// Image Hover Save Extension - Popup Script
// Copyright (c) Jaewoo Jeon (@thejjw) and Image Hover Save Extension Contributors
// SPDX-License-Identifier: zlib-acknowledgement
//
// Third-party libraries:
// - JSZip v3.10.1 (MIT) - Copyright (c) 2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso

// Extension version - update this when releasing new versions
const EXTENSION_VERSION = '1.0.0';

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
    DEFAULT_EXTENSIONS: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'mp4', 'webm', 'mov'],
    DEFAULT_EXTENSIONS_STRING: 'jpg,jpeg,png,gif,webp,svg,bmp,mp4,webm,mov',
    DEFAULT_HOVER_DELAY: 1500,
    MIN_IMAGE_SIZE: 100
};

// Storage helper
const storage = {
    async get(key) {
        try {
            const result = await chrome.storage.sync.get(key);
            return result[key];
        } catch (error) {
            debug.error('Storage get error:', error);
            return null;
        }
    },
    
    async set(key, value) {
        try {
            await chrome.storage.sync.set({ [key]: value });
            return true;
        } catch (error) {
            debug.error('Storage set error:', error);
            return false;
        }
    }
};

// Show status message
function showStatus(message, type = 'success') {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    
    setTimeout(() => {
        status.textContent = '';
        status.className = 'status';
    }, 2000);
}

// Update delay display
function updateDelayDisplay(value) {
    const delayValue = document.getElementById('delayValue');
    delayValue.textContent = (value / 1000).toFixed(1) + 's';
}

// Initialize popup
async function initializePopup() {
    try {
        // Load current settings
        const enabled = await storage.get('ihs_enabled');
        const delay = await storage.get('ihs_hover_delay');
        const detectImg = await storage.get('ihs_detect_img');
        const detectSvg = await storage.get('ihs_detect_svg');
        const detectBackground = await storage.get('ihs_detect_background');
        const detectVideo = await storage.get('ihs_detect_video');
        const allowedExtensions = await storage.get('ihs_allowed_extensions');
        
        // Set toggle state
        const enabledToggle = document.getElementById('enabledToggle');
        enabledToggle.checked = enabled !== false; // Default to true
        
        // Set delay slider
        const hoverDelay = document.getElementById('hoverDelay');
        const delayValue = delay || CONFIG.DEFAULT_HOVER_DELAY;
        hoverDelay.value = delayValue;
        updateDelayDisplay(delayValue);
        
        // Set image detection checkboxes
        document.getElementById('detectImg').checked = detectImg !== false;
        document.getElementById('detectSvg').checked = detectSvg === true; // Disabled by default
        document.getElementById('detectBackground').checked = detectBackground === true; // Disabled by default
        document.getElementById('detectVideo').checked = detectVideo !== false;
        
        // Set experimental download mode
        const downloadMode = await storage.get('ihs_download_mode') || 'normal';
        document.getElementById('downloadMode' + downloadMode.charAt(0).toUpperCase() + downloadMode.slice(1)).checked = true;
        
        // Set up download mode UI
        setupDownloadModeUI(downloadMode);
        
        // Set allowed extensions
        const extensionsInput = document.getElementById('allowedExtensions');
        extensionsInput.placeholder = CONFIG.DEFAULT_EXTENSIONS_STRING;
        extensionsInput.value = allowedExtensions || CONFIG.DEFAULT_EXTENSIONS_STRING;
        
        // Set minimum image size
        const minImageSize = await storage.get('ihs_min_image_size');
        const minImageSizeInput = document.getElementById('minImageSize');
        minImageSizeInput.value = minImageSize || CONFIG.MIN_IMAGE_SIZE;
        
        // Set up additional event listeners
        setupImageDetectionListeners();
        
        // Set version display
        const versionElement = document.getElementById('version');
        if (versionElement) {
            versionElement.textContent = `v${EXTENSION_VERSION}`;
        }
        
    } catch (error) {
        debug.error('Failed to initialize popup:', error);
        showStatus('Failed to load settings', 'error');
    }
}

// Set up download mode UI and indicator
function setupDownloadModeUI(currentMode) {
    const expandButton = document.getElementById('expandDownloadModes');
    const downloadModeSection = document.getElementById('downloadModeSection');
    const downloadModeIndicator = document.getElementById('downloadModeIndicator');
    
    // Update indicator text and style
    updateDownloadModeIndicator(currentMode);
    
    // Set up expand/collapse button
    expandButton.addEventListener('click', () => {
        const isCollapsed = downloadModeSection.classList.contains('collapsed');
        
        if (isCollapsed) {
            downloadModeSection.classList.remove('collapsed');
            expandButton.classList.add('expanded');
            expandButton.textContent = '⚙️ Hide Advanced';
        } else {
            downloadModeSection.classList.add('collapsed');
            expandButton.classList.remove('expanded');
            expandButton.textContent = '⚙️ Advanced';
        }
    });
    
    // Auto-expand if experimental mode is selected
    if (currentMode !== 'normal') {
        downloadModeSection.classList.remove('collapsed');
        expandButton.classList.add('expanded');
        expandButton.textContent = '⚙️ Hide Advanced';
    }
}

// Update download mode indicator
function updateDownloadModeIndicator(mode) {
    const indicator = document.getElementById('downloadModeIndicator');
    const modeName = mode === 'normal' ? 'Normal' : 
                   mode === 'cache' ? 'Cache-based (Experimental)' : 
                   mode === 'canvas' ? 'Canvas extraction (Experimental)' :
                   mode === 'jxl' ? 'JXL conversion (Experimental)' :
                   'Unknown';
    
    indicator.innerHTML = `Download mode: <strong>${modeName}</strong>`;
    
    // Update styling based on mode
    if (mode === 'normal') {
        indicator.classList.remove('experimental');
    } else {
        indicator.classList.add('experimental');
    }
}

// Set up event listeners
function setupEventListeners() {
    const enabledToggle = document.getElementById('enabledToggle');
    const hoverDelay = document.getElementById('hoverDelay');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const downloadZipBtn = document.getElementById('downloadZipBtn');
    const exclusionBtn = document.getElementById('exclusionBtn');
    
    // Toggle enabled/disabled
    enabledToggle.addEventListener('change', async (e) => {
        const success = await storage.set('ihs_enabled', e.target.checked);
        if (success) {
            showStatus(e.target.checked ? 'Extension enabled' : 'Extension disabled');
        } else {
            showStatus('Failed to save setting', 'error');
            e.target.checked = !e.target.checked; // Revert
        }
    });
    
    // Update hover delay
    hoverDelay.addEventListener('input', (e) => {
        updateDelayDisplay(e.target.value);
    });
    
    hoverDelay.addEventListener('change', async (e) => {
        const value = parseInt(e.target.value);
        const success = await storage.set('ihs_hover_delay', value);
        if (success) {
            showStatus(`Delay set to ${(value / 1000).toFixed(1)}s`);
        } else {
            showStatus('Failed to save delay', 'error');
        }
    });
    
    // Bulk download buttons
    downloadAllBtn.addEventListener('click', handleGalleryView);
    downloadZipBtn.addEventListener('click', handleDownloadZip);
    
    // Exclusion button
    exclusionBtn.addEventListener('click', () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL('exclusions.html')
        });
    });
}

// Set up image detection event listeners
function setupImageDetectionListeners() {
    const detectImg = document.getElementById('detectImg');
    const detectSvg = document.getElementById('detectSvg');
    const detectBackground = document.getElementById('detectBackground');
    const detectVideo = document.getElementById('detectVideo');
    const allowedExtensions = document.getElementById('allowedExtensions');
    const downloadModeRadios = document.querySelectorAll('input[name="downloadMode"]');
    
    // Image type detection checkboxes
    detectImg.addEventListener('change', async (e) => {
        const success = await storage.set('ihs_detect_img', e.target.checked);
        if (success) {
            showStatus('IMG detection ' + (e.target.checked ? 'enabled' : 'disabled'));
            await notifyContentScriptSettingsChanged();
        } else {
            showStatus('Failed to save setting', 'error');
            e.target.checked = !e.target.checked;
        }
    });
    
    detectSvg.addEventListener('change', async (e) => {
        const success = await storage.set('ihs_detect_svg', e.target.checked);
        if (success) {
            showStatus('SVG detection ' + (e.target.checked ? 'enabled' : 'disabled'));
            await notifyContentScriptSettingsChanged();
        } else {
            showStatus('Failed to save setting', 'error');
            e.target.checked = !e.target.checked;
        }
    });
    
    detectBackground.addEventListener('change', async (e) => {
        const success = await storage.set('ihs_detect_background', e.target.checked);
        if (success) {
            showStatus('Background image detection ' + (e.target.checked ? 'enabled' : 'disabled'));
            await notifyContentScriptSettingsChanged();
        } else {
            showStatus('Failed to save setting', 'error');
            e.target.checked = !e.target.checked;
        }
    });
    
    detectVideo.addEventListener('change', async (e) => {
        const success = await storage.set('ihs_detect_video', e.target.checked);
        if (success) {
            showStatus('Video detection ' + (e.target.checked ? 'enabled' : 'disabled'));
            await notifyContentScriptSettingsChanged();
        } else {
            showStatus('Failed to save setting', 'error');
            e.target.checked = !e.target.checked;
        }
    });
    
    // Allowed extensions input
    allowedExtensions.addEventListener('change', async (e) => {
        const value = e.target.value.trim();
        const success = await storage.set('ihs_allowed_extensions', value);
        if (success) {
            showStatus('File extensions updated');
        } else {
            showStatus('Failed to save extensions', 'error');
        }
    });
    
    // Download mode radio buttons
    downloadModeRadios.forEach(radio => {
        radio.addEventListener('change', async (e) => {
            if (e.target.checked) {
                const success = await storage.set('ihs_download_mode', e.target.value);
                if (success) {
                    const modeName = e.target.value === 'normal' ? 'Normal' : 
                                   e.target.value === 'cache' ? 'Cache-based' : 
                                   e.target.value === 'canvas' ? 'Canvas extraction' :
                                   e.target.value === 'jxl' ? 'JXL conversion' : 'Unknown';
                    showStatus(`Download mode set to: ${modeName}`);
                    
                    // Update the indicator
                    updateDownloadModeIndicator(e.target.value);
                } else {
                    showStatus('Failed to save setting', 'error');
                    // Revert to previous selection
                    const currentMode = await storage.get('ihs_download_mode') || 'normal';
                    document.getElementById('downloadMode' + currentMode.charAt(0).toUpperCase() + currentMode.slice(1)).checked = true;
                    updateDownloadModeIndicator(currentMode);
                }
            }
        });
    });
    
    // Minimum image size input
    const minImageSize = document.getElementById('minImageSize');
    minImageSize.addEventListener('change', async (e) => {
        const value = parseInt(e.target.value);
        if (e.target.validity.valid && value >= 50 && value <= 1000) {
            const success = await storage.set('ihs_min_image_size', value);
            if (success) {
                showStatus(`Minimum image size set to ${value}px`);
                await notifyContentScriptSettingsChanged();
            } else {
                showStatus('Failed to save minimum size', 'error');
            }
        } else {
            showStatus('Please enter a value between 50 and 1000 pixels', 'error');
            e.target.value = CONFIG.MIN_IMAGE_SIZE;
        }
    });
    
    // Reset button
    const resetBtn = document.getElementById('resetBtn');
    resetBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to reset all settings to default values? This action cannot be undone.')) {
            await resetAllSettings();
        }
    });
}

// Get current settings for image detection
async function getCurrentSettings() {
    try {
        const detectImg = await storage.get('ihs_detect_img');
        const detectSvg = await storage.get('ihs_detect_svg');
        const detectBackground = await storage.get('ihs_detect_background');
        const detectVideo = await storage.get('ihs_detect_video');
        const allowedExtensions = await storage.get('ihs_allowed_extensions');
        
        return {
            detectImg: detectImg !== false, // Default: true
            detectSvg: detectSvg === true, // Default: false
            detectBackground: detectBackground === true, // Default: false
            detectVideo: detectVideo !== false, // Default: true
            allowedExtensions: (allowedExtensions || CONFIG.DEFAULT_EXTENSIONS_STRING)
                .split(',')
                .map(ext => ext.trim())
                .filter(ext => ext.length > 0)
        };
    } catch (error) {
        debug.error('Error getting settings:', error);
        // Return defaults if storage fails
        return {
            detectImg: true,
            detectSvg: false, // Changed default
            detectBackground: false, // Changed default
            detectVideo: true,
            allowedExtensions: CONFIG.DEFAULT_EXTENSIONS
        };
    }
}

// Handle gallery view
async function handleGalleryView() {
    try {
        debug.log('Gallery view started');
        showStatus('Scanning for images...', 'info');
        
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        debug.log('Active tab:', activeTab);
        
        const settings = await getCurrentSettings();
        debug.log('Current settings:', settings);
        
        debug.log('Sending message to content script...');
        const response = await chrome.tabs.sendMessage(activeTab.id, {
            type: 'scan_images',
            settings: settings
        });
        
        debug.log('Response from content script:', response);
        
        if (!response.success) {
            debug.error('Scan failed:', response.error);
            showStatus('Failed to scan images: ' + response.error, 'error');
            return;
        }
        
        const images = response.images;
        debug.log('Found images:', images.length, images);
        
        if (images.length === 0) {
            showStatus('No images found on this page', 'info');
            return;
        }
        
        // Create gallery HTML
        debug.log('Creating gallery HTML...');
        const galleryHtml = createGalleryHtml(images, activeTab.title);
        debug.log('Gallery HTML length:', galleryHtml.length);
        
        // Open gallery in new tab
        debug.log('Opening gallery in new tab...');
        chrome.tabs.create({
            url: 'data:text/html;charset=utf-8,' + encodeURIComponent(galleryHtml)
        });
        
        showStatus(`Gallery opened with ${images.length} images`);
        debug.log('Gallery view completed successfully');
        
    } catch (error) {
        debug.error('Gallery view error:', error);
        showStatus('Failed to create gallery', 'error');
    }
}

// Handle ZIP download
async function handleDownloadZip() {
    debug.log('[IHS Popup] ZIP download started');
    
    // First check if JSZip is available
    if (typeof JSZip === 'undefined') {
        debug.error('[IHS Popup] JSZip not available during download');
        showStatus('JSZip library not available', 'error');
        return;
    }
    
    try {
        showStatus('Scanning for images...', 'info');
        
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        debug.log('[IHS Popup] Active tab:', activeTab.url);
        
        const settings = await getCurrentSettings();
        debug.log('[IHS Popup] Current settings:', settings);
        
        debug.log('[IHS Popup] Sending message to content script...');
        
        let response;
        try {
            response = await chrome.tabs.sendMessage(activeTab.id, {
                type: 'scan_images',
                settings: settings
            });
        } catch (messageError) {
            debug.error('[IHS Popup] Failed to send message to content script:', messageError);
            showStatus('Failed to communicate with page content script', 'error');
            return;
        }
        
        debug.log('[IHS Popup] Response from content script:', response);
        
        if (!response) {
            debug.error('[IHS Popup] No response from content script');
            showStatus('Content script did not respond', 'error');
            return;
        }
        
        if (!response.success) {
            debug.error('Scan failed:', response.error);
            showStatus('Failed to scan images: ' + response.error, 'error');
            return;
        }
        
        const images = response.images;
        debug.log('Found images:', images.length, images);
        
        if (images.length === 0) {
            showStatus('No images found on this page', 'info');
            return;
        }
        
        showStatus(`Downloading ${images.length} images...`, 'info');
        
        // Create ZIP file
        debug.log('Creating ZIP file with JSZip...');
        const zip = new JSZip();
        const imageFolder = zip.folder('images');
        
        let downloadedCount = 0;
        const totalCount = images.length;
        
        // Download each image and add to ZIP
        let skippedCount = 0;
        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            debug.log(`Processing image ${i + 1}/${totalCount}:`, image.url);
            
            try {
                debug.log('Fetching image data...');
                const imageData = await fetchImageAsBlob(image.url);
                debug.log('Image data received, size:', imageData.size);
                
                const filename = generateImageFilename(image, i);
                debug.log('Generated filename:', filename);
                
                imageFolder.file(filename, imageData);
                downloadedCount++;
                
                // Update progress
                showStatus(`Downloaded ${downloadedCount}/${totalCount} images...`, 'info');
                debug.log(`Successfully added image ${downloadedCount}/${totalCount} to ZIP`);
                
            } catch (error) {
                skippedCount++;
                debug.warn(`Failed to download image ${i + 1}/${totalCount} (${image.url}):`, error.message);
                // Continue with other images - this handles CORS and other fetch errors gracefully
            }
        }
        
        debug.log(`ZIP creation completed. Downloaded: ${downloadedCount}/${totalCount}`);
        
        if (downloadedCount === 0) {
            showStatus('No images could be downloaded', 'error');
            return;
        }
        
        // Generate ZIP file
        debug.log('Generating ZIP blob...');
        showStatus('Creating ZIP file...', 'info');
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        debug.log('ZIP blob created, size:', zipBlob.size);
        
        // Create download link
        const url = URL.createObjectURL(zipBlob);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const pageTitle = activeTab.title ? sanitizeFilename(activeTab.title).substring(0, 30) : 'page';
        const filename = `ihs_images_${pageTitle}_${timestamp}.zip`;
        
        debug.log('Starting download with filename:', filename);
        
        // Use Chrome downloads API
        chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: false  // Download directly without prompting
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                debug.error('Download failed:', chrome.runtime.lastError.message);
                showStatus('Download failed: ' + chrome.runtime.lastError.message, 'error');
            } else {
                debug.log('Download started with ID:', downloadId);
                showStatus(`ZIP created with ${downloadedCount} images`);
            }
            
            // Clean up object URL
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
        
        debug.log('ZIP download completed successfully');
        
    } catch (error) {
        debug.error('ZIP download error:', error);
        showStatus('Failed to create ZIP file', 'error');
    }
}

// Fetch image as blob
async function fetchImageAsBlob(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.blob();
}

// Generate filename for image
function generateImageFilename(image, index) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    
    try {
        const url = new URL(image.url, window.location.href);
        let filename = url.pathname.split('/').pop();
        
        // If no filename or no extension, generate one with timestamp
        if (!filename || !filename.includes('.')) {
            const extension = getExtensionFromType(image.type);
            filename = `image_${timestamp}_${index + 1}.${extension}`;
        } else {
            // If filename exists but might be generic, add timestamp for uniqueness
            const nameParts = filename.split('.');
            if (nameParts.length > 1) {
                const extension = nameParts.pop();
                const baseName = nameParts.join('.');
                // Add timestamp if filename is very generic or short
                if (baseName.length < 3 || ['image', 'img', 'pic', 'photo'].includes(baseName.toLowerCase())) {
                    filename = `${baseName}_${timestamp}.${extension}`;
                }
                // Otherwise use original filename as-is
            }
        }
        
        // Sanitize filename while preserving CJK characters
        filename = sanitizeFilename(filename);
        
        return filename;
    } catch {
        const extension = getExtensionFromType(image.type);
        return `image_${timestamp}_${index + 1}.${extension}`;
    }
}

// Get file extension based on image type
function getExtensionFromType(type) {
    switch (type) {
        case 'svg': return 'svg';
        case 'video': return 'mp4';
        case 'background': return 'jpg';
        default: return 'jpg';
    }
}

// Create gallery HTML
function createGalleryHtml(images, pageTitle) {
    const title = pageTitle ? `Gallery - ${pageTitle}` : 'Image Gallery';
    
    // Get unique file extensions for filter
    const extensions = [...new Set(images.map(img => {
        try {
            const url = new URL(img.url);
            const ext = url.pathname.split('.').pop().toLowerCase();
            return ext && ext.length <= 4 ? ext : 'unknown';
        } catch {
            return 'unknown';
        }
    }))].sort();
    
    const imageHtml = images.map((image, index) => {
        const alt = image.alt || `Image ${index + 1}`;
        const dimensions = `${Math.round(image.width)}x${Math.round(image.height)}`;
        const fileExt = (() => {
            try {
                const url = new URL(image.url);
                const ext = url.pathname.split('.').pop().toLowerCase();
                return ext && ext.length <= 4 ? ext : 'unknown';
            } catch {
                return 'unknown';
            }
        })();
        
        return `
            <div class="gallery-item" data-width="${image.width}" data-height="${image.height}" data-ext="${fileExt}">
                <img src="${image.url}" alt="${alt}" loading="lazy">
                <div class="image-info">
                    <div class="image-title">${alt}</div>
                    <div class="image-meta">
                        <span class="image-type">${image.type.toUpperCase()}</span>
                        <span class="image-dimensions">${dimensions}</span>
                        <span class="image-ext">${fileExt.toUpperCase()}</span>
                    </div>
                    <a href="${image.url}" target="_blank" class="download-link">Open in New Tab</a>
                </div>
            </div>
        `;
    }).join('');
    
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background-color: #f5f5f5;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                }
                .header h1 {
                    color: #333;
                    margin: 0 0 10px 0;
                }
                .header p {
                    color: #666;
                    margin: 0;
                }
                .controls {
                    max-width: 1200px;
                    margin: 0 auto 20px auto;
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .filter-section {
                    margin-bottom: 15px;
                }
                .filter-section label {
                    display: block;
                    font-weight: 600;
                    margin-bottom: 8px;
                    color: #333;
                }
                .size-filter {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                    margin-bottom: 15px;
                }
                .size-filter input {
                    width: 80px;
                    padding: 4px 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }
                .extension-filters {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin-bottom: 15px;
                }
                .ext-checkbox {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .ext-checkbox input {
                    margin: 0;
                }
                .action-buttons {
                    display: flex;
                    gap: 10px;
                }
                .btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: background 0.2s;
                }
                .btn-primary {
                    background: #1976d2;
                    color: white;
                }
                .btn-primary:hover {
                    background: #1565c0;
                }
                .btn-secondary {
                    background: #e0e0e0;
                    color: #333;
                }
                .btn-secondary:hover {
                    background: #d0d0d0;
                }
                .gallery {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 20px;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .gallery-item {
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    transition: transform 0.2s;
                }
                .gallery-item:hover {
                    transform: translateY(-2px);
                }
                .gallery-item.hidden {
                    display: none;
                }
                .gallery-item img {
                    width: 100%;
                    height: 200px;
                    object-fit: cover;
                    display: block;
                }
                .image-info {
                    padding: 15px;
                }
                .image-title {
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 8px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .image-meta {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 10px;
                    font-size: 12px;
                    color: #666;
                    flex-wrap: wrap;
                }
                .image-type, .image-ext {
                    background: #e1f5fe;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-weight: 500;
                }
                .download-link {
                    display: inline-block;
                    background: #1976d2;
                    color: white;
                    padding: 6px 12px;
                    text-decoration: none;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 500;
                    transition: background 0.2s;
                }
                .download-link:hover {
                    background: #1565c0;
                }
                .stats {
                    text-align: center;
                    margin-bottom: 20px;
                    color: #666;
                }
                .status {
                    padding: 10px;
                    border-radius: 4px;
                    margin-bottom: 15px;
                    text-align: center;
                    font-weight: 500;
                }
                .status.info {
                    background: #e3f2fd;
                    color: #1976d2;
                }
                .status.success {
                    background: #e8f5e8;
                    color: #2e7d32;
                }
                .status.error {
                    background: #ffebee;
                    color: #c62828;
                }
                .status.hidden {
                    display: none;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${title}</h1>
                <p class="stats">Found <span id="totalCount">${images.length}</span> images (<span id="visibleCount">${images.length}</span> visible)</p>
                <p style="color: #666; font-size: 14px; margin: 10px 0 0 0;">
                    💡 <strong>Browse and open images.</strong> Use filters to find what you need, then click "Open in New Tab" to view/save images.
                </p>
            </div>
            
            <div class="controls">
                <div class="status hidden" id="status"></div>
                
                <div class="filter-section">
                    <label>Filter by size:</label>
                    <div class="size-filter">
                        <span>Width:</span>
                        <input type="number" id="minWidth" placeholder="Min" min="0">
                        <span>-</span>
                        <input type="number" id="maxWidth" placeholder="Max" min="0">
                        <span>Height:</span>
                        <input type="number" id="minHeight" placeholder="Min" min="0">
                        <span>-</span>
                        <input type="number" id="maxHeight" placeholder="Max" min="0">
                    </div>
                </div>
                
                <div class="filter-section">
                    <label>Filter by file extension:</label>
                    <div class="extension-filters">
                        ${extensions.map(ext => `
                            <div class="ext-checkbox">
                                <input type="checkbox" id="ext-${ext}" value="${ext}" checked>
                                <label for="ext-${ext}">${ext.toUpperCase()}</label>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="action-buttons">
                    <button class="btn btn-primary" id="resetFiltersBtn">Reset Filters</button>
                    <button class="btn btn-secondary" id="downloadZipBtn">🗜️ (Advanced) ZIP Download</button>
                </div>
                
                <div class="download-info" style="margin-top: 15px; padding: 10px; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; font-size: 12px; color: #856404;">
                    ⚠️ <strong>CORS Limitations:</strong> This gallery ZIP download uses the fetch method and faces CORS restrictions. For better download success rates, use the <strong>ZIP download button in the extension popup</strong> instead - it runs with extension permissions and may allow download more images.
                </div>
            </div>
            
            <div class="gallery" id="gallery">
                ${imageHtml}
            </div>
            
            <footer style="margin-top: 40px; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0; background-color: #f8f9fa; color: #6c757d; font-size: 11px;">
                <p style="margin: 0 0 5px 0;">
                    📄 This is a temporary auto-generated gallery page created by the <strong>Image Hover Save</strong> extension v${EXTENSION_VERSION}
                </p>
                <p style="margin: 0; font-style: italic;">
                    This page will be lost when closed. Do all downloads you need before you close the page.
                </p>
            </footer>
            
            <script>
                // Debug wrapper for gallery page
                const DEBUG = true;
                const debug = {
                    log: (...args) => DEBUG && console.log(...args),
                    error: (...args) => DEBUG && console.error(...args),
                    warn: (...args) => DEBUG && console.warn(...args),
                    info: (...args) => DEBUG && console.info(...args)
                };
                
                const allImages = ${JSON.stringify(images)};
                let filteredImages = [...allImages];
                
                function showStatus(message, type = 'info') {
                    const status = document.getElementById('status');
                    status.textContent = message;
                    status.className = 'status ' + type;
                    status.classList.remove('hidden');
                    
                    setTimeout(() => {
                        status.classList.add('hidden');
                    }, 3000);
                }
                
                function updateVisibleCount() {
                    const visibleItems = document.querySelectorAll('.gallery-item:not(.hidden)');
                    document.getElementById('visibleCount').textContent = visibleItems.length;
                }
                
                function applyFilters() {
                    const minWidth = parseInt(document.getElementById('minWidth').value) || 0;
                    const maxWidth = parseInt(document.getElementById('maxWidth').value) || Infinity;
                    const minHeight = parseInt(document.getElementById('minHeight').value) || 0;
                    const maxHeight = parseInt(document.getElementById('maxHeight').value) || Infinity;
                    
                    const enabledExtensions = new Set();
                    document.querySelectorAll('.ext-checkbox input:checked').forEach(cb => {
                        enabledExtensions.add(cb.value);
                    });
                    
                    const items = document.querySelectorAll('.gallery-item');
                    filteredImages = [];
                    
                    items.forEach((item, index) => {
                        const width = parseInt(item.dataset.width);
                        const height = parseInt(item.dataset.height);
                        const ext = item.dataset.ext;
                        
                        const sizeMatch = width >= minWidth && width <= maxWidth && 
                                        height >= minHeight && height <= maxHeight;
                        const extMatch = enabledExtensions.has(ext);
                        
                        if (sizeMatch && extMatch) {
                            item.classList.remove('hidden');
                            filteredImages.push(allImages[index]);
                        } else {
                            item.classList.add('hidden');
                        }
                    });
                    
                    updateVisibleCount();
                }
                
                async function downloadZip() {
                    if (filteredImages.length === 0) {
                        showStatus('No images to download', 'error');
                        return;
                    }
                    
                    try {
                        showStatus('Creating ZIP file...', 'info');
                        
                        const zip = new JSZip();
                        const imageFolder = zip.folder('images');
                        let downloadedCount = 0;
                        
                        for (let i = 0; i < filteredImages.length; i++) {
                            const image = filteredImages[i];
                            
                            try {
                                const response = await fetch(image.url);
                                if (!response.ok) throw new Error('Failed to fetch');
                                
                                const blob = await response.blob();
                                const filename = generateFilename(image, i);
                                
                                imageFolder.file(filename, blob);
                                downloadedCount++;
                                
                                showStatus('Downloaded ' + downloadedCount + '/' + filteredImages.length + ' images...', 'info');
                            } catch (error) {
                                debug.warn('Failed to download image:', image.url, error);
                            }
                        }
                        
                        if (downloadedCount === 0) {
                            showStatus('No images could be downloaded', 'error');
                            return;
                        }
                        
                        showStatus('Generating ZIP file...', 'info');
                        const zipBlob = await zip.generateAsync({ type: 'blob' });
                        
                        const url = URL.createObjectURL(zipBlob);
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                        const filename = 'ihs_gallery_images_' + timestamp + '.zip';
                        
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                        
                        showStatus('ZIP downloaded with ' + downloadedCount + ' images', 'success');
                    } catch (error) {
                        debug.error('ZIP download failed:', error);
                        showStatus('Failed to create ZIP file', 'error');
                    }
                }
                
                // Sanitize filename while preserving CJK characters
                function sanitizeFilename(filename) {
                    // Remove only filesystem-unsafe characters, keep CJK characters
                    // Use a safe approach without problematic regex ranges
                    let result = '';
                    for (let i = 0; i < filename.length; i++) {
                        const char = filename.charAt(i);
                        const code = filename.charCodeAt(i);
                        
                        // Remove filesystem-unsafe characters
                        if ('<>:"/\\\\|?*'.includes(char)) {
                            result += '_';
                        }
                        // Remove control characters (0-31 and 127)
                        else if (code >= 0 && code <= 31 || code === 127) {
                            result += '_';
                        }
                        // Keep all other characters (including CJK)
                        else {
                            result += char;
                        }
                    }
                    
                    return result
                        .replace(/\\s+/g, '_') // Replace spaces with underscores
                        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
                        .replace(/^_|_$/g, ''); // Trim leading/trailing underscores
                }
                
                function generateFilename(image, index) {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                    
                    try {
                        const url = new URL(image.url);
                        let filename = url.pathname.split('/').pop();
                        
                        if (!filename || !filename.includes('.')) {
                            const extension = image.url.split('.').pop() || 'jpg';
                            filename = 'image_' + timestamp + '_' + (index + 1) + '.' + extension;
                        }
                        // Use original filename as-is if it exists
                        
                        // Use basic sanitization for the gallery version
                        return sanitizeFilename(filename);
                    } catch {
                        return 'image_' + timestamp + '_' + (index + 1) + '.jpg';
                    }
                }
                
                function resetFilters() {
                    document.getElementById('minWidth').value = '';
                    document.getElementById('maxWidth').value = '';
                    document.getElementById('minHeight').value = '';
                    document.getElementById('maxHeight').value = '';
                    
                    document.querySelectorAll('.ext-checkbox input').forEach(cb => {
                        cb.checked = true;
                    });
                    
                    applyFilters();
                }
                
                // Event listeners
                document.getElementById('downloadZipBtn').addEventListener('click', downloadZip);
                document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);
                
                // Filter inputs
                ['minWidth', 'maxWidth', 'minHeight', 'maxHeight'].forEach(id => {
                    document.getElementById(id).addEventListener('input', applyFilters);
                });
                
                document.querySelectorAll('.ext-checkbox input').forEach(cb => {
                    cb.addEventListener('change', applyFilters);
                });
                
                // Initial filter application
                applyFilters();
            </script>
        </body>
        </html>
    `;
}

// Sanitize filename while preserving CJK characters
function sanitizeFilename(filename) {
    // Remove only filesystem-unsafe characters, keep CJK characters
    // Use a safe approach without problematic regex ranges
    let result = '';
    for (let i = 0; i < filename.length; i++) {
        const char = filename.charAt(i);
        const code = filename.charCodeAt(i);
        
        // Remove filesystem-unsafe characters
        if ('<>:"/\\|?*'.includes(char)) {
            result += '_';
        }
        // Remove control characters (0-31 and 127)
        else if (code >= 0 && code <= 31 || code === 127) {
            result += '_';
        }
        // Keep all other characters (including CJK)
        else {
            result += char;
        }
    }
    
    return result
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
        .replace(/^_|_$/g, ''); // Trim leading/trailing underscores
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    debug.log('[IHS Popup] Initializing...');
    
    try {
        // Check if JSZip is available
        if (typeof JSZip === 'undefined') {
            debug.error('[IHS Popup] JSZip not loaded');
            showStatus('JSZip library failed to load', 'error');
            return;
        } else {
            debug.log('[IHS Popup] JSZip loaded successfully, version:', JSZip.version || 'unknown');
            
            // Test JSZip functionality
            try {
                const testZip = new JSZip();
                testZip.file('test.txt', 'Hello World');
                const testBlob = await testZip.generateAsync({ type: 'blob' });
                debug.log('[IHS Popup] JSZip test successful, blob size:', testBlob.size);
            } catch (zipError) {
                debug.error('[IHS Popup] JSZip test failed:', zipError);
                showStatus('JSZip library not functioning correctly', 'error');
                return;
            }
        }
        
        // Check if JXL converter is available
        if (typeof jxlConverter !== 'undefined') {
            debug.log('[IHS Popup] JXL converter loaded successfully');
            // JXL converter auto-initializes when script loads
        } else {
            debug.warn('[IHS Popup] JXL converter not loaded, JXL conversion will not be available');
        }
        
        // Initialize popup and event listeners
        await initializePopup();
        setupEventListeners();
        
        debug.log('[IHS Popup] Initialization complete');
    } catch (error) {
        debug.error('[IHS Popup] Initialization failed:', error);
        showStatus('Extension failed to initialize', 'error');
    }
});

// Reset all settings to default values
async function resetAllSettings() {
    try {
        // Clear all extension settings
        await chrome.storage.sync.clear();
        
        // Reinitialize popup with default values
        await initializePopup();
        
        // Notify content script of the reset settings
        await notifyContentScriptSettingsChanged();
        
        showStatus('All settings have been reset to default values');
    } catch (error) {
        debug.error('Failed to reset settings:', error);
        showStatus('Failed to reset settings', 'error');
    }
}

// Notify content script of settings changes
async function notifyContentScriptSettingsChanged() {
    try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab && activeTab.id) {
            const settings = await getCurrentSettings();
            const minImageSize = await storage.get('ihs_min_image_size');
            
            chrome.tabs.sendMessage(activeTab.id, {
                type: 'settings_updated',
                settings: {
                    ...settings,
                    minImageSize: minImageSize || CONFIG.MIN_IMAGE_SIZE
                }
            }).catch(error => {
                // Ignore errors - content script might not be ready or page might not support it
                debug.log('Could not notify content script:', error.message);
            });
        }
    } catch (error) {
        debug.log('Could not notify content script:', error.message);
    }
}
