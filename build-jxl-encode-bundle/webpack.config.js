const path = require('path');

module.exports = (env, argv) => {
  const isDevelopment = argv.mode === 'development';
  
  return {
    entry: './jxl-entry.js',
    output: {
      filename: 'jxl-bundle.js',
      path: path.resolve(__dirname, 'dist'),
      library: {
        name: 'JXLEncoder',
        type: 'window',
      },
      globalObject: 'window'
    },
    mode: argv.mode || 'production',
    
    // Enable persistent caching for faster rebuilds
    cache: {
      type: 'filesystem',
      cacheDirectory: path.resolve(__dirname, '.webpack-cache'),
    },
    
    // Optimize for faster builds in development
    optimization: isDevelopment ? {
      minimize: false,
      splitChunks: false,
      removeAvailableModules: false,
      removeEmptyChunks: false,
      sideEffects: false,
    } : {
      // Production optimizations - single bundle
      minimize: true,
      sideEffects: false,
      splitChunks: false, // Disable code splitting for single bundle
    },
    
    // Faster source maps for development
    devtool: isDevelopment ? 'eval-cheap-module-source-map' : false,
    
    module: {
      rules: [
        {
          test: /\.wasm$/,
          type: 'asset/inline'
        }
      ]
    },
    
    // Resolve optimizations
    resolve: {
      symlinks: false,
      cacheWithContext: false,
    },
    
    // Stats configuration for cleaner output
    stats: {
      preset: 'minimal',
      moduleTrace: false,
      errorDetails: true,
    },
  };
};
