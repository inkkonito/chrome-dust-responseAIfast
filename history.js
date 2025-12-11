document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const backBtn = document.getElementById('backBtn');
  const searchInput = document.getElementById('searchInput');
  const agentFilter = document.getElementById('agentFilter');
  const exportBtn = document.getElementById('exportBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const statsText = document.getElementById('statsText');
  const filteredStats = document.getElementById('filteredStats');
  const historyTableBody = document.getElementById('historyTableBody');
  const answerModal = document.getElementById('answerModal');
  const modalClose = document.getElementById('modalClose');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalCopyBtn = document.getElementById('modalCopyBtn');
  const modalBody = document.getElementById('modalBody');

  // State
  let allHistory = [];
  let filteredHistory = [];
  let currentModalAnswer = '';

  // Load history on page load
  loadHistory();

  // Event listeners
  backBtn.addEventListener('click', () => window.close());
  searchInput.addEventListener('input', filterHistory);
  agentFilter.addEventListener('change', filterHistory);
  exportBtn.addEventListener('click', exportHistory);
  clearAllBtn.addEventListener('click', clearAllHistory);
  modalClose.addEventListener('click', closeModal);
  modalCloseBtn.addEventListener('click', closeModal);
  modalCopyBtn.addEventListener('click', copyModalAnswer);

  // Close modal on background click
  answerModal.addEventListener('click', (e) => {
    if (e.target === answerModal) {
      closeModal();
    }
  });

  // Check for specific entry ID in URL
  const urlParams = new URLSearchParams(window.location.search);
  const entryId = urlParams.get('id');
  if (entryId) {
    setTimeout(() => viewEntry(entryId), 500);
  }

  /**
   * Load all history
   */
  async function loadHistory() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getHistory'
      });

      if (response.success) {
        allHistory = response.data;
        filteredHistory = allHistory;

        updateAgentFilter();
        updateStats();
        displayHistory();
      } else {
        throw new Error(response.error || 'Failed to load history');
      }
    } catch (error) {
      console.error('Error loading history:', error);
      showError('Error loading history');
    }
  }

  /**
   * Update agent filter dropdown
   */
  function updateAgentFilter() {
    // Get unique agent IDs
    const agents = [...new Set(allHistory.map(entry => entry.agentId).filter(Boolean))];

    // Clear and rebuild options
    agentFilter.innerHTML = '<option value="">All Agents</option>';

    agents.forEach(agentId => {
      const option = document.createElement('option');
      option.value = agentId;
      option.textContent = agentId;
      agentFilter.appendChild(option);
    });
  }

  /**
   * Update statistics
   */
  function updateStats() {
    statsText.textContent = `Total queries: ${allHistory.length}`;

    if (filteredHistory.length !== allHistory.length) {
      filteredStats.textContent = `Showing: ${filteredHistory.length}`;
    } else {
      filteredStats.textContent = '';
    }
  }

  /**
   * Filter history based on search and agent filter
   */
  function filterHistory() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedAgent = agentFilter.value;

    filteredHistory = allHistory.filter(entry => {
      // Agent filter
      if (selectedAgent && entry.agentId !== selectedAgent) {
        return false;
      }

      // Search filter
      if (searchTerm) {
        const query = (entry.query || entry.selectedText || '').toLowerCase();
        const answer = (entry.answer || '').toLowerCase();
        return query.includes(searchTerm) || answer.includes(searchTerm);
      }

      return true;
    });

    updateStats();
    displayHistory();
  }

  /**
   * Display history in table
   */
  function displayHistory() {
    historyTableBody.innerHTML = '';

    if (filteredHistory.length === 0) {
      historyTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-history">
            <div class="empty-icon">📝</div>
            <p>No history entries found</p>
          </td>
        </tr>
      `;
      return;
    }

    filteredHistory.forEach(entry => {
      const row = createHistoryRow(entry);
      historyTableBody.appendChild(row);
    });
  }

  /**
   * Create a history table row
   */
  function createHistoryRow(entry) {
    const row = document.createElement('tr');

    const pageInfo = Formatting.formatPageInfo(entry.pageTitle, entry.pageUrl);

    row.innerHTML = `
      <td class="time-cell">
        <span>${Formatting.formatRelativeTime(entry.timestamp)}</span>
        <span class="time-absolute">${Formatting.formatAbsoluteTime(entry.timestamp)}</span>
      </td>
      <td class="page-cell">
        <span class="page-title">${escapeHtml(Formatting.truncateText(pageInfo.title, 40))}</span>
        <a href="${escapeHtml(entry.pageUrl)}" class="page-url" target="_blank" title="${escapeHtml(entry.pageUrl)}">
          ${escapeHtml(pageInfo.domain)}
        </a>
      </td>
      <td class="query-cell">
        <div class="truncated-text">${escapeHtml(entry.query || entry.selectedText || '')}</div>
      </td>
      <td class="answer-cell">
        <div class="truncated-text">
          ${entry.error ? `<span style="color: #e74c3c;">Error: ${escapeHtml(entry.error)}</span>` : escapeHtml(Formatting.truncateText(entry.answer || 'No answer', 150))}
        </div>
      </td>
      <td class="actions-cell">
        <button class="table-action-btn view-btn" data-id="${entry.id}" ${!entry.answer ? 'disabled' : ''}>
          👁️ View
        </button>
        <button class="table-action-btn copy-btn" data-id="${entry.id}" ${!entry.answer ? 'disabled' : ''}>
          📋 Copy
        </button>
        <button class="table-action-btn delete-btn" data-id="${entry.id}">
          🗑️ Delete
        </button>
      </td>
    `;

    // Add event listeners
    const viewBtn = row.querySelector('.view-btn');
    const copyBtn = row.querySelector('.copy-btn');
    const deleteBtn = row.querySelector('.delete-btn');

    if (viewBtn && !viewBtn.disabled) {
      viewBtn.addEventListener('click', () => viewEntry(entry.id));
    }

    if (copyBtn && !copyBtn.disabled) {
      copyBtn.addEventListener('click', () => copyAnswer(entry.id));
    }

    deleteBtn.addEventListener('click', () => deleteEntry(entry.id));

    return row;
  }

  /**
   * View full entry in modal
   */
  async function viewEntry(entryId) {
    const entry = allHistory.find(e => e.id === entryId);

    if (!entry || !entry.answer) {
      alert('No answer available');
      return;
    }

    // Remove citation markers from answer before displaying
    const cleanAnswer = entry.answer
      .replace(/:cite\[[^\]]+\]/g, '')
      .replace(/\[:cite:[^\]]+\]/g, '');

    currentModalAnswer = cleanAnswer;

    // Get structured links from history entry (stored in links field)
    const structuredLinks = entry.links || [];

    // Get workspace ID from config
    const config = await chrome.storage.sync.get(['workspaceId']);
    const openInDustButton = createOpenInDustButton(config.workspaceId || entry.workspaceId, entry.conversationId);

    // Render markdown with LaTeX
    try {
      let html = '';

      if (typeof marked !== 'undefined' && marked.parse) {
        html = marked.parse(cleanAnswer);
      } else if (typeof marked !== 'undefined') {
        html = marked(cleanAnswer);
      } else {
        html = `<pre>${escapeHtml(cleanAnswer)}</pre>`;
      }

      // Add links section using STRUCTURED links
      const linksSection = Formatting.createLinksSection(structuredLinks);

      modalBody.innerHTML = `<div class="response-content">${html}${linksSection}${openInDustButton}</div>`;

      // Add copy event listener to preserve link HTML when copying
      modalBody.removeEventListener('copy', handleCopyWithLinks);
      modalBody.addEventListener('copy', handleCopyWithLinks);

      // Render math if KaTeX is available
      if (typeof katex !== 'undefined') {
        renderMath(modalBody);
      }
    } catch (e) {
      console.error('Error rendering markdown:', e);
      modalBody.innerHTML = `<div class="response-content">${escapeHtml(cleanAnswer)}</div>`;
    }

    // Show modal
    answerModal.classList.add('active');
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
   * Close modal
   */
  function closeModal() {
    answerModal.classList.remove('active');
    currentModalAnswer = '';
  }

  /**
   * Copy modal answer
   */
  async function copyModalAnswer() {
    if (!currentModalAnswer) return;

    try {
      await navigator.clipboard.writeText(currentModalAnswer);

      const originalText = modalCopyBtn.textContent;
      modalCopyBtn.textContent = '✓ Copied!';
      modalCopyBtn.disabled = true;

      setTimeout(() => {
        modalCopyBtn.textContent = originalText;
        modalCopyBtn.disabled = false;
      }, 2000);
    } catch (error) {
      console.error('Error copying:', error);
      alert('Failed to copy to clipboard');
    }
  }

  /**
   * Copy answer to clipboard
   */
  async function copyAnswer(entryId) {
    const entry = allHistory.find(e => e.id === entryId);

    if (!entry || !entry.answer) {
      alert('No answer to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(entry.answer);
      alert('Answer copied to clipboard!');
    } catch (error) {
      console.error('Error copying:', error);
      alert('Failed to copy to clipboard');
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
      } else {
        throw new Error('Failed to delete entry');
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry');
    }
  }

  /**
   * Export history to JSON
   */
  async function exportHistory() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'exportHistory'
      });

      if (response.success) {
        const json = response.data;
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `dust-history-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
      } else {
        throw new Error('Failed to export history');
      }
    } catch (error) {
      console.error('Error exporting history:', error);
      alert('Failed to export history');
    }
  }

  /**
   * Clear all history
   */
  async function clearAllHistory() {
    if (!confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'clearHistory'
      });

      if (response.success) {
        await loadHistory();
      } else {
        throw new Error('Failed to clear history');
      }
    } catch (error) {
      console.error('Error clearing history:', error);
      alert('Failed to clear history');
    }
  }

  /**
   * Show error message
   */
  function showError(message) {
    historyTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-history">
          <div class="empty-icon">⚠️</div>
          <p style="color: #e74c3c;">${escapeHtml(message)}</p>
        </td>
      </tr>
    `;
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
