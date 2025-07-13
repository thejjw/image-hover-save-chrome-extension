import { encode } from '@jsquash/jxl';

// Create the encoder object that will be exposed to window.JXLEncoder
const JXLEncoder = {
  async encode(imageData, options = {}) {
    try {
      console.log('[JXL Bundle] Encoding image with options:', options);
      
      const finalOptions = {
        effort: 7,
        quality: 75,
        progressive: false,
        epf: -1,
        lossyPalette: false,
        decodingSpeedTier: 0,
        photonNoiseIso: 0,
        lossyModular: false,
        lossless: false,
        ...options
      };
      
      // Handle lossless mode
      if (finalOptions.lossless) {
        finalOptions.quality = 100;
        finalOptions.lossyModular = false;
        finalOptions.lossyPalette = false;
      }
      
      console.log('[JXL Bundle] Final encoding options:', finalOptions);
      
      const result = await encode(imageData, finalOptions);
      console.log('[JXL Bundle] Encoding successful, output size:', result.byteLength);
      
      return result;
    } catch (error) {
      console.error('[JXL Bundle] Encoding failed:', error);
      throw error;
    }
  },
  
  isSupported() {
    return true;
  },
  
  getVersion() {
    return 'webpack-bundled-@jsquash/jxl-v2';
  }
};

// Export as default for webpack
export default JXLEncoder;
