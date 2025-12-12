# Dust AI Assistant - Chrome Extension

A powerful Chrome extension that brings **Dust AI** directly into your browser. Select any text on any webpage and instantly get AI-powered answers with contextual sources, all displayed in an elegant side panel.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 🌟 Features

### Core Features
- **Text Selection AI Query** - Select any text on any webpage and ask AI about it
- **Beautiful Side Panel** - Non-intrusive sliding panel with your AI responses
- **Structured Source Links** - Automatically extracts and displays relevant sources from Dust
- **Query History** - Full history of all your queries with search and filtering
- **One-Click Copy** - Copy answers, links, or both to clipboard
- **Markdown & Math Support** - Beautifully rendered markdown with KaTeX math formulas
- **Open in Dust** - Direct link to continue conversations in Dust webapp

### Advanced Features
- **Request Timeout Protection** - 30-second timeout prevents indefinite hangs
- **Live Request Timer** - See exactly how long requests take
- **Cancel Anytime** - Cancel slow requests with one click
- **Retry on Error** - Easy retry button when requests fail
- **Toast Notifications** - Professional non-blocking feedback
- **Bulk Operations** - Multi-select and bulk delete history entries
- **Pagination** - Browse history with 20/50/100 entries per page
- **Advanced Filtering** - Search by query, answer, or page URL

---

## 📦 Installation

### Prerequisites
- Google Chrome or Chromium-based browser (Edge, Brave, etc.)
- Dust API access with API key and workspace ID
- Node.js (optional, only for proxy deployment)

### Step 1: Get the Extension Files
1. Clone this repository or download as ZIP:
   ```bash
   git clone <repository-url>
   cd chrome-dust-responseAI
   ```

### Step 2: Generate Icons (Optional)
If you want custom icons, open `icon-generator.html` in your browser and download the generated icons. Otherwise, create placeholder PNG files:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

### Step 3: Deploy CORS Proxy (Required)
The extension requires a Cloudflare Worker proxy to bypass CORS restrictions.

1. **Go to Cloudflare Workers:**
   - Visit [dash.cloudflare.com](https://dash.cloudflare.com)
   - Navigate to Workers & Pages
   - Click "Create Application" → "Create Worker"

2. **Deploy the proxy:**
   - Copy code from `cloudflare-worker.js`
   - Paste into the Cloudflare Worker editor
   - Click "Deploy"
   - Copy your worker URL (e.g., `https://dust-proxy.your-name.workers.dev`)

3. **Update the extension:**
   - Open `background.js`
   - Update line 9 with your worker URL:
     ```javascript
     const PROXY_URL = 'https://dust-proxy.your-name.workers.dev';
     ```

See `DEPLOY_PROXY.md` for detailed proxy deployment instructions.

### Step 4: Load Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **"Load unpacked"**
4. Select the extension directory
5. Extension icon should appear in your toolbar

---

## 🚀 Quick Start Guide

### First-Time Setup

1. **Click the extension icon** in your Chrome toolbar
2. **Click "Setup"** button
3. **Enter your credentials:**
   - **API Key** - Your Dust API Bearer Token (starts with `dust_...`)
   - **Workspace ID** - Your workspace identifier (e.g., `abc123xyz`)
   - **Agent ID** - Optional: specific assistant configuration ID
   - **Agent Name** - Optional: display name for the agent
4. **Click "Save Configuration"**
5. **Test the connection** by clicking "Test API"

### Using the Extension

#### Method 1: Popup Button (Quick Access)
1. Click the extension icon
2. Click "Activate Selection Mode"
3. Select text on any webpage
4. Click the "Ask AI" button that appears
5. View response in the side panel

#### Method 2: Context Menu (Right-Click)
1. Select text on any webpage
2. Right-click the selected text
3. Click "Ask Dust AI about this"
4. Response appears in side panel

#### Method 3: Keyboard Shortcut (Coming Soon)
Configurable keyboard shortcut for power users.

---

## 📖 Detailed Usage

### Side Panel Features

When you query AI, a beautiful side panel slides in from the right side of your page:

**Panel Header:**
- **Expand/Collapse** button (⇔) - Toggle panel width
- **Close** button (✕) - Hide the panel

**Content Area:**
- **AI Response** - Markdown-formatted answer with syntax highlighting
- **Math Formulas** - Rendered beautifully with KaTeX
- **Source Links** - Clickable links to referenced sources
- **Open in Dust** button - Continue conversation in Dust webapp

**Footer Actions:**
- **📋 Copy Answer** - Copy just the answer text
- **🔗 Copy Links** - Copy all source links
- **📚 View History** - Open full history page

### Request Management

#### Live Timer
When making a request, you'll see:
```
Asking AI... 3s
[Cancel Request]
```
- Timer shows elapsed seconds
- Updates every second
- Helps you understand request duration

#### Cancel Requests
If a request is taking too long:
1. Click the **"Cancel Request"** button (red)
2. Panel closes immediately
3. You can try again or select different text

#### Timeout Protection
- All requests automatically timeout after 30 seconds
- Clear error message: _"Request timed out after 30 seconds. Please check your network connection."_
- No more indefinite loading spinners

#### Retry on Error
When requests fail, you get:
```
⚠️ Request Failed
[Error message]
[🔄 Retry] [Close]
```
- **Retry** button repeats the same query
- **Close** button dismisses the error
- Original query is preserved for retry

### Query History

Access your full query history by clicking **"📚 View History"** in the panel footer or from the popup.

#### History Page Features

**Search & Filter:**
- **Search bar** - Search by query text or answer content
- **Agent filter** - Filter by specific assistant
- **Page size selector** - Show 20, 50, or 100 entries per page

**Pagination:**
- Navigate through pages with Previous/Next buttons
- See current page and total entries
- Example: "Displaying 1-20 of 156 entries"

**Multi-Select Operations:**
- **Select All** checkbox - Select all entries on current page
  - Unchecked: None selected
  - Checked: All on page selected
  - Indeterminate (−): Some on page selected
- **Individual checkboxes** - Select specific entries
- **Bulk Delete** button - Delete multiple entries at once
- Selection persists across pages

**Entry Actions:**
Each history entry shows:
- Timestamp (relative + absolute)
- Page URL and title
- Query text (first 100 chars)
- Answer preview (first 100 chars)
- Action buttons:
  - **👁️ View** - See full answer in modal
  - **📋 Copy** - Copy answer to clipboard
  - **🔗 Links** - Copy all source links
  - **🗑️ Delete** - Remove entry

**Modal Viewer:**
Click "View" on any entry to see:
- Full answer with markdown rendering
- All source links
- Copy buttons for answer and links
- "Open in Dust" button (if conversation ID available)

### Toast Notifications

The extension uses professional toast notifications instead of blocking alerts:

**Types:**
- **✓ Success** (green) - "Answer copied to clipboard!"
- **✕ Error** (red) - "Failed to copy to clipboard"
- **ℹ Info** (blue) - Informational messages
- **⚠ Warning** (yellow) - "No answer to copy"

**Behavior:**
- Appears bottom-right corner
- Auto-dismisses after 3 seconds
- Slides in/out smoothly
- Non-blocking (you can keep working)
- Multiple toasts queue automatically

---

## ⚙️ Configuration Options

### Basic Settings (Required)

**API Key:**
- Get from: [Dust Platform Settings](https://dust.tt/settings)
- Format: `dust_xxxxxxxxxxxxxxxxxxxxxxxxx`
- Stored securely in Chrome sync storage
- Never exposed to webpages

**Workspace ID:**
- Found in your Dust workspace URL
- Format: Alphanumeric string (e.g., `abc123xyz`)
- Example URL: `https://dust.tt/w/abc123xyz`

**Agent ID (Optional):**
- Specific assistant configuration ID
- Leave empty to use default workspace assistant
- Format: Alphanumeric string

**Agent Name (Optional):**
- Display name for easier identification
- Shows in history and UI
- Defaults to "Dust Assistant" if empty

### Advanced Settings (Optional)

**Timezone:**
- Default: Browser timezone
- Used for timestamp displays
- Format: IANA timezone (e.g., "America/New_York")

**Username:**
- Optional user identifier
- Sent with API requests for context
- Default: "Dust User"

**Conversation Title:**
- Default title for new conversations
- Shown in Dust webapp
- Default: "Chrome Extension Query"

---

## 🛠️ Architecture & Technical Details

### File Structure

```
chrome-dust-responseAI/
├── manifest.json              # Extension configuration (Manifest V3)
├── background.js              # Service worker for API calls
├── content.js                 # Content script for text selection
├── popup.html / popup.js      # Extension popup interface
├── setup.html / setup.js      # Configuration page
├── history.html / history.js  # Query history viewer
├── styles.css                 # Global styles
├── utils/
│   ├── storage.js            # History storage management
│   ├── formatting.js         # Formatting utilities
│   ├── toast.js              # Toast notification system
│   └── response.js           # API response parsing
├── marked.min.js             # Markdown rendering
├── katex.min.js              # Math formula rendering
├── katex.min.css             # KaTeX styles
├── cloudflare-worker.js      # CORS proxy code
├── DEPLOY_PROXY.md           # Proxy deployment guide
└── README.md                 # This file
```

### Technology Stack

**Frontend:**
- Vanilla JavaScript (no frameworks)
- HTML5 + CSS3
- Chrome Extension APIs (Manifest V3)

**Libraries:**
- **Marked.js** - Markdown parsing and rendering
- **KaTeX** - Mathematical formula rendering
- **Chrome Storage API** - Configuration persistence
- **Chrome Runtime API** - Message passing

**Backend:**
- **Cloudflare Workers** - CORS proxy
- **Dust API** - AI assistant endpoints

### Data Flow

1. **User selects text** → Content script captures selection
2. **Content script** → Sends message to background service worker
3. **Background worker** → Makes API call via Cloudflare proxy
4. **Cloudflare proxy** → Forwards request to Dust API
5. **Dust API** → Returns response with answer + sources
6. **Background worker** → Extracts answer and links, saves to history
7. **Content script** → Receives response, displays in side panel
8. **History storage** → Persists query for later viewing

### Storage

**Chrome Storage Sync (Config):**
- API key, workspace ID, agent ID
- User preferences (timezone, username)
- Syncs across devices

**Chrome Storage Local (History):**
- Query history (last 1000 entries)
- Timestamps, queries, answers, links
- Stored locally per device

### Security

**CORS Protection:**
- Chrome extensions can't make direct cross-origin requests from content scripts
- Cloudflare Worker acts as proxy to bypass CORS
- API key never exposed to webpage context

**Content Security:**
- All user input is HTML-escaped
- No eval() or inline scripts
- CSP-compliant

**API Key Storage:**
- Stored in Chrome's secure storage
- Only accessible by extension
- Never logged or transmitted except to Dust API

---

## 🎨 Customization

### Changing DataDome Brand Colors

All colors are centralized. To customize:

**Primary Colors:**
```javascript
// In content.js, popup.js, history.js, etc.
--dd-primary: #0b465e;      // Navy blue (headers, buttons)
--dd-secondary: #528c8e;    // Teal (accents, links)
--dd-light: #ecf0f1;        // Light gray (backgrounds)
--dd-primary-hover: #083545;  // Darker navy
--dd-secondary-hover: #6a9c9e; // Darker teal
```

### Custom Icons

Use the icon generator:
1. Open `icon-generator.html` in browser
2. Modify the `createIcon()` function to change design
3. Download generated icons
4. Replace `icon16.png`, `icon48.png`, `icon128.png`

---

## 🐛 Troubleshooting

### Common Issues

#### "API not configured" Error
**Solution:**
1. Click extension icon → Setup
2. Enter API key and workspace ID
3. Click "Save Configuration"
4. Try again

#### "Request timed out after 30 seconds"
**Possible causes:**
- Slow network connection
- Dust API is slow to respond
- CORS proxy is down

**Solutions:**
1. Check your internet connection
2. Click "Retry" button
3. Verify proxy is deployed and URL is correct in `background.js`

#### "Proxy error (500)" or "Failed to fetch"
**Cause:** CORS proxy is not deployed or URL is incorrect

**Solution:**
1. Follow `DEPLOY_PROXY.md` to deploy Cloudflare Worker
2. Update `PROXY_URL` in `background.js` line 9
3. Reload extension (`chrome://extensions/` → Click reload icon)

#### Side panel doesn't appear
**Solutions:**
1. Make sure you selected text first
2. Try right-click → "Ask Dust AI about this"
3. Check browser console for errors (F12 → Console)
4. Reload the page

#### History is empty
**Possible causes:**
- No queries have been made yet
- History was cleared
- Storage quota exceeded

**Check:**
- Make at least one query first
- Open `chrome://extensions/` → Extension details → Storage → Check size

#### Toast notifications don't appear
**Solution:**
- Check if another extension is blocking them
- Look for console errors (F12)
- Ensure `styles.css` is loaded

---

## 📊 Performance & Limits

### Storage Limits
- **Max history entries:** 1000 (configurable in `utils/storage.js`)
- **Chrome storage limit:** ~10MB per extension
- Oldest entries auto-deleted when limit reached

### API Limits
- Dust API has rate limits (check Dust documentation)
- Extension respects rate limits
- Failed requests can be retried

### Performance Optimization
- Lazy loading for large history
- Pagination reduces DOM size
- Debounced search (300ms)
- Efficient Set-based selection tracking

---

## 🔒 Privacy & Data

### What Data is Stored Locally?
- API credentials (encrypted by Chrome)
- User preferences (timezone, username, etc.)
- Query history (queries, answers, timestamps, URLs)

### What Data is Sent to Dust?
- Your query text
- Optional: username, conversation title
- Agent configuration ID

### What Data is NOT Sent?
- Your browsing history (except URLs of pages where you made queries)
- Cookies or session data
- Any data from pages you don't query

### Data Deletion
- Clear history: Click "Clear All" in history page (or use bulk delete)
- Reset config: Go to Setup → Clear all fields → Save
- Complete wipe: Uninstall extension

---

## 🚀 Advanced Usage

### For Developers

**Enable Debug Mode:**
```javascript
// In background.js or content.js
console.log('[Dust] Debug:', ...);
```
Check browser console (F12) for detailed logs.

**Modify Request Body:**
Edit `buildRequestBody()` in `content.js` around line 488 to customize:
```javascript
function buildRequestBody(selectedText, config) {
  return {
    message: {
      content: selectedText,
      context: {
        // Add custom context here
        timezone: config.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        username: config.username || 'Dust User'
      }
    },
    blocking: true,
    mentions: config.agentId ? [{
      configurationId: config.agentId
    }] : []
  };
}
```

**Custom Keyboard Shortcuts:**
Edit `manifest.json` to add:
```json
"commands": {
  "activate-selection": {
    "suggested_key": {
      "default": "Ctrl+Shift+D",
      "mac": "Command+Shift+D"
    },
    "description": "Activate selection mode"
  }
}
```

### API Response Structure

Dust API returns:
```json
{
  "conversation": {
    "sId": "conv_abc123",
    "content": [
      { "content": "User query", ... },
      [{
        "content": "AI response",
        "actions": [{
          "output": [{
            "type": "resource",
            "resource": {
              "uri": "https://example.com",
              "text": "Source title"
            }
          }]
        }]
      }]
    ]
  }
}
```

The extension automatically extracts:
- **Answer**: `conversation.content[1][0].content`
- **Links**: `conversation.content[1][0].actions[*].output[*].resource`
- **Conversation ID**: `conversation.sId`

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

**Areas for improvement:**
- Keyboard shortcuts
- Multi-language support
- Dark mode
- Export history to CSV/JSON
- Conversation threading
- Voice input

---

## 📝 Changelog

### Version 2.0.0 (Current)
- ✨ Added request timeout protection (30s)
- ✨ Added live request timer
- ✨ Added cancel button for requests
- ✨ Added retry button on errors
- ✨ Replaced blocking alerts with toast notifications
- ✨ Added multi-select and bulk delete in history
- ✨ Added pagination (20/50/100 per page)
- ♻️ Refactored duplicate code into shared utilities (~250 lines removed)
- 🐛 Fixed numerous edge cases and race conditions
- 💄 Harmonized all button colors to DataDome brand
- 📚 Comprehensive README documentation

### Version 1.0.0
- 🎉 Initial release
- ✅ Text selection and AI query
- ✅ Side panel with markdown support
- ✅ Query history
- ✅ Source link extraction
- ✅ Copy to clipboard
- ✅ Open in Dust

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🙏 Acknowledgments

- **Dust.tt** - AI platform and API
- **Marked.js** - Markdown rendering
- **KaTeX** - Math formula rendering
- **DataDome** - Brand colors and design inspiration
- **Cloudflare** - CORS proxy infrastructure

---

## 📧 Support

**Issues?**
- Check the Troubleshooting section above
- Open an issue on GitHub
- Check Dust API documentation

**Feature requests?**
- Open a GitHub issue with `[Feature Request]` tag
- Describe use case and expected behavior

---

## 🔗 Useful Links

- [Dust Platform](https://dust.tt)
- [Dust API Documentation](https://docs.dust.tt)
- [Chrome Extension Developer Guide](https://developer.chrome.com/docs/extensions/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)

---

**Made with ❤️ for the Dust community**

*Last updated: December 2024*
