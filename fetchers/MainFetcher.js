// MainFetcher.js - Main coordinator for all platform-specific fetchers
// Routes URLs to appropriate platform fetchers and provides fallbacks

import { fetchYouTubePreview } from './YouTubeFetcher.js';
import { fetchInstagramPreview } from './InstagramFetcher.js';
import { fetchFacebookPreview } from './FacebookFetcher.js';
import { fetchEnhancedMetadata } from '../utils/SocialMediaFetcher.js';

/**
 * Get site name from URL
 * @param {string} url - URL to extract site name from
 * @returns {string} - Site name
 */
const getSiteNameFromUrl = (url) => {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    if (hostname.includes('instagram.com')) return 'Instagram';
    if (hostname.includes('facebook.com')) return 'Facebook';
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'YouTube';
    if (hostname.includes('tiktok.com')) return 'TikTok';
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'X (Twitter)';
    if (hostname.includes('linkedin.com')) return 'LinkedIn';
    if (hostname.includes('reddit.com')) return 'Reddit';
    
    return hostname.replace('www.', '');
  } catch (error) {
    return 'Unknown site';
  }
};

/**
 * Generate fallback preview when all methods fail
 * @param {string} url - URL to generate fallback for
 * @returns {Object} - Fallback preview data
 */
const generateFallbackPreview = (url) => {
  try {
    const urlObj = new URL(url);
    const siteName = getSiteNameFromUrl(url);

    // Generate a basic preview based on the URL
    const preview = {
      title: siteName === 'Instagram' ? 'Instagram Post' : 
             siteName === 'YouTube' ? 'YouTube Video' :
             siteName === 'TikTok' ? 'TikTok Video' :
             siteName === 'X (Twitter)' ? 'X Post' :
             siteName === 'Facebook' ? 'Facebook Post' :
             siteName === 'LinkedIn' ? 'LinkedIn Post' :
             siteName === 'Reddit' ? 'Reddit Post' :
             `${siteName} Link`,
      description: `Shared from ${siteName}`,
      image: null,
      url: url,
      siteName: siteName,
      timestamp: new Date().toISOString(),
      source: 'fallback',
      success: false
    };

    console.log('Generated fallback preview:', preview);
    return preview;
  } catch (error) {
    console.log('Failed to generate fallback preview:', error.message);
    return null;
  }
};

/**
 * Main function to fetch link preview using platform-specific fetchers
 * @param {string} url - URL to fetch preview for
 * @param {Object} options - Options for fetching
 * @returns {Promise<Object>} - Preview data object
 */
export const fetchLinkPreview = async (url, options = {}) => {
  try {
    console.log('=== MAIN FETCHER ===');
    console.log('Processing URL:', url);
    
    const normalizedUrl = url.trim();
    const hostname = new URL(normalizedUrl).hostname.toLowerCase();
    
    // Route to appropriate platform fetcher
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      console.log('Routing to YouTube fetcher');
      return await fetchYouTubePreview(normalizedUrl);
    }
    
    if (hostname.includes('instagram.com')) {
      console.log('Routing to Instagram fetcher');
      return await fetchInstagramPreview(normalizedUrl);
    }
    
    if (hostname.includes('facebook.com')) {
      console.log('Routing to Facebook fetcher');
      return await fetchFacebookPreview(normalizedUrl);
    }
    
    // For other platforms, try enhanced metadata fetching
    console.log('Routing to enhanced metadata fetcher for:', hostname);
    try {
      const metadata = await fetchEnhancedMetadata(normalizedUrl, {
        showUserFeedback: false,
        onError: null
      });
      
      if (metadata && metadata.title) {
        return {
          title: metadata.title || 'Untitled',
          description: metadata.description || '',
          image: metadata.thumbnail || null,
          siteName: metadata.siteName || getSiteNameFromUrl(normalizedUrl),
          timestamp: new Date().toISOString(),
          source: `enhanced_${metadata.source || 'unknown'}`,
          success: true
        };
      } else {
        throw new Error('Enhanced metadata failed');
      }
    } catch (enhancedError) {
      console.log('Enhanced metadata fallback failed:', enhancedError.message);
      
      // Final fallback
      const fallbackPreview = generateFallbackPreview(normalizedUrl);
      if (fallbackPreview) {
        return fallbackPreview;
      }
      
      throw new Error('All fetching methods failed');
    }
    
  } catch (error) {
    console.error('Main fetcher failed:', error.message);
    
    // Ultimate fallback
    const fallbackPreview = generateFallbackPreview(url);
    if (fallbackPreview) {
      return fallbackPreview;
    }
    
    return {
      title: 'Link Preview',
      description: 'Click to view the full content',
      image: null,
      siteName: getSiteNameFromUrl(url),
      timestamp: new Date().toISOString(),
      source: 'error_fallback',
      success: false,
      error: error.message
    };
  }
};

/**
 * Test function for debugging specific platform fetchers
 * @param {string} url - URL to test
 * @param {string} platform - Platform to test ('youtube', 'instagram', 'facebook', 'all')
 * @returns {Promise<Object>} - Test results
 */
export const testPlatformFetcher = async (url, platform = 'all') => {
  console.log('=== TESTING PLATFORM FETCHER ===');
  console.log('URL:', url);
  console.log('Platform:', platform);
  
  try {
    switch (platform.toLowerCase()) {
      case 'youtube':
        return await fetchYouTubePreview(url);
      case 'instagram':
        return await fetchInstagramPreview(url);
      case 'facebook':
        return await fetchFacebookPreview(url);
      case 'all':
      default:
        return await fetchLinkPreview(url);
    }
  } catch (error) {
    console.error('Test failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

// Make test function available globally for debugging
if (typeof window !== 'undefined') {
  window.testPlatformFetcher = testPlatformFetcher;
  window.fetchLinkPreview = fetchLinkPreview;
}
