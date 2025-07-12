// JXL Encoder using webpack-bundled @jsquash/jxl
// Uses bundled version that includes all WASM and dependencies

(function() {
    'use strict';

    class SimpleJXLEncoder {
        constructor() {
            this.initialized = false;
        }

        async init() {
            window.debug.log('[JXL Encoder] Initializing webpack-bundled JXL encoder...');
            
            try {
                // Load the main webpack bundle
                if (typeof window.JXLEncoder === 'undefined') {
                    await this.loadBundle();
                }
                
                if (typeof window.JXLEncoder !== 'undefined' && window.JXLEncoder.isSupported()) {
                    this.initialized = true;
                    window.debug.log('[JXL Encoder] Webpack-bundled JXL encoder ready!');
                    window.debug.log('[JXL Encoder] Version:', window.JXLEncoder.getVersion());
                    return true;
                } else {
                    throw new Error('JXL encoder bundle failed to initialize');
                }
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
                            resolve();
                        } else {
                            reject(new Error('JXL encoder not available after bundle load'));
                        }
                    }, 100);
                };
                script.onerror = (error) => {
                    window.debug.error('[JXL Encoder] Failed to load bundle:', error);
                    reject(new Error('Failed to load JXL bundle'));
                };
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
            
            // Use the bundled encoder
            return await window.JXLEncoder.encode(imageData, options);
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
