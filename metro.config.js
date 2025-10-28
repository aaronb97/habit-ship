const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

// Ensure .obj files are treated as assets
config.resolver.assetExts = [...config.resolver.assetExts, 'obj'];

module.exports = config;