// JXL Converter for Chrome Extension
// Uses @jsquash/jxl library for JPEG to JXL conversion
// Copyright (c) Jaewoo Jeon (@thejjw) and Image Hover Save Extension Contributors
// SPDX-License-Identifier: zlib-acknowledgement

const DEBUG = true;

const debug = {
    log: (...args) => DEBUG && console.log('[JXL Converter]', ...args),
    error: (...args) => DEBUG && console.error('[JXL Converter]', ...args),
    warn: (...args) => DEBUG && console.warn('[JXL Converter]', ...args),
    info: (...args) => DEBUG && console.info('[JXL Converter]', ...args)
};

class JXLConverter {
    constructor() {
        this.initialized = false;
        this.encoder = null;
    }

    // Initialize the JXL encoder
    async init() {
        try {
            debug.log('Initializing JXL converter...');
            
            // For now, we'll create a placeholder that indicates JXL conversion is not yet available
            // In the future, this would initialize the actual @jsquash/jxl encoder
            this.initialized = true;
            debug.log('JXL converter initialized (placeholder mode)');
            
            return true;
        } catch (error) {
            debug.error('Failed to initialize JXL converter:', error);
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
        
        debug.log('Converting image to JXL, lossless:', lossless);
        
        try {
            // For now, return a placeholder
            // In the future, this would use the actual @jsquash/jxl encoder
            throw new Error('JXL conversion not yet implemented - @jsquash/jxl integration pending');
            
            // Placeholder for future implementation:
            // const jxlData = await this.encoder.encode(imageData, { lossless });
            // return jxlData;
            
        } catch (error) {
            debug.error('JXL conversion failed:', error);
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
        debug.log('JXL converter ready');
    } else {
        debug.error('JXL converter failed to initialize');
    }
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = jxlConverter;
} else if (typeof globalThis !== 'undefined') {
    globalThis.jxlConverter = jxlConverter;
}
