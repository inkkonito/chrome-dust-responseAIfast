/**
 * Response parsing utilities for Dust API
 */

/**
 * Extract answer text from Dust API response
 * @param {Object} data - API response data
 * @returns {string|null} Extracted answer or null
 */
function extractAnswer(data) {
  try {
    if (data.conversation?.content && Array.isArray(data.conversation.content)) {
      if (data.conversation.content.length > 1) {
        const assistantMessage = data.conversation.content[1];

        if (Array.isArray(assistantMessage) && assistantMessage.length > 0) {
          return assistantMessage[0].content || null;
        } else if (assistantMessage?.content) {
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
 * @returns {Array<{uri: string, text: string}>} Array of link objects
 */
function extractStructuredLinks(data) {
  try {
    const assistantMessage = data?.conversation?.content?.[1]?.[0];
    if (!assistantMessage) return [];

    if (!Array.isArray(assistantMessage.actions) || assistantMessage.actions.length === 0) {
      return [];
    }

    const allLinks = [];
    const seenUris = new Set();

    for (let i = 0; i < assistantMessage.actions.length; i++) {
      const outputArray = assistantMessage.actions[i]?.output;

      if (!Array.isArray(outputArray) || outputArray.length === 0) {
        continue;
      }

      const links = outputArray
        .filter(item => item.type === 'resource' && item.resource)
        .map(item => ({
          uri: item.resource.uri,
          text: item.resource.text
        }))
        .filter(link => link.uri && link.text)
        .filter(link => {
          if (seenUris.has(link.uri)) return false;
          seenUris.add(link.uri);
          return true;
        });

      if (links.length > 0) {
        allLinks.push(...links);
      }
    }

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

// Export Response utilities
const Response = {
  extractAnswer,
  extractStructuredLinks,
  extractConversationId
};

if (typeof window !== 'undefined') {
  window.Response = Response;
}
