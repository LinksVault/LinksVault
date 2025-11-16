// Root Metro config to prevent bundling server-only code
const { getDefaultConfig } = require('@expo/metro-config');
// Use Metro's default exclusionList util via stable path (compatible across SDKs)
let exclusionList;
try {
  exclusionList = require('metro-config/src/defaults/exclusionList');
} catch (e) {
  exclusionList = undefined;
}

/**
 * Blocklist server folders so Metro doesn't attempt to bundle Node server code
 * which pulls native Node stdlib modules (e.g., zlib) that React Native lacks.
 */
module.exports = (() => {
  const config = getDefaultConfig(__dirname);

  // Robust, cross-platform regex that matches any path starting with scraper-server/
  const blockRE = /(?:^|[\\\/])scraper-server(?:[\\\/].*)?$/;
  // Apply to both keys; if exclusionList exists, use it; otherwise set regex directly
  if (exclusionList) {
    config.resolver.blockList = exclusionList([blockRE]);
    config.resolver.blacklistRE = exclusionList([blockRE]);
  } else {
    config.resolver.blockList = blockRE;
    config.resolver.blacklistRE = blockRE;
  }

  return config;
})();


