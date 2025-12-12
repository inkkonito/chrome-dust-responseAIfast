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
    console.log('[History] Entry selection changed:', { entryId, isChecked });
    if (isChecked) {
      selectedEntries.add(entryId);
    } else {
      selectedEntries.delete(entryId);
    }
    console.log('[History] Selected entries:', Array.from(selectedEntries));
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
    console.log('[History] Bulk delete triggered. Selected count:', count);
    console.log('[History] Selected entry IDs:', Array.from(selectedEntries));

    if (count === 0) {
      console.log('[History] No entries selected, returning');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${count} selected ${count === 1 ? 'entry' : 'entries'}?`)) {
      console.log('[History] Delete cancelled by user');
      return;
    }

    try {
      // Create array of entry IDs to delete
      const entriesToDelete = Array.from(selectedEntries);
      console.log('[History] Entries to delete:', entriesToDelete);

      // Use bulk delete action for better performance and atomicity
      console.log('[History] Sending bulk delete message...');
      const response = await chrome.runtime.sendMessage({
        action: 'deleteHistoryEntries',
        ids: entriesToDelete
      });

      console.log('[History] Bulk delete response:', response);

      // Clear selection
      selectedEntries.clear();
      updateSelectionUI();

      // Reload history to reflect changes
      await loadHistory();

      // Show appropriate toast based on results
      if (response.success) {
        const deletedCount = response.deletedCount || count;
        Toast.success(`Successfully deleted ${deletedCount} ${deletedCount === 1 ? 'entry' : 'entries'}`);
      } else {
        throw new Error('Bulk delete failed');
      }
    } catch (error) {
      console.error('Error deleting entries:', error);
      Toast.error('Failed to delete entries');
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
      viewBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event from bubbling
        viewEntry(entry.id);
      });
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
   * View full entry in real sidebar
   */
  async function viewEntry(entryId) {
    console.log('[History] viewEntry called with ID:', entryId);

    const entry = allHistory.find(e => e.id === entryId);
    console.log('[History] Found entry:', entry);

    if (!entry || !entry.answer) {
      console.log('[History] No entry or answer found');
      Toast.warning('No answer available');
      return;
    }

    // Get workspace ID from config
    const config = await chrome.storage.sync.get(['workspaceId']);
    console.log('[History] Config:', config);

    // Show the real sidebar component
    console.log('[History] Calling showHistorySidePanel...');
    showHistorySidePanel({
      answer: entry.answer,
      links: entry.links || [],
      conversationId: entry.conversationId,
      workspaceId: config.workspaceId || entry.workspaceId
    });
    console.log('[History] showHistorySidePanel called');
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
    answerModal.classList.remove('sidebar-style');
    currentModalAnswer = '';
    currentModalLinks = [];
  }

  /**
   * Copy modal answer
   */
  async function copyModalAnswer() {
    if (!currentModalAnswer) return;

    // Use centralized utility
    await Formatting.copyAnswerText(currentModalAnswer);

    const originalText = modalCopyBtn.textContent;
    modalCopyBtn.textContent = '✓ Copied!';
    modalCopyBtn.disabled = true;

    setTimeout(() => {
      modalCopyBtn.textContent = originalText;
      modalCopyBtn.disabled = false;
    }, 2000);
  }

  /**
   * Copy modal links to clipboard with title and bullet points
   */
  async function copyModalLinks() {
    if (!currentModalLinks || currentModalLinks.length === 0) {
      Toast.warning('No links to copy');
      return;
    }

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
  }

  /**
   * Copy answer to clipboard
   */
  async function copyAnswer(entryId) {
    const entry = allHistory.find(e => e.id === entryId);

    if (!entry || !entry.answer) {
      Toast.warning('No answer to copy');
      return;
    }

    // Use centralized utility
    await Formatting.copyAnswerText(entry.answer);
  }

  /**
   * Copy links to clipboard with title and bullet points
   */
  async function copyLinks(entryId) {
    const entry = allHistory.find(e => e.id === entryId);

    if (!entry || !entry.links || entry.links.length === 0) {
      Toast.warning('No links to copy');
      return;
    }

    // Use centralized utility
    await Formatting.copyLinksText(entry.links);
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
        Toast.success('Entry deleted successfully');
      } else {
        throw new Error('Failed to delete entry');
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      Toast.error('Failed to delete entry');
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
   * Show real sidebar component (same as content.js sidebar)
   */
  function showHistorySidePanel(entry) {
    console.log('[History] showHistorySidePanel called with entry:', entry);

    // Remove any existing sidebar AND its listeners
    const existing = document.getElementById('history-side-panel');
    if (existing) {
      console.log('[History] Removing existing sidebar');
      // Remove the click listener first
      if (existing._clickListener) {
        document.removeEventListener('click', existing._clickListener);
        console.log('[History] Removed old click listener');
      }
      existing.remove();
    }

    // Create sidebar with exact same structure as content.js
    const sidePanel = document.createElement('div');
    sidePanel.id = 'history-side-panel';
    sidePanel.className = 'dust-side-panel';

    console.log('[History] Created sidebar element');

    // Apply inline styles (let CSS handle right and opacity for animation)
    sidePanel.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      width: 500px !important;
      height: 100vh !important;
      background-color: #ffffff !important;
      box-shadow: -2px 0 24px rgba(0, 0, 0, 0.12) !important;
      z-index: 2147483647 !important;
      display: flex !important;
      flex-direction: column !important;
      transition: width 0.3s ease-in-out !important;
    `;

    console.log('[History] Applied styles to sidebar');

    // Create header
    console.log('[History] Creating header...');
    const header = createSidebarHeader();

    // Create content area
    console.log('[History] Creating content...');
    const content = createSidebarContent(entry);

    // Create footer
    console.log('[History] Creating footer...');
    const footer = createSidebarFooter(entry);

    sidePanel.appendChild(header);
    sidePanel.appendChild(content);
    sidePanel.appendChild(footer);

    console.log('[History] Appending sidebar to body...');
    document.body.appendChild(sidePanel);
    console.log('[History] Sidebar appended to body');

    // Trigger animation
    setTimeout(() => {
      console.log('[History] Triggering slide-in animation...');
      sidePanel.classList.add('dust-panel-open');
      console.log('[History] Animation triggered, classes:', sidePanel.className);
    }, 10);

    // Add click-outside listener
    console.log('[History] Setting up click-outside listener...');
    setupClickOutsideListener(sidePanel);
  }

  /**
   * Create sidebar header
   */
  function createSidebarHeader() {
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px !important;
      background-color: #0b465e !important;
      border-bottom: 1px solid #e0e0e0 !important;
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
    `;

    // Title with DD icon
    const title = document.createElement('div');
    title.style.cssText = 'display: flex !important; align-items: center !important; gap: 10px !important;';

    // Create DD icon image
    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL('icon/favicon-32x32-1.png');
    icon.alt = 'DataDome';
    icon.style.cssText = `
      width: 20px !important;
      height: 20px !important;
      display: block !important;
    `;

    // Create title text
    const titleText = document.createElement('h2');
    titleText.textContent = 'Dust AI Assistant';
    titleText.style.cssText = `
      margin: 0 !important;
      font-size: 18px !important;
      font-weight: 600 !important;
      color: white !important;
    `;

    title.appendChild(icon);
    title.appendChild(titleText);

    // Buttons container
    const buttons = document.createElement('div');
    buttons.style.cssText = 'display: flex !important; gap: 8px !important;';

    // Expand button
    const expandBtn = document.createElement('button');
    expandBtn.innerHTML = '⇔';
    expandBtn.title = 'Expand panel';
    expandBtn.style.cssText = `
      background: none !important;
      border: none !important;
      color: white !important;
      font-size: 22px !important;
      cursor: pointer !important;
      padding: 6px !important;
      width: 32px !important;
      height: 32px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      border-radius: 4px !important;
      transition: background-color 0.2s !important;
    `;

    // Track expanded state
    let isExpanded = false;

    expandBtn.addEventListener('click', () => {
      const sidePanel = document.getElementById('history-side-panel');
      if (!sidePanel) return;

      isExpanded = !isExpanded;

      if (isExpanded) {
        sidePanel.style.width = '800px';
        expandBtn.innerHTML = '⇄';
        expandBtn.title = 'Collapse panel';
      } else {
        sidePanel.style.width = '500px';
        expandBtn.innerHTML = '⇔';
        expandBtn.title = 'Expand panel';
      }
    });

    expandBtn.addEventListener('mouseover', () => {
      expandBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
    });
    expandBtn.addEventListener('mouseout', () => {
      expandBtn.style.backgroundColor = 'transparent';
    });

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.title = 'Close';
    closeBtn.style.cssText = `
      background: none !important;
      border: none !important;
      color: white !important;
      font-size: 22px !important;
      cursor: pointer !important;
      padding: 6px !important;
      border-radius: 4px !important;
      width: 32px !important;
      height: 32px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transition: background-color 0.2s !important;
    `;
    closeBtn.addEventListener('click', closeHistorySidePanel);
    closeBtn.addEventListener('mouseover', () => {
      closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
    });
    closeBtn.addEventListener('mouseout', () => {
      closeBtn.style.backgroundColor = 'transparent';
    });

    buttons.appendChild(expandBtn);
    buttons.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(buttons);

    return header;
  }

  /**
   * Create sidebar content area
   */
  function createSidebarContent(entry) {
    const content = document.createElement('div');
    content.id = 'history-panel-content';
    content.style.cssText = `
      flex: 1 !important;
      overflow-y: auto !important;
      padding: 30px !important;
      background-color: rgba(82, 140, 142, 0.03) !important;
      font-size: 16px !important;
      line-height: 1.8 !important;
    `;

    // Format answer (same as displayResponse in content.js)
    const cleanAnswer = entry.answer
      .replace(/:cite\[[^\]]+\]/g, '')
      .replace(/\[:cite:[^\]]+\]/g, '');

    let html = '';
    if (typeof marked !== 'undefined' && marked.parse) {
      html = marked.parse(cleanAnswer);
    } else if (typeof marked !== 'undefined') {
      html = marked(cleanAnswer);
    } else {
      html = `<pre>${escapeHtml(cleanAnswer)}</pre>`;
    }

    // Add links section
    const linksSection = Formatting.createLinksSection(entry.links || []);

    // Add Open in Dust button
    const openInDustButton = createOpenInDustButton(entry.workspaceId, entry.conversationId);

    content.innerHTML = `
      <div class="dust-response" style="color: #0b465e; line-height: 1.8;">
        ${html}
        ${linksSection}
        ${openInDustButton}
      </div>
    `;

    return content;
  }

  /**
   * Create sidebar footer
   */
  function createSidebarFooter(entry) {
    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 15px 20px !important;
      border-top: 1px solid #e0e0e0 !important;
      background-color: rgba(82, 140, 142, 0.05) !important;
      display: flex !important;
      gap: 10px !important;
    `;

    // Copy Answer button
    const copyBtn = document.createElement('button');
    copyBtn.innerHTML = '📋 Copy Answer';
    copyBtn.className = 'dust-btn dust-btn-secondary';
    copyBtn.style.cssText = `
      flex: 1 !important;
      padding: 10px 15px !important;
      background-color: #528c8e !important;
      color: white !important;
      border: none !important;
      border-radius: 6px !important;
      cursor: pointer !important;
      font-size: 13px !important;
      font-weight: 500 !important;
      transition: background-color 0.2s !important;
    `;
    copyBtn.addEventListener('click', async () => {
      await Formatting.copyAnswerText(entry.answer);
    });
    copyBtn.addEventListener('mouseover', () => {
      copyBtn.style.backgroundColor = '#6a9c9e';
    });
    copyBtn.addEventListener('mouseout', () => {
      copyBtn.style.backgroundColor = '#528c8e';
    });

    // Copy Links button
    const copyLinksBtn = document.createElement('button');
    copyLinksBtn.innerHTML = '🔗 Copy Links';
    copyLinksBtn.className = 'dust-btn dust-btn-secondary';
    copyLinksBtn.style.cssText = copyBtn.style.cssText;
    if (!entry.links || entry.links.length === 0) {
      copyLinksBtn.disabled = true;
      copyLinksBtn.style.opacity = '0.6';
      copyLinksBtn.style.cursor = 'not-allowed';
    } else {
      copyLinksBtn.addEventListener('click', async () => {
        await Formatting.copyLinksText(entry.links || []);
      });
      copyLinksBtn.addEventListener('mouseover', () => {
        copyLinksBtn.style.backgroundColor = '#6a9c9e';
      });
      copyLinksBtn.addEventListener('mouseout', () => {
        copyLinksBtn.style.backgroundColor = '#528c8e';
      });
    }

    footer.appendChild(copyBtn);
    footer.appendChild(copyLinksBtn);

    return footer;
  }

  /**
   * Setup click-outside listener to close sidebar
   */
  function setupClickOutsideListener(sidePanel) {
    const clickOutside = (event) => {
      console.log('[History] Click detected, target:', event.target);

      // Ignore clicks on the sidebar itself
      if (sidePanel && !sidePanel.contains(event.target)) {
        console.log('[History] Click is outside sidebar');

        // Also ignore clicks on any buttons or the table
        const isButton = event.target.closest('button');
        const isTableRow = event.target.closest('tr');

        console.log('[History] isButton:', isButton, 'isTableRow:', isTableRow);

        if (!isButton && !isTableRow) {
          console.log('[History] Closing sidebar due to outside click');
          closeHistorySidePanel();
        } else {
          console.log('[History] Ignoring click on button or table');
        }
      } else {
        console.log('[History] Click is inside sidebar, ignoring');
      }
    };

    // Delay adding the listener to prevent immediate closing from the opening click
    setTimeout(() => {
      console.log('[History] Adding click-outside listener');
      document.addEventListener('click', clickOutside);
      sidePanel._clickListener = clickOutside; // Store for cleanup
    }, 500);
  }

  /**
   * Close history sidebar
   */
  function closeHistorySidePanel() {
    const sidePanel = document.getElementById('history-side-panel');
    if (!sidePanel) return;

    console.log('[History] Closing sidebar with animation...');

    // Remove listener
    if (sidePanel._clickListener) {
      document.removeEventListener('click', sidePanel._clickListener);
    }

    // Remove open class (triggers slide-out animation)
    sidePanel.classList.remove('dust-panel-open');

    // Remove from DOM after animation
    setTimeout(() => {
      if (sidePanel && sidePanel.parentNode) {
        sidePanel.parentNode.removeChild(sidePanel);
        console.log('[History] Sidebar removed from DOM');
      }
    }, 300);
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
