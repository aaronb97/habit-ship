/* eslint-disable @typescript-eslint/no-require-imports */
// Metro configuration for Expo
// Adds support for bundling OBJ model files as static assets
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure .obj files are treated as assets
config.resolver.assetExts = [...config.resolver.assetExts, 'obj'];

module.exports = config;
