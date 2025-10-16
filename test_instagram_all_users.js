// Test Instagram fetching for all users (with and without tokens)
// This file tests the Instagram fetching system to ensure it works for everyone

import { fetchInstagramPreview } from './fetchers/InstagramFetcher.js';
import { fetchEnhancedMetadata } from './utils/SocialMediaFetcher.js';

// Test URLs
const testUrls = [
  'https://www.instagram.com/p/ABC123/',
  'https://www.instagram.com/reel/XYZ789/',
  'https://www.instagram.com/tv/DEF456/',
  'https://www.instagram.com/p/GHI789/'
];

// Test without token (regular users)
const testWithoutToken = async () => {
  console.log('=== TESTING WITHOUT TOKEN (Regular Users) ===');
  
  for (const url of testUrls) {
    try {
      console.log(`\nTesting: ${url}`);
      
      // Test InstagramFetcher directly
      const instagramResult = await fetchInstagramPreview(url);
      console.log('InstagramFetcher result:', {
        title: instagramResult.title,
        thumbnail: instagramResult.image ? 'Found' : 'Not found',
        source: instagramResult.source,
        success: instagramResult.success
      });
      
      // Test SocialMediaFetcher
      const socialResult = await fetchEnhancedMetadata(url);
      console.log('SocialMediaFetcher result:', {
        title: socialResult.title,
        thumbnail: socialResult.thumbnail ? 'Found' : 'Not found',
        source: socialResult.source
      });
      
    } catch (error) {
      console.error(`Error testing ${url}:`, error.message);
    }
  }
};

// Test with token (enhanced users)
const testWithToken = async (token) => {
  console.log('=== TESTING WITH TOKEN (Enhanced Users) ===');
  
  for (const url of testUrls) {
    try {
      console.log(`\nTesting: ${url}`);
      
      // Test InstagramFetcher with token
      const instagramResult = await fetchInstagramPreview(url, { instagramToken: token });
      console.log('InstagramFetcher with token result:', {
        title: instagramResult.title,
        thumbnail: instagramResult.image ? 'Found' : 'Not found',
        source: instagramResult.source,
        success: instagramResult.success,
        author: instagramResult.author || 'N/A',
        likes: instagramResult.likes || 'N/A',
        comments: instagramResult.comments || 'N/A'
      });
      
      // Test SocialMediaFetcher with token
      const socialResult = await fetchEnhancedMetadata(url, { instagramToken: token });
      console.log('SocialMediaFetcher with token result:', {
        title: socialResult.title,
        thumbnail: socialResult.thumbnail ? 'Found' : 'Not found',
        source: socialResult.source
      });
      
    } catch (error) {
      console.error(`Error testing ${url} with token:`, error.message);
    }
  }
};

// Run all tests
const runAllTests = async () => {
  console.log('🚀 Starting Instagram fetching tests for all users...\n');
  
  // Test without token (most users)
  await testWithoutToken();
  
  // Test with token (if available)
  const testToken = process.env.INSTAGRAM_TOKEN || null;
  if (testToken) {
    console.log('\n' + '='.repeat(50));
    await testWithToken(testToken);
  } else {
    console.log('\n⚠️  No Instagram token provided. Skipping enhanced tests.');
    console.log('   Set INSTAGRAM_TOKEN environment variable to test with token.');
  }
  
  console.log('\n✅ All tests completed!');
};

// Export for use in other files
export {
  testWithoutToken,
  testWithToken,
  runAllTests
};

// Run tests if this file is executed directly
if (typeof window === 'undefined' && require.main === module) {
  runAllTests().catch(console.error);
}
