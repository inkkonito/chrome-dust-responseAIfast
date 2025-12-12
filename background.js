// Background service worker for making API calls via CORS proxy
// Direct calls fail because chrome-extension:// origin is blocked by Dust API

// Import storage utilities
importScripts('utils/storage.js');
importScripts('utils/response.js');

// IMPORTANT: Replace this with your Cloudflare Worker URL after deployment
// See DEPLOY_PROXY.md for instructions
const PROXY_URL = 'https://dust-proxy.pro-julienp.workers.dev';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'makeApiCall') {
    // Handle API call from test page
    makeApiCall(request.apiUrl, request.apiKey, request.requestBody)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep the message channel open for async response
  }

  if (request.action === 'makeApiCallWithHistory') {
    // Handle API call from content script with history saving
    const startTime = Date.now();
    makeApiCall(request.apiUrl, request.apiKey, request.requestBody)
      .then(async response => {
        const duration = Date.now() - startTime;

        // Extract answer and structured links from response
        const answer = Response.extractAnswer(response);
        const structuredLinks = Response.extractStructuredLinks(response);

        // Save to history
        const entry = await saveToHistory(request, response, sender, duration);

        sendResponse({
          success: true,
          data: response,
          answer: answer,
          links: structuredLinks,
          conversationId: Response.extractConversationId(response),
          historyId: entry.id
        });
      })
      .catch(async error => {
        const duration = Date.now() - startTime;

        // Save error to history
        const entry = await saveToHistory(request, { error: error.message }, sender, duration, true);

        sendResponse({ success: false, error: error.message, historyId: entry.id });
      });
    return true;
  }

  // History management actions
  if (request.action === 'getHistory') {
    HistoryStorage.getHistory()
      .then(history => sendResponse({ success: true, data: history }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'getRecentHistory') {
    HistoryStorage.getRecentHistory(request.limit || 5)
      .then(history => sendResponse({ success: true, data: history }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'deleteHistoryEntry') {
    HistoryStorage.deleteEntry(request.id)
      .then(success => sendResponse({ success }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'deleteHistoryEntries') {
    HistoryStorage.deleteEntries(request.ids)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message, deletedCount: 0, failedIds: request.ids }));
    return true;
  }

  if (request.action === 'clearHistory') {
    HistoryStorage.clearHistory()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'searchHistory') {
    HistoryStorage.searchHistory(request.searchTerm)
      .then(history => sendResponse({ success: true, data: history }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'openHistory') {
    // Open history page in a new tab
    chrome.tabs.create({ url: 'history.html' });
    return true;
  }
});

async function makeApiCall(apiUrl, apiKey, requestBody) {
  console.log('Making API call via proxy:', PROXY_URL);

  // Create AbortController with 30-second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    // Call the proxy instead of Dust API directly
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        apiUrl: apiUrl,
        apiKey: apiKey,
        requestBody: requestBody
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    console.log('Proxy response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Proxy error (${response.status}): ${errorText}`);
    }

    const responseData = await response.json();
    return responseData;
  } catch (error) {
    clearTimeout(timeoutId);

    // Provide clear error messages
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 30 seconds. Please check your network connection.');
    }
    throw error;
  }
}

/**
 * Save API call to history
 * @param {Object} request - Original request object
 * @param {Object} response - API response object
 * @param {Object} sender - Chrome message sender object
 * @param {number} duration - Request duration in milliseconds
 * @param {boolean} isError - Whether this was an error response
 * @returns {Promise<Object>} Saved history entry
 */
async function saveToHistory(request, response, sender, duration, isError = false) {
  // Extract answer from conversation response
  const answer = isError ? null : Response.extractAnswer(response);
  // Extract structured links from conversation response
  const structuredLinks = isError ? [] : Response.extractStructuredLinks(response);
  // Extract conversation ID from response
  const conversationId = isError ? null : Response.extractConversationId(response);

  // Get current config for agentId and workspaceId
  const config = await chrome.storage.sync.get(null);

  const entry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    pageUrl: sender.tab?.url || 'unknown',
    pageTitle: sender.tab?.title || 'Unknown Page',
    selectedText: request.selectedText || '',
    query: request.selectedText || '',
    answer: answer,
    links: structuredLinks,
    conversationId: conversationId,
    workspaceId: config.workspaceId || null,
    error: isError ? response.error : null,
    agentId: config.agentId || null,
    duration: duration
  };

  // Save using HistoryStorage
  const id = await HistoryStorage.addEntry(entry);

  // Return the entry with confirmed ID
  return { ...entry, id };
}

// Extract functions are now provided by utils/response.js
