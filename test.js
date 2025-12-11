document.addEventListener('DOMContentLoaded', function() {
  const testForm = document.getElementById('testForm');
  const messageInput = document.getElementById('messageInput');
  const backBtn = document.getElementById('backBtn');
  const configStatus = document.getElementById('configStatus');
  const responseSection = document.getElementById('responseSection');
  const loadingSection = document.getElementById('loadingSection');
  const errorSection = document.getElementById('errorSection');
  const responseContent = document.getElementById('responseContent');
  const errorBody = document.getElementById('errorBody');

  let config = null;

  // Load configuration
  chrome.storage.sync.get(null, function(result) {
    if (result.apiKey && result.workspaceId) {
      config = result;

      const agentInfo = config.agentId ? `Agent: ${config.agentId}` : 'No agent configured';
      configStatus.textContent = `Ready | Workspace: ${config.workspaceId} | ${agentInfo}`;
      configStatus.className = 'config-status configured';
    } else {
      configStatus.textContent = 'Warning: API not configured. Please go to Setup first.';
      configStatus.className = 'config-status not-configured';
      testForm.querySelector('button[type="submit"]').disabled = true;
    }
  });

  testForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const message = messageInput.value.trim();
    if (!message) {
      showError('Please enter a message');
      return;
    }

    // Check if config is loaded
    if (!config || !config.apiKey || !config.workspaceId) {
      showError('Configuration not loaded. Please refresh the page and try again.');
      return;
    }

    // Hide previous responses and show loading
    responseSection.style.display = 'none';
    errorSection.style.display = 'none';
    loadingSection.style.display = 'block';

    // Build request body according to Dust API spec
    const requestBody = buildRequestBody(message, config);

    // Construct API URL with EU endpoint
    const apiUrl = `https://eu.dust.tt/api/v1/w/${config.workspaceId}/assistant/conversations`;

    // Debug: Log request details
    console.log('API URL:', apiUrl);
    console.log('API Key (first 10 chars):', config.apiKey ? config.apiKey.substring(0, 10) + '...' : 'MISSING');
    console.log('Request Body:', JSON.stringify(requestBody, null, 2));

    // Make API call via background service worker (avoids CORS/origin issues)
    chrome.runtime.sendMessage({
      action: 'makeApiCall',
      apiUrl: apiUrl,
      apiKey: config.apiKey,
      requestBody: requestBody
    }, (response) => {
      loadingSection.style.display = 'none';

      if (chrome.runtime.lastError) {
        showError('Extension error: ' + chrome.runtime.lastError.message);
        return;
      }

      if (!response) {
        showError('No response from background service worker');
        return;
      }

      if (response.success) {
        console.log('API Response:', response.data);
        showResponse(response.data);
      } else {
        console.error('API Error:', response.error);
        const errorMessage = typeof response.error === 'string'
          ? response.error
          : JSON.stringify(response.error, null, 2);
        showError(errorMessage);
      }
    });
  });

  backBtn.addEventListener('click', function() {
    window.close();
  });

  function showResponse(data) {
    // Extract the assistant's answer from conversation.content[1][0].content
    let content = '';

    try {
      if (data.conversation && data.conversation.content && Array.isArray(data.conversation.content)) {
        // content[0] is the user message, content[1] is the assistant response
        if (data.conversation.content.length > 1) {
          const assistantMessage = data.conversation.content[1];

          // Check if it's an array with content
          if (Array.isArray(assistantMessage) && assistantMessage.length > 0) {
            content = assistantMessage[0].content || '';
          } else if (assistantMessage && assistantMessage.content) {
            content = assistantMessage.content;
          }
        }
      }

      // Fallback: if we couldn't extract the content, show full JSON
      if (!content) {
        console.log('Full response:', data);
        content = '```json\n' + JSON.stringify(data, null, 2) + '\n```';
      }
    } catch (error) {
      console.error('Error parsing response:', error);
      content = '```json\n' + JSON.stringify(data, null, 2) + '\n```';
    }

    // Render markdown to HTML
    try {
      if (typeof marked !== 'undefined' && marked.parse) {
        responseContent.innerHTML = marked.parse(content);
      } else if (typeof marked !== 'undefined') {
        // Fallback for older versions of marked
        responseContent.innerHTML = marked(content);
      } else {
        console.warn('Marked library not loaded, showing plain text');
        responseContent.textContent = content;
      }

      // Render LaTeX math formulas with KaTeX
      renderMath(responseContent);
    } catch (e) {
      console.error('Error rendering markdown:', e);
      responseContent.textContent = content;
    }

    responseSection.style.display = 'block';
  }

  function renderMath(element) {
    if (typeof katex === 'undefined') {
      console.warn('KaTeX not loaded, math formulas will not render');
      return;
    }

    // Get the HTML content
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

  function showError(errorMessage) {
    errorBody.textContent = errorMessage;
    errorSection.style.display = 'block';
  }

  // Request building helper functions
  function buildRequestBody(message, config) {
    const requestBody = {
      message: {
        content: message,
        mentions: buildMentions(config.agentId),
        context: buildContext(config)
      },
      blocking: true  // Always use blocking mode for now
    };

    // Add optional title if provided
    if (config.requestConfig?.title && config.requestConfig.title.trim()) {
      requestBody.title = config.requestConfig.title.trim();
    }

    // Add skipToolsValidation only if true
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
    // ONLY username and timezone are allowed - other fields cause 403
    const username = config.userContext?.username?.trim() || 'user-' + Math.random().toString(36).substr(2, 9);
    const timezone = config.userContext?.timezone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';

    // Return ONLY required fields
    return {
      username: username,
      timezone: timezone
    };
  }
});
