module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      return {
        ...webpackConfig,
        devtool: false, // Disable source maps completely
        module: {
          ...webpackConfig.module,
          rules: [
            ...(webpackConfig.module.rules || []),
            {
              test: /node_modules\/face-api\.js/,
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
        resolve: {
          ...webpackConfig.resolve,
          fallback: {
            fs: false,
            path: false,
            crypto: false,
            buffer: false,
            stream: false,
            os: false,
            url: false,
            util: 'util/'
          },
          alias: {
            ...webpackConfig.resolve.alias,
            'face-api.js': 'face-api.js/dist/face-api.min.js'
          }
        },
        externals: {
          ...webpackConfig.externals,
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
        ]
      };
    }
  }
};
