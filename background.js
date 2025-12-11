// Background service worker for making API calls via CORS proxy
// Direct calls fail because chrome-extension:// origin is blocked by Dust API

// Import storage utilities
importScripts('utils/storage.js');

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

        // Save to history
        const entry = await saveToHistory(request, response, sender, duration);

        sendResponse({ success: true, data: response, historyId: entry.id });
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

  if (request.action === 'exportHistory') {
    HistoryStorage.exportHistory()
      .then(json => sendResponse({ success: true, data: json }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function makeApiCall(apiUrl, apiKey, requestBody) {
  console.log('Making API call via proxy:', PROXY_URL);

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
    })
  });

  console.log('Proxy response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Proxy error (${response.status}): ${errorText}`);
  }

  const responseData = await response.json();
  return responseData;
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
  const answer = isError ? null : extractAnswer(response);

  // Get current config for agentId
  const config = await chrome.storage.sync.get(null);

  const entry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    pageUrl: sender.tab?.url || 'unknown',
    pageTitle: sender.tab?.title || 'Unknown Page',
    selectedText: request.selectedText || '',
    query: request.selectedText || '',
    answer: answer,
    error: isError ? response.error : null,
    agentId: config.agentId || null,
    duration: duration
  };

  // Save using HistoryStorage
  const id = await HistoryStorage.addEntry(entry);

  // Return the entry with confirmed ID
  return { ...entry, id };
}

/**
 * Extract answer text from Dust API response
 * @param {Object} data - API response data
 * @returns {string|null} Extracted answer or null
 */
function extractAnswer(data) {
  try {
    if (data.conversation && data.conversation.content && Array.isArray(data.conversation.content)) {
      // content[0] is the user message, content[1] is the assistant response
      if (data.conversation.content.length > 1) {
        const assistantMessage = data.conversation.content[1];

        // Check if it's an array with content
        if (Array.isArray(assistantMessage) && assistantMessage.length > 0) {
          return assistantMessage[0].content || null;
        } else if (assistantMessage && assistantMessage.content) {
          return assistantMessage.content;
        }
      }
    }
  } catch (error) {
    console.error('Error extracting answer:', error);
  }

  return null;
}
