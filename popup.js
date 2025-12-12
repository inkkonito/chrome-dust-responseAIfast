document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const selectTextBtn = document.getElementById('selectTextBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const viewAllBtn = document.getElementById('viewAllBtn');
  const historyList = document.getElementById('historyList');
  const loadingState = document.getElementById('loadingState');
  const emptyState = document.getElementById('emptyState');
  const statusMessage = document.getElementById('statusMessage');
  const answerModal = document.getElementById('answerModal');
  const modalClose = document.getElementById('modalClose');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalCopyBtn = document.getElementById('modalCopyBtn');
  const modalCopyLinksBtn = document.getElementById('modalCopyLinksBtn');
  const modalBody = document.getElementById('modalBody');

  // State
  let currentModalAnswer = '';
  let currentModalLinks = [];

  // Load history on popup open
  loadHistory();

  // Event listeners
  selectTextBtn.addEventListener('click', handleSelectText);
  settingsBtn.addEventListener('click', () => chrome.tabs.create({ url: 'setup.html' }));
  viewAllBtn.addEventListener('click', () => chrome.tabs.create({ url: 'history.html' }));

  // Modal event listeners
  modalClose.addEventListener('click', closeModal);
  modalCloseBtn.addEventListener('click', closeModal);
  modalCopyBtn.addEventListener('click', copyModalAnswer);
  modalCopyLinksBtn.addEventListener('click', copyModalLinks);

  // Close modal on background click
  answerModal.addEventListener('click', (e) => {
    if (e.target === answerModal) {
      closeModal();
    }
  });

  // Listen for history updates
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'historyUpdated') {
      loadHistory();
    }
  });

  /**
   * Handle "Select Text" button click
   */
  async function handleSelectText() {
    try {
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        showStatus('No active tab found', 'error');
        return;
      }

      // Check if URL is accessible
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        showStatus('Cannot access browser pages', 'error');
        return;
      }

      // Try to check if content script is already loaded
      let scriptLoaded = false;
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
        scriptLoaded = true;
        console.log('Content script already loaded');
      } catch (e) {
        console.log('Content script not loaded, will inject');
      }

      // Inject content script and CSS only if not already loaded
      if (!scriptLoaded) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });

        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content.css']
        });
        console.log('Content script and CSS injected');

        // Wait a bit for the content script to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Activate selection mode with retry logic
      let retries = 3;
      let activated = false;

      while (retries > 0 && !activated) {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'activateSelection' });
          activated = true;
        } catch (error) {
          retries--;
          if (retries > 0) {
            console.log('Retrying activation...', retries, 'attempts left');
            await new Promise(resolve => setTimeout(resolve, 50));
          } else {
            throw error;
          }
        }
      }

      // Close popup
      window.close();
    } catch (error) {
      console.error('Error activating selection mode:', error);
      showStatus('Error: ' + error.message, 'error');
    }
  }

  /**
   * Load history from storage
   */
  async function loadHistory() {
    try {
      // Show loading state
      loadingState.style.display = 'block';
      historyList.style.display = 'none';
      emptyState.style.display = 'none';

      // Get recent history (last 5)
      const response = await chrome.runtime.sendMessage({
        action: 'getRecentHistory',
        limit: 5
      });

      if (response.success) {
        const history = response.data;

        if (history.length === 0) {
          // Show empty state
          loadingState.style.display = 'none';
          emptyState.style.display = 'block';
        } else {
          // Display history
          displayHistory(history);
          loadingState.style.display = 'none';
          historyList.style.display = 'block';
        }
      } else {
        throw new Error(response.error || 'Failed to load history');
      }
    } catch (error) {
      console.error('Error loading history:', error);
      loadingState.style.display = 'none';
      showStatus('Error loading history', 'error');
    }
  }

  /**
   * Display history items
   */
  function displayHistory(history) {
    historyList.innerHTML = '';

    history.forEach(entry => {
      const item = createHistoryItem(entry);
      historyList.appendChild(item);
    });
  }

  /**
   * Create a history item element
   */
  function createHistoryItem(entry) {
    const item = document.createElement('div');
    item.className = 'history-item';

    const pageInfo = Formatting.formatPageInfo(entry.pageTitle, entry.pageUrl);

    const hasLinks = entry.links && entry.links.length > 0;

    item.innerHTML = `
      <div class="history-item-header">
        <span class="history-time">${Formatting.formatRelativeTime(entry.timestamp)}</span>
        <span class="history-page" title="${escapeHtml(pageInfo.fullUrl)}">${escapeHtml(pageInfo.domain)}</span>
      </div>
      <div class="history-query">${escapeHtml(Formatting.truncateText(entry.query || entry.selectedText, 100))}</div>
      <div class="history-item-actions">
        <button class="history-action-btn copy-btn" data-id="${entry.id}">📋 Copy</button>
        <button class="history-action-btn copy-links-btn" data-id="${entry.id}" ${!hasLinks ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ''}>🔗 Links</button>
        <button class="history-action-btn view-btn" data-id="${entry.id}">👁️ View</button>
        <button class="history-action-btn delete-btn" data-id="${entry.id}">🗑️ Delete</button>
      </div>
    `;

    // Add event listeners
    const copyBtn = item.querySelector('.copy-btn');
    const copyLinksBtn = item.querySelector('.copy-links-btn');
    const viewBtn = item.querySelector('.view-btn');
    const deleteBtn = item.querySelector('.delete-btn');

    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyAnswer(entry.id);
    });

    if (hasLinks) {
      copyLinksBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyLinks(entry.id);
      });
    }

    viewBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      viewFullEntry(entry.id);
    });

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteEntry(entry.id);
    });

    return item;
  }

  /**
   * Copy answer to clipboard
   */
  async function copyAnswer(entryId) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getHistory'
      });

      if (response.success) {
        const entry = response.data.find(e => e.id === entryId);

        if (entry && entry.answer) {
          // Use centralized utility
          await Formatting.copyAnswerText(entry.answer);
        } else {
          showStatus('No answer to copy', 'error');
        }
      }
    } catch (error) {
      console.error('Error copying answer:', error);
      showStatus('Failed to copy', 'error');
    }
  }

  /**
   * Copy links to clipboard with title and bullet points
   */
  async function copyLinks(entryId) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getHistory'
      });

      if (response.success) {
        const entry = response.data.find(e => e.id === entryId);

        if (entry && entry.links && entry.links.length > 0) {
          // Use centralized utility
          await Formatting.copyLinksText(entry.links);
        } else {
          showStatus('No links to copy', 'error');
        }
      }
    } catch (error) {
      console.error('Error copying links:', error);
      showStatus('Failed to copy', 'error');
    }
  }

  /**
   * View entry in modal
   */
  async function viewFullEntry(entryId) {
    try {
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        showStatus('No active tab found', 'error');
        return;
      }

      // Check if URL is accessible
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        showStatus('Cannot access browser pages', 'error');
        return;
      }

      // Fetch entry from history
      const response = await chrome.runtime.sendMessage({ action: 'getHistory' });

      if (!response.success) {
        showStatus('Failed to load entry', 'error');
        return;
      }

      const entry = response.data.find(e => e.id === entryId);

      if (!entry || !entry.answer) {
        showStatus('No answer available', 'error');
        return;
      }

      // Get workspace ID from config
      const config = await chrome.storage.sync.get(['workspaceId']);

      // Inject content script if needed
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      } catch (e) {
        // Content script not loaded, inject it
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content.css']
        });
        // Wait for injection
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Send message to content script to display sidebar
      await chrome.tabs.sendMessage(tab.id, {
        action: 'displayHistoryEntry',
        entry: {
          answer: entry.answer,
          links: entry.links || [],
          conversationId: entry.conversationId,
          workspaceId: config.workspaceId
        }
      });

      // Close popup after successfully sending message
      window.close();
    } catch (error) {
      console.error('Error viewing entry:', error);
      showStatus('Failed to view entry', 'error');
    }
  }

  /**
   * Show status message
   */
  function showStatus(message, type = 'success') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';

    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, 3000);
  }

  /**
   * Close modal
   */
  function closeModal() {
    answerModal.classList.remove('active');
    currentModalAnswer = '';
    currentModalLinks = [];
  }

  /**
   * Copy modal answer
   */
  async function copyModalAnswer() {
    if (!currentModalAnswer) return;

    try {
      // Use centralized utility
      await Formatting.copyAnswerText(currentModalAnswer);

      const originalText = modalCopyBtn.textContent;
      modalCopyBtn.textContent = '✓ Copied!';
      modalCopyBtn.disabled = true;

      setTimeout(() => {
        modalCopyBtn.textContent = originalText;
        modalCopyBtn.disabled = false;
      }, 2000);
    } catch (error) {
      console.error('Error copying:', error);
      showStatus('Failed to copy', 'error');
    }
  }

  /**
   * Copy modal links to clipboard with title and bullet points
   */
  async function copyModalLinks() {
    if (!currentModalLinks || currentModalLinks.length === 0) {
      showStatus('No links to copy', 'error');
      return;
    }

    try {
      // Use centralized utility
      await Formatting.copyLinksText(currentModalLinks);

      const modalCopyLinksBtn = document.getElementById('modalCopyLinksBtn');
      const originalText = modalCopyLinksBtn.textContent;
      modalCopyLinksBtn.textContent = '✓ Copied!';
      modalCopyLinksBtn.disabled = true;

      setTimeout(() => {
        modalCopyLinksBtn.textContent = originalText;
        modalCopyLinksBtn.disabled = false;
      }, 2000);
    } catch (error) {
      console.error('Error copying links:', error);
      showStatus('Failed to copy', 'error');
    }
  }

  /**
   * Delete single entry
   */
  async function deleteEntry(entryId) {
    if (!confirm('Are you sure you want to delete this entry?')) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'deleteHistoryEntry',
        id: entryId
      });

      if (response.success) {
        // Reload history
        await loadHistory();
        showStatus('Entry deleted', 'success');
      } else {
        throw new Error('Failed to delete entry');
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      showStatus('Failed to delete entry', 'error');
    }
  }

  /**
   * Render LaTeX math formulas
   */
  function renderMath(element) {
    if (!element || typeof katex === 'undefined') return;

    let html = element.innerHTML;

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

    element.innerHTML = html;
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
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
