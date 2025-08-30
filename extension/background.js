// Image Hover Save Extension - Background Script
// Copyright (c) Jaewoo Jeon (@thejjw) and Image Hover Save Extension Contributors
// SPDX-License-Identifier: zlib-acknowledgement

// Debug flag - set to false to disable all console output
const DEBUG = false;

// Debug console wrapper
const debug = {
    log: (...args) => DEBUG && console.log(...args),
    error: (...args) => DEBUG && console.error(...args),
    warn: (...args) => DEBUG && console.warn(...args),
    info: (...args) => DEBUG && console.info(...args)
};

// Configuration
const CONFIG = {
    DEFAULT_HOVER_DELAY: 1500
};

// Helper: update badge for specific tab
function updateBadge(disabled, excluded = false, tabId = null) {
    const text = disabled ? 'OFF' : (excluded ? 'EXCL' : '');
    const color = disabled ? '#d00' : '#ff8c00';
    
    if (tabId) {
        chrome.action.setBadgeText({ text, tabId });
        if (text) {
            chrome.action.setBadgeBackgroundColor({ color, tabId });
        }
    } else {
        chrome.action.setBadgeText({ text });
        if (text) {
            chrome.action.setBadgeBackgroundColor({ color });
        }
    }
    debug.log(`Badge updated: text="${text}", color="${color}", tabId=${tabId || 'all'}`);
}

// Set default settings on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({
        ihs_enabled: true,
        ihs_hover_delay: CONFIG.DEFAULT_HOVER_DELAY
    });
    
    // Set initial badge state
    updateBadge(false, false);
    
    // Create context menu item for links
    chrome.contextMenus.create({
        id: "ihs-download-link",
        title: "Download Link",
        contexts: ["link"],
        documentUrlPatterns: ["http://*/*", "https://*/*"]
    });
    
    // Create context menu item for videos
    chrome.contextMenus.create({
        id: "ihs-download-video",
        title: "Download Video",
        contexts: ["video"],
        documentUrlPatterns: ["http://*/*", "https://*/*"]
    });
    
    // Create context menu item for images
    chrome.contextMenus.create({
        id: "ihs-download-image",
        title: "Download Image",
        contexts: ["image"],
        documentUrlPatterns: ["http://*/*", "https://*/*"]
    });
    
    debug.log('Extension installed, default settings applied');
});

// On startup, set badge state for all tabs
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.sync.get('ihs_enabled', (data) => {
        const disabled = !data.ihs_enabled;
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                updateBadge(disabled, false, tab.id);
            });
        });
        debug.log('Extension startup, badge state set for all tabs');
    });
});

// Listen for storage changes to update badges
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (changes.ihs_enabled && areaName === 'sync') {
        const disabled = !changes.ihs_enabled.newValue;
        debug.log('Extension enabled status changed:', !disabled);
        
        // Update badge for all tabs
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                updateBadge(disabled, false, tab.id);
            });
        });
    }
    
    if (changes.ihs_domain_exclusions && areaName === 'sync') {
        debug.log('Domain exclusions changed, content scripts will update automatically');
        // Content scripts will detect the storage change automatically
    }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "ihs-download-link") {
        downloadLinkDirectly(info.linkUrl);
    } else if (info.menuItemId === "ihs-download-video") {
        downloadVideoDirectly(info.srcUrl, tab);
    } else if (info.menuItemId === "ihs-download-image") {
        downloadImageDirectly(info.srcUrl, tab);
    }
});

// Handle download requests from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'download_image') {
        downloadImage(message.url, message.filename, message.downloadMode);
    } else if (message.type === 'download_canvas_image') {
        downloadCanvasImage(message.dataUrl, message.filename);
    } else if (message.type === 'extract_canvas_image') {
        // For canvas extraction, we'll need to send a message back to content script
        sendResponse({ success: true });
    } else if (message.type === 'ihs:domain_status_changed') {
        // Update badge for the specific tab that sent this message
        const tabId = sender.tab?.id;
        if (tabId) {
            chrome.storage.sync.get('ihs_enabled', (data) => {
                const disabled = !data.ihs_enabled;
                const excluded = !!message.excluded;
                updateBadge(disabled, excluded && !disabled, tabId);
                debug.log(`Badge updated for tab ${tabId}: disabled=${disabled}, excluded=${excluded}`);
            });
        }
    }
});

// Download image function
async function downloadImage(url, filename, downloadMode = 'normal') {
    try {
        // Clean filename - remove any potentially problematic characters
        const cleanFilename = filename.replace(/[<>:"/\\|?*]/g, '_');
        
        let downloadUrl = url;
        
        // Handle different download modes
        if (downloadMode === 'cache') {
            try {
                const cacheBlob = await getImageFromCache(url);
                if (cacheBlob) {
                    downloadUrl = URL.createObjectURL(cacheBlob);
                    debug.log('Using cached image for download');
                }
            } catch (cacheError) {
                debug.warn('Cache retrieval failed, falling back to direct URL:', cacheError);
            }
        } else if (downloadMode === 'canvas') {
            // For canvas mode, we need to coordinate with content script
            debug.log('Canvas extraction mode not yet implemented for background downloads');
            // This would require more complex coordination with content script
        }
        
        const downloadId = await chrome.downloads.download({
            url: downloadUrl,
            filename: cleanFilename,
            saveAs: false // Save to default downloads folder without dialog
        });
        
        debug.log(`Image download started: ${cleanFilename} (ID: ${downloadId}) - Mode: ${downloadMode}`);
        
        // Clean up blob URL if we created one
        if (downloadUrl !== url && downloadUrl.startsWith('blob:')) {
            setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
        }
        
    } catch (error) {
        debug.error('Download failed:', error);
        
        // Fallback: try to download without custom filename
        try {
            await chrome.downloads.download({
                url: url,
                saveAs: false
            });
        } catch (fallbackError) {
            debug.error('Fallback download also failed:', fallbackError);
        }
    }
}

// Download canvas-extracted image from data URL
async function downloadCanvasImage(dataUrl, filename) {
    try {
        debug.log('Downloading canvas-extracted image:', filename);
        
        // Clean filename - remove any potentially problematic characters
        const cleanFilename = filename.replace(/[<>:"/\\|?*]/g, '_');
        
        const downloadId = await chrome.downloads.download({
            url: dataUrl,
            filename: cleanFilename,
            saveAs: false // Save to default downloads folder without dialog
        });
        
        debug.log(`Canvas image download started: ${cleanFilename} (ID: ${downloadId})`);
        
    } catch (error) {
        debug.error('Canvas image download failed:', error);
    }
}

// Experimental function to get image from browser cache
async function getImageFromCache(url) {
    try {
        // Use fetch with cache-only mode to get from cache
        const response = await fetch(url, {
            cache: 'only-if-cached',
            mode: 'same-origin'
        });
        
        if (response.ok) {
            return await response.blob();
        }
    } catch (error) {
        debug.log('Cache-only fetch failed, trying force-cache:', error);
        
        // Fallback: try force-cache mode
        try {
            const response = await fetch(url, {
                cache: 'force-cache'
            });
            
            if (response.ok) {
                return await response.blob();
            }
        } catch (forceCacheError) {
            debug.log('Force-cache fetch also failed:', forceCacheError);
        }
    }
    
    return null;
}

// Shared function to generate and clean filenames
function generateCleanFilename(url, fallbackPrefix = 'download', fallbackExtension = '') {
    let filename;
    
    // Clean up URL - remove fragment identifiers like #t=0.01
    let cleanUrl = url;
    if (cleanUrl.includes('#')) {
        cleanUrl = cleanUrl.split('#')[0];
    }
    
    try {
        const urlObj = new URL(cleanUrl);
        filename = urlObj.pathname.split('/').pop();
        
        // Throw error if no filename from URL to use fallback logic
        if (!filename || filename === '') {
            throw new Error('No filename found in URL');
        }
    } catch (error) {
        debug.warn(`Using fallback filename for ${fallbackPrefix}:`, error.message);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        filename = `${fallbackPrefix}-${timestamp}${fallbackExtension}`;
    }
    
    // Clean filename - remove problematic characters and limit length
    let cleanFilename = filename.replace(/[<>:"/\\|?*]/g, '_');
    
    // Limit filename to 100 characters (conservative limit for most filesystems)
    if (cleanFilename.length > 100) {
        const ext = cleanFilename.lastIndexOf('.');
        if (ext > 0 && ext > cleanFilename.length - 10) {
            // Keep extension if it exists and is reasonable
            const extension = cleanFilename.substring(ext);
            const basename = cleanFilename.substring(0, ext);
            cleanFilename = basename.substring(0, 100 - extension.length) + extension;
        } else {
            cleanFilename = cleanFilename.substring(0, 100);
        }
    }
    
    return cleanFilename;
}

// Download link directly to default directory
async function downloadLinkDirectly(url) {
    try {
        debug.log('Downloading link directly:', url);
        
        // Generate clean filename using shared function
        const cleanFilename = generateCleanFilename(url, 'download', '-file');
        
        // Download using Chrome downloads API
        const downloadId = await chrome.downloads.download({
            url: url,
            filename: cleanFilename,
            saveAs: false // Don't prompt for save location, use default directory
        });
        
        debug.log('Link download started with ID:', downloadId);
        
    } catch (error) {
        debug.error('Error downloading link:', error);
    }
}

// Download video directly to default directory
async function downloadVideoDirectly(videoUrl, tab) {
    try {
        debug.log('Downloading video directly:', videoUrl);
        
        // Generate clean filename using shared function
        let cleanFilename = generateCleanFilename(videoUrl, 'video', '.mp4');
        
        // Ensure it has a video extension if none present
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv', '.flv', '.mkv'];
        const hasVideoExtension = videoExtensions.some(ext => 
            cleanFilename.toLowerCase().endsWith(ext.toLowerCase())
        );
        
        if (!hasVideoExtension) {
            // Try to detect extension from URL or default to .mp4
            const urlLower = videoUrl.toLowerCase();
            const detectedExt = videoExtensions.find(ext => urlLower.includes(ext.toLowerCase()));
            cleanFilename += detectedExt || '.maybe.mp4';
        }
        
        // Clean up URL - remove fragment identifiers like #t=0.01
        let cleanUrl = videoUrl;
        if (cleanUrl.includes('#')) {
            cleanUrl = cleanUrl.split('#')[0];
        }
        
        // Download using Chrome downloads API
        const downloadId = await chrome.downloads.download({
            url: cleanUrl,
            filename: cleanFilename,
            saveAs: false // Don't prompt for save location, use default directory
        });
        
        debug.log('Video download started with ID:', downloadId, 'Filename:', cleanFilename);
        
    } catch (error) {
        debug.error('Error downloading video:', error);
        
        // Fallback: try to download without custom filename
        try {
            await chrome.downloads.download({
                url: videoUrl,
                saveAs: false
            });
        } catch (fallbackError) {
            debug.error('Fallback video download also failed:', fallbackError);
        }
    }
}

// Download image directly to default directory
async function downloadImageDirectly(imageUrl, tab) {
    try {
        debug.log('Downloading image directly:', imageUrl);
        
        // Generate clean filename using shared function
        let cleanFilename = generateCleanFilename(imageUrl, 'image', '.jpg');
        
        // Ensure it has an image extension if none present
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.ico'];
        const hasImageExtension = imageExtensions.some(ext => 
            cleanFilename.toLowerCase().endsWith(ext.toLowerCase())
        );
        
        if (!hasImageExtension) {
            // Try to detect extension from URL or default to .jpg
            const urlLower = imageUrl.toLowerCase();
            const detectedExt = imageExtensions.find(ext => urlLower.includes(ext.toLowerCase()));
            cleanFilename += detectedExt || '.maybe.jpg';
        }
        
        // Clean up URL - remove fragment identifiers
        let cleanUrl = imageUrl;
        if (cleanUrl.includes('#')) {
            cleanUrl = cleanUrl.split('#')[0];
        }
        
        // Download using Chrome downloads API
        const downloadId = await chrome.downloads.download({
            url: cleanUrl,
            filename: cleanFilename,
            saveAs: false // Don't prompt for save location, use default directory
        });
        
        debug.log('Image download started with ID:', downloadId, 'Filename:', cleanFilename);
        
    } catch (error) {
        debug.error('Error downloading image:', error);
        
        // Fallback: try to download without custom filename
        try {
            await chrome.downloads.download({
                url: imageUrl,
                saveAs: false
            });
        } catch (fallbackError) {
            debug.error('Fallback image download also failed:', fallbackError);
        }
    }
}
