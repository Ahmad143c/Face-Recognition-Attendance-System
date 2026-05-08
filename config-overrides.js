module.exports = function (webpackConfig) {
  return {
    ...webpackConfig,
    module: {
      ...webpackConfig.module,
      rules: webpackConfig.module.rules.map(rule => {
        // Handle face-api.js specific configurations
        if (rule.test && rule.test.toString().includes('face-api.js')) {
          return {
            ...rule,
            resolve: {
              ...webpackConfig.resolve,
              fallback: {
                "fs": false,
                "path": false,
                "crypto": false,
                "buffer": false,
                "stream": false,
                "os": false,
                "url": false
              }
            },
            use: rule.use.map(use => {
              if (use.loader && use.loader.includes('source-map-loader')) {
                return {
                  ...use,
                  options: {
                    ...use.options,
                    filterSourceMappingUrl: (url, resourcePath) => {
                      // Filter out face-api.js source maps
                      if (resourcePath && resourcePath.includes('face-api.js')) {
                        return false;
                      }
                      return use.options.filterSourceMappingUrl ? 
                        use.options.filterSourceMappingUrl(url, resourcePath) : false;
                    }
                  }
                };
              }
              return use;
            })
          };
        }
        return rule;
      })
    },
    resolve: {
      ...webpackConfig.resolve,
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
        ...webpackConfig.resolve.alias,
        // Handle face-api.js imports properly
        'face-api.js': 'face-api.js/dist/face-api.min.js'
      }
    },
    externals: {
      // Externalize Node.js modules that shouldn't be bundled
      'fs': 'commonjs fs',
      'path': 'commonjs path',
      'crypto': 'commonjs crypto',
      'buffer': 'commonjs buffer',
      'stream': 'commonjs stream',
      'os': 'commonjs os',
      'url': 'commonjs url'
    },
    plugins: [
      ...(webpackConfig.plugins || []),
      // Add plugin to ignore face-api.js source maps
      {
        apply: function(compiler) {
          compiler.hooks.compilation.tap('IgnoreFaceApiSourceMaps', function(compilation) {
            compilation.warnings = compilation.warnings.filter(function(warning) {
              return !warning.message.includes('face-api.js') && 
                     !warning.message.includes('source map');
            });
          });
        }
      }
    ]
  };
};
