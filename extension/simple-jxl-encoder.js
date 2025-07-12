// Simplified JXL Encoder for Chrome Extension Content Scripts
// Based on @jsquash/jxl but adapted for content script environment

(function() {
    'use strict';

    // Simple JXL encoder that works in content scripts
    class SimpleJXLEncoder {
        constructor() {
            this.module = null;
            this.initialized = false;
        }

        async init() {
            try {
                window.debug.log('[JXL Encoder] Initializing simple JXL encoder...');
                
                // Load the single-threaded WASM encoder
                const wasmUrl = chrome.runtime.getURL('enc/jxl_enc.wasm');
                const jsUrl = chrome.runtime.getURL('enc/jxl_enc.js');

                // Load the JS module first
                await this.loadScript(jsUrl);
                
                // Wait for the module to be available
                let attempts = 0;
                while (!window.createJxlEncoderModule && attempts < 50) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                }

                if (!window.createJxlEncoderModule) {
                    throw new Error('JXL encoder module not loaded');
                }

                // Initialize the module
                this.module = await window.createJxlEncoderModule({
                    locateFile: (path) => {
                        if (path.endsWith('.wasm')) {
                            return wasmUrl;
                        }
                        return path;
                    }
                });

                this.initialized = true;
                window.debug.log('[JXL Encoder] Simple JXL encoder initialized successfully');
                return true;

            } catch (error) {
                window.debug.error('[JXL Encoder] Failed to initialize simple JXL encoder:', error);
                return false;
            }
        }

        async loadScript(url) {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = url;
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        async encode(imageData, options = {}) {
            if (!this.initialized) {
                const success = await this.init();
                if (!success) {
                    throw new Error('JXL encoder not initialized');
                }
            }

            const defaultOptions = {
                effort: 7,
                quality: 75,
                progressive: false,
                epf: -1,
                lossyPalette: false,
                decodingSpeedTier: 0,
                photonNoiseIso: 0,
                lossyModular: false,
                lossless: false,
            };

            const _options = { ...defaultOptions, ...options };

            // Handle lossless mode
            if (_options.lossless) {
                _options.quality = 100;
                _options.lossyModular = false;
                _options.lossyPalette = false;
            }

            window.debug.log('[JXL Encoder] Encoding image with options:', _options);

            try {
                const resultView = this.module.encode(
                    imageData.data, 
                    imageData.width, 
                    imageData.height, 
                    _options
                );

                if (!resultView) {
                    throw new Error('JXL encoding returned null result');
                }

                const buffer = resultView.buffer.slice(resultView.byteOffset, resultView.byteOffset + resultView.byteLength);
                window.debug.log('[JXL Encoder] Encoding successful, output size:', buffer.byteLength);
                
                return buffer;

            } catch (error) {
                window.debug.error('[JXL Encoder] Encoding failed:', error);
                throw error;
            }
        }

        canEncode(mimeType) {
            // For now, we'll only support converting from ImageData
            // The caller should handle decoding JPEG to ImageData first
            return true;
        }
    }

    // Make available globally
    if (typeof window !== 'undefined') {
        window.SimpleJXLEncoder = SimpleJXLEncoder;
    }
    if (typeof globalThis !== 'undefined') {
        globalThis.SimpleJXLEncoder = SimpleJXLEncoder;
    }

})();
