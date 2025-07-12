// JXL Encoder using webpack-bundled @jsquash/jxl
// Uses bundled version that includes all WASM and dependencies

(function() {
    'use strict';

    class SimpleJXLEncoder {
        constructor() {
            this.initialized = false;
            this.encoder = null;
        }

        async init() {
            window.debug.log('[JXL Encoder] Initializing webpack-bundled JXL encoder...');
            
            try {
                // Load the main webpack bundle
                if (typeof window.JXLEncoder === 'undefined') {
                    await this.loadBundle();
                }
                
                // Check if the bundle loaded properly
                if (typeof window.JXLEncoder !== 'undefined') {
                    // The bundle exposes either the encoder directly or as .default
                    const encoder = window.JXLEncoder.default || window.JXLEncoder;
                    if (encoder && encoder.encode) {
                        this.encoder = encoder;
                        this.initialized = true;
                        window.debug.log('[JXL Encoder] Webpack-bundled JXL encoder ready!');
                        if (encoder.getVersion) {
                            window.debug.log('[JXL Encoder] Version:', encoder.getVersion());
                        }
                        return true;
                    }
                }
                throw new Error('JXL encoder bundle failed to initialize');
            } catch (error) {
                window.debug.error('[JXL Encoder] Failed to initialize bundled JXL encoder:', error);
                return false;
            }
        }

        async loadBundle() {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = chrome.runtime.getURL('jxl-bundle.js');
                script.onload = () => {
                    window.debug.log('[JXL Encoder] Main bundle loaded successfully');
                    // The bundle may need a moment to initialize
                    setTimeout(() => {
                        if (typeof window.JXLEncoder !== 'undefined') {
                            window.debug.log('[JXL Encoder] JXLEncoder object available:', typeof window.JXLEncoder);
                            window.debug.log('[JXL Encoder] JXLEncoder methods:', Object.keys(window.JXLEncoder || {}));
                            resolve();
                        } else {
                            reject(new Error('JXL encoder not available after bundle load'));
                        }
                    }, 100);
                };
                script.onerror = (error) => {
                    window.debug.error('[JXL Encoder] Failed to load JXL bundle:', error);
                    reject(new Error('Failed to load JXL bundle'));
                };
                
                document.head.appendChild(script);
            });
        }

        async encode(imageData, options = {}) {
            if (!this.initialized || !this.encoder) {
                throw new Error('JXL encoder not initialized');
            }

            window.debug.log('[JXL Encoder] Encoding image...');
            
            try {
                const result = await this.encoder.encode(imageData, options);
                window.debug.log('[JXL Encoder] Encoding successful, size:', result.byteLength);
                return result;
            } catch (error) {
                window.debug.error('[JXL Encoder] Encoding failed:', error);
                throw error;
            }
        }

        isSupported() {
            return this.initialized && this.encoder && typeof this.encoder.encode === 'function';
        }

        canEncode(mimeType) {
            return this.initialized;
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
