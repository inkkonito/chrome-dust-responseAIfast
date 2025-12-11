// Cloudflare Worker - CORS Proxy for Dust API
// Deploy at: https://workers.cloudflare.com/

export default {
  async fetch(request, env, ctx) {
    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Parse the request body
    const body = await request.json();
    const { apiUrl, apiKey, requestBody } = body;

    // Validate inputs
    if (!apiUrl || !apiKey || !requestBody) {
      return new Response('Missing required fields', { status: 400 });
    }

    // Make the request to Dust API WITHOUT chrome-extension origin
    try {
      const dustResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          // No Origin header - this is the key!
        },
        body: JSON.stringify(requestBody)
      });

      const responseData = await dustResponse.text();

      // Return the response with CORS headers
      return new Response(responseData, {
        status: dustResponse.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};
