# Deploy CORS Proxy to Cloudflare Workers

## Why You Need This
Chrome extensions send `Origin: chrome-extension://...` header with all requests, which the Dust API blocks. This tiny proxy forwards requests WITHOUT that origin header.

## Quick Deploy (2 minutes, FREE)

### 1. Create Cloudflare Account
- Go to https://workers.cloudflare.com/
- Sign up (free tier is enough - 100,000 requests/day)

### 2. Create a Worker
- Click "Create a Service" or "Create Worker"
- Give it a name like `dust-api-proxy`
- Click "Create Service"

### 3. Deploy the Code
- Click "Quick Edit"
- Delete all the existing code
- Copy the entire contents of `cloudflare-worker.js`
- Paste it into the editor
- Click "Save and Deploy"

### 4. Get Your Worker URL
- You'll see your worker URL like: `https://dust-api-proxy.YOUR-USERNAME.workers.dev`
- Copy this URL

### 5. Update Extension
- Open `background.js` in the extension
- Replace the API call section with the proxy URL
- Or just provide your worker URL and I'll update the code for you

## Security
- The proxy runs on YOUR Cloudflare account
- Only you can modify it
- No one else can see your API keys (they're sent through, not stored)
- Free tier is more than enough for personal use

## Alternative: Vercel/Netlify
If you prefer, you can also deploy to Vercel or Netlify Functions. Let me know!
