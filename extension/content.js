// Image Hover Save Extension - Content Script
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
    DEFAULT_EXTENSIONS: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'mp4', 'webm', 'mov'],
    DEFAULT_HOVER_DELAY: 1500,
    MIN_IMAGE_SIZE: 100
};

let hoverTimer = null;
let currentImage = null;
let downloadButton = null;
let isEnabled = true;
let hoverDelay = CONFIG.DEFAULT_HOVER_DELAY; // 1.5 seconds default
let isDomainExcluded = false;
let minImageSize = CONFIG.MIN_IMAGE_SIZE;
let detectImg = true;
let detectVideo = true;
let detectSvg = false;
let detectBackground = false;

// Storage helper
const storage = {
    async get(key) {
        try {
            const result = await chrome.storage.sync.get(key);
            return result[key];
        } catch (error) {
            debug.warn('Storage error:', error);
            return null;
        }
    }
};

// Initialize extension settings
async function initializeExtension() {
    try {
        const enabled = await storage.get('ihs_enabled');
        const delay = await storage.get('ihs_hover_delay');
        const minSize = await storage.get('ihs_min_image_size');
        const imgDetect = await storage.get('ihs_detect_img');
        const videoDetect = await storage.get('ihs_detect_video');
        const svgDetect = await storage.get('ihs_detect_svg');
        const bgDetect = await storage.get('ihs_detect_background');
        
        isEnabled = enabled !== false; // Default to true
        hoverDelay = delay || CONFIG.DEFAULT_HOVER_DELAY;
        minImageSize = minSize || CONFIG.MIN_IMAGE_SIZE;
        detectImg = imgDetect !== false; // Default: true
        detectVideo = videoDetect !== false; // Default: true
        detectSvg = svgDetect === true; // Default: false
        detectBackground = bgDetect === true; // Default: false
        
        // Check domain exclusions
        await checkDomainExclusion();
        
        // Send initial domain status to background script
        chrome.runtime.sendMessage({
            type: 'ihs:domain_status_changed',
            excluded: isDomainExcluded
        }).catch(() => {
            // Ignore errors if background script isn't available
        });
        
        debug.log('Extension initialized:', { 
            isEnabled, hoverDelay, minImageSize, isDomainExcluded,
            detectImg, detectVideo, detectSvg, detectBackground 
        });
    } catch (error) {
        debug.warn('Failed to load settings:', error);
    }
}

// Create download button element
function createDownloadButton() {
    const button = document.createElement('div');
    button.className = 'ihs-download-btn';
    button.innerHTML = '💾';
    button.title = 'Save image';
    
    button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (currentImage) {
            downloadElement(currentImage);
        }
        hideDownloadButton();
    });
    
    return button;
}

// Position download button relative to image
function positionButton(img, button) {
    const rect = img.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    button.style.position = 'absolute';
    button.style.left = (rect.right - 40 + scrollX) + 'px';
    button.style.top = (rect.top + 10 + scrollY) + 'px';
    button.style.zIndex = '2147483647';
}

// Show download button
function showDownloadButton(img) {
    if (!downloadButton) {
        downloadButton = createDownloadButton();
        document.body.appendChild(downloadButton);
    }
    
    positionButton(img, downloadButton);
    downloadButton.style.display = 'block';
    currentImage = img;
}

// Hide download button
function hideDownloadButton() {
    if (downloadButton) {
        downloadButton.style.display = 'none';
    }
    currentImage = null;
}

// Download image or video
function downloadElement(element) {
    try {
        let elementUrl;
        let defaultExtension = 'jpg';
        
        // Get element URL based on type
        if (element.tagName === 'IMG') {
            elementUrl = element.src;
            defaultExtension = 'jpg';
        } else if (element.tagName === 'VIDEO') {
            // For video elements, try src first, then currentSrc, then first source element
            elementUrl = element.src || element.currentSrc;
            defaultExtension = 'mp4';
            
            if (!elementUrl) {
                const sources = element.querySelectorAll('source');
                if (sources.length > 0) {
                    elementUrl = sources[0].src;
                }
            }
        }
        
        if (!elementUrl || elementUrl.startsWith('data:')) {
            // Handle data URLs or missing src
            if (elementUrl && elementUrl.startsWith('data:')) {
                // Keep data URL as is
            } else {
                debug.warn('Cannot download element: no valid URL');
                return;
            }
        }
        
        // Generate filename
        const url = new URL(elementUrl, window.location.href);
        let filename = url.pathname.split('/').pop() || 'media';
        
        // Ensure filename has extension
        if (!filename.includes('.')) {
            filename += '.' + defaultExtension;
        }
        
        // Send download request to background script
        chrome.storage.sync.get(['ihs_download_mode'], async (result) => {
            const downloadMode = result.ihs_download_mode || 'normal';
            
            // Handle JXL conversion mode
            if (downloadMode === 'jxl') {
                // Check if this is a JPEG image that can be converted
                if (element.tagName === 'IMG' && (elementUrl.toLowerCase().includes('.jpg') || elementUrl.toLowerCase().includes('.jpeg'))) {
                    chrome.runtime.sendMessage({
                        type: 'download_image_as_jxl',
                        url: elementUrl,
                        filename: filename,
                        options: { lossless: true }
                    });
                    return;
                } else {
                    // Not a JPEG, fall back to normal download
                    debug.log('JXL conversion only supports JPEG images, falling back to normal download');
                }
            }
            
            // Handle canvas extraction mode
            if (downloadMode === 'canvas') {
                try {
                    const canvasBlob = await extractImageToCanvas(element);
                    if (canvasBlob) {
                        // Send blob data to background script
                        const reader = new FileReader();
                        reader.onload = function() {
                            chrome.runtime.sendMessage({
                                type: 'download_canvas_image',
                                dataUrl: reader.result,
                                filename: filename,
                                downloadMode: downloadMode
                            });
                        };
                        reader.readAsDataURL(canvasBlob);
                        return;
                    } else {
                        debug.warn('Canvas extraction failed, falling back to normal download');
                    }
                } catch (canvasError) {
                    debug.warn('Canvas extraction error, falling back to normal download:', canvasError);
                }
            }
            
            chrome.runtime.sendMessage({
                type: 'download_image',
                url: elementUrl,
                filename: filename,
                downloadMode: downloadMode
            });
        });
        
    } catch (error) {
        debug.error('Error downloading element:', error);
    }
}

// Check if element is suitable for download (image or video)
function isDownloadableElement(element) {
    // Skip very small elements (likely icons or decorative)
    const rect = element.getBoundingClientRect();
    if (rect.width < minImageSize || rect.height < minImageSize) {
        return false;
    }
    
    // For IMG elements
    if (element.tagName === 'IMG') {
        if (!element.src || element.src === '' || element.src === window.location.href) {
            return false;
        }
    }
    
    // For VIDEO elements
    if (element.tagName === 'VIDEO') {
        if (!element.src && !element.currentSrc) {
            // Check if there are source elements
            const sources = element.querySelectorAll('source');
            if (sources.length === 0) {
                return false;
            }
        }
    }
    
    return true;
}

// Get all images on the page based on settings
function getAllImages(settings = {}) {
    const images = [];
    const detectImg = settings.detectImg !== false; // Default: true
    const detectSvg = settings.detectSvg === true; // Default: false
    const detectBackground = settings.detectBackground === true; // Default: false
    const detectVideo = settings.detectVideo !== false; // Default: true
    const allowedExtensions = settings.allowedExtensions || CONFIG.DEFAULT_EXTENSIONS;
    
    // Helper function to check if URL has allowed extension
    function hasAllowedExtension(url) {
        if (!url) return false;
        try {
            const pathname = new URL(url, window.location.href).pathname.toLowerCase();
            return allowedExtensions.some(ext => pathname.includes('.' + ext.toLowerCase()));
        } catch {
            return false;
        }
    }
    
    // 1. Regular IMG elements
    if (detectImg) {
        const imgElements = document.querySelectorAll('img');
        imgElements.forEach(img => {
            if (img.src && hasAllowedExtension(img.src)) {
                const rect = img.getBoundingClientRect();
                if (rect.width >= minImageSize && rect.height >= minImageSize) {
                    images.push({
                        url: img.src,
                        type: 'img',
                        alt: img.alt || '',
                        width: rect.width,
                        height: rect.height
                    });
                }
            }
        });
    }
    
    // 2. SVG elements  
    if (detectSvg) {
        const svgElements = document.querySelectorAll('svg');
        svgElements.forEach(svg => {
            const rect = svg.getBoundingClientRect();
            if (rect.width >= minImageSize && rect.height >= minImageSize) {
                // Convert SVG to data URL
                try {
                    const serializer = new XMLSerializer();
                    const svgStr = serializer.serializeToString(svg);
                    const dataUrl = 'data:image/svg+xml;base64,' + btoa(svgStr);
                    images.push({
                        url: dataUrl,
                        type: 'svg',
                        alt: svg.getAttribute('title') || svg.getAttribute('aria-label') || '',
                        width: rect.width,
                        height: rect.height
                    });
                } catch (error) {
                    debug.warn('Failed to serialize SVG:', error);
                }
            }
        });
    }
    
    // 3. Background images
    if (detectBackground) {
        const allElements = document.querySelectorAll('*');
        allElements.forEach(element => {
            const style = window.getComputedStyle(element);
            const bgImage = style.backgroundImage;
            
            if (bgImage && bgImage !== 'none') {
                const matches = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
                if (matches && matches[1]) {
                    const url = matches[1];
                    if (hasAllowedExtension(url)) {
                        const rect = element.getBoundingClientRect();
                        if (rect.width >= minImageSize && rect.height >= minImageSize) {
                            images.push({
                                url: url,
                                type: 'background',
                                alt: element.getAttribute('title') || element.getAttribute('alt') || '',
                                width: rect.width,
                                height: rect.height
                            });
                        }
                    }
                }
            }
        });
    }
    
    // 4. Video elements
    if (detectVideo) {
        const videoElements = document.querySelectorAll('video');
        videoElements.forEach(video => {
            let videoUrl = video.src || video.currentSrc;
            
            // If no direct src, check source elements
            if (!videoUrl) {
                const sources = video.querySelectorAll('source');
                if (sources.length > 0) {
                    videoUrl = sources[0].src;
                }
            }
            
            if (videoUrl && hasAllowedExtension(videoUrl)) {
                const rect = video.getBoundingClientRect();
                if (rect.width >= minImageSize && rect.height >= minImageSize) {
                    images.push({
                        url: videoUrl,
                        type: 'video',
                        alt: video.getAttribute('title') || video.getAttribute('alt') || '',
                        width: rect.width,
                        height: rect.height
                    });
                }
            }
        });
    }
    
    // Remove duplicates based on URL
    const uniqueImages = [];
    const seen = new Set();
    images.forEach(img => {
        if (!seen.has(img.url)) {
            seen.add(img.url);
            uniqueImages.push(img);
        }
    });
    
    return uniqueImages;
}

// Domain exclusion checking
function isCurrentDomainExcluded(exclusions) {
    if (!exclusions || !Array.isArray(exclusions)) {
        return false;
    }
    
    const currentHostname = window.location.hostname.toLowerCase();
    
    for (const exclusion of exclusions) {
        const excludeDomain = exclusion.toLowerCase();
        
        // Exact match
        if (currentHostname === excludeDomain) {
            return true;
        }
        
        // Subdomain match - check if current domain ends with "." + exclude domain
        if (currentHostname.endsWith('.' + excludeDomain)) {
            return true;
        }
    }
    
    return false;
}

// Check if extension should run on current domain
async function checkDomainExclusion() {
    try {
        const exclusions = await storage.get('ihs_domain_exclusions');
        const wasExcluded = isDomainExcluded;
        isDomainExcluded = isCurrentDomainExcluded(exclusions);
        debug.log('Domain exclusion check:', window.location.hostname, isDomainExcluded);
        
        // Notify background script if exclusion status changed
        if (wasExcluded !== isDomainExcluded) {
            chrome.runtime.sendMessage({
                type: 'ihs:domain_status_changed',
                excluded: isDomainExcluded
            }).catch(() => {
                // Ignore errors if background script isn't available
            });
        }
    } catch (error) {
        debug.warn('Failed to check domain exclusions:', error);
        isDomainExcluded = false;
    }
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    debug.log('Content script received message:', message);
    
    if (message.type === 'scan_images') {
        try {
            debug.log('Starting image scan with settings:', message.settings);
            const images = getAllImages(message.settings);
            debug.log('Image scan completed. Found:', images.length, 'images');
            debug.log('Scanned images:', images);
            sendResponse({ success: true, images });
        } catch (error) {
            debug.error('Error scanning images:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true; // Keep message channel open for async response
    }
    
    if (message.type === 'settings_updated') {
        try {
            debug.log('Updating settings:', message.settings);
            
            // Update detection settings
            if (message.settings.detectImg !== undefined) {
                detectImg = message.settings.detectImg;
            }
            if (message.settings.detectVideo !== undefined) {
                detectVideo = message.settings.detectVideo;
            }
            if (message.settings.detectSvg !== undefined) {
                detectSvg = message.settings.detectSvg;
            }
            if (message.settings.detectBackground !== undefined) {
                detectBackground = message.settings.detectBackground;
            }
            if (message.settings.minImageSize !== undefined) {
                minImageSize = message.settings.minImageSize;
            }
            
            debug.log('Settings updated:', { 
                detectImg, detectVideo, detectSvg, detectBackground, minImageSize 
            });
            
            sendResponse({ success: true });
        } catch (error) {
            debug.error('Error updating settings:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }
    
    if (message.type === 'convert_to_jxl') {
        // Handle JXL conversion request via shared JXLConverter module
        if (typeof globalThis.jxlConverter !== 'undefined') {
            (async () => {
                try {
                    const response = await fetch(message.url);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch image: ${response.status}`);
                    }
                    const blob = await response.blob();
                    const jxlBlob = await globalThis.jxlConverter.convertBlobToJXL(blob, message.options);
                    const arrayBuffer = await jxlBlob.arrayBuffer();
                    sendResponse({ 
                        success: true, 
                        jxlData: Array.from(new Uint8Array(arrayBuffer))
                    });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
            })();
        } else {
            sendResponse({ success: false, error: 'JXL converter not available' });
        }
        return true; // Keep message channel open for async response
    }
    
    debug.log('Unknown message type:', message.type);
});

// Handle mouse events
function handleMouseEnter(e) {
    if (!isEnabled || isDomainExcluded) return;
    
    const element = e.target;
    
    // Check if this element type is enabled for detection
    let isValidType = false;
    if (element.tagName === 'IMG' && detectImg) {
        isValidType = true;
    } else if (element.tagName === 'VIDEO' && detectVideo) {
        isValidType = true;
    } else if (element.tagName === 'svg' && detectSvg) {
        isValidType = true;
    } else if (detectBackground) {
        // Check for background images
        const computedStyle = window.getComputedStyle(element);
        const bgImage = computedStyle.backgroundImage;
        if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) {
            isValidType = true;
        }
    }
    
    if (!isValidType || !isDownloadableElement(element)) {
        return;
    }
    
    // Clear any existing timer
    if (hoverTimer) {
        clearTimeout(hoverTimer);
    }
    
    // Set new timer
    hoverTimer = setTimeout(() => {
        showDownloadButton(element);
    }, hoverDelay);
}

function handleMouseLeave(e) {
    // Clear timer if mouse leaves before delay
    if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
    }
    
    // Hide button after a short delay (unless mouse moves to button)
    setTimeout(() => {
        if (downloadButton && !downloadButton.matches(':hover') && 
            e.target && typeof e.target.matches === 'function' && !e.target.matches(':hover')) {
            hideDownloadButton();
        } else if (downloadButton && !downloadButton.matches(':hover') && 
                  (!e.target || typeof e.target.matches !== 'function')) {
            hideDownloadButton();
        }
    }, 100);
}

// Handle mouse move for button repositioning
function handleMouseMove(e) {
    if (currentImage && downloadButton && downloadButton.style.display === 'block') {
        positionButton(currentImage, downloadButton);
    }
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
        if (changes.ihs_enabled) {
            isEnabled = changes.ihs_enabled.newValue !== false;
            debug.log('Extension enabled status changed:', isEnabled);
            if (!isEnabled) {
                hideDownloadButton();
            }
        }
        
        if (changes.ihs_hover_delay) {
            hoverDelay = changes.ihs_hover_delay.newValue || CONFIG.DEFAULT_HOVER_DELAY;
            debug.log('Hover delay changed:', hoverDelay);
        }
        
        if (changes.ihs_domain_exclusions) {
            checkDomainExclusion();
        }
    }
});

// Set up event listeners
document.addEventListener('mouseenter', handleMouseEnter, true);
document.addEventListener('mouseleave', handleMouseLeave, true);
window.addEventListener('scroll', () => {
    if (currentImage && downloadButton) {
        positionButton(currentImage, downloadButton);
    }
});
window.addEventListener('resize', () => {
    if (currentImage && downloadButton) {
        positionButton(currentImage, downloadButton);
    }
});

// Extract image to canvas and return as blob
async function extractImageToCanvas(element) {
    try {
        debug.log('Attempting canvas extraction for element:', element.tagName);
        
        let imageElement = element;
        let sourceUrl = null;
        
        // Handle different element types
        if (element.tagName === 'IMG') {
            sourceUrl = element.src;
        } else if (element.tagName === 'VIDEO') {
            sourceUrl = element.currentSrc || element.src;
        } else {
            // For background images or other elements, try to extract the URL
            const computedStyle = window.getComputedStyle(element);
            const backgroundImage = computedStyle.backgroundImage;
            
            if (backgroundImage && backgroundImage !== 'none') {
                const urlMatch = backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
                if (urlMatch) {
                    sourceUrl = urlMatch[1];
                }
            }
        }
        
        if (!sourceUrl) {
            debug.warn('No source URL found for canvas extraction');
            return null;
        }
        
        debug.log('Canvas extraction source URL:', sourceUrl);
        
        // Create a new image element to load the source
        const img = new Image();
        
        // Set up cross-origin handling
        img.crossOrigin = 'anonymous';
        
        return new Promise((resolve, reject) => {
            img.onload = function() {
                try {
                    debug.log('Image loaded for canvas extraction, dimensions:', img.naturalWidth, 'x', img.naturalHeight);
                    
                    // Create canvas
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Set canvas dimensions to match image
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    
                    // Draw image to canvas
                    ctx.drawImage(img, 0, 0);
                    
                    // Convert canvas to blob
                    canvas.toBlob((blob) => {
                        if (blob) {
                            debug.log('Canvas extraction successful, blob size:', blob.size);
                            resolve(blob);
                        } else {
                            debug.warn('Failed to create blob from canvas');
                            resolve(null);
                        }
                    }, 'image/png', 1.0);
                    
                } catch (canvasError) {
                    debug.error('Canvas drawing error:', canvasError);
                    resolve(null);
                }
            };
            
            img.onerror = function() {
                debug.warn('Failed to load image for canvas extraction');
                resolve(null);
            };
            
            // Handle CORS errors gracefully
            img.onabort = function() {
                debug.warn('Image loading aborted for canvas extraction');
                resolve(null);
            };
            
            // Start loading the image
            img.src = sourceUrl;
            
            // Set a timeout to avoid hanging
            setTimeout(() => {
                debug.warn('Canvas extraction timeout');
                resolve(null);
            }, 10000);
        });
        
    } catch (error) {
        debug.error('Canvas extraction error:', error);
        return null;
    }
}

// Initialize extension
initializeExtension();
checkDomainExclusion();
