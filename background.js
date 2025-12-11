// Background service worker for making API calls via CORS proxy
// Direct calls fail because chrome-extension:// origin is blocked by Dust API

// IMPORTANT: Replace this with your Cloudflare Worker URL after deployment
// See DEPLOY_PROXY.md for instructions
const PROXY_URL = 'https://dust-proxy.pro-julienp.workers.dev';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'makeApiCall') {
    makeApiCall(request.apiUrl, request.apiKey, request.requestBody)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep the message channel open for async response
  }
});

async function makeApiCall(apiUrl, apiKey, requestBody) {
  console.log('Making API call via proxy:', PROXY_URL);

  // Call the proxy instead of Dust API directly
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      apiUrl: apiUrl,
      apiKey: apiKey,
      requestBody: requestBody
    })
  });

  console.log('Proxy response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Proxy error (${response.status}): ${errorText}`);
  }

  const responseData = await response.json();
  return responseData;
}
