document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const backBtn = document.getElementById('backBtn');
  const searchInput = document.getElementById('searchInput');
  const agentFilter = document.getElementById('agentFilter');
  const pageSizeSelector = document.getElementById('pageSizeSelector');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  const selectedCount = document.getElementById('selectedCount');
  const statsText = document.getElementById('statsText');
  const filteredStats = document.getElementById('filteredStats');
  const paginationInfo = document.getElementById('paginationInfo');
  const historyTableBody = document.getElementById('historyTableBody');
  const paginationControls = document.getElementById('paginationControls');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const pageInfo = document.getElementById('pageInfo');
  const answerModal = document.getElementById('answerModal');
  const modalClose = document.getElementById('modalClose');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalCopyBtn = document.getElementById('modalCopyBtn');
  const modalCopyLinksBtn = document.getElementById('modalCopyLinksBtn');
  const modalBody = document.getElementById('modalBody');

  // State
  let allHistory = [];
  let filteredHistory = [];
  let currentModalAnswer = '';
  let currentModalLinks = [];
  let currentPage = 1;
  let pageSize = 20;
  let selectedEntries = new Set(); // Track selected entry IDs

  // Load history on page load
  loadHistory();

  // Event listeners
  backBtn.addEventListener('click', () => window.close());
  searchInput.addEventListener('input', filterHistory);
  agentFilter.addEventListener('change', filterHistory);
  pageSizeSelector.addEventListener('change', handlePageSizeChange);
  selectAllCheckbox.addEventListener('change', handleSelectAll);
  bulkDeleteBtn.addEventListener('click', handleBulkDelete);
  prevPageBtn.addEventListener('click', () => changePage(currentPage - 1));
  nextPageBtn.addEventListener('click', () => changePage(currentPage + 1));
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
      filteredStats.textContent = `Filtered: ${filteredHistory.length}`;
    } else {
      filteredStats.textContent = '';
    }

    // Update pagination info
    if (filteredHistory.length > 0) {
      const startIndex = (currentPage - 1) * pageSize + 1;
      const endIndex = Math.min(currentPage * pageSize, filteredHistory.length);
      paginationInfo.textContent = `Displaying ${startIndex}-${endIndex} of ${filteredHistory.length}`;
    } else {
      paginationInfo.textContent = '';
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

    currentPage = 1; // Reset to first page when filtering
    updateStats();
    displayHistory();
  }

  /**
   * Handle page size change
   */
  function handlePageSizeChange() {
    pageSize = parseInt(pageSizeSelector.value);
    currentPage = 1; // Reset to first page when changing page size
    displayHistory();
  }

  /**
   * Change to a specific page
   */
  function changePage(newPage) {
    const totalPages = Math.ceil(filteredHistory.length / pageSize);
    if (newPage < 1 || newPage > totalPages) return;

    currentPage = newPage;
    displayHistory();

    // Scroll to top of table
    document.querySelector('.history-table-container').scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * Update pagination controls
   */
  function updatePaginationControls() {
    const totalPages = Math.ceil(filteredHistory.length / pageSize);

    if (totalPages <= 1) {
      paginationControls.style.display = 'none';
      return;
    }

    paginationControls.style.display = 'block';
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
  }

  /**
   * Display history in table with pagination
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
      paginationControls.style.display = 'none';
      return;
    }

    // Calculate pagination
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, filteredHistory.length);
    const pageEntries = filteredHistory.slice(startIndex, endIndex);

    // Display entries for current page
    pageEntries.forEach(entry => {
      const row = createHistoryRow(entry);
      historyTableBody.appendChild(row);
    });

    // Update pagination controls
    updatePaginationControls();

    // Update select all checkbox state
    updateSelectAllCheckbox();
  }

  /**
   * Handle entry selection
   */
  function handleEntrySelection(entryId, isChecked) {
    if (isChecked) {
      selectedEntries.add(entryId);
    } else {
      selectedEntries.delete(entryId);
    }
    updateSelectionUI();
  }

  /**
   * Handle select all checkbox
   */
  function handleSelectAll() {
    const isChecked = selectAllCheckbox.checked;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, filteredHistory.length);
    const pageEntries = filteredHistory.slice(startIndex, endIndex);

    pageEntries.forEach(entry => {
      if (isChecked) {
        selectedEntries.add(entry.id);
      } else {
        selectedEntries.delete(entry.id);
      }
    });

    updateSelectionUI();
    displayHistory(); // Refresh to update checkboxes
  }

  /**
   * Update select all checkbox state
   */
  function updateSelectAllCheckbox() {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, filteredHistory.length);
    const pageEntries = filteredHistory.slice(startIndex, endIndex);

    if (pageEntries.length === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
      return;
    }

    const selectedOnPage = pageEntries.filter(entry => selectedEntries.has(entry.id)).length;

    if (selectedOnPage === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    } else if (selectedOnPage === pageEntries.length) {
      selectAllCheckbox.checked = true;
      selectAllCheckbox.indeterminate = false;
    } else {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = true;
    }
  }

  /**
   * Update selection UI (button visibility and count)
   */
  function updateSelectionUI() {
    const count = selectedEntries.size;
    selectedCount.textContent = count;

    if (count > 0) {
      bulkDeleteBtn.style.display = 'inline-block';
    } else {
      bulkDeleteBtn.style.display = 'none';
    }
  }

  /**
   * Handle bulk delete
   */
  async function handleBulkDelete() {
    const count = selectedEntries.size;
    if (count === 0) return;

    if (!confirm(`Are you sure you want to delete ${count} selected ${count === 1 ? 'entry' : 'entries'}?`)) {
      return;
    }

    try {
      // Delete all selected entries
      const deletePromises = Array.from(selectedEntries).map(entryId =>
        chrome.runtime.sendMessage({
          action: 'deleteHistoryEntry',
          id: entryId
        })
      );

      await Promise.all(deletePromises);

      // Clear selection
      selectedEntries.clear();
      updateSelectionUI();

      // Reload history
      await loadHistory();
    } catch (error) {
      console.error('Error deleting entries:', error);
      alert('Failed to delete some entries');
    }
  }

  /**
   * Create a history table row
   */
  function createHistoryRow(entry) {
    const row = document.createElement('tr');

    const pageInfo = Formatting.formatPageInfo(entry.pageTitle, entry.pageUrl);
    const hasLinks = entry.links && entry.links.length > 0;
    const isSelected = selectedEntries.has(entry.id);

    row.innerHTML = `
      <td style="text-align: center;">
        <input type="checkbox" class="entry-checkbox" data-id="${entry.id}" ${isSelected ? 'checked' : ''} style="cursor: pointer;">
      </td>
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
        <button class="table-action-btn copy-links-btn" data-id="${entry.id}" ${!hasLinks ? 'disabled style="opacity: 0.6;"' : ''}>
          🔗 Links
        </button>
        <button class="table-action-btn delete-btn" data-id="${entry.id}">
          🗑️ Delete
        </button>
      </td>
    `;

    // Add event listeners
    const checkbox = row.querySelector('.entry-checkbox');
    const viewBtn = row.querySelector('.view-btn');
    const copyBtn = row.querySelector('.copy-btn');
    const copyLinksBtn = row.querySelector('.copy-links-btn');
    const deleteBtn = row.querySelector('.delete-btn');

    checkbox.addEventListener('change', () => handleEntrySelection(entry.id, checkbox.checked));

    if (viewBtn && !viewBtn.disabled) {
      viewBtn.addEventListener('click', () => viewEntry(entry.id));
    }

    if (copyBtn && !copyBtn.disabled) {
      copyBtn.addEventListener('click', () => copyAnswer(entry.id));
    }

    if (copyLinksBtn && !copyLinksBtn.disabled) {
      copyLinksBtn.addEventListener('click', () => copyLinks(entry.id));
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
    currentModalLinks = structuredLinks;

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
    currentModalLinks = [];
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
   * Copy modal links to clipboard with title and bullet points
   */
  async function copyModalLinks() {
    if (!currentModalLinks || currentModalLinks.length === 0) {
      alert('No links to copy');
      return;
    }

    try {
      const header = '🔗 Links\n\n';
      const linksText = currentModalLinks
        .map(link => `• ${link.text || link.uri} - ${link.uri}`)
        .join('\n');
      const fullText = header + linksText;
      await navigator.clipboard.writeText(fullText);

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
      alert('Failed to copy links to clipboard');
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
   * Copy links to clipboard with title and bullet points
   */
  async function copyLinks(entryId) {
    const entry = allHistory.find(e => e.id === entryId);

    if (!entry || !entry.links || entry.links.length === 0) {
      alert('No links to copy');
      return;
    }

    try {
      const header = '🔗 Links\n\n';
      const linksText = entry.links
        .map(link => `• ${link.text || link.uri} - ${link.uri}`)
        .join('\n');
      const fullText = header + linksText;
      await navigator.clipboard.writeText(fullText);
      alert('Links copied to clipboard!');
    } catch (error) {
      console.error('Error copying links:', error);
      alert('Failed to copy links to clipboard');
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
