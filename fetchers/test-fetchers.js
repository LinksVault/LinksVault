// Test file for the new fetchers system
// This file can be run to test all fetchers

import { fetchLinkPreview, testPlatformFetcher } from './index.js';

// Test URLs
const testUrls = {
  youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  instagram: 'https://www.instagram.com/p/DOk0019AoYA/',
  facebook: 'https://www.facebook.com/posts/123456',
  other: 'https://github.com'
};

// Test function
const runTests = async () => {
  console.log('🧪 Testing New Fetchers System');
  console.log('================================');
  
  for (const [platform, url] of Object.entries(testUrls)) {
    console.log(`\n📱 Testing ${platform.toUpperCase()}: ${url}`);
    console.log('----------------------------------------');
    
    try {
      const result = await fetchLinkPreview(url);
      console.log('✅ Success:', {
        title: result.title,
        siteName: result.siteName,
        source: result.source,
        success: result.success
      });
    } catch (error) {
      console.log('❌ Failed:', error.message);
    }
  }
  
  console.log('\n🎉 Test completed!');
};

// Run tests if this file is executed directly
if (typeof window !== 'undefined') {
  window.runFetcherTests = runTests;
  console.log('Test function available as window.runFetcherTests()');
}

export { runTests };
