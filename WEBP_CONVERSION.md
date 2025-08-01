# WebP to PNG Conversion Feature

## Overview
This feature allows the extension to automatically convert WebP images to PNG format when downloading, providing better compatibility across different applications and systems.

## How It Works

### 1. Detection
The extension detects WebP images by checking if the image URL contains:
- `.webp` extension (case-insensitive)
- `webp` anywhere in the URL (for URLs with query parameters or paths containing 'webp')

### 2. Conversion Process
When a WebP image is detected and the conversion option is enabled:

1. **Load the WebP image**: Creates a new Image element with CORS handling
2. **Draw to Canvas**: Renders the WebP image onto an HTML5 canvas
3. **Convert to PNG**: Uses `canvas.toBlob()` to generate a PNG blob
4. **Download**: Sends the PNG data to the background script for download

### 3. Filename Handling
- Automatically changes `.webp` extensions to `.png`
- Preserves the original filename structure
- Handles edge cases where there's no clear extension

## Browser Compatibility
- **Canvas API**: Supported in all modern browsers (IE9+)
- **toBlob()**: Supported in all modern browsers
- **PNG conversion**: Universal support across all browsers

## Error Handling
The system includes robust error handling:
- **CORS errors**: Gracefully handled with anonymous cross-origin requests
- **Loading failures**: Falls back to normal download mode
- **Timeout protection**: 10-second timeout prevents hanging
- **Canvas errors**: Catches drawing/conversion errors

## Settings Integration
- **Storage key**: `ihs_convert_webp_to_png`
- **Default value**: `false` (disabled by default)
- **UI location**: Advanced settings section in popup
- **Real-time updates**: Changes are immediately applied to active tabs

## Performance Considerations
- **Memory usage**: Temporary canvas creation for conversion
- **Processing time**: Slight delay for conversion process
- **Network**: May require re-downloading the image for conversion
- **Fallback**: Always falls back to normal download if conversion fails

## Usage Examples

### Enable/Disable
```javascript
// Enable WebP to PNG conversion
chrome.storage.sync.set({ 'ihs_convert_webp_to_png': true });

// Disable WebP to PNG conversion  
chrome.storage.sync.set({ 'ihs_convert_webp_to_png': false });
```

### URLs that will be converted
- `https://example.com/image.webp`
- `https://example.com/image.WEBP`
- `https://cdn.example.com/webp/photo.jpg` (contains 'webp' in path)
- `https://api.example.com/image?format=webp`

### URLs that will NOT be converted
- `https://example.com/image.jpg`
- `https://example.com/image.png`
- `https://example.com/image.gif`

## Code Architecture

### Content Script (`content.js`)
- `convertWebpImageToPng()`: Main conversion function
- `downloadElement()`: Modified to check for WebP conversion
- Settings handling and initialization

### Popup Script (`popup.js`)
- UI checkbox for enabling/disabling the feature
- Settings persistence and loading
- Real-time updates to content scripts

### Background Script (`background.js`)
- Handles converted PNG downloads via `download_canvas_image` message type
- No modifications needed for basic functionality

## Testing
Use the included `test-webp.html` file to test WebP detection and conversion functionality in a controlled environment.
