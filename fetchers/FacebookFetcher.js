// FacebookFetcher.js - Dedicated Facebook link preview fetching
// Uses meta tag extraction and proxy services for Facebook content

/**
 * Check if URL is a social media site that blocks direct fetch due to CORS
 * @param {string} url - URL to check
 * @returns {boolean} - True if social media site
 */
const isSocialMediaSite = (url) => {
  const socialMediaDomains = [
    'instagram.com', 'facebook.com', 'twitter.com', 'x.com', 
    'tiktok.com', 'linkedin.com', 'reddit.com'
  ];
  return socialMediaDomains.some(domain => url.includes(domain));
};

/**
 * Extract meta content from HTML using multiple patterns
 * @param {string} html - HTML content
 * @param {Array} patterns - Array of regex patterns to try
 * @returns {string|null} - Extracted content or null
 */
const extractMetaContent = (html, patterns) => {
  for (const pattern of patterns) {
    const regex = new RegExp(pattern, 'gi');
    const match = html.match(regex);
    if (match) {
      const contentMatch = match[0].match(/content=["']([^"']+)["']/i);
      if (contentMatch) {
        return decodeHtmlEntities(contentMatch[1]);
      }
    }
  }
  return null;
};

/**
 * Decode HTML entities
 * @param {string} text - Text with HTML entities
 * @returns {string} - Decoded text
 */
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
 * Fetch Facebook preview using meta tag extraction
 * @param {string} url - Facebook URL
 * @returns {Promise<Object>} - Preview data object
 */
export const fetchFacebookPreview = async (url) => {
  try {
    console.log('=== FACEBOOK FETCHER ===');
    console.log('Processing Facebook URL:', url);
    
    let html = null;
    let source = 'direct';
    
    // Strategy 1: Try direct fetch with mobile user agent (skip for social media due to CORS)
    if (!isSocialMediaSite(url)) {
      try {
        console.log('Strategy 1: Direct fetch with mobile user agent');
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0',
          },
          timeout: 15000,
        });

        if (response.ok) {
          html = await response.text();
          console.log('Direct fetch successful, HTML length:', html.length);
        }
      } catch (directError) {
        console.log('Direct fetch failed:', directError.message);
      }
    } else {
      console.log('Skipping direct fetch for social media site due to CORS restrictions');
    }
    
    // Strategy 2: Use proxy services (primary for social media, fallback for others)
    if (!html) {
      if (isSocialMediaSite(url)) {
        console.log('Using proxy services for social media site');
      }
      const proxyServices = [
        `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
        `https://cors-anywhere.herokuapp.com/${url}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
        `https://corsproxy.io/?${encodeURIComponent(url)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}&format=json`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}&format=text`,
        `https://thingproxy.freeboard.io/fetch/${url}`
      ];
      
      for (const proxyUrl of proxyServices) {
        try {
          console.log(`Strategy 2: Trying proxy ${proxyUrl.split('?')[0]}`);

          // Skip proxy if it's known to have SSL issues
          if (proxyUrl.includes('thingproxy.freeboard.io')) {
            console.log('Skipping thingproxy.freeboard.io due to known SSL certificate issues');
            continue;
          }

          const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json, text/html, */*',
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15'
            },
            timeout: 8000, // Reduced timeout for faster fallback
          });

          if (response.ok) {
            let data;
            const contentType = response.headers.get('content-type');

            try {
              if (contentType && contentType.includes('application/json')) {
                data = await response.json();
                html = data.contents || data.contents || data.data || data;
              } else {
                html = await response.text();
              }

              source = 'proxy';
              if (html && html.length > 100) { // Ensure we got meaningful content
                console.log('Proxy fetch successful');
                break;
              } else {
                console.log('Proxy returned empty or too short content');
              }
            } catch (parseError) {
              console.log('Failed to parse proxy response:', parseError.message);
            }
          } else {
            console.log(`Proxy returned status: ${response.status}`);
          }
        } catch (error) {
          // Check for specific SSL certificate errors
          if (error.message.includes('ERR_CERT_DATE_INVALID') ||
              error.message.includes('ERR_CERT_AUTHORITY_INVALID') ||
              error.message.includes('ERR_SSL_PROTOCOL_ERROR')) {
            console.log(`Proxy SSL error (skipping): ${error.message}`);
          } else {
            console.log(`Proxy failed: ${error.message}`);
          }
          continue;
        }
      }
    }
    
    if (!html) {
      throw new Error('All fetch strategies failed');
    }
    
    // Extract data from HTML
    console.log('Extracting Facebook data from HTML...');
    
    // Extract title
    const titlePatterns = [
      '<meta[^>]*property=["\']og:title["\'][^>]*content=["\']([^"\']+)["\']',
      '<meta[^>]*name=["\']twitter:title["\'][^>]*content=["\']([^"\']+)["\']',
      '<meta[^>]*property=["\']twitter:title["\'][^>]*content=["\']([^"\']+)["\']',
      '<title[^>]*>([^<]+)</title>'
    ];
    
    let title = extractMetaContent(html, titlePatterns);
    
    // Extract description
    const descriptionPatterns = [
      '<meta[^>]*property=["\']og:description["\'][^>]*content=["\']([^"\']+)["\']',
      '<meta[^>]*name=["\']twitter:description["\'][^>]*content=["\']([^"\']+)["\']',
      '<meta[^>]*property=["\']twitter:description["\'][^>]*content=["\']([^"\']+)["\']',
      '<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']+)["\']'
    ];
    
    let description = extractMetaContent(html, descriptionPatterns);
    
    // Extract image
    const imagePatterns = [
      '<meta[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']',
      '<meta[^>]*name=["\']twitter:image["\'][^>]*content=["\']([^"\']+)["\']',
      '<meta[^>]*property=["\']twitter:image["\'][^>]*content=["\']([^"\']+)["\']',
      '<meta[^>]*property=["\']twitter:image:src["\'][^>]*content=["\']([^"\']+)["\']'
    ];
    
    let image = extractMetaContent(html, imagePatterns);
    
    // If no image found, try to find any image in the HTML
    if (!image) {
      console.log('No image found in meta tags, searching HTML for images...');
      const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
      const imgMatches = html.match(imgRegex);
      if (imgMatches) {
        console.log('Found', imgMatches.length, 'img tags in HTML');
        // Try to find the first valid image URL
        for (const imgTag of imgMatches) {
          const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
          if (srcMatch) {
            const imgUrl = srcMatch[1];
            if (imgUrl && !imgUrl.includes('data:') && !imgUrl.includes('placeholder')) {
              console.log('Found potential image URL:', imgUrl);
              // For Facebook, try to use actual post images
              if (url.includes('facebook.com') && imgUrl.includes('facebook.com')) {
                console.log('Found Facebook post image:', imgUrl);
                image = imgUrl;
                break;
              }
            }
          }
        }
      }
    }
    
    // Clean up title
    let finalTitle = title;
    if (finalTitle) {
      finalTitle = finalTitle
        .replace(/\s*on Facebook:?\s*$/gi, '')
        .replace(/\s*•\s*Facebook.*$/gi, '')
        .replace(/\s*-\s*Facebook.*$/gi, '')
        .replace(/\s*@\w+\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    // Special handling for Facebook - create more informative title
    if (url.includes('facebook.com') && !finalTitle) {
      const postIdMatch = url.match(/\/posts\/([^\/\?]+)/);
      if (postIdMatch) {
        finalTitle = `Facebook Post ${postIdMatch[1]}`;
      } else {
        finalTitle = 'Facebook Post';
      }
    }
    
    // Create better description for Facebook
    let finalDescription = description || 'Click to view the full content';
    if (url.includes('facebook.com') && !description) {
      finalDescription = 'View this Facebook post in the app';
    }
    
    const previewData = {
      title: finalTitle || 'Facebook Post',
      description: finalDescription,
      image: image,
      siteName: 'Facebook',
      timestamp: new Date().toISOString(),
      source: `facebook_${source}`,
      success: true
    };
    
    console.log('Facebook extraction successful:', previewData.title);
    return previewData;
    
  } catch (error) {
    console.error('Facebook extraction failed:', error.message);
    return {
      title: 'Facebook Post',
      description: 'View this Facebook post in the app',
      image: 'https://via.placeholder.com/400x300/1877f2/ffffff?text=Facebook',
      siteName: 'Facebook',
      timestamp: new Date().toISOString(),
      source: 'facebook_fallback',
      success: false,
      error: error.message
    };
  }
};
