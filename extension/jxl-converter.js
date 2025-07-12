// JXL Converter Module for Image Hover Save Extension
// Uses @jsquash/jxl package for JXL encoding

class JXLConverter {
    constructor() {
        this.encodeModule = null;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return true;
        
        try {
            // For now, we'll implement a placeholder that converts to WebP
            // until we can properly integrate the @jsquash/jxl library
            this.initialized = true;
            console.log('[JXL Converter] Initialized (WebP fallback mode)');
            return true;
        } catch (error) {
            console.error('[JXL Converter] Failed to initialize:', error);
            return false;
        }
    }

    async convertImageToJXL(imageBlob, options = { lossless: true }) {
        if (!this.initialized) {
            await this.init();
        }

        try {
            // For now, we'll convert JPEG to WebP as a proof of concept
            // Later we'll integrate the actual JXL encoder
            return await this.convertToWebP(imageBlob, options);
        } catch (error) {
            console.error('[JXL Converter] Conversion failed:', error);
            throw error;
        }
    }

    async convertToWebP(imageBlob, options) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                // Convert to WebP with lossless quality if requested
                const quality = options.lossless ? 1.0 : 0.9;
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to convert to WebP'));
                    }
                }, 'image/webp', quality);
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(imageBlob);
        });
    }

    async loadImageFromUrl(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.statusText}`);
            }
            return await response.blob();
        } catch (error) {
            console.error('[JXL Converter] Failed to load image from URL:', error);
            throw error;
        }
    }

    // Helper method to check if image is JPEG
    isJPEG(blob) {
        return blob.type === 'image/jpeg' || blob.type === 'image/jpg';
    }

    // Helper method to generate JXL filename
    generateJXLFilename(originalFilename) {
        const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
        return nameWithoutExt + '.webp'; // For now using .webp, later will be .jxl
    }
}

// Export for use in other scripts
window.JXLConverter = JXLConverter;
