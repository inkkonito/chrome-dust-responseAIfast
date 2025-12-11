# Dust API Tester - Chrome Extension

A Chrome extension for testing the Dust API endpoint for creating assistant conversations.

## Features

- **API Setup**: Configure your API key, workspace ID, and agent ID
- **API Testing**: Send POST requests to the Dust API with custom request bodies
- **Response Viewer**: View formatted API responses with status codes and timing
- **Automatic Mentions**: Agent ID is automatically formatted into mentions array in all API requests

## Installation

1. Create placeholder icon files (or use your own icons):
   - `icon16.png` (16x16 pixels)
   - `icon48.png` (48x48 pixels)
   - `icon128.png` (128x128 pixels)

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" in the top right corner

4. Click "Load unpacked" and select the extension directory

## Usage

### 1. API Setup
- Click the extension icon in Chrome toolbar
- Click "API Setup" button
- Enter your Dust API Bearer Token
- Enter your Workspace ID (wId)
- Enter your Agent ID (Configuration ID) - optional
  - Leave empty if you don't want to trigger any agent
  - The extension will automatically format it into the mentions array
- Click "Save Configuration"

### 2. Test API
- Click the extension icon
- Click "Test API" button
- You'll see your workspace and agent configuration at the top
- Enter your message in the text field
- Click "Send"
- Wait for the response to appear below your message
- The response will be displayed automatically when it arrives

## API Endpoint

**POST** `https://dust.tt/api/v1/w/{wId}/assistant/conversations`

### Example Usage

The extension automatically formats your simple message input into the proper API request:

**What you type in the Test API page:**
```
Hello, how are you?
```

**What the extension sends to the API:**
```json
{
  "message": {
    "content": "Hello, how are you?",
    "context": {}
  },
  "blocking": true,
  "mentions": [
    {
      "configurationId": "your-agent-id-from-setup"
    }
  ]
}
```

**What you see:**
- Loading spinner while waiting
- The assistant's response appears below your message
- Clean, readable format - no JSON needed!

## Files Structure

```
chrome-dust-responseAI/
├── manifest.json       # Extension configuration
├── popup.html          # Main popup with two buttons
├── popup.js            # Popup logic
├── setup.html          # API setup page
├── setup.js            # Setup page logic
├── test.html           # API testing page
├── test.js             # Test page logic and API calls
├── styles.css          # Styling for all pages
├── icon16.png          # Extension icon (16x16)
├── icon48.png          # Extension icon (48x48)
├── icon128.png         # Extension icon (128x128)
└── README.md           # This file
```

## Notes

- Configuration (API key, workspace ID, agent ID) is saved using Chrome's `storage.sync` API
- CORS is handled through Chrome extension permissions
- All API calls are made directly from the extension to Dust API
- The agent ID is automatically formatted into the mentions array in every API request
- If agent ID is empty, an empty mentions array `[]` is sent (won't trigger any agent)
