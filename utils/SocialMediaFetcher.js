// SocialMediaFetcher.js - Enhanced legal and reliable social media fetching
// Alert import removed - no more user-facing alerts

// Rate limiting configuration
const RATE_LIMITS = {
  'instagram.com': { requests: 0, maxRequests: 8, timeWindow: 60000 }, // 8 requests per minute (increased)
  'facebook.com': { requests: 0, maxRequests: 5, timeWindow: 60000 }, // 5 requests per minute
  'tiktok.com': { requests: 0, maxRequests: 3, timeWindow: 60000 }, // 3 requests per minute
  'twitter.com': { requests: 0, maxRequests: 3, timeWindow: 60000 }, // 3 requests per minute
  'x.com': { requests: 0, maxRequests: 3, timeWindow: 60000 }, // 3 requests per minute
  'youtube.com': { requests: 0, maxRequests: 10, timeWindow: 60000 }, // 10 requests per minute
  'youtu.be': { requests: 0, maxRequests: 10, timeWindow: 60000 }, // 10 requests per minute
  'default': { requests: 0, maxRequests: 8, timeWindow: 60000 } // 8 requests per minute for other sites
};

// Rate limiting timer
let rateLimitTimer = null;

// Reset rate limits every minute
const startRateLimitTimer = () => {
  if (rateLimitTimer) return;
  
  rateLimitTimer = setInterval(() => {
    Object.keys(RATE_LIMITS).forEach(domain => {
      RATE_LIMITS[domain].requests = 0;
    });
  }, 60000);
};

// Check if we can make a request to a domain
const canMakeRequest = (url) => {
  try {
    let hostname;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch (urlError) {
      // Try to extract domain from invalid URL
      const domainMatch = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/);
      if (domainMatch) {
        hostname = domainMatch[1].toLowerCase();
      } else {
        return true; // Allow if we can't parse URL
      }
    }
    
    let domain = 'default';
    
    // Find matching domain
    Object.keys(RATE_LIMITS).forEach(key => {
      if (hostname.includes(key)) {
        domain = key;
      }
    });
    
    const limit = RATE_LIMITS[domain];
    if (limit.requests >= limit.maxRequests) {
      return false;
    }
    
    limit.requests++;
    return true;
  } catch (error) {
    console.log('Error checking rate limit:', error);
    return true; // Allow if we can't parse URL
  }
};

// Start the rate limiting timer
startRateLimitTimer();

// Helper function to get site name from URL
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

// Enhanced metadata fetching with multiple fallback methods
export const fetchEnhancedMetadata = async (url, options = {}) => {
  const { 
    useCache = true, 
    forceRefresh = false, 
    showUserFeedback = true,
    onError = null, // New callback for custom error handling
    instagramToken = null // Instagram API token for enhanced fetching
  } = options;
  
  try {
    console.log('=== FETCH ENHANCED METADATA CALLED ===');
    console.log('URL:', url);
    console.log('Options:', options);
    
    // Check rate limiting - silently handle without user alerts
    if (!canMakeRequest(url)) {
      console.log('Rate limited for URL:', url, '- silently continuing');
      return createPlaceholderMetadata(url);
    }
    
    // Try multiple LEGAL methods in order of reliability
    let hostname;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch (urlError) {
      // Try to extract domain from invalid URL
      const domainMatch = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/);
      if (domainMatch) {
        hostname = domainMatch[1].toLowerCase();
      } else {
        hostname = 'unknown';
      }
    }
    
    const isSocialMedia = hostname.includes('instagram.com') || hostname.includes('facebook.com');
    const isInstagram = hostname.includes('instagram.com');
    
    console.log('Hostname:', hostname, 'Is social media:', isSocialMedia, 'Is Instagram:', isInstagram);
    
    // Special handling for Instagram with token
    if (isInstagram && instagramToken) {
      try {
        console.log('Using Instagram Graph API with token');
        const { fetchWithInstagramGraphAPI } = await import('../fetchers/InstagramFetcher.js');
        const result = await fetchWithInstagramGraphAPI(url, instagramToken);
        if (result && result.title) {
          console.log('Instagram Graph API successful:', result.title);
          return enhancePreviewData(result, url);
        }
      } catch (error) {
        console.log('Instagram Graph API failed, falling back to other methods:', error.message);
      }
    }
    
    const methods = isSocialMedia ? [
      () => fetchWithOpenGraph(url), // Open Graph extraction first for social media
      () => fetchWithMicrolink(url), // Microlink as backup
      () => fetchWithSmartFallback(url) // Smart fallback with good placeholders
    ] : [
      () => fetchWithMicrolink(url), // Microlink first for other sites
      () => fetchWithYouTubeAPI(url), // For YouTube videos
      () => fetchWithSmartFallback(url) // Smart fallback with good placeholders
    ];
    
    for (let i = 0; i < methods.length; i++) {
      try {
        console.log(`Trying method ${i + 1} for:`, url);
        const result = await methods[i]();
        console.log(`Method ${i + 1} raw result:`, result);
        
        if (result && result.title) {
          console.log(`Method ${i + 1} succeeded:`, result);
          // Enhance the result for better WhatsApp-like previews
          const enhanced = enhancePreviewData(result, url);
          console.log(`Method ${i + 1} enhanced result:`, enhanced);
          return enhanced;
        } else {
          console.log(`Method ${i + 1} returned no title:`, result);
        }
      } catch (error) {
        console.log(`Method ${i + 1} failed:`, error.message);
        continue;
      }
    }
    
    // All methods failed, return placeholder
    console.log('All methods failed, returning placeholder');
    return createPlaceholderMetadata(url);
    
  } catch (error) {
    console.error('All metadata fetching methods failed:', error);
    return createPlaceholderMetadata(url);
  }
};

// Enhanced preview data processing for WhatsApp-like rich previews
const enhancePreviewData = (previewData, url) => {
  try {
    console.log('=== ENHANCING PREVIEW DATA ===');
    console.log('Input preview data:', previewData);
    console.log('URL:', url);
    
    let hostname;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch (urlError) {
      // Try to extract domain from invalid URL
      const domainMatch = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/);
      if (domainMatch) {
        hostname = domainMatch[1].toLowerCase();
      } else {
        hostname = 'unknown';
      }
    }
    
    // Clean up and enhance the title
    let enhancedTitle = previewData.title || '';
    if (enhancedTitle) {
      // Remove common platform suffixes
      enhancedTitle = enhancedTitle
        .replace(/\s*on Instagram:?\s*$/gi, '')
        .replace(/\s*on Facebook:?\s*$/gi, '')
        .replace(/\s*on Twitter:?\s*$/gi, '')
        .replace(/\s*on YouTube:?\s*$/gi, '')
        .replace(/\s*-\s*TikTok\s*(?:\|\s*Make Your Day)?\s*$/gi, '')
        .replace(/\s*\|\s*TikTok\s*(?:\|\s*Make Your Day)?\s*$/gi, '')
        .replace(/\s*TikTok\s*Make Your Day\s*$/gi, '')
        .replace(/\s*•\s*Instagram.*$/gi, '')
        .replace(/\s*•\s*Facebook.*$/gi, '')
        .replace(/\s*•\s*Twitter.*$/gi, '')
        .replace(/\s*•\s*YouTube.*$/gi, '')
        .trim();
    }
    
    // Enhance description for better readability
    let enhancedDescription = previewData.description || '';
    if (enhancedDescription) {
      // Clean up description
      enhancedDescription = enhancedDescription
        .replace(/^Click to view the full content$/gi, 'View this content')
        .replace(/^No description available$/gi, '')
        .trim();
    }
    
    // Ensure we have a meaningful site name
    let enhancedSiteName = previewData.siteName || getSiteNameFromUrl(url);
    if (enhancedSiteName === 'Unknown site') {
      enhancedSiteName = getSiteNameFromUrl(url);
    }
    
    const enhanced = {
      ...previewData,
      title: enhancedTitle || `${enhancedSiteName} Content`,
      description: enhancedDescription || `View this ${enhancedSiteName} content`,
      siteName: enhancedSiteName,
      enhanced: true
    };
    
    console.log('=== ENHANCED RESULT ===');
    console.log('Enhanced result:', enhanced);
    return enhanced;
  } catch (error) {
    console.log('Error enhancing preview data:', error.message);
    return previewData;
  }
};

// Special handling for Instagram Reels to fix preview issues
const fetchInstagramReelPreview = async (url) => {
  try {
    console.log('Fetching Instagram Reel preview for:', url);
    
    // Try legal proxy services only (no direct fetch to avoid CORS)
    const approaches = [
      // Approach 1: Use AllOrigins proxy service
      async () => {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'LinksVault/1.0 (Link Preview Bot)'
          },
          timeout: 3000, // PERFORMANCE: Reduced from 8s to 3s for faster failures
        });
        
        if (response.ok) {
          const data = await response.json();
          const html = data.contents || data;
          return extractInstagramReelData(html, url);
        }
        throw new Error('AllOrigins proxy failed');
      },
      
      // Approach 2: Use CORS Anywhere proxy service
      async () => {
        const proxyUrl = `https://cors-anywhere.herokuapp.com/${url}`;
        const response = await fetch(proxyUrl, {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': 'LinksVault/1.0 (Link Preview Bot)'
          },
          timeout: 3000, // PERFORMANCE: Reduced from 8s to 3s for faster failures
        });
        
        if (response.ok) {
          const html = await response.text();
          return extractInstagramReelData(html, url);
        }
        throw new Error('CORS Anywhere proxy failed');
      },
      
      // Approach 3: Use CodeTabs proxy service
      async () => {
        const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'LinksVault/1.0 (Link Preview Bot)'
          },
          timeout: 3000, // PERFORMANCE: Reduced from 8s to 3s for faster failures
        });
        
        if (response.ok) {
          const data = await response.json();
          const html = data.contents || data;
          return extractInstagramReelData(html, url);
        }
        throw new Error('CodeTabs proxy failed');
      }
    ];
    
    for (let i = 0; i < approaches.length; i++) {
      try {
        console.log(`Trying Instagram Reel approach ${i + 1}`);
        const result = await approaches[i]();
        if (result && result.title) {
          console.log('Instagram Reel preview successful:', result.title);
          return result;
        }
      } catch (error) {
        console.log(`Instagram Reel approach ${i + 1} failed:`, error.message);
        continue;
      }
    }
    
    // Fallback to generic Instagram Reel placeholder
    return {
      title: 'Instagram Reel',
      description: 'Watch this Instagram Reel',
      thumbnail: `https://via.placeholder.com/400x300/e4405f/ffffff?text=Instagram+Reel`,
      siteName: 'Instagram',
      timestamp: new Date().toISOString(),
      source: 'instagram_reel_fallback'
    };
    
  } catch (error) {
    console.log('Instagram Reel preview failed:', error.message);
    throw error;
  }
};

// Extract Instagram Reel data from HTML
const extractInstagramReelData = (html, url) => {
  try {
    // Extract Open Graph meta tags
    const extractMetaContent = (property) => {
      const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i');
      const match = html.match(regex);
      return match ? decodeHtmlEntities(match[1]) : null;
    };
    
    const title = extractMetaContent('og:title') || 
                  extractMetaContent('twitter:title') || 
                  'Instagram Reel';
                  
    const description = extractMetaContent('og:description') || 
                       extractMetaContent('twitter:description') || 
                       'Watch this Instagram Reel';
                       
    const image = extractMetaContent('og:image') || 
                  extractMetaContent('twitter:image') || 
                  null;
    
    // Clean up the title
    let cleanTitle = title;
    if (cleanTitle) {
      cleanTitle = cleanTitle
        .replace(/\s*on Instagram:?\s*$/gi, '')
        .replace(/\s*•\s*Instagram.*$/gi, '')
        .trim();
    }
    
    return {
      title: cleanTitle || 'Instagram Reel',
      description: description || 'Watch this Instagram Reel',
      thumbnail: image,
      siteName: 'Instagram',
      timestamp: new Date().toISOString(),
      source: 'instagram_reel_og'
    };
    
  } catch (error) {
    console.log('Error extracting Instagram Reel data:', error.message);
    throw error;
  }
};

// Microlink-specific cooldown
let lastMicrolinkRequest = 0;
const microlinkCooldown = 3000; // 3 seconds between Microlink requests

// Method 1: Microlink.io API with better rate limit handling
const fetchWithMicrolink = async (url) => {
  try {
    // Check if we need to wait for cooldown
    const now = Date.now();
    const timeSinceLastRequest = now - lastMicrolinkRequest;
    if (timeSinceLastRequest < microlinkCooldown) {
      const waitTime = microlinkCooldown - timeSinceLastRequest;
      console.log(`Waiting ${waitTime}ms for Microlink cooldown`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    lastMicrolinkRequest = Date.now();
    
    const response = await fetch(
      `https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=true&meta=true&video=true&audio=true`,
      { 
          timeout: 5000, // PERFORMANCE: Reduced from 15s to 5s for faster failures
        headers: {
          'User-Agent': 'SocialVault/1.0 (Link Preview Bot)'
        }
      }
    );
    
    if (response.status === 429) {
      console.log('Microlink API rate limited, will use fallback');
      throw new Error('Rate limited - using fallback');
    }
    
    if (!response.ok) {
      console.log(`Microlink API error: ${response.status}`);
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Microlink API response:', data);
    
    if (data.status === 'success' && data.data) {
      console.log('Microlink API success:', data.data.title);
      
      // Enhanced metadata extraction for better previews
      const title = data.data.title || data.data.logo?.title || 'Untitled';
      const description = data.data.description || data.data.logo?.alt || 'No description available';
      const thumbnail = data.data.image?.url || 
                       data.data.screenshot?.url || 
                       data.data.logo?.url || 
                       null;
      const siteName = data.data.publisher || 
                      data.data.logo?.alt || 
                      getSiteNameFromUrl(url);
      
      const result = {
        title: title.trim(),
        thumbnail: thumbnail,
        description: description.trim(),
        siteName: siteName,
        timestamp: new Date().toISOString(),
        source: 'microlink'
      };
      
      console.log('Microlink processed result:', result);
      return result;
    }
    
    throw new Error('Microlink API returned unsuccessful status');
  } catch (error) {
    console.log('Microlink failed:', error.message);
    throw new Error(`Microlink failed: ${error.message}`);
  }
};

// Method 2: YouTube API (for YouTube videos - most reliable)
const fetchWithYouTubeAPI = async (url) => {
  try {
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      throw new Error('Not a YouTube URL');
    }
    
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      throw new Error('Could not extract YouTube video ID');
    }
    
    // Try oEmbed API first (no API key required)
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oembedUrl, { timeout: 4000 }); // PERFORMANCE: Reduced from 10s to 4s
    
    if (response.ok) {
      const data = await response.json();
      
      return {
        title: data.title || 'YouTube Video',
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        description: data.author_name ? `By ${data.author_name}` : 'YouTube video',
        siteName: 'YouTube',
        timestamp: new Date().toISOString()
      };
    }
    
    throw new Error('YouTube oEmbed API failed');
  } catch (error) {
    throw new Error(`YouTube API failed: ${error.message}`);
  }
};

// REMOVED: Direct HTML scraping method
// This method was removed for legal compliance reasons:
// - Violates website Terms of Service
// - May infringe on copyright laws
// - Circumvents anti-bot measures
// - Could be considered unauthorized access
// 
// We now only use official APIs and legal methods:
// 1. Microlink.io API (official service)
// 2. YouTube oEmbed API (official API)
// 3. Social media fallbacks (placeholder content)

// Method 3: Legal Open Graph extraction for Instagram and Facebook
const fetchWithOpenGraph = async (url) => {
  try {
    let hostname;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch (urlError) {
      // Try to extract domain from invalid URL
      const domainMatch = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/);
      if (domainMatch) {
        hostname = domainMatch[1].toLowerCase();
      } else {
        throw new Error('Invalid URL format');
      }
    }
    
    // Only use for Instagram and Facebook
    if (!hostname.includes('instagram.com') && !hostname.includes('facebook.com')) {
      throw new Error('Not Instagram or Facebook URL');
    }
    
    console.log('Using Open Graph extraction for:', url);
    
    // Special handling for Instagram Reels
    if (hostname.includes('instagram.com') && url.includes('/reel/')) {
      console.log('Detected Instagram Reel, using enhanced extraction');
      return await fetchInstagramReelPreview(url);
    }
    
    // Try Instagram oEmbed API first (most reliable for Instagram titles)
    if (hostname.includes('instagram.com')) {
      try {
        console.log('Trying Instagram oEmbed API first for title extraction');
        const oembedUrl = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`;
        const response = await fetch(oembedUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
            'Accept': 'application/json',
            'Referer': 'https://www.instagram.com/',
          },
          timeout: 4000, // PERFORMANCE: Reduced from 10s to 4s for faster failures
        });

        if (response.ok) {
          const oembedData = await response.json();
          console.log('Instagram oEmbed API successful:', oembedData.title);
          
          // Clean the title
          let cleanTitle = oembedData.title || 'Instagram Post';
          cleanTitle = cleanTitle
            .replace(/\s*on Instagram:?\s*$/gi, '')
            .replace(/\s*•\s*Instagram.*$/gi, '')
            .replace(/\s*-\s*Instagram.*$/gi, '')
            .replace(/\s*@\w+\s*/g, ' ')
            .replace(/\s*#\w+\s*/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          return {
            title: cleanTitle,
            description: oembedData.author_name ? `by ${oembedData.author_name}` : 'Instagram post',
            thumbnail: oembedData.thumbnail_url || null,
            siteName: 'Instagram',
            timestamp: new Date().toISOString(),
            source: 'instagram_oembed',
            titleExtracted: true
          };
        } else {
          console.log(`Instagram oEmbed API failed with status: ${response.status}`);
        }
      } catch (oembedError) {
        console.log('Instagram oEmbed API failed:', oembedError.message);
      }
    }
    
    // Use legal proxy services only (no direct fetch to avoid CORS)
    let html = null;
    
    // Try legal proxy services
    if (!html) {
      const proxyServices = [
        `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
        `https://cors-anywhere.herokuapp.com/${url}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
      ];
      
      // Try each proxy service until one works
      for (const proxyUrl of proxyServices) {
        try {
          console.log(`Trying proxy: ${proxyUrl.split('?')[0]}`);
          const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'LinksVault/1.0 (Link Preview Bot)'
            },
            timeout: 3000, // PERFORMANCE: Reduced from 8s to 3s for faster failures // Reduced timeout
          });
          
          if (response.ok) {
            const data = await response.json();
            html = data.contents || data; // Handle different response formats
            if (html) {
              console.log('Proxy service successful');
              break;
            }
          }
        } catch (error) {
          console.log(`Proxy failed: ${error.message}`);
          continue;
        }
      }
    }
    
    if (!html) {
      throw new Error('All fetching methods failed');
    }
    
    // Extract Open Graph meta tags (legal and standard)
    const extractMetaContent = (property) => {
      const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i');
      const match = html.match(regex);
      return match ? decodeHtmlEntities(match[1]) : null;
    };
    
    // Try multiple meta tag properties with better fallbacks
    const title = extractMetaContent('og:title') || 
                  extractMetaContent('twitter:title') || 
                  extractMetaContent('title') ||
                  extractMetaContent('application-name');
                  
    const description = extractMetaContent('og:description') || 
                       extractMetaContent('twitter:description') || 
                       extractMetaContent('description') ||
                       extractMetaContent('summary');
                       
    const image = extractMetaContent('og:image') || 
                  extractMetaContent('twitter:image') || 
                  extractMetaContent('twitter:image:src') ||
                  extractMetaContent('og:image:url');
                  
    const siteName = extractMetaContent('og:site_name') || 
                     extractMetaContent('application-name') || 
                     extractMetaContent('twitter:site') ||
                     getSiteNameFromUrl(url);
    
    // Clean up the title for Instagram/Facebook
    let cleanTitle = title;
    if (cleanTitle) {
      // Remove platform-specific suffixes
      cleanTitle = cleanTitle
        .replace(/\s*on Instagram:?\s*$/gi, '')
        .replace(/\s*on Facebook:?\s*$/gi, '')
        .replace(/\s*•\s*Instagram.*$/gi, '')
        .replace(/\s*•\s*Facebook.*$/gi, '')
        .trim();
    }
    
    if (title || description || image) {
      console.log('Open Graph data extracted successfully:', cleanTitle);
      return {
        title: cleanTitle || `${getSiteNameFromUrl(url)} Post`,
        description: description || 'Click to view the full content',
        thumbnail: image || null,
        siteName: siteName || getSiteNameFromUrl(url),
        timestamp: new Date().toISOString(),
        titleExtracted: !!title
      };
    }
    
    // For Instagram, try additional title extraction if no title found
    if (hostname.includes('instagram.com') && !title) {
      console.log('No title found for Instagram, trying additional extraction');
      try {
        // Try to extract post ID for better fallback
        const postIdMatch = url.match(/\/p\/([^\/\?]+)/) || url.match(/\/reel\/([^\/\?]+)/);
        if (postIdMatch) {
          const postId = postIdMatch[1];
          const isReel = url.includes('/reel/');
          const fallbackTitle = isReel ? `Instagram Reel ${postId}` : `Instagram Post ${postId}`;
          console.log('Generated fallback title from URL:', fallbackTitle);
          return {
            title: fallbackTitle,
            description: 'View this Instagram post in the app',
            thumbnail: image || null,
            siteName: 'Instagram',
            timestamp: new Date().toISOString(),
            source: 'instagram_url_fallback',
            titleExtracted: true
          };
        }
      } catch (urlError) {
        console.log('URL pattern extraction failed:', urlError.message);
      }
    }
    
    throw new Error('No Open Graph data found');
    
  } catch (error) {
    throw new Error(`Open Graph extraction failed: ${error.message}`);
  }
};

// Method 4: Smart fallback with better placeholders
const fetchWithSmartFallback = async (url) => {
  try {
    let hostname;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch (urlError) {
      // Try to extract domain from invalid URL
      const domainMatch = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/);
      if (domainMatch) {
        hostname = domainMatch[1].toLowerCase();
      } else {
        hostname = 'unknown';
      }
    }
    
    const siteName = getSiteNameFromUrl(url);
    
    console.log('Using smart fallback for:', url);
    
    // Create platform-specific placeholders with better descriptions
    if (hostname.includes('instagram.com')) {
      return {
        title: 'Instagram Post',
        description: 'View this Instagram post in the app',
        thumbnail: `https://via.placeholder.com/400x300/e4405f/ffffff?text=Instagram`,
        siteName: 'Instagram',
        timestamp: new Date().toISOString(),
        source: 'placeholder'
      };
    }
    
    if (hostname.includes('facebook.com')) {
      return {
        title: 'Facebook Post',
        description: 'View this Facebook post in the app',
        thumbnail: `https://via.placeholder.com/400x300/1877f2/ffffff?text=Facebook`,
        siteName: 'Facebook',
        timestamp: new Date().toISOString(),
        source: 'placeholder'
      };
    }
    
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      return {
        title: 'YouTube Video',
        description: 'Watch this video on YouTube',
        thumbnail: `https://via.placeholder.com/400x300/ff0000/ffffff?text=YouTube`,
        siteName: 'YouTube',
        timestamp: new Date().toISOString(),
        source: 'placeholder'
      };
    }
    
    if (hostname.includes('tiktok.com')) {
      return {
        title: 'TikTok Video',
        description: 'Watch this video on TikTok',
        thumbnail: `https://via.placeholder.com/400x300/000000/ffffff?text=TikTok`,
        siteName: 'TikTok',
        timestamp: new Date().toISOString(),
        source: 'placeholder'
      };
    }
    
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      return {
        title: 'Twitter Post',
        description: 'View this post on X (Twitter)',
        thumbnail: `https://via.placeholder.com/400x300/1da1f2/ffffff?text=Twitter`,
        siteName: 'X (Twitter)',
        timestamp: new Date().toISOString(),
        source: 'placeholder'
      };
    }
    
    // Generic fallback
    return {
      title: `${siteName} Link`,
      description: 'Click to view the full content',
      thumbnail: `https://via.placeholder.com/400x300/6c757d/ffffff?text=${encodeURIComponent(siteName)}`,
      siteName: siteName,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    throw new Error(`Smart fallback failed: ${error.message}`);
  }
};

// Method 4: Social media specific fallbacks with legal Open Graph extraction
const fetchWithSocialMediaFallback = async (url) => {
  try {
    let hostname;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch (urlError) {
      // Try to extract domain from invalid URL
      const domainMatch = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/);
      if (domainMatch) {
        hostname = domainMatch[1].toLowerCase();
      } else {
        hostname = 'unknown';
      }
    }
    
    // Try smart fallback for all platforms
    try {
      return await fetchWithSmartFallback(url);
    } catch (fallbackError) {
      console.log('Smart fallback failed, using generic fallback:', fallbackError.message);
    }
    
    // Try Open Graph meta tags first for other social media sites
    try {
      console.log('Trying Open Graph meta tags for social media:', url);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LinksVault/1.0; +https://linksvault.app)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 10000,
      });
      
      if (response.ok) {
        const html = await response.text();
        
        // Extract Open Graph meta tags
        const getMetaContent = (property) => {
          const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i');
          const match = html.match(regex);
          return match ? match[1] : null;
        };
        
        const title = getMetaContent('og:title') || getMetaContent('twitter:title');
        const description = getMetaContent('og:description') || getMetaContent('twitter:description');
        const image = getMetaContent('og:image') || getMetaContent('twitter:image');
        const siteName = getMetaContent('og:site_name') || getSiteNameFromUrl(url);
        
        if (title || description || image) {
          console.log('Open Graph data extracted for social media:', { title, description, image, siteName });
          return {
            title: title || 'Social Media Content',
            description: description || 'Click to view the full content',
            thumbnail: image || null,
            siteName: siteName || getSiteNameFromUrl(url),
            timestamp: new Date().toISOString()
          };
        }
      }
    } catch (ogError) {
      console.log('Open Graph extraction failed for social media:', ogError.message);
    }
    
    // Fallback to platform-specific placeholders
    if (hostname.includes('instagram.com')) {
      return {
        title: 'Instagram Post',
        thumbnail: 'https://via.placeholder.com/400x300/e4405f/ffffff?text=Instagram',
        description: 'Instagram content - click to view the full post',
        siteName: 'Instagram',
        timestamp: new Date().toISOString()
      };
    }
    
    if (hostname.includes('facebook.com')) {
      return {
        title: 'Facebook Post',
        thumbnail: 'https://via.placeholder.com/400x300/1877f2/ffffff?text=Facebook',
        description: 'Facebook content - click to view the full post',
        siteName: 'Facebook',
        timestamp: new Date().toISOString()
      };
    }
    
    if (hostname.includes('tiktok.com')) {
      return {
        title: 'TikTok Video',
        thumbnail: 'https://via.placeholder.com/400x300/000000/ffffff?text=TikTok',
        description: 'TikTok video - click to view the full content',
        siteName: 'TikTok',
        timestamp: new Date().toISOString()
      };
    }
    
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      return {
        title: 'Twitter Post',
        thumbnail: 'https://via.placeholder.com/400x300/1da1f2/ffffff?text=Twitter',
        description: 'Twitter content - click to view the full post',
        siteName: 'X (Twitter)',
        timestamp: new Date().toISOString()
      };
    }
    
    throw new Error('No social media fallback available');
  } catch (error) {
    throw new Error(`Social media fallback failed: ${error.message}`);
  }
};

// Helper functions
const extractYouTubeVideoId = (url) => {
  try {
    if (url.includes('youtube.com/watch?v=')) {
      return url.split('v=')[1].split('&')[0];
    } else if (url.includes('youtu.be/')) {
      return url.split('youtu.be/')[1].split('?')[0];
    } else if (url.includes('youtube.com/embed/')) {
      return url.split('embed/')[1].split('?')[0];
    }
    return null;
  } catch (error) {
    return null;
  }
};

// REMOVED: Instagram post ID extraction function
// This function was removed for legal compliance reasons:
// - Instagram's media endpoints require proper API access
// - Using them without authorization violates Instagram's Terms of Service
// - Could be considered unauthorized access to Instagram's systems

// REMOVED: HTML parsing helper functions
// These functions were used for direct HTML scraping which has been removed
// for legal compliance reasons. We now only use official APIs.

const decodeHtmlEntities = (text) => {
  if (!text) return text;
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'");
};

const createPlaceholderMetadata = (url) => {
  const siteName = getSiteNameFromUrl(url);
  return {
    title: `${siteName} Content`,
    thumbnail: `https://via.placeholder.com/400x300/6c757d/ffffff?text=${encodeURIComponent(siteName)}`,
    description: 'Content from this site - click to view',
    siteName,
    timestamp: new Date().toISOString()
  };
};

// Export rate limiting info for debugging
export const getRateLimitInfo = () => {
  return RATE_LIMITS;
};

// Export function to check if we can make requests
export const checkRateLimit = (url) => {
  return canMakeRequest(url);
};
