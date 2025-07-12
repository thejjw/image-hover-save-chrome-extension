// JXL Converter for Chrome Extension
// Uses @jsquash/jxl library for JPEG to JXL conversion
// Copyright (c) Jaewoo Jeon (@thejjw) and Image Hover Save Extension Contributors
// SPDX-License-Identifier: zlib-acknowledgement

// Share debug system with other scripts - only declare if not already exists
if (typeof window.DEBUG === 'undefined') {
    window.DEBUG = true;
}

if (typeof window.debug === 'undefined') {
    window.debug = {
        log: (...args) => window.DEBUG && console.log(...args),
        error: (...args) => window.DEBUG && console.error(...args),
        warn: (...args) => window.DEBUG && console.warn(...args),
        info: (...args) => window.DEBUG && console.info(...args)
    };
}

class JXLConverter {
    constructor() {
        this.initialized = false;
        this.encoder = null;
    }

    // Initialize the JXL encoder
    async init() {
        try {
            window.debug.log('[JXL Converter] Initializing JXL converter...');
            
            // Load the JXL bundle if not already loaded
            if (typeof window === 'undefined' || !window.jxl) {
                await this.loadJXLBundle();
            }
            
            this.initialized = true;
            window.debug.log('[JXL Converter] JXL converter initialized successfully');
            
            return true;
        } catch (error) {
            window.debug.error('[JXL Converter] Failed to initialize JXL converter:', error);
            return false;
        }
    }

    // Load the JXL bundle dynamically
    async loadJXLBundle() {
        return new Promise((resolve, reject) => {
            if (typeof window !== 'undefined' && window.jxl) {
                resolve(); // Already loaded
                return;
            }

            window.debug.log('[JXL Converter] Loading jxl.bundle.js...');
            
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('jxl.bundle.js');
            script.onload = () => {
                window.debug.log('[JXL Converter] jxl.bundle.js loaded successfully');
                // Wait a bit for the library to initialize
                setTimeout(() => {
                    if (window.jxl && window.jxl.encode) {
                        window.debug.log('[JXL Converter] JXL encoder is available');
                        resolve();
                    } else {
                        window.debug.error('[JXL Converter] JXL encoder not available after loading bundle');
                        reject(new Error('JXL encoder not available after loading bundle'));
                    }
                }, 100);
            };
            script.onerror = (error) => {
                window.debug.error('[JXL Converter] Failed to load jxl.bundle.js:', error);
                reject(new Error('Failed to load jxl.bundle.js'));
            };
            
            document.head.appendChild(script);
        });
    }

    // Check if an image can be converted to JXL (currently only JPEG)
    canConvert(mimeType) {
        return mimeType === 'image/jpeg' || mimeType === 'image/jpg';
    }

    // Convert an image to JXL format
    async convertToJXL(imageData, options = {}) {
        if (!this.initialized) {
            throw new Error('JXL converter not initialized');
        }

        const { lossless = true } = options;
        
        window.debug.log('[JXL Converter] Converting image to JXL, lossless:', lossless);
        
        try {
            // Check if window.jxl is available (loaded by jxl.bundle.js)
            if (typeof window === 'undefined' || !window.jxl || !window.jxl.encode) {
                throw new Error('JXL encoder not available. Make sure jxl.bundle.js is loaded.');
            }

            // Set up encoding options with lossless default for JPEG conversion
            const jxlOptions = {
                lossless: lossless,
                quality: lossless ? 100 : 85,
                effort: 7,
                ...options
            };

            window.debug.log('[JXL Converter] Encoding with options:', jxlOptions);
            
            // If input is raw bytes, we need to decode it to ImageData first
            let imageDataToEncode;
            if (imageData instanceof Uint8Array || imageData instanceof ArrayBuffer) {
                // Create a temporary image to decode the JPEG data
                imageDataToEncode = await this.decodeImageToImageData(imageData);
            } else if (imageData.data && imageData.width && imageData.height) {
                // Already ImageData
                imageDataToEncode = imageData;
            } else {
                throw new Error('Unsupported image data format');
            }
            
            // Use the bundled JXL encoder
            const jxlData = await window.jxl.encode(imageDataToEncode, jxlOptions);
            
            window.debug.log('[JXL Converter] JXL conversion successful, size:', jxlData.byteLength);
            return new Uint8Array(jxlData);
            
        } catch (error) {
            window.debug.error('[JXL Converter] JXL conversion failed:', error);
            throw error;
        }
    }

    // Helper method to decode image bytes to ImageData
    async decodeImageToImageData(imageBytes) {
        return new Promise((resolve, reject) => {
            // Convert Uint8Array to Blob
            const blob = new Blob([imageBytes], { type: 'image/jpeg' });
            const url = URL.createObjectURL(blob);
            
            const img = new Image();
            img.onload = () => {
                try {
                    // Create canvas and get ImageData
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    canvas.width = img.width;
                    canvas.height = img.height;
                    
                    ctx.drawImage(img, 0, 0);
                    const imageData = ctx.getImageData(0, 0, img.width, img.height);
                    
                    URL.revokeObjectURL(url);
                    resolve(imageData);
                } catch (error) {
                    URL.revokeObjectURL(url);
                    reject(error);
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load image for decoding'));
            };
            img.src = url;
        });
    }

    // Convert a blob to JXL
    async convertBlobToJXL(blob, options = {}) {
        if (!this.canConvert(blob.type)) {
            throw new Error(`Cannot convert ${blob.type} to JXL. Only JPEG is supported.`);
        }

        // Convert blob to ImageData or ArrayBuffer for processing
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Convert to JXL
        const jxlData = await this.convertToJXL(uint8Array, options);
        
        // Return as blob
        return new Blob([jxlData], { type: 'image/jxl' });
    }

    // Utility: Generate JXL filename from original filename
    generateJXLFilename(originalFilename) {
        if (!originalFilename) {
            return 'image.jxl';
        }
        
        // Remove extension and add .jxl
        const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
        return `${nameWithoutExt}.jxl`;
    }

    // Check if browser supports JXL (for display purposes)
    async checkJXLSupport() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            return new Promise((resolve) => {
                img.onload = () => resolve(true);
                img.onerror = () => resolve(false);
                img.src = 'data:image/jxl;base64,/woIELdIWA=='; // Minimal JXL header
            });
        } catch {
            return false;
        }
    }
}

// Create global instance
const jxlConverter = new JXLConverter();

// Auto-initialize when script loads
jxlConverter.init().then(success => {
    if (success) {
        window.debug.log('[JXL Converter] JXL converter ready');
    } else {
        window.debug.error('[JXL Converter] JXL converter failed to initialize');
    }
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = jxlConverter;
} else if (typeof globalThis !== 'undefined') {
    globalThis.jxlConverter = jxlConverter;
}
