// Metro configuration for Expo
// Adds support for bundling OBJ model files as static assets
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure .obj files are treated as assets
config.resolver.assetExts = [...config.resolver.assetExts, 'obj'];

module.exports = config;
