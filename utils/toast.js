/**
 * Toast notification system for non-blocking user feedback
 */
const Toast = {
  /**
   * Show a toast notification
   * @param {string} message - Message to display
   * @param {string} type - 'success', 'error', 'info', 'warning'
   * @param {number} duration - Duration in ms (default 3000)
   */
  show(message, type = 'info', duration = 3000) {
    // Remove any existing toast
    const existing = document.getElementById('dust-toast');
    if (existing) existing.remove();

    // Create toast element
    const toast = document.createElement('div');
    toast.id = 'dust-toast';
    toast.className = `dust-toast dust-toast-${type}`;

    // Add icon based on type
    const icons = {
      success: '✓',
      error: '✕',
      info: 'ℹ',
      warning: '⚠'
    };

    toast.innerHTML = `
      <span class="dust-toast-icon">${icons[type]}</span>
      <span class="dust-toast-message">${message}</span>
    `;

    // Add to DOM
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('dust-toast-show');
    });

    // Auto-dismiss after duration
    setTimeout(() => {
      toast.classList.remove('dust-toast-show');
      setTimeout(() => toast.remove(), 300); // Wait for fade out
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

// Export for use in content scripts and pages
if (typeof window !== 'undefined') {
  window.Toast = Toast;
}
