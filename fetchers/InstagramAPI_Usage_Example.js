// Instagram Graph API Usage Example
// This file shows how to use the new Instagram Graph API functionality

import { fetchInstagramPreview, testInstagramFetching } from './InstagramFetcher.js';
import { fetchEnhancedMetadata } from '../utils/SocialMediaFetcher.js';

// Example 1: Basic usage without token (uses oEmbed and other methods)
const basicExample = async () => {
  const url = 'https://www.instagram.com/p/ABC123/';
  
  try {
    const result = await fetchInstagramPreview(url);
    console.log('Basic result:', result);
    // Result will use oEmbed API, Open Graph, and other fallback methods
  } catch (error) {
    console.error('Error:', error);
  }
};

// Example 2: Enhanced usage with Instagram API token
const enhancedExample = async () => {
  const url = 'https://www.instagram.com/p/ABC123/';
  const instagramToken = 'YOUR_INSTAGRAM_ACCESS_TOKEN'; // Get this from Instagram Developer Console
  
  try {
    const result = await fetchInstagramPreview(url, { instagramToken });
    console.log('Enhanced result:', result);
    // Result will use Instagram Graph API first, then fallback to other methods
    // You'll get:
    // - Real post captions as titles
    // - High-resolution thumbnails
    // - Like and comment counts
    // - Author information
    // - Media type (IMAGE, VIDEO, CAROUSEL_ALBUM)
  } catch (error) {
    console.error('Error:', error);
  }
};

// Example 3: Using with SocialMediaFetcher
const socialMediaExample = async () => {
  const url = 'https://www.instagram.com/p/ABC123/';
  const instagramToken = 'YOUR_INSTAGRAM_ACCESS_TOKEN';
  
  try {
    const result = await fetchEnhancedMetadata(url, { instagramToken });
    console.log('Social Media result:', result);
    // This will automatically use Instagram Graph API for Instagram URLs
  } catch (error) {
    console.error('Error:', error);
  }
};

// Example 4: Testing different strategies
const testExample = async () => {
  const url = 'https://www.instagram.com/p/ABC123/';
  const instagramToken = 'YOUR_INSTAGRAM_ACCESS_TOKEN';
  
  try {
    const testResults = await testInstagramFetching(url, { instagramToken });
    console.log('Test results:', testResults);
    // This will test all available strategies and show which ones work
  } catch (error) {
    console.error('Error:', error);
  }
};

// Example 5: Error handling and fallbacks
const errorHandlingExample = async () => {
  const url = 'https://www.instagram.com/p/ABC123/';
  const instagramToken = 'INVALID_TOKEN'; // This will cause Graph API to fail
  
  try {
    const result = await fetchInstagramPreview(url, { instagramToken });
    console.log('Result with invalid token:', result);
    // Even with invalid token, it will fallback to oEmbed and other methods
  } catch (error) {
    console.error('Error:', error);
  }
};

// How to get Instagram API Token:
const getInstagramTokenInstructions = () => {
  console.log(`
  To get an Instagram API token:
  
  1. Go to https://developers.facebook.com/
  2. Create a new app or use existing app
  3. Add Instagram Basic Display product
  4. Get your App ID and App Secret
  5. Generate a User Access Token
  6. Use the token in your app
  
  For more details, see:
  https://developers.facebook.com/docs/instagram-basic-display-api/getting-started
  `);
};

export {
  basicExample,
  enhancedExample,
  socialMediaExample,
  testExample,
  errorHandlingExample,
  getInstagramTokenInstructions
};
