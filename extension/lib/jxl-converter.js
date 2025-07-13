// JXL Converter for Chrome Extension
// Uses @jsquash/jxl library for JPEG to JXL conversion
// Copyright (c) Jaewoo Jeon (@thejjw) and Image Hover Save Extension Contributors
// SPDX-License-Identifier: zlib-acknowledgement

const JXL_DEBUG = true;

const jxlDebug = {
    log: (...args) => JXL_DEBUG && console.log('[JXL Converter]', ...args),
    error: (...args) => JXL_DEBUG && console.error('[JXL Converter]', ...args),
    warn: (...args) => JXL_DEBUG && console.warn('[JXL Converter]', ...args),
    info: (...args) => JXL_DEBUG && console.info('[JXL Converter]', ...args)
};

class JXLConverter {
    constructor() {
        this.initialized = false;
        this.encoder = null;
    }

    // Initialize the JXL encoder
    async init() {
        try {
            jxlDebug.log('Initializing JXL converter...');
            
            // For now, we'll create a placeholder that indicates JXL conversion is not yet available
            // In the future, this would initialize the actual @jsquash/jxl encoder
            this.initialized = true;
            jxlDebug.log('JXL converter initialized (placeholder mode)');
            
            return true;
        } catch (error) {
            jxlDebug.error('Failed to initialize JXL converter:', error);
            return false;
        }
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
        
        jxlDebug.log('Converting image to JXL, lossless:', lossless);
        
        try {
            // Check image size limits before attempting conversion
            const pixelCount = imageData.width * imageData.height;
            const maxPixels = 4000000; // ~4MP limit for safety
            const maxDimension = 3000; // Max width or height
            
            if (pixelCount > maxPixels || imageData.width > maxDimension || imageData.height > maxDimension) {
                throw new Error(`Image too large for JXL conversion (${imageData.width}x${imageData.height}, ${(pixelCount/1000000).toFixed(1)}MP). Max supported: ${maxDimension}x${maxDimension}, ${(maxPixels/1000000).toFixed(1)}MP`);
            }
            
            // Check if window.jxl is available (loaded by jxl.bundle.js)
            let encoder = null;
            if (typeof window !== 'undefined' && window.jxl && window.jxl.encode) {
                encoder = window.jxl;
            } else if (typeof window !== 'undefined' && window.JXLEncoder) {
                // Try the webpack bundle format
                encoder = window.JXLEncoder.default || window.JXLEncoder;
            }
            
            if (!encoder || typeof encoder.encode !== 'function') {
                throw new Error('JXL encoder not available. Make sure jxl.bundle.js is loaded.');
            }

            // Set up encoding options with lossless default for JPEG conversion
            const jxlOptions = {
                lossless: lossless,
                quality: lossless ? 100 : 85,
                effort: 7,
                ...options
            };

            jxlDebug.log('Encoding with options:', jxlOptions);
            
            // Add timeout to prevent hanging on problematic images
            const conversionPromise = encoder.encode(imageData, jxlOptions);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('JXL conversion timeout (30s)')), 30000)
            );
            
            const jxlData = await Promise.race([conversionPromise, timeoutPromise]);
            
            jxlDebug.log('JXL conversion successful, size:', jxlData.byteLength);
            return new Uint8Array(jxlData);
            
        } catch (error) {
            jxlDebug.error('JXL conversion failed:', error);
            
            // Provide more specific error messages
            if (error.message.includes('Aborted()')) {
                throw new Error('Image too large for JXL conversion (memory limit exceeded)');
            } else if (error.message.includes('timeout')) {
                throw new Error('JXL conversion took too long and was cancelled');
            }
            
            throw error;
        }
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
        jxlDebug.log('JXL converter ready');
    } else {
        jxlDebug.error('JXL converter failed to initialize');
    }
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = jxlConverter;
} else if (typeof globalThis !== 'undefined') {
    globalThis.jxlConverter = jxlConverter;
}
