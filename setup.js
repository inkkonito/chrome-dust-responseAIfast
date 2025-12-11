document.addEventListener('DOMContentLoaded', function() {
  // Get form elements
  const setupForm = document.getElementById('setupForm');
  const backBtn = document.getElementById('backBtn');
  const messageDiv = document.getElementById('message');
  const advancedToggle = document.getElementById('advancedToggle');
  const advancedSection = document.getElementById('advancedSection');

  // Basic fields
  const apiKeyInput = document.getElementById('apiKey');
  const workspaceIdInput = document.getElementById('workspaceId');
  const agentIdInput = document.getElementById('agentId');

  // Advanced - User Context fields
  const usernameInput = document.getElementById('username');
  const timezoneInput = document.getElementById('timezone');

  // Advanced - Request Options fields
  const conversationTitleInput = document.getElementById('conversationTitle');
  const skipToolsValidationInput = document.getElementById('skipToolsValidation');
  const blockingModeInput = document.getElementById('blockingMode');

  // Load configuration on page load
  loadConfig();

  // Setup collapsible section toggle
  advancedToggle.addEventListener('click', function() {
    const isExpanded = advancedSection.style.display === 'block';
    const icon = advancedToggle.querySelector('.toggle-icon');
    const text = advancedToggle.querySelector('span:last-child');

    if (isExpanded) {
      advancedSection.style.display = 'none';
      icon.textContent = '▼';
      text.textContent = 'Show Advanced Options';
    } else {
      advancedSection.style.display = 'block';
      icon.textContent = '▲';
      text.textContent = 'Hide Advanced Options';
    }

    // Save UI state
    chrome.storage.sync.get(['uiState'], function(result) {
      const uiState = result.uiState || {};
      uiState.advancedExpanded = !isExpanded;
      chrome.storage.sync.set({ uiState: uiState });
    });
  });

  // Form submission
  setupForm.addEventListener('submit', function(e) {
    e.preventDefault();

    const config = collectFormData();

    // Validate required fields
    if (!validateRequiredFields(config)) {
      showMessage('Please fill in API Key and Workspace ID', 'error');
      return;
    }


    // Save configuration
    saveConfig(config);
  });

  // Back button
  backBtn.addEventListener('click', function() {
    window.close();
  });

  // Utility Functions

  function getDefaultConfig() {
    return {
      apiKey: '',
      workspaceId: '',
      agentId: '',
      userContext: {
        username: '',
        timezone: ''
      },
      requestConfig: {
        title: '',
        skipToolsValidation: false,
        blocking: true
      },
      uiState: {
        advancedExpanded: false
      }
    };
  }

  function migrateOldConfig(oldConfig) {
    const defaults = getDefaultConfig();
    return {
      apiKey: oldConfig.apiKey || '',
      workspaceId: oldConfig.workspaceId || '',
      agentId: oldConfig.agentId || '',
      userContext: defaults.userContext,
      requestConfig: defaults.requestConfig,
      uiState: defaults.uiState
    };
  }

  async function loadConfig() {
    chrome.storage.sync.get(null, function(result) {
      let config;

      // Check if we need to migrate old config
      if (result.apiKey && !result.userContext) {
        config = migrateOldConfig(result);
        // Save migrated config
        chrome.storage.sync.set(config);
      } else {
        const defaults = getDefaultConfig();
        config = {
          ...defaults,
          ...result,
          userContext: { ...defaults.userContext, ...(result.userContext || {}) },
          requestConfig: { ...defaults.requestConfig, ...(result.requestConfig || {}) },
          uiState: { ...defaults.uiState, ...(result.uiState || {}) }
        };
      }

      populateFormFields(config);
    });
  }

  function populateFormFields(config) {
    // Basic fields
    if (config.apiKey) apiKeyInput.value = config.apiKey;
    if (config.workspaceId) workspaceIdInput.value = config.workspaceId;
    if (config.agentId) agentIdInput.value = config.agentId;

    // User Context fields
    if (config.userContext) {
      if (config.userContext.username) usernameInput.value = config.userContext.username;
      if (config.userContext.timezone) timezoneInput.value = config.userContext.timezone;
    }

    // Request Options fields
    if (config.requestConfig) {
      if (config.requestConfig.title) conversationTitleInput.value = config.requestConfig.title;
      skipToolsValidationInput.checked = config.requestConfig.skipToolsValidation || false;
      blockingModeInput.checked = config.requestConfig.blocking !== false; // Default to true
    }

    // Restore UI state
    if (config.uiState && config.uiState.advancedExpanded) {
      advancedSection.style.display = 'block';
      advancedToggle.querySelector('.toggle-icon').textContent = '▲';
      advancedToggle.querySelector('span:last-child').textContent = 'Hide Advanced Options';
    }
  }

  function collectFormData() {
    return {
      apiKey: apiKeyInput.value.trim(),
      workspaceId: workspaceIdInput.value.trim(),
      agentId: agentIdInput.value.trim(),
      userContext: {
        username: usernameInput.value.trim(),
        timezone: timezoneInput.value.trim()
      },
      requestConfig: {
        title: conversationTitleInput.value.trim(),
        skipToolsValidation: skipToolsValidationInput.checked,
        blocking: blockingModeInput.checked
      }
    };
  }

  function validateRequiredFields(config) {
    return config.apiKey && config.workspaceId;
  }

  function saveConfig(config) {
    chrome.storage.sync.set(config, function() {
      showMessage('Configuration saved successfully!', 'success');
      setTimeout(() => {
        window.close();
      }, 1500);
    });
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
  }
});
