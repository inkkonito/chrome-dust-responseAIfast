// Storage management utilities for history tracking

const HistoryStorage = {
  // Maximum number of history entries to keep
  MAX_ENTRIES: 100,

  // Maximum length for selectedText storage
  MAX_TEXT_LENGTH: 500,

  /**
   * Get all history entries
   * @returns {Promise<Array>} Array of history entries
   */
  async getHistory() {
    const result = await chrome.storage.local.get('history');
    return result.history || [];
  },

  /**
   * Get the last N history entries
   * @param {number} limit - Number of entries to retrieve
   * @returns {Promise<Array>} Array of history entries
   */
  async getRecentHistory(limit = 5) {
    const history = await this.getHistory();
    return history.slice(0, limit);
  },

  /**
   * Add a new entry to history
   * @param {Object} entry - History entry object
   * @returns {Promise<string>} ID of the created entry
   */
  async addEntry(entry) {
    const history = await this.getHistory();

    // Generate unique ID if not provided
    if (!entry.id) {
      entry.id = crypto.randomUUID();
    }

    // Truncate selectedText if too long
    if (entry.selectedText && entry.selectedText.length > this.MAX_TEXT_LENGTH) {
      entry.selectedText = entry.selectedText.substring(0, this.MAX_TEXT_LENGTH) + '...';
    }

    // Add timestamp if not provided
    if (!entry.timestamp) {
      entry.timestamp = Date.now();
    }

    // Add to beginning of array
    history.unshift(entry);

    // Enforce max entries limit
    if (history.length > this.MAX_ENTRIES) {
      history.splice(this.MAX_ENTRIES);
    }

    // Save updated history
    await chrome.storage.local.set({ history });

    // Broadcast update to all listeners
    chrome.runtime.sendMessage({ action: 'historyUpdated' }).catch(() => {
      // Ignore errors if no listeners
    });

    return entry.id;
  },

  /**
   * Get a single history entry by ID
   * @param {string} id - Entry ID
   * @returns {Promise<Object|null>} History entry or null if not found
   */
  async getEntry(id) {
    const history = await this.getHistory();
    return history.find(entry => entry.id === id) || null;
  },

  /**
   * Delete a history entry by ID
   * @param {string} id - Entry ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteEntry(id) {
    const history = await this.getHistory();
    const index = history.findIndex(entry => entry.id === id);

    if (index === -1) {
      return false;
    }

    history.splice(index, 1);
    await chrome.storage.local.set({ history });

    chrome.runtime.sendMessage({ action: 'historyUpdated' }).catch(() => {
      // Ignore errors if no listeners
    });

    return true;
  },

  /**
   * Clear all history entries
   * @returns {Promise<void>}
   */
  async clearHistory() {
    await chrome.storage.local.set({ history: [] });

    chrome.runtime.sendMessage({ action: 'historyUpdated' }).catch(() => {
      // Ignore errors if no listeners
    });
  },

  /**
   * Search history by query or answer text
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} Filtered history entries
   */
  async searchHistory(searchTerm) {
    const history = await this.getHistory();
    const term = searchTerm.toLowerCase();

    return history.filter(entry => {
      const query = (entry.query || entry.selectedText || '').toLowerCase();
      const answer = (entry.answer || '').toLowerCase();
      return query.includes(term) || answer.includes(term);
    });
  },

  /**
   * Filter history by agent ID
   * @param {string} agentId - Agent ID to filter by
   * @returns {Promise<Array>} Filtered history entries
   */
  async filterByAgent(agentId) {
    const history = await this.getHistory();
    return history.filter(entry => entry.agentId === agentId);
  },

  /**
   * Export history as JSON
   * @returns {Promise<string>} JSON string of all history
   */
  async exportHistory() {
    const history = await this.getHistory();
    return JSON.stringify(history, null, 2);
  }
};

// Make available globally for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HistoryStorage;
}
