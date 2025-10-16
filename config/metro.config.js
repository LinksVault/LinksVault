const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude only server directories from bundling (keep client-side email service)
config.resolver.blockList = [
  /functions\/.*/,
  /scraper-server\/.*/,
  /email_verification\/.*/, // This contains server-side Cloud Functions
];

// Exclude Node.js modules that don't work in React Native
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

module.exports = config;
