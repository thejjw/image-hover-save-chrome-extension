// JXL Encoder for Chrome Extension
// Based on @jsquash/jxl but adapted for Chrome extension environment

// Import the necessary dependencies
importScripts(chrome.runtime.getURL('wasm-feature-detect/dist/index.js'));

class JXLEncoder {
    constructor() {
        this.emscriptenModule = null;
        this.initialized = false;
    }

    async init(moduleOptionOverrides) {
        try {
            // Default options from meta.js
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

            let actualOptions = moduleOptionOverrides || {};

            // For Chrome extension, we'll use the single-threaded version for simplicity
            // and better compatibility
            const jxlEncoderModule = await import(chrome.runtime.getURL('enc/jxl_enc.js'));
            
            // Initialize the emscripten module
            this.emscriptenModule = await this.initEmscriptenModule(
                jxlEncoderModule.default, 
                undefined, 
                actualOptions
            );
            
            this.initialized = true;
            return this.emscriptenModule;
        } catch (error) {
            console.error('JXL Encoder initialization failed:', error);
            throw error;
        }
    }

    async initEmscriptenModule(createModule, wasmModule, moduleOptionOverrides) {
        const module = await createModule({
            wasmBinary: wasmModule,
            ...moduleOptionOverrides,
            locateFile: (path) => {
                // Use Chrome extension runtime URL for WASM files
                if (path.endsWith('.wasm')) {
                    return chrome.runtime.getURL('enc/' + path);
                }
                return path;
            }
        });
        return module;
    }

    async encode(imageData, options = {}) {
        if (!this.initialized || !this.emscriptenModule) {
            await this.init();
        }

        const module = this.emscriptenModule;
        
        // Default options
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
            if (options.quality !== undefined && options.quality !== 100) {
                console.warn('JXL lossless: Quality setting is ignored when lossless is enabled (quality must be 100).');
            }
            if (options.lossyModular) {
                console.warn('JXL lossless: LossyModular setting is ignored when lossless is enabled (lossyModular must be false).');
            }
            if (options.lossyPalette) {
                console.warn('JXL lossless: LossyPalette setting is ignored when lossless is enabled (lossyPalette must be false).');
            }
            _options.quality = 100;
            _options.lossyModular = false;
            _options.lossyPalette = false;
        }

        // Encode the image
        const resultView = module.encode(imageData.data, imageData.width, imageData.height, _options);
        
        if (!resultView) {
            throw new Error('JXL encoding error.');
        }

        return resultView.buffer;
    }
}

// Export for use in Chrome extension
if (typeof globalThis !== 'undefined') {
    globalThis.JXLEncoder = JXLEncoder;
}

if (typeof window !== 'undefined') {
    window.JXLEncoder = JXLEncoder;
}
