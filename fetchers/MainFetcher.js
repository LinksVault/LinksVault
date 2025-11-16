// MainFetcher.js - Main coordinator for all platform-specific fetchers
// Routes URLs to appropriate platform fetchers and provides fallbacks

import { fetchYouTubePreview } from './YouTubeFetcher.js';
import { fetchInstagramPreview } from './InstagramFetcher.js';
import { fetchFacebookPreview } from './FacebookFetcher.js';
import { fetchTikTokPreview } from './TikTokFetcher.js';
import { fetchEnhancedMetadata } from '../utils/SocialMediaFetcher.js';

/**
 * Attempt server-side legal preview (if a preview server URL is provided)
 * @param {string} url
 * @param {Object} options - expects previewServerUrl and instagramToken
 */
const tryPreviewServer = async (url, options = {}) => {
  try {
    const { previewServerUrl, instagramToken } = options || {};
    if (!previewServerUrl) return null;
    const endpoint = previewServerUrl.replace(/\/$/, '') + '/api/preview';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s fail-fast
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, userAccessToken: instagramToken || undefined }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || json.success !== true || !json.data) return null;
    const d = json.data;
    return {
      title: d.title || 'Untitled',
      description: d.description || '',
      image: d.image || null,
      siteName: d.siteName || getSiteNameFromUrl(url),
      timestamp: d.timestamp || new Date().toISOString(),
      source: 'preview_server',
      success: true,
    };
  } catch (e) {
    // Server might be down or blocked; silently fall back
    return null;
  }
};

/**
 * Extract clean URL from mixed text (like WhatsApp does)
 * @param {string} input - Mixed text that may contain URLs
 * @returns {string|null} - Clean URL or null if none found
 */
const extractCleanUrl = (input) => {
  if (!input || typeof input !== 'string') return null;
  
  console.log('Extracting URL from input:', input);
  
  // More precise URL patterns that avoid including non-ASCII characters
  const urlPatterns = [
    // Full URLs with protocol - stop at whitespace or non-URL characters
    /https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=-]*)?/gi,
    // Specific domain patterns without protocol
    /(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=-]*)?/gi,
  ];
  
  // Try each pattern
  for (const pattern of urlPatterns) {
    const matches = input.match(pattern);
    if (matches && matches.length > 0) {
      // Return the first valid URL found
      for (const match of matches) {
        let cleanUrl = match.trim();
        
        // Clean up any trailing non-URL characters
        cleanUrl = cleanUrl.replace(/[^\w\-._~:/?#[\]@!$&'()*+,;=]+$/, '');
        
        // Add protocol if missing
        if (!cleanUrl.match(/^https?:\/\//)) {
          cleanUrl = 'https://' + cleanUrl;
        }
        
        // Validate the URL
        try {
          const urlObj = new URL(cleanUrl);
          // Additional validation - ensure hostname is valid
          if (urlObj.hostname && urlObj.hostname.includes('.')) {
            console.log('Extracted clean URL:', cleanUrl, 'from input:', input);
            return cleanUrl;
          }
        } catch (error) {
          // Invalid URL, try next match
          continue;
        }
      }
    }
  }
  
  // Fallback: try to find URLs by looking for common patterns more carefully
  const fallbackPatterns = [
    // Look for https:// followed by valid domain
    /https?:\/\/([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=-]*)?/gi,
    // Look for domains without protocol
    /([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=-]*)?/gi,
  ];
  
  for (const pattern of fallbackPatterns) {
    const matches = input.match(pattern);
    if (matches && matches.length > 0) {
      for (const match of matches) {
        let cleanUrl = match.trim();
        
        // Clean up any trailing non-URL characters
        cleanUrl = cleanUrl.replace(/[^\w\-._~:/?#[\]@!$&'()*+,;=]+$/, '');
        
        // Add protocol if missing
        if (!cleanUrl.match(/^https?:\/\//)) {
          cleanUrl = 'https://' + cleanUrl;
        }
        
        // Validate the URL
        try {
          const urlObj = new URL(cleanUrl);
          if (urlObj.hostname && urlObj.hostname.includes('.')) {
            console.log('Extracted clean URL (fallback):', cleanUrl, 'from input:', input);
            return cleanUrl;
          }
        } catch (error) {
          continue;
        }
      }
    }
  }
  
  console.log('No valid URL found in input:', input);
  return null;
};

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
    // Try to extract domain from invalid URL
    const domainMatch = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/);
    if (domainMatch) {
      const domain = domainMatch[1].toLowerCase();
      
      if (domain.includes('instagram.com')) return 'Instagram';
      if (domain.includes('facebook.com')) return 'Facebook';
      if (domain.includes('youtube.com') || domain.includes('youtu.be')) return 'YouTube';
      if (domain.includes('tiktok.com')) return 'TikTok';
      if (domain.includes('twitter.com') || domain.includes('x.com')) return 'X (Twitter)';
      if (domain.includes('linkedin.com')) return 'LinkedIn';
      if (domain.includes('reddit.com')) return 'Reddit';
      
      return domain.replace('www.', '');
    }
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
    let urlObj;
    let siteName;
    let cleanUrl = url;
    
    // Try to extract clean URL first
    const extractedUrl = extractCleanUrl(url);
    if (extractedUrl) {
      cleanUrl = extractedUrl;
    }
    
    try {
      urlObj = new URL(cleanUrl);
      siteName = getSiteNameFromUrl(cleanUrl);
    } catch (urlError) {
      // If URL is invalid, try to extract domain from the string
      const domainMatch = cleanUrl.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/);
      if (domainMatch) {
        const domain = domainMatch[1].toLowerCase();
        siteName = domain.replace('www.', '');
        
        // Try to identify platform from domain
        if (domain.includes('instagram.com')) siteName = 'Instagram';
        else if (domain.includes('youtube.com') || domain.includes('youtu.be')) siteName = 'YouTube';
        else if (domain.includes('facebook.com')) siteName = 'Facebook';
        else if (domain.includes('tiktok.com')) siteName = 'TikTok';
        else if (domain.includes('twitter.com') || domain.includes('x.com')) siteName = 'X (Twitter)';
        else if (domain.includes('linkedin.com')) siteName = 'LinkedIn';
        else if (domain.includes('reddit.com')) siteName = 'Reddit';
      } else {
        siteName = 'Unknown Site';
      }
    }

    // Generate a basic preview based on the URL
    const favicon = (() => {
      try {
        const h = new URL(cleanUrl).hostname;
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=128`;
      } catch { return null; }
    })();

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
      image: favicon,
      url: cleanUrl, // Use the clean URL instead of original input
      siteName: siteName,
      timestamp: new Date().toISOString(),
      source: 'fallback',
      success: false
    };

    console.log('Generated fallback preview:', preview);
    return preview;
  } catch (error) {
    console.log('Failed to generate fallback preview:', error.message);
    // Try to extract clean URL for error fallback
    const extractedUrl = extractCleanUrl(url);
    const fallbackUrl = extractedUrl || url;
    
    return {
      title: 'Link Preview',
      description: 'Click to view the full content',
      image: null,
      url: fallbackUrl,
      siteName: 'Unknown Site',
      timestamp: new Date().toISOString(),
      source: 'error_fallback',
      success: false
    };
  }
};

/**
 * Main function to fetch link preview using platform-specific fetchers
 * @param {string} url - URL to fetch preview for
 * @param {Object} options - Options for fetching
 * @returns {Promise<Object>} - Preview data object
 */
export const fetchLinkPreview = async (url, options = {}) => {
  // Extract clean URL first to determine appropriate timeout
  const cleanUrl = extractCleanUrl(url) || url.trim();
  let timeout = 20000; // 20 second timeout by default (increased for better reliability)
  
  // Increase timeout for specific slow domains
  try {
    const urlObj = new URL(cleanUrl);
    const hostname = urlObj.hostname.toLowerCase();
    
    if (hostname.includes('search.app')) {
      timeout = 30000; // 30 seconds for search.app (they're slower)
    } else if (hostname.includes('instagram.com') || hostname.includes('facebook.com')) {
      timeout = 25000; // 25 seconds for social media (more reliable)
    } else if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      timeout = 22000; // 22 seconds for Twitter/X
    } else if (hostname.includes('tiktok.com') || hostname.includes('linkedin.com') || hostname.includes('reddit.com')) {
      timeout = 22000; // 22 seconds for other social media
    }
  } catch (error) {
    // Keep default timeout if URL parsing fails
  }
  
  const { timeout: customTimeout = timeout } = options;
  
  // Create a timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Request timeout after ${customTimeout/1000} seconds`)), customTimeout);
  });
  
  // Create the main fetching promise
  const fetchPromise = fetchLinkPreviewInternal(url, options);
  
  try {
    // Race between the fetch and timeout
    const result = await Promise.race([fetchPromise, timeoutPromise]);
    return result;
  } catch (error) {
    console.error('Main fetcher failed:', error.message);
    
    // Ultimate fallback - try to use original URL or create a basic fallback
    let fallbackUrl = url;
    try {
      // Try to extract clean URL first
      const extractedUrl = extractCleanUrl(url);
      if (extractedUrl) {
        fallbackUrl = extractedUrl;
      } else {
        // Try to validate the original URL for fallback
        const testUrl = new URL(url.trim());
        fallbackUrl = testUrl.href;
      }
    } catch {
      // If URL is completely invalid, use as-is for fallback
      fallbackUrl = url.trim();
    }
    
    const fallbackPreview = generateFallbackPreview(fallbackUrl);
    if (fallbackPreview) {
      return fallbackPreview;
    }
    
    return {
      title: 'Link Preview',
      description: 'Click to view the full content',
      image: null,
      siteName: getSiteNameFromUrl(fallbackUrl),
      timestamp: new Date().toISOString(),
      source: 'error_fallback',
      success: false,
      error: error.message
    };
  }
};

/**
 * Internal function to fetch link preview (without timeout wrapper)
 * @param {string} url - URL to fetch preview for
 * @param {Object} options - Options for fetching
 * @returns {Promise<Object>} - Preview data object
 */
const fetchLinkPreviewInternal = async (url, options = {}) => {
  try {
    console.log('=== MAIN FETCHER ===');
    console.log('Processing input:', url);
    
    // First, try to extract a clean URL from the input (like WhatsApp does)
    let cleanUrl = extractCleanUrl(url);
    
    if (!cleanUrl) {
      console.log('No clean URL found, trying direct processing');
      cleanUrl = url.trim();
    }
    
    // Validate and normalize URL
    let validUrl;
    try {
      validUrl = new URL(cleanUrl);
    } catch (urlError) {
      // Try to fix common URL issues
      let fixedUrl = cleanUrl;
      
      // Add protocol if missing
      if (!fixedUrl.match(/^https?:\/\//)) {
        fixedUrl = 'https://' + fixedUrl;
      }
      
      // Try again with fixed URL
      try {
        validUrl = new URL(fixedUrl);
        console.log('Fixed URL:', fixedUrl);
      } catch (secondError) {
        console.log('URL validation failed:', secondError.message);
        // Return fallback for invalid URLs
        return generateFallbackPreview(cleanUrl);
      }
    }
    
    const hostname = validUrl.hostname.toLowerCase();
    
    // Use the validated URL for all operations
    const finalUrl = validUrl.href;
    
    // Try server-side preview first if provided (WhatsApp-like reliability)
    const serverResult = await tryPreviewServer(finalUrl, options);
    if (serverResult) {
      // Ensure favicon fallback if image missing
      if (!serverResult.image) {
        try {
          const h = new URL(finalUrl).hostname;
          serverResult.image = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=128`;
        } catch {}
      }
      return serverResult;
    }

    // Route to appropriate platform fetcher
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      console.log('Routing to YouTube fetcher');
      // Forward options for future extensibility (ignored by current fetcher)
      return await fetchYouTubePreview(finalUrl, options);
    }
    
    if (hostname.includes('instagram.com')) {
      console.log('Routing to Instagram fetcher');
      // Forward options so instagramToken and other flags are available
      return await fetchInstagramPreview(finalUrl, options);
    }
    
    if (hostname.includes('facebook.com')) {
      console.log('Routing to Facebook fetcher');
      // Forward options for future extensibility (ignored by current fetcher)
      return await fetchFacebookPreview(finalUrl, options);
    }

    if (hostname.includes('tiktok.com')) {
      console.log('Routing to TikTok fetcher');
      return await fetchTikTokPreview(finalUrl, options);
    }
    
    // For other platforms, try enhanced metadata fetching
    console.log('Routing to enhanced metadata fetcher for:', hostname);
    try {
      const metadata = await fetchEnhancedMetadata(finalUrl, {
        showUserFeedback: false,
        onError: null
      });
      
      if (metadata && metadata.title) {
        return {
          title: metadata.title || 'Untitled',
          description: metadata.description || '',
          image: metadata.thumbnail || null,
          siteName: metadata.siteName || getSiteNameFromUrl(finalUrl),
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
      const fallbackPreview = generateFallbackPreview(finalUrl);
      if (fallbackPreview) {
        return fallbackPreview;
      }
      
      throw new Error('All fetching methods failed');
    }
    
  } catch (error) {
    console.error('Main fetcher internal error:', error.message);
    throw error; // Re-throw to be handled by the timeout wrapper
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
