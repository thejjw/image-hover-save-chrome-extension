# WebP to PNG Conversion Feature

## Overview
This feature allows the extension to automatically convert WebP images to PNG format when downloading, providing better compatibility across different applications and systems.

## How It Works

### 1. Detection
The extension detects WebP images by checking if the image URL contains:
- `.webp` extension (case-insensitive)
- `webp` anywhere in the URL (for URLs with query parameters or paths containing 'webp')

### 2. Animation Detection
Before converting, the extension checks if the WebP image is animated:
- **Fetches only the first 1KB** of the image file for efficient header analysis
- **Parses WebP file structure** to look for animation indicators:
  - `VP8X` chunk with animation flag (bit 1)
  - `ANIM` chunk (animation parameters)
  - `ANMF` chunk (animation frames)
- **Skips conversion** for animated WebP to preserve animation functionality
- **Safe fallback**: If animation status cannot be determined, skips conversion

### 3. Conversion Process
When a WebP image is detected and the conversion option is enabled:

1. **Check for animation**: Uses efficient header parsing to detect animated WebP
2. **Skip animated WebP**: Preserves animation by not converting animated images
3. **Load static WebP**: Creates a new Image element with CORS handling for static images
4. **Draw to Canvas**: Renders the static WebP image onto an HTML5 canvas
5. **Convert to PNG**: Uses `canvas.toBlob()` to generate a PNG blob
6. **Download**: Sends the PNG data to the background script for download

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
- **Animation detection**: Efficiently checks WebP headers without downloading full files
- **Animated WebP preservation**: Skips conversion for animated images to maintain functionality
- **CORS errors**: Gracefully handled with anonymous cross-origin requests
- **Loading failures**: Falls back to normal download mode
- **Timeout protection**: 10-second timeout prevents hanging
- **Canvas errors**: Catches drawing/conversion errors
- **Header parsing errors**: Safe fallback when WebP structure cannot be analyzed

## Settings Integration
- **Storage key**: `ihs_convert_webp_to_png`
- **Default value**: `false` (disabled by default)
- **UI location**: Advanced settings section in popup
- **Real-time updates**: Changes are immediately applied to active tabs

## Performance Considerations
- **Header-only fetching**: Only downloads first 1KB for animation detection
- **Memory usage**: Temporary canvas creation for conversion
- **Processing time**: Slight delay for animation detection + conversion process
- **Network efficiency**: Minimal overhead for animation checking
- **Fallback**: Always falls back to normal download if conversion fails

## Usage Examples

### Enable/Disable
```javascript
// Enable WebP to PNG conversion
chrome.storage.sync.set({ 'ihs_convert_webp_to_png': true });

// Disable WebP to PNG conversion  
chrome.storage.sync.set({ 'ihs_convert_webp_to_png': false });
```

### URLs that will be converted (static WebP only)
- `https://example.com/image.webp` ✅ (if static)
- `https://example.com/image.WEBP` ✅ (if static)
- `https://cdn.example.com/webp/photo.jpg` ✅ (contains 'webp' in path, if static)
- `https://api.example.com/image?format=webp` ✅ (if static)

### URLs that will NOT be converted
- `https://example.com/animated.webp` ❌ (animated WebP - preserves animation)
- `https://example.com/image.jpg` ❌ (not WebP)
- `https://example.com/image.png` ❌ (not WebP)
- `https://example.com/image.gif` ❌ (not WebP)

## Code Architecture

### Content Script (`content.js`)
- `convertWebpImageToPng()`: Main conversion function with animation detection
- `isAnimatedWebP()`: WebP header analysis for animation detection
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

## Technical Details: WebP Animation Detection

### WebP File Structure
WebP files follow the RIFF container format:
```
RIFF [file size] WEBP [chunks...]
```

### Animation Detection Method
The extension uses efficient header parsing to detect animated WebP:

1. **Fetch Headers Only**: Uses `Range: bytes=0-1024` to download only the first 1KB
2. **Parse RIFF Structure**: Validates the file as a proper WebP
3. **Scan Chunks**: Looks for animation-specific chunks:
   - **VP8X**: Extended format with flags byte (animation flag = bit 1)
   - **ANIM**: Animation parameters chunk
   - **ANMF**: Animation frame chunks

### Chunk Analysis
```javascript
// VP8X chunk structure (simplified)
VP8X [size] [flags] [canvas_width] [canvas_height]
// If flags & 0x02, then animation is present

// ANIM chunk indicates animation parameters
ANIM [size] [background_color] [loop_count]

// ANMF chunks contain individual animation frames  
ANMF [size] [frame_data...]
```

### Safety Features
- **Conservative approach**: If animation status cannot be determined, conversion is skipped
- **Minimal network usage**: Only fetches file headers, not full images
- **Error resilience**: Handles malformed files, CORS issues, and network failures
- **Performance**: Quick header analysis (typically <100ms)
