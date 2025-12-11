document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const selectTextBtn = document.getElementById('selectTextBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const viewAllBtn = document.getElementById('viewAllBtn');
  const historyList = document.getElementById('historyList');
  const loadingState = document.getElementById('loadingState');
  const emptyState = document.getElementById('emptyState');
  const statusMessage = document.getElementById('statusMessage');

  // Load history on popup open
  loadHistory();

  // Event listeners
  selectTextBtn.addEventListener('click', handleSelectText);
  settingsBtn.addEventListener('click', () => chrome.tabs.create({ url: 'setup.html' }));
  refreshBtn.addEventListener('click', loadHistory);
  viewAllBtn.addEventListener('click', () => chrome.tabs.create({ url: 'history.html' }));

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

    item.innerHTML = `
      <div class="history-item-header">
        <span class="history-time">${Formatting.formatRelativeTime(entry.timestamp)}</span>
        <span class="history-page" title="${escapeHtml(pageInfo.fullUrl)}">${escapeHtml(pageInfo.domain)}</span>
      </div>
      <div class="history-query">${escapeHtml(Formatting.truncateText(entry.query || entry.selectedText, 100))}</div>
      <div class="history-item-actions">
        <button class="history-action-btn copy-btn" data-id="${entry.id}">📋 Copy</button>
        <button class="history-action-btn view-btn" data-id="${entry.id}">👁️ View</button>
      </div>
    `;

    // Add event listeners
    const copyBtn = item.querySelector('.copy-btn');
    const viewBtn = item.querySelector('.view-btn');

    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyAnswer(entry.id);
    });

    viewBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      viewFullEntry(entry.id);
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
          await navigator.clipboard.writeText(entry.answer);
          showStatus('Answer copied to clipboard!', 'success');
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
   * View full entry in history page
   */
  function viewFullEntry(entryId) {
    chrome.tabs.create({ url: `history.html?id=${entryId}` });
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
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
