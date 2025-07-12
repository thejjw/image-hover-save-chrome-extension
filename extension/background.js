// Image Hover Save Extension - Background Script
// Copyright (c) Jaewoo Jeon (@thejjw) and Image Hover Save Extension Contributors
// SPDX-License-Identifier: zlib-acknowledgement

// Debug flag - set to false to disable all console output
const DEBUG = true;

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

// Handle download requests from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'download_image') {
        downloadImage(message.url, message.filename, message.downloadMode);
    } else if (message.type === 'download_image_jxl') {
        downloadImageAsJXL(message.url, message.filename, message.downloadMode);
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
