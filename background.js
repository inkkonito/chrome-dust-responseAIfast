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

        // Extract answer and structured links from response
        const answer = extractAnswer(response);
        const structuredLinks = extractStructuredLinks(response);

        // Save to history
        const entry = await saveToHistory(request, response, sender, duration);

        sendResponse({
          success: true,
          data: response,
          answer: answer,
          links: structuredLinks,
          conversationId: extractConversationId(response),
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
  // Extract structured links from conversation response
  const structuredLinks = isError ? [] : extractStructuredLinks(response);
  // Extract conversation ID from response
  const conversationId = isError ? null : extractConversationId(response);

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

/**
 * Extract structured links from Dust API response
 * @param {Object} data - Full API response data
 * @returns {Array<{uri: string, text: string}>} Array of link objects with uri and text
 */
function extractStructuredLinks(data) {
  try {
    // Navigate to: conversation.content[1][0].actions
    const assistantMessage = data?.conversation?.content?.[1]?.[0];
    if (!assistantMessage) {
      return [];
    }

    // Check if actions array exists
    if (!Array.isArray(assistantMessage.actions) || assistantMessage.actions.length === 0) {
      return [];
    }

    // Iterate through ALL actions to find resources (they may be in actions[0], actions[1], etc.)
    const allLinks = [];
    const seenUris = new Set(); // Track URIs to avoid duplicates

    for (let i = 0; i < assistantMessage.actions.length; i++) {
      const outputArray = assistantMessage.actions[i]?.output;

      if (!Array.isArray(outputArray) || outputArray.length === 0) {
        continue; // Skip this action if no output array
      }

      // Extract uri and text from each output item's resource
      const links = outputArray
        .filter(item => item.type === 'resource' && item.resource) // Only resource items
        .map(item => ({
          uri: item.resource.uri,  // lowercase 'uri'
          text: item.resource.text  // lowercase 'text'
        }))
        .filter(link => link.uri && link.text) // Only include items with both fields
        .filter(link => {
          // Deduplicate by URI
          if (seenUris.has(link.uri)) {
            return false;
          }
          seenUris.add(link.uri);
          return true;
        });

      if (links.length > 0) {
        console.log(`[Dust] Found ${links.length} unique links in actions[${i}]`);
        allLinks.push(...links);
      }
    }

    console.log('[Dust] Total extracted unique links:', allLinks.length);
    return allLinks;
  } catch (error) {
    console.error('[Dust] Error extracting structured links:', error);
    return [];
  }
}

/**
 * Extract conversation ID from Dust API response
 * @param {Object} data - API response data
 * @returns {string|null} Conversation ID (sId) or null
 */
function extractConversationId(data) {
  try {
    return data?.conversation?.sId || null;
  } catch (error) {
    console.error('[Dust] Error extracting conversation ID:', error);
    return null;
  }
}
