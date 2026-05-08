const webpack = require('webpack');

module.exports = {
  // This extends the default Create React App webpack config
  // and adds specific configurations for face-api.js
  webpack: (config) => ({
    ...config,
    resolve: {
      ...config.resolve,
      fallback: {
        "fs": false,
        "path": false,
        "crypto": false,
        "buffer": false,
        "stream": false,
        "os": false,
        "url": false
      },
      alias: {
        ...config.resolve.alias,
        // Use the minified version that doesn't require Node.js modules
        'face-api.js': 'face-api.js/dist/face-api.min.js'
      }
    },
    module: {
      ...config.module,
      rules: [
        ...(config.module.rules || []),
        {
          test: /\.js$/,
          include: /node_modules\/face-api\.js/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
              plugins: ['@babel/plugin-transform-runtime']
            }
          }
        }
      ]
    },
    externals: {
      // Externalize Node.js modules for face-api.js
      'fs': 'commonjs fs',
      'path': 'commonjs path', 
      'crypto': 'commonjs crypto',
      'buffer': 'commonjs buffer',
      'stream': 'commonjs stream',
      'os': 'commonjs os',
      'url': 'commonjs url'
    },
    plugins: [
      ...(config.plugins || []),
      // Plugin to filter out face-api.js warnings
      {
        apply: (compiler) => {
          compiler.hooks.compilation.tap('IgnoreFaceApiWarnings', (compilation) => {
            compilation.warnings = compilation.warnings.filter(warning => {
              const message = warning.message || '';
              return !message.includes('face-api.js') && 
                     !message.includes('source map') &&
                     !message.includes('Module not found');
            });
          });
        }
      }
    ],
    stats: {
      ...config.stats,
      warnings: false
    }
  })
};
