// Formatting utilities for display

const Formatting = {
  /**
   * Format a timestamp as relative time (e.g., "2 mins ago", "1 hour ago")
   * @param {number} timestamp - Unix timestamp in milliseconds
   * @returns {string} Formatted relative time string
   */
  formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    // Less than a minute
    if (diff < 60000) {
      return 'just now';
    }

    // Minutes
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) {
      return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
    }

    // Hours
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }

    // Days
    const days = Math.floor(hours / 24);
    if (days < 7) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }

    // For older dates, show absolute date
    return new Date(timestamp).toLocaleDateString();
  },

  /**
   * Format a timestamp as absolute time
   * @param {number} timestamp - Unix timestamp in milliseconds
   * @returns {string} Formatted date and time string
   */
  formatAbsoluteTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
  },

  /**
   * Truncate text to a maximum length with ellipsis
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length (default: 100)
   * @returns {string} Truncated text with "..." if needed
   */
  truncateText(text, maxLength = 100) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  },

  /**
   * Format duration in milliseconds to human-readable format
   * @param {number} duration - Duration in milliseconds
   * @returns {string} Formatted duration (e.g., "1.5s", "234ms")
   */
  formatDuration(duration) {
    if (!duration) return 'N/A';

    if (duration < 1000) {
      return `${duration}ms`;
    }

    const seconds = (duration / 1000).toFixed(1);
    return `${seconds}s`;
  },

  /**
   * Extract domain from URL
   * @param {string} url - Full URL
   * @returns {string} Domain name
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      return url;
    }
  },

  /**
   * Format page title and URL for display
   * @param {string} title - Page title
   * @param {string} url - Page URL
   * @returns {Object} Object with formatted title and domain
   */
  formatPageInfo(title, url) {
    const domain = this.extractDomain(url);
    const displayTitle = this.truncateText(title, 50) || domain;

    return {
      title: displayTitle,
      domain: domain,
      fullUrl: url
    };
  },

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
   * Copy text to clipboard
   * @param {string} text - Text to copy
   * @returns {Promise<boolean>} True if successful
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error('Failed to copy:', err);
      return false;
    }
  },

  /**
   * Format file size in bytes to human-readable format
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size (e.g., "1.5 KB", "234 B")
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
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

      return `<li style="margin-bottom: 8px;"><a href="${safeUri}" target="_blank" rel="noopener noreferrer" style="color: #528c8e; text-decoration: none; word-break: break-word;">${safeText}</a></li>`;
    }).join('');

    return `<div style="margin-top: 32px; padding-top: 24px; border-top: 2px solid rgba(82, 140, 142, 0.3);"><h3 style="font-size: 18px; font-weight: 600; color: #0b465e; margin-bottom: 16px;">🔗 Links</h3><ul style="margin: 0; padding-left: 24px; list-style-type: disc;">${linksHtml}</ul></div>`;
  }
};

// Make available globally for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Formatting;
}
