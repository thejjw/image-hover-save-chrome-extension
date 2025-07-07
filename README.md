# Image Hover Save Chrome Extension

A Chrome extension that allows you to quickly save images by hovering over them (and more). When you hover over an image for a configurable amount of time, a download button appears that lets you save the image directly to your default downloads folder.

## Features

- **Hover to start**: Hover over any image to show a download button
- **Configurable delay**: Adjust how long to hover before the button appears (0.5s to 3s)
- **Smart filtering**: Only shows download button for images larger than predefined dimensions
- **No save dialog**: Downloads directly to your default downloads folder
- **Enable/disable**: Toggle the extension on/off from the popup
- **Badge indicators**: Real-time status badges on extension icon
- **Bulk download**: ZIP download for all images on a page
- and more..

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the `extension` folder
5. The extension is now ready to use!

## Usage

1. Navigate to any webpage with images
2. Hover your mouse over an image for the configured delay (default: 1.5 seconds)
3. A download button (💾) will appear in the top-right corner of the image
4. Click the button to download the image to your default downloads folder
5. Click the extension icon to adjust settings or disable the extension

## Permissions

- `downloads`: Required to save images to your downloads folder
- `storage`: Required to save your preferences and settings
- `tabs`: Required for cross-tab preference communication and badge indicators
- `activeTab`: Required to interact with the current webpage
- `scripting`: Required to inject the hover detection functionality
- `<all_urls>`: Required to work on all websites

## Privacy

This extension:
- Does not collect any personal data
- Does not send any information to external servers
- Settings are saved using Chrome's sync storage feature that syncs to your own Google account when available.

## License

See [LICENSE](LICENSE).

## Author

- Jaewoo Jeon [@thejjw](https://github.com/thejjw)

If you find this extension helpful, consider supporting its development:

[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/default-yellow.png)](https://buymeacoffee.com/thejjw)

## Third-Party Libraries

This extension uses the following open-source libraries:

- **[JSZip](https://stuk.github.io/jszip/)** v3.10.1 - For creating ZIP archives of bulk downloads
  - License: MIT
  - Copyright (c) 2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso