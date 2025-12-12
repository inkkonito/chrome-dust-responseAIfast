// Content script for text selection and response display

// Store current links for copy functionality
let currentLinks = [];

// Store abort controller for cancellation
let currentAbortController = null;

// Store current timer interval
let currentTimerInterval = null;

// Store timer seconds elapsed
let secondsElapsed = 0;

// Store click outside listener for cleanup
let clickOutsideListener = null;

// Formatting utilities
const Formatting = {
  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Extract all HTTP/HTTPS URLs from text
   * @param {string} text - The text to extract URLs from
   * @returns {Array<string>} Array of unique URLs
   */
  extractUrls(text) {
    if (!text) return [];

    // Regex to match HTTP/HTTPS URLs
    const urlRegex = /https?:\/\/[^\s<>"'\)]+/gi;
    const matches = text.match(urlRegex) || [];

    // Deduplicate URLs
    const uniqueUrls = [...new Set(matches)];

    // Validate URLs
    return uniqueUrls.filter(url => {
      try {
        new URL(url);
        return true;
      } catch (e) {
        return false;
      }
    });
  },

  /**
   * Create HTML for links section from structured link objects
   * @param {Array<{uri: string, text: string}>} links - Array of link objects with uri and text
   * @returns {string} HTML string for links section
   */
  createLinksSection(links) {
    if (!links || links.length === 0) return '';

    const linksHtml = links.map(link => {
      const safeUri = this.escapeHtml(link.uri || '');
      const safeText = this.escapeHtml(link.text || link.uri || 'Link');

      return `<li style="margin-bottom: 0;"><a href="${safeUri}" target="_blank" rel="noopener noreferrer" style="color: #528c8e; text-decoration: none; word-break: break-word;">${safeText}</a></li>`;
    }).join('');

    return `<div style="margin-top: 32px; padding-top: 24px; border-top: 2px solid rgba(82, 140, 142, 0.3);"><h3 style="font-size: 18px; font-weight: 600; color: #0b465e; margin-bottom: 16px;">🔗 Links</h3><ul style="margin: 0; padding-left: 24px; list-style-type: disc;">${linksHtml}</ul></div>`;
  }
};

// Toast notification utility (inline for content script)
const Toast = {
  show(message, type = 'info', duration = 3000) {
    const existing = document.getElementById('dust-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'dust-toast';
    toast.className = `dust-toast dust-toast-${type}`;

    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };

    toast.innerHTML = `
      <span class="dust-toast-icon">${icons[type]}</span>
      <span class="dust-toast-message">${message}</span>
    `;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('dust-toast-show');
    });

    setTimeout(() => {
      toast.classList.remove('dust-toast-show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success(message, duration) {
    this.show(message, 'success', duration);
  },

  error(message, duration) {
    this.show(message, 'error', duration);
  },

  info(message, duration) {
    this.show(message, 'info', duration);
  },

  warning(message, duration) {
    this.show(message, 'warning', duration);
  }
};

// Prevent multiple injections
if (window.dustContentScriptLoaded) {
  console.log('[Dust] Content script already loaded, skipping initialization');
  // Just trigger activation if requested
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
      sendResponse({ loaded: true });
      return true;
    }
    if (request.action === 'activateSelection') {
      if (window.dustActivateSelection) {
        window.dustActivateSelection();
      }
      sendResponse({ success: true });
      return true;
    }
  });
} else {
  window.dustContentScriptLoaded = true;
  console.log('[Dust] Initializing content script...');

(function() {
  'use strict';

  // State management
  let isSelectionModeActive = false;
  let sidePanelOpen = false;

  // Create overlay elements (will be injected on activation)
  let overlayContainer = null;
  let selectionBanner = null;
  let askButton = null;
  let sidePanel = null;

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
      sendResponse({ loaded: true });
      return true;
    }

    if (request.action === 'activateSelection') {
      activateSelectionMode();
      sendResponse({ success: true });
      return true;
    }

    if (request.action === 'deactivateSelection') {
      deactivateSelectionMode();
      sendResponse({ success: true });
      return true;
    }

    if (request.action === 'displayHistoryEntry') {
      try {
        displayHistoryEntryInSidebar(request.entry);
        sendResponse({ success: true });
      } catch (error) {
        console.error('[Dust] Error displaying history entry:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }

    return false;
  });

/**
 * Display a history entry in the full sidebar view
 * @param {Object} entry - History entry with answer, links, conversationId, workspaceId
 */
async function displayHistoryEntryInSidebar(entry) {
  console.log('[Dust] Displaying history entry in sidebar:', entry);

  // Show sidebar if not already open
  if (!sidePanelOpen) {
    showSidePanel();
  }

  // Display the response with all details
  await displayResponse(entry.answer, entry.links, entry.conversationId);

  console.log('[Dust] History entry displayed in sidebar');
}

/**
 * Activate text selection mode
 */
function activateSelectionMode() {
  if (isSelectionModeActive) return;

  isSelectionModeActive = true;

  // Create and inject overlay UI
  createOverlay();

  // Add event listeners
  document.addEventListener('mouseup', handleTextSelection);
  document.addEventListener('keydown', handleEscapeKey);

  console.log('Selection mode activated');
}

/**
 * Deactivate text selection mode
 */
function deactivateSelectionMode() {
  if (!isSelectionModeActive) return;

  isSelectionModeActive = false;

  // Remove overlay
  if (overlayContainer && overlayContainer.parentNode) {
    overlayContainer.parentNode.removeChild(overlayContainer);
  }

  // Hide ask button if visible
  if (askButton && askButton.parentNode) {
    askButton.parentNode.removeChild(askButton);
  }

  // Remove event listeners
  document.removeEventListener('mouseup', handleTextSelection);
  document.removeEventListener('keydown', handleEscapeKey);

  // Reset references
  overlayContainer = null;
  selectionBanner = null;
  askButton = null;

  console.log('Selection mode deactivated');
}

/**
 * Create overlay UI elements
 */
function createOverlay() {
  // Create overlay container
  overlayContainer = document.createElement('div');
  overlayContainer.id = 'dust-selection-overlay';
  overlayContainer.className = 'dust-overlay';

  // Create banner
  selectionBanner = document.createElement('div');
  selectionBanner.id = 'dust-selection-banner';
  selectionBanner.className = 'dust-banner';
  selectionBanner.innerHTML = `
    <div class="dust-banner-content">
      <span class="dust-banner-icon">🔍</span>
      <span class="dust-banner-text">Select text on this page to ask AI</span>
      <button class="dust-banner-close" id="dust-banner-close">ESC to cancel</button>
    </div>
  `;

  overlayContainer.appendChild(selectionBanner);
  document.body.appendChild(overlayContainer);

  // Add click handler for close button
  const closeBtn = document.getElementById('dust-banner-close');
  closeBtn.addEventListener('click', deactivateSelectionMode);
}

/**
 * Handle text selection
 */
function handleTextSelection(event) {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  // Remove old ask button if exists
  if (askButton && askButton.parentNode) {
    askButton.parentNode.removeChild(askButton);
  }

  // Only show button if text is selected
  if (selectedText && selectedText.length > 0) {
    showAskButton(event.pageX, event.pageY, selectedText);
  }
}

/**
 * Show "Ask AI" button near selection
 */
function showAskButton(x, y, selectedText) {
  console.log('[Dust] showAskButton called with text:', selectedText.substring(0, 50) + '...');

  askButton = document.createElement('button');
  askButton.id = 'dust-ask-button';
  askButton.className = 'dust-ask-btn';
  askButton.textContent = '✨ Ask AI';
  askButton.type = 'button'; // Explicit button type

  // CRITICAL: Add inline styles to make it absolutely clickable
  askButton.style.cssText = `
    position: fixed !important;
    left: ${x}px !important;
    top: ${y + 10}px !important;
    z-index: 2147483647 !important;
    padding: 12px 24px !important;
    background: linear-gradient(135deg, #528c8e 0%, #0b465e 100%) !important;
    color: white !important;
    border: none !important;
    border-radius: 8px !important;
    font-size: 16px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    pointer-events: auto !important;
    box-shadow: 0 4px 15px rgba(11, 70, 94, 0.4) !important;
    transition: transform 0.2s !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  `;

  // CRITICAL: Stop mouseup from bubbling BEFORE onclick fires
  // This prevents handleTextSelection from removing the button
  askButton.onmousedown = function(e) {
    console.log('[Dust] Button MOUSEDOWN detected');
    e.stopPropagation();
    e.preventDefault();
  };

  askButton.onmouseup = function(e) {
    console.log('[Dust] Button MOUSEUP detected - stopping propagation!');
    e.stopPropagation();
    e.preventDefault();
  };

  // Now onclick will fire without interference
  askButton.onclick = async function(event) {
    console.log('[Dust] ========== Ask AI button CLICKED! ==========');

    // Disable button immediately to prevent double clicks and add loading animation
    askButton.disabled = true;
    askButton.classList.add('loading');
    askButton.textContent = '⏳ Loading...';

    // Show side panel IMMEDIATELY and SYNCHRONOUSLY
    console.log('[Dust] About to show side panel...');
    showSidePanel();
    console.log('[Dust] Side panel shown');

    // Force a reflow to ensure panel is rendered
    void sidePanel.offsetHeight;

    try {
      console.log('[Dust] Starting API call...');
      await handleAskAI(selectedText);
      console.log('[Dust] handleAskAI completed');
    } catch (error) {
      console.error('[Dust] Error in Ask AI button handler:', error);
      displayError(error.message);
    }

    // Remove ask button after click
    if (askButton && askButton.parentNode) {
      askButton.parentNode.removeChild(askButton);
    }

    // Deactivate selection mode
    deactivateSelectionMode();

    return false;
  };

  console.log('[Dust] Appending Ask AI button to body');
  document.body.appendChild(askButton);
  console.log('[Dust] Ask AI button appended successfully, button element:', askButton);
  console.log('[Dust] Button position:', askButton.getBoundingClientRect());
}

/**
 * Handle ESC key to cancel selection mode
 */
function handleEscapeKey(event) {
  if (event.key === 'Escape') {
    deactivateSelectionMode();
  }
}

/**
 * Make API call with selected text
 */
async function handleAskAI(selectedText) {
  console.log('[Dust] handleAskAI called with text:', selectedText.substring(0, 50) + '...');

  try {
    // Clear any existing timer first to prevent multiple timers running
    if (currentTimerInterval) {
      clearInterval(currentTimerInterval);
      currentTimerInterval = null;
    }

    // Reset timer counter
    secondsElapsed = 0;

    // Show loading state with timer and cancel button
    console.log('[Dust] Setting loading content...');
    updateSidePanelContent(`
      <div class="dust-loading">
        <div class="dust-spinner"></div>
        <p>Asking AI... <span id="dust-timer" style="color: #528c8e; font-weight: 600;">0s</span></p>
        <button id="dust-cancel-btn" class="dust-cancel-btn">Cancel Request</button>
      </div>
    `);

    // Start timer
    currentTimerInterval = setInterval(() => {
      secondsElapsed++;
      const timerEl = document.getElementById('dust-timer');
      if (timerEl) {
        timerEl.textContent = `${secondsElapsed}s`;
      } else {
        // Timer element gone, clear interval
        if (currentTimerInterval) {
          clearInterval(currentTimerInterval);
          currentTimerInterval = null;
        }
      }
    }, 1000);

    // Add cancel button handler
    const cancelBtn = document.getElementById('dust-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent click from bubbling to document
        if (currentTimerInterval) {
          clearInterval(currentTimerInterval);
          currentTimerInterval = null;
        }
        Toast.warning('Request cancelled by user');
        closeSidePanel();
        restoreButtonState();
      });
    }

    console.log('[Dust] Loading content set');

    // Get configuration
    console.log('[Dust] Getting configuration...');
    const config = await chrome.storage.sync.get(null);
    console.log('[Dust] Config loaded:', { apiKey: config.apiKey ? 'present' : 'missing', workspaceId: config.workspaceId });

    if (!config.apiKey || !config.workspaceId) {
      throw new Error('API not configured. Please go to extension setup.');
    }

    // Build request body
    const requestBody = buildRequestBody(selectedText, config);
    const apiUrl = `https://eu.dust.tt/api/v1/w/${config.workspaceId}/assistant/conversations`;
    console.log('[Dust] API URL:', apiUrl);
    console.log('[Dust] Request body:', requestBody);

    // Make API call via background script with history saving
    console.log('[Dust] Sending message to background script...');
    const response = await chrome.runtime.sendMessage({
      action: 'makeApiCallWithHistory',
      apiUrl: apiUrl,
      apiKey: config.apiKey,
      requestBody: requestBody,
      selectedText: selectedText
    });
    console.log('[Dust] Response received:', response);

    // Clear timer on response
    if (currentTimerInterval) {
      clearInterval(currentTimerInterval);
      currentTimerInterval = null;
    }

    if (response.success) {
      console.log('[Dust] API Response successful:', response.data);
      const answer = response.answer || extractAnswer(response.data);
      const structuredLinks = response.links || [];
      const conversationId = response.conversationId || null;
      console.log('[Dust] Extracted answer length:', answer ? answer.length : 0);
      console.log('[Dust] Structured links count:', structuredLinks.length);
      console.log('[Dust] Conversation ID:', conversationId);
      displayResponse(answer, structuredLinks, conversationId);

      // Restore button state after successful response
      restoreButtonState();
    } else {
      console.error('[Dust] API call failed:', response.error);
      throw new Error(response.error);
    }
  } catch (error) {
    console.error('[Dust] Error in handleAskAI:', error);

    // Clear timer on error
    if (currentTimerInterval) {
      clearInterval(currentTimerInterval);
      currentTimerInterval = null;
    }

    // Show error with retry button
    displayErrorWithRetry(error.message, selectedText);

    // Restore button state after error
    restoreButtonState();
  }
}

/**
 * Restore Ask AI button to normal state
 */
function restoreButtonState() {
  if (askButton) {
    askButton.disabled = false;
    askButton.classList.remove('loading');
    askButton.textContent = '✨ Ask AI';
    console.log('[Dust] Button state restored');
  }
}

/**
 * Build request body for Dust API
 */
function buildRequestBody(message, config) {
  const requestBody = {
    message: {
      content: message,
      mentions: buildMentions(config.agentId),
      context: buildContext(config)
    },
    blocking: true
  };

  if (config.requestConfig?.title && config.requestConfig.title.trim()) {
    requestBody.title = config.requestConfig.title.trim();
  }

  if (config.requestConfig?.skipToolsValidation) {
    requestBody.skipToolsValidation = true;
  }

  return requestBody;
}

function buildMentions(agentId) {
  if (agentId && agentId.trim()) {
    return [{ configurationId: agentId.trim() }];
  }
  return [];
}

function buildContext(config) {
  const username = config.userContext?.username?.trim() || 'user-' + Math.random().toString(36).substr(2, 9);
  const timezone = config.userContext?.timezone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';

  return {
    username: username,
    timezone: timezone
  };
}

/**
 * Extract answer from API response
 */
function extractAnswer(data) {
  try {
    if (data.conversation && data.conversation.content && Array.isArray(data.conversation.content)) {
      if (data.conversation.content.length > 1) {
        const assistantMessage = data.conversation.content[1];

        if (Array.isArray(assistantMessage) && assistantMessage.length > 0) {
          return assistantMessage[0].content || '';
        } else if (assistantMessage && assistantMessage.content) {
          return assistantMessage.content;
        }
      }
    }
  } catch (error) {
    console.error('Error extracting answer:', error);
  }

  return JSON.stringify(data, null, 2);
}

/**
 * Show side panel
 */
function showSidePanel() {
  console.log('[Dust] showSidePanel called, sidePanelOpen:', sidePanelOpen);

  if (sidePanelOpen) {
    console.log('[Dust] Side panel already open, skipping');
    return;
  }

  // Create side panel
  console.log('[Dust] Creating side panel element...');
  sidePanel = document.createElement('div');
  sidePanel.id = 'dust-side-panel';
  sidePanel.className = 'dust-side-panel';

  // Add inline styles for clean, readable panel
  sidePanel.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    right: 0 !important;
    width: 500px !important;
    height: 100vh !important;
    background-color: #ffffff !important;
    box-shadow: -2px 0 24px rgba(0, 0, 0, 0.12) !important;
    z-index: 2147483647 !important;
    display: flex !important;
    flex-direction: column !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    transition: width 0.3s ease !important;
  `;

  // Panel header
  const header = document.createElement('div');
  header.className = 'dust-panel-header';
  header.style.cssText = `
    padding: 20px !important;
    background-color: #0b465e !important;
    border-bottom: 1px solid #e0e0e0 !important;
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
  `;

  // Get the icon URL using chrome.runtime.getURL for proper extension resource access
  const iconUrl = chrome.runtime.getURL('icon/favicon-32x32-1.png');

  header.innerHTML = `
    <h2 class="dust-panel-title" style="margin: 0; font-size: 18px; font-weight: 600; color: #ffffff; display: flex; align-items: center; gap: 8px;">
      <img src="${iconUrl}" alt="DataDome" style="width: 20px; height: 20px; display: inline-block;">
      Dust AI Response
    </h2>
    <div style="display: flex; gap: 8px; align-items: center;">
      <button class="dust-panel-expand" id="dust-panel-expand" style="background: none; border: none; font-size: 22px; cursor: pointer; padding: 6px; color: #ffffff; line-height: 1; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 4px; transition: background 0.2s;" title="Expand panel">⇔</button>
      <button class="dust-panel-close" id="dust-panel-close" style="background: none; border: none; font-size: 22px; cursor: pointer; padding: 6px; color: #ffffff; line-height: 1; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 4px; transition: background 0.2s;" title="Close">✕</button>
    </div>
  `;

  // Panel content with improved readability
  const content = document.createElement('div');
  content.id = 'dust-panel-content';
  content.className = 'dust-panel-content';
  content.style.cssText = `
    flex: 1 !important;
    overflow-y: auto !important;
    padding: 30px !important;
    background-color: rgba(82, 140, 142, 0.03) !important;
    font-size: 16px !important;
    line-height: 1.8 !important;
    color: #0b465e !important;
  `;

  // Panel footer
  const footer = document.createElement('div');
  footer.className = 'dust-panel-footer';
  footer.style.cssText = `
    padding: 15px 20px !important;
    border-top: 1px solid #e0e0e0 !important;
    background-color: rgba(82, 140, 142, 0.05) !important;
    display: flex !important;
    gap: 10px !important;
  `;
  footer.innerHTML = `
    <button class="dust-btn dust-btn-secondary" id="dust-copy-btn" style="flex: 1; padding: 10px; border: none; border-radius: 6px; background: #528c8e; color: white; cursor: pointer; transition: background 0.2s;">📋 Copy Answer</button>
    <button class="dust-btn dust-btn-secondary" id="dust-copy-links-btn" style="flex: 1; padding: 10px; border: none; border-radius: 6px; background: #528c8e; color: white; cursor: pointer; transition: background 0.2s;">🔗 Copy Links</button>
    <button class="dust-btn dust-btn-secondary" id="dust-history-btn" style="flex: 1; padding: 10px; border: none; border-radius: 6px; background: #528c8e; color: white; cursor: pointer; transition: background 0.2s;">📚 View History</button>
  `;

  sidePanel.appendChild(header);
  sidePanel.appendChild(content);
  sidePanel.appendChild(footer);

  console.log('[Dust] Appending side panel to body...');

  if (!document.body) {
    console.error('[Dust] document.body is null!');
    return;
  }

  document.body.appendChild(sidePanel);
  console.log('[Dust] Side panel appended, element:', sidePanel);
  console.log('[Dust] Side panel in DOM:', document.getElementById('dust-side-panel') !== null);
  console.log('[Dust] Side panel position:', sidePanel.getBoundingClientRect());

  // Add event listeners
  const closeBtn = document.getElementById('dust-panel-close');
  const expandBtn = document.getElementById('dust-panel-expand');
  const copyBtn = document.getElementById('dust-copy-btn');
  const copyLinksBtn = document.getElementById('dust-copy-links-btn');
  const historyBtn = document.getElementById('dust-history-btn');

  if (closeBtn) closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeSidePanel();
  });
  if (expandBtn) expandBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePanelWidth();
  });
  if (copyBtn) copyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    copyAnswer();
  });
  if (copyLinksBtn) copyLinksBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    copyLinks();
  });
  if (historyBtn) historyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openHistory();
  });

  // Add click outside listener to close sidebar
  clickOutsideListener = (event) => {
    // Check if click is outside the sidebar
    if (sidePanel && !sidePanel.contains(event.target)) {
      closeSidePanel();
    }
  };

  // Add listener after a short delay to avoid immediate closing from the button that opened it
  setTimeout(() => {
    document.addEventListener('click', clickOutsideListener);
  }, 100);

  sidePanelOpen = true;

  // Track panel width state
  sidePanel.dataset.expanded = 'false';

  // Make absolutely sure it's visible
  console.log('[Dust] Panel computed style:', window.getComputedStyle(sidePanel).display);
  console.log('[Dust] Panel parent:', sidePanel.parentElement);

  // Trigger animation
  console.log('[Dust] Triggering slide-in animation...');
  setTimeout(() => {
    sidePanel.classList.add('dust-panel-open');
    console.log('[Dust] Animation triggered, classes:', sidePanel.className);
  }, 10);
}

/**
 * Toggle panel width between normal and expanded
 */
function togglePanelWidth() {
  if (!sidePanel) return;

  const expandBtn = document.getElementById('dust-panel-expand');
  const isExpanded = sidePanel.dataset.expanded === 'true';

  if (isExpanded) {
    // Collapse to normal width
    sidePanel.style.width = '500px';
    sidePanel.dataset.expanded = 'false';
    if (expandBtn) expandBtn.textContent = '⇔';
    if (expandBtn) expandBtn.title = 'Expand panel';
  } else {
    // Expand to wider width
    sidePanel.style.width = '800px';
    sidePanel.dataset.expanded = 'true';
    if (expandBtn) expandBtn.textContent = '⇄';
    if (expandBtn) expandBtn.title = 'Collapse panel';
  }

  console.log('[Dust] Panel width toggled to:', sidePanel.style.width);
}

/**
 * Close side panel with smooth animation
 */
function closeSidePanel() {
  if (!sidePanelOpen || !sidePanel) return;

  console.log('[Dust] Closing side panel with animation...');

  // Remove click outside listener
  if (clickOutsideListener) {
    document.removeEventListener('click', clickOutsideListener);
    clickOutsideListener = null;
  }

  // Trigger closing animation by removing the open class
  sidePanel.classList.remove('dust-panel-open');

  // Wait for animation to complete (300ms) before removing from DOM
  setTimeout(() => {
    if (sidePanel && sidePanel.parentNode) {
      sidePanel.parentNode.removeChild(sidePanel);
      console.log('[Dust] Side panel removed from DOM');
    }
    sidePanel = null;
    sidePanelOpen = false;
  }, 300); // Match CSS transition duration
}

/**
 * Update side panel content
 */
function updateSidePanelContent(html) {
  const content = document.getElementById('dust-panel-content');
  if (content) {
    content.innerHTML = html;

    // Inject additional styles if not already present
    if (!document.getElementById('dust-additional-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'dust-additional-styles';
      styleEl.textContent = `
        .dust-cancel-btn {
          margin-top: 15px;
          padding: 8px 16px;
          background: #e74c3c;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          transition: background 0.2s;
        }
        .dust-cancel-btn:hover {
          background: #c0392b;
        }
        .dust-error-icon {
          font-size: 48px;
          text-align: center;
          margin-bottom: 16px;
        }
        .dust-error-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        .dust-btn-primary {
          padding: 10px 20px;
          background: #528c8e;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          flex: 1;
          font-size: 14px;
          transition: background 0.2s;
        }
        .dust-btn-primary:hover {
          background: #6a9c9e;
        }
        .dust-btn-secondary {
          padding: 10px 20px;
          background: #ecf0f1;
          color: #0b465e;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          flex: 1;
          font-size: 14px;
          transition: background 0.2s;
        }
        .dust-btn-secondary:hover {
          background: #d5dbdd;
        }
        /* Link hover state in answer text */
        .dust-response a:hover {
          color: #6a9c9e !important;
          text-decoration: underline !important;
        }
      `;
      document.head.appendChild(styleEl);
    }
  }
}

/**
 * Inject structured links into answer text as markdown links
 * Converts plain text mentions to [text](url) format
 * @param {string} answer - Answer text with plain mentions
 * @param {Array} links - Structured links [{text, uri}]
 * @returns {string} Answer with injected markdown links
 */
function injectLinksIntoAnswer(answer, links) {
  if (!links || links.length === 0) return answer;

  console.log('[Dust] Injecting links into answer');
  console.log('[Dust] Number of links:', links.length);
  console.log('[Dust] Links:', links);

  let processedAnswer = answer;

  // Sort links by text length (longest first) to avoid partial matches
  const sortedLinks = [...links].sort((a, b) =>
    (b.text || b.uri).length - (a.text || a.uri).length
  );

  sortedLinks.forEach((link, index) => {
    const linkText = link.text || link.uri;
    if (!linkText || !link.uri) return;

    console.log(`[Dust] Processing link ${index + 1}:`, { text: linkText, uri: link.uri });

    // Escape special regex characters in the link text
    const escapedText = linkText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    console.log(`[Dust] Escaped text: "${escapedText}"`);

    // Check if link text exists in answer (for debugging)
    if (answer.includes(linkText)) {
      console.log(`[Dust] ✅ Found exact match for: "${linkText}"`);
    } else {
      console.log(`[Dust] ❌ No exact match for: "${linkText}"`);
    }

    // Create regex patterns to match:
    // 1. Plain text with optional colon and optional parenthetical URL
    // 2. Not already in markdown link format [text](url)

    // Pattern 1: "Text: (https://...)" - with trailing colon and URL
    const patternWithColonAndUrl = new RegExp(
      `(?<!\\[)${escapedText}:\\s*\\(https?:\\/\\/[^)]+\\)`,
      'g'
    );

    // Pattern 2: "Text: Any additional text" - with trailing colon and text continuation
    // This handles cases like "DataDome API Protection: Safeguard APIs..."
    const patternWithColonAndText = new RegExp(
      `(?<!\\[)${escapedText}:[^\\n\\[]*?(?=\\n|$)`,
      'g'
    );

    // Pattern 3: "Text:" - with trailing colon only (exact match)
    const patternWithColon = new RegExp(
      `(?<!\\[)${escapedText}:(?!\\])`,
      'g'
    );

    // Pattern 4: "Text" - plain text without colon
    const patternPlain = new RegExp(
      `(?<!\\[)${escapedText}(?!\\]\\(|:)`,
      'g'
    );

    // Try patterns in order and log matches
    let replaced = false;

    // Try Pattern 1
    if (patternWithColonAndUrl.test(processedAnswer)) {
      console.log(`[Dust] Matched Pattern 1 (with colon and URL) for: "${linkText}"`);
      processedAnswer = processedAnswer.replace(patternWithColonAndUrl, `[${linkText}](${link.uri})`);
      replaced = true;
    }
    patternWithColonAndUrl.lastIndex = 0; // Reset regex

    // Try Pattern 2 (new pattern for text continuation)
    if (!replaced && patternWithColonAndText.test(processedAnswer)) {
      console.log(`[Dust] Matched Pattern 2 (with colon and text) for: "${linkText}"`);
      processedAnswer = processedAnswer.replace(patternWithColonAndText, `[${linkText}](${link.uri})`);
      replaced = true;
    }
    patternWithColonAndText.lastIndex = 0; // Reset regex

    // Try Pattern 3
    if (!replaced && patternWithColon.test(processedAnswer)) {
      console.log(`[Dust] Matched Pattern 3 (with colon only) for: "${linkText}"`);
      processedAnswer = processedAnswer.replace(patternWithColon, `[${linkText}](${link.uri})`);
      replaced = true;
    }
    patternWithColon.lastIndex = 0; // Reset regex

    // Try Pattern 4
    if (!replaced && patternPlain.test(processedAnswer)) {
      console.log(`[Dust] Matched Pattern 4 (plain text) for: "${linkText}"`);
      processedAnswer = processedAnswer.replace(patternPlain, `[${linkText}](${link.uri})`);
      replaced = true;
    }

    if (!replaced) {
      console.log(`[Dust] ⚠️ No pattern matched for: "${linkText}"`);
    }
  });

  console.log('[Dust] Link injection complete');
  console.log('[Dust] Processed answer preview:', processedAnswer.substring(0, 500));

  return processedAnswer;
}

/**
 * Display response in side panel
 */
async function displayResponse(answer, structuredLinks = [], conversationId = null) {
  console.log('[Dust] displayResponse called, answer length:', answer ? answer.length : 0);
  console.log('[Dust] Structured links:', structuredLinks.length);
  console.log('[Dust] Conversation ID:', conversationId);

  // Store links globally for copy functionality
  currentLinks = structuredLinks || [];

  // Update Copy Links button state
  updateCopyLinksButtonState();

  try {
    // Inject structured links into answer text
    const answerWithLinks = injectLinksIntoAnswer(answer, structuredLinks);

    // Enhanced markdown formatting for better readability
    let formattedAnswer = answerWithLinks
      // Remove Dust citation markers like :cite[as7, aqe]
      .replace(/:cite\[[^\]]+\]/g, '')
      // Remove any other common citation patterns
      .replace(/\[:cite:[^\]]+\]/g, '')
      // Markdown links: [text](url) → <a href="url">text</a> (BEFORE bold/italic to handle nested links)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #528c8e; text-decoration: underline; font-weight: 500; transition: color 0.2s;">$1</a>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #0b465e; font-weight: 600;">$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em style="color: #528c8e;">$1</em>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code style="background: rgba(82, 140, 142, 0.15); padding: 2px 6px; border-radius: 3px; font-family: monospace; color: #e53e3e; font-size: 15px;">$1</code>')
      // Headers (before paragraphs)
      .replace(/^### (.*$)/gm, '<h3 style="font-size: 20px; font-weight: 600; color: #0b465e; margin-top: 24px; margin-bottom: 12px;">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 style="font-size: 24px; font-weight: 600; color: #0b465e; margin-top: 28px; margin-bottom: 14px; border-bottom: 2px solid #528c8e; padding-bottom: 8px;">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 style="font-size: 28px; font-weight: 700; color: #0b465e; margin-top: 32px; margin-bottom: 16px;">$1</h1>')
      // Remove blank lines between bullet points (before converting to <li>)
      .replace(/(\* .*)\n\n(\* .*)/g, '$1\n$2')
      // Bullet lists
      .replace(/^\* (.*$)/gm, '<li style="margin-bottom: 4px; color: #0b465e;">$1</li>')
      .replace(/(<li.*<\/li>\n?)+/g, '<ul style="margin: 16px 0; padding-left: 24px; list-style-type: disc;">$&</ul>')
      // Paragraphs
      .replace(/\n\n/g, '</p><p style="margin-bottom: 16px; color: #0b465e;">')
      // Single line breaks
      .replace(/\n/g, '<br>');

    // Create links section using STRUCTURED links (not regex extraction)
    const linksSection = Formatting.createLinksSection(structuredLinks);

    // Get workspace ID from config and create Open in Dust button
    const config = await chrome.storage.sync.get(['workspaceId']);
    const openInDustButton = createOpenInDustButton(config.workspaceId, conversationId);

    const html = `
      <div class="dust-response" style="line-height: 1.8; color: #0b465e; font-size: 16px; max-width: 100%;">
        <p style="margin-bottom: 16px; color: #0b465e;">${formattedAnswer}</p>
        ${linksSection}
        ${openInDustButton}
      </div>
    `;

    console.log('[Dust] Updating panel content with formatted HTML and links');
    updateSidePanelContent(html);
    console.log('[Dust] Panel content updated successfully');

    // Add copy event listener to preserve link HTML when copying
    const responseContent = document.querySelector('.dust-response');
    if (responseContent) {
      responseContent.removeEventListener('copy', handleCopyWithLinks);
      responseContent.addEventListener('copy', handleCopyWithLinks);
    }
  } catch (e) {
    console.error('[Dust] Error in displayResponse:', e);
    // Fallback to plain text with good readability
    const html = `<div class="dust-response" style="white-space: pre-wrap; line-height: 1.8; font-size: 16px; color: #2d3748;">${escapeHtml(answer)}</div>`;
    updateSidePanelContent(html);
  }
}

/**
 * Create "Open in Dust" button
 * @param {string} workspaceId - Workspace ID
 * @param {string} conversationId - Conversation ID
 * @returns {string} HTML for button
 */
function createOpenInDustButton(workspaceId, conversationId) {
  if (!workspaceId || !conversationId) return '';

  const dustUrl = `https://eu.dust.tt/w/${workspaceId}/conversation/${conversationId}`;

  return `<div style="margin-top: 24px; padding-top: 20px; border-top: 2px solid rgba(82, 140, 142, 0.3); text-align: center;"><a href="${dustUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 10px 20px; background: #528c8e; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px; transition: background 0.2s;">🌪️ Open in Dust</a></div>`;
}

/**
 * Handle copy events to preserve link HTML
 * @param {ClipboardEvent} event - The copy event
 */
function handleCopyWithLinks(event) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const fragment = range.cloneContents();

  // Check if selection contains any links
  const links = fragment.querySelectorAll('a[href]');
  if (links.length === 0) return; // No links, use default behavior

  // Create HTML version (already has <a> tags)
  const div = document.createElement('div');
  div.appendChild(fragment.cloneNode(true));
  const htmlContent = div.innerHTML;

  // Create plain text version with URLs
  let textContent = selection.toString();

  // For plain text: append URLs after link titles
  const selectedLinks = Array.from(range.cloneContents().querySelectorAll('a[href]')).map(link => ({
    text: link.textContent.trim(),
    url: link.getAttribute('href')
  }));

  selectedLinks.forEach(link => {
    textContent = textContent.replace(link.text, `${link.text} (${link.url})`);
  });

  // Set clipboard data
  event.preventDefault();
  event.clipboardData.setData('text/html', htmlContent);
  event.clipboardData.setData('text/plain', textContent);
}

/**
 * Render markdown with LaTeX support
 */
function renderMarkdown(content) {
  try {
    let html = '';

    if (typeof marked !== 'undefined' && marked.parse) {
      html = marked.parse(content);
    } else if (typeof marked !== 'undefined') {
      html = marked(content);
    } else {
      html = `<pre>${escapeHtml(content)}</pre>`;
    }

    updateSidePanelContent(`<div class="dust-response">${html}</div>`);

    // Render math if KaTeX is available
    if (typeof katex !== 'undefined') {
      renderMath();
    }
  } catch (e) {
    console.error('Error rendering markdown:', e);
    updateSidePanelContent(`<div class="dust-response">${escapeHtml(content)}</div>`);
  }
}

/**
 * Render LaTeX math formulas
 */
function renderMath() {
  const content = document.getElementById('dust-panel-content');
  if (!content || typeof katex === 'undefined') return;

  let html = content.innerHTML;

  // Replace display math $$ ... $$
  html = html.replace(/\$\$([^\$]+)\$\$/g, function(match, math) {
    try {
      return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
    } catch (e) {
      console.error('KaTeX error:', e);
      return match;
    }
  });

  // Replace inline math $ ... $
  html = html.replace(/\$([^\$]+)\$/g, function(match, math) {
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
    } catch (e) {
      console.error('KaTeX error:', e);
      return match;
    }
  });

  content.innerHTML = html;
}

/**
 * Display error in side panel
 */
function displayError(errorMessage) {
  updateSidePanelContent(`
    <div class="dust-error">
      <h3>Error</h3>
      <p>${escapeHtml(errorMessage)}</p>
    </div>
  `);
}

/**
 * Display error with retry button
 */
function displayErrorWithRetry(errorMessage, originalQuery) {
  updateSidePanelContent(`
    <div class="dust-error">
      <div class="dust-error-icon">⚠️</div>
      <h3>Request Failed</h3>
      <p>${escapeHtml(errorMessage)}</p>
      <div class="dust-error-actions">
        <button id="dust-retry-btn" class="dust-btn-primary">🔄 Retry</button>
        <button id="dust-close-btn" class="dust-btn-secondary">Close</button>
      </div>
    </div>
  `);

  // Add retry handler
  const retryBtn = document.getElementById('dust-retry-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent click from bubbling to document
      handleAskAI(originalQuery); // Retry with same query
    });
  }

  // Add close handler
  const closeBtn = document.getElementById('dust-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent click from bubbling to document
      closeSidePanel();
      restoreButtonState();
    });
  }
}

/**
 * Copy answer to clipboard
 */
async function copyAnswer() {
  const content = document.getElementById('dust-panel-content');
  if (!content) return;

  try {
    // Clone the content to manipulate it
    const contentClone = content.cloneNode(true);

    // Remove BOTH "Open in Dust" button AND "Referenced Links" sections
    // Both have border-top styling
    const sectionsToRemove = contentClone.querySelectorAll('div[style*="border-top"]');
    sectionsToRemove.forEach(section => section.remove());

    // Remove "Key Points for Your Conversation:" sections
    const headers = contentClone.querySelectorAll('h2, h3');
    headers.forEach(header => {
      if (/Key Points for Your Conversation/i.test(header.textContent)) {
        // Remove following list if present
        let nextSibling = header.nextElementSibling;
        if (nextSibling && (nextSibling.tagName === 'UL' || nextSibling.tagName === 'OL')) {
          nextSibling.remove();
        }
        // Remove the header
        header.remove();
      }
    });

    const htmlContent = contentClone.innerHTML;

    // Convert HTML to plain text while preserving markdown formatting
    let plainText = htmlContent
      // Remove citation markers FIRST
      .replace(/:cite\[[^\]]+\]/g, '')
      .replace(/\[:cite:[^\]]+\]/g, '')
      // Convert <a> tags to inline format: <a href="url">text</a> → text (url)
      .replace(/<a[^>]+href="([^"]*)"[^>]*>([^<]+)<\/a>/gi, '$2 ($1)')
      // Convert headers to text with line breaks
      .replace(/<h[123][^>]*>(.*?)<\/h[123]>/gi, '\n\n$1\n')
      // Convert paragraphs to text with double line breaks
      .replace(/<\/p><p[^>]*>/gi, '\n\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/p>/gi, '\n')
      // Convert line breaks to actual newlines
      .replace(/<br\s*\/?>/gi, '\n')
      // Convert list items
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/?ul[^>]*>/gi, '\n')
      .replace(/<\/?ol[^>]*>/gi, '\n')
      // Strip HTML bold/italic/code tags (convert to plain text, no markdown)
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '$1')  // <strong> → text (not **text**)
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '$1')          // <em> → text (not *text*)
      .replace(/<code[^>]*>(.*?)<\/code>/gi, '$1')      // <code> → text (not `text`)
      // Remove all remaining HTML tags
      .replace(/<[^>]+>/g, '')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Clean up excessive whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();

    // Copy both HTML and plain text to clipboard (rich text formatting)
    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
    const plainBlob = new Blob([plainText], { type: 'text/plain' });

    await navigator.clipboard.write([new ClipboardItem({
      'text/html': htmlBlob,
      'text/plain': plainBlob
    })]);

    console.log('[Dust] Copied answer with rich text formatting');

    // Show feedback
    const copyBtn = document.getElementById('dust-copy-btn');
    const originalText = copyBtn.textContent;
    copyBtn.textContent = '✓ Copied!';
    copyBtn.disabled = true;

    setTimeout(() => {
      copyBtn.textContent = originalText;
      copyBtn.disabled = false;
    }, 2000);
  } catch (err) {
    console.error('[Dust] Failed to copy:', err);
    alert('Failed to copy to clipboard');
  }
}

/**
 * Update Copy Links button state based on available links
 */
function updateCopyLinksButtonState() {
  const copyLinksBtn = document.getElementById('dust-copy-links-btn');
  if (!copyLinksBtn) return;

  if (!currentLinks || currentLinks.length === 0) {
    copyLinksBtn.disabled = true;
    copyLinksBtn.style.opacity = '0.5';
    copyLinksBtn.style.cursor = 'not-allowed';
    copyLinksBtn.style.background = '#6a9c9e'; // Darker teal for disabled state
  } else {
    copyLinksBtn.disabled = false;
    copyLinksBtn.style.opacity = '1';
    copyLinksBtn.style.cursor = 'pointer';
    copyLinksBtn.style.background = '#528c8e'; // Normal teal
  }
}

/**
 * Copy links to clipboard with title and bullet points
 */
async function copyLinks() {
  if (!currentLinks || currentLinks.length === 0) {
    if (typeof Toast !== 'undefined') {
      Toast.warning('No links to copy');
    }
    return;
  }

  try {
    // Use centralized utility
    await Formatting.copyLinksText(currentLinks);

    // Update button state
    const copyLinksBtn = document.getElementById('dust-copy-links-btn');
    const originalText = copyLinksBtn.textContent;
    copyLinksBtn.textContent = '✓ Copied!';
    copyLinksBtn.disabled = true;

    setTimeout(() => {
      copyLinksBtn.textContent = originalText;
      copyLinksBtn.disabled = false;
    }, 2000);
  } catch (err) {
    console.error('[Dust] Failed to copy links:', err);
  }
}

/**
 * Open history page
 */
function openHistory() {
  chrome.runtime.sendMessage({ action: 'openHistory' });
  closeSidePanel();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

  // Expose activation function globally for re-use
  window.dustActivateSelection = activateSelectionMode;

  console.log('[Dust] Content script initialization complete');

})(); // End of IIFE

} // End of content script initialization guard
