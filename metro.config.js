// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Customize the config
config.resolver.alias = {
  '@': './src',
  '@components': './src/components',
  '@services': './src/services',
  '@utils': './src/utils',
  '@types': './src/types',
  '@assets': './src/assets'
};

// Add HTML to asset extensions
config.resolver.assetExts.push('html');

module.exports = config;
