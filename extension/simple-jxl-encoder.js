// Simplified JXL Encoder for Chrome Extension Content Scripts
// WASM-based JXL encoding compatible with Chrome extension environment

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
                window.debug.log('[JXL Encoder] Initializing WASM JXL encoder...');
                
                // Load the WASM module directly without the problematic JS wrapper
                const wasmUrl = chrome.runtime.getURL('enc/jxl_enc.wasm');
                const wasmBytes = await fetch(wasmUrl).then(r => r.arrayBuffer());
                
                // Create a minimal WASM module wrapper
                const wasmModule = await WebAssembly.instantiate(wasmBytes, {
                    env: {
                        memory: new WebAssembly.Memory({ initial: 256 }),
                        // Add other required imports as needed
                    }
                });
                
                this.module = wasmModule.instance.exports;
                this.initialized = true;
                
                window.debug.log('[JXL Encoder] WASM JXL encoder initialized successfully');
                return true;

            } catch (error) {
                window.debug.error('[JXL Encoder] Failed to initialize WASM JXL encoder:', error);
                
                // Try alternative approach using the JS file but patching import.meta
                try {
                    window.debug.log('[JXL Encoder] Trying alternative JS module loading...');
                    await this.loadJSModule();
                    return true;
                } catch (jsError) {
                    window.debug.error('[JXL Encoder] JS module loading also failed:', jsError);
                    return false;
                }
            }
        }

        async loadJSModule() {
            // Patch import.meta before loading the module
            const originalImportMeta = window.import && window.import.meta;
            
            // Create a fake import.meta object
            if (!window.import) {
                window.import = {};
            }
            window.import.meta = {
                url: chrome.runtime.getURL('enc/jxl_enc.js')
            };
            
            try {
                // Load the JS module
                const jsUrl = chrome.runtime.getURL('enc/jxl_enc.js');
                await this.loadScript(jsUrl);
                
                // Wait for the module to be available
                let attempts = 0;
                while (!window.Module && attempts < 50) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                }

                if (!window.Module) {
                    throw new Error('JXL module not loaded');
                }

                // Wait for module ready
                await window.Module.ready;
                
                this.module = window.Module;
                this.initialized = true;
                
                window.debug.log('[JXL Encoder] JS module loaded successfully');
                
            } finally {
                // Restore original import.meta
                if (originalImportMeta) {
                    window.import.meta = originalImportMeta;
                } else if (window.import) {
                    delete window.import.meta;
                }
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
                // Use the loaded module to encode
                let result;
                
                if (this.module.encode) {
                    // Direct WASM function call
                    result = this.module.encode(
                        imageData.data, 
                        imageData.width, 
                        imageData.height, 
                        _options
                    );
                } else if (window.Module && window.Module.encode) {
                    // JS module wrapper
                    result = window.Module.encode(
                        imageData.data, 
                        imageData.width, 
                        imageData.height, 
                        _options
                    );
                } else {
                    throw new Error('No encode function available');
                }

                if (!result) {
                    throw new Error('JXL encoding returned null result');
                }

                // Handle different result types
                let buffer;
                if (result.buffer) {
                    buffer = result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength);
                } else if (result instanceof ArrayBuffer) {
                    buffer = result;
                } else if (result instanceof Uint8Array) {
                    buffer = result.buffer;
                } else {
                    buffer = result;
                }

                window.debug.log('[JXL Encoder] Encoding successful, output size:', buffer.byteLength || buffer.length);
                
                return buffer;

            } catch (error) {
                window.debug.error('[JXL Encoder] Encoding failed:', error);
                throw error;
            }
        }

        canEncode(mimeType) {
            // Only return true if we're actually initialized
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
