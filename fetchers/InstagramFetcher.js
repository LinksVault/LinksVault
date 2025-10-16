// InstagramFetcher.js - Dedicated Instagram link preview fetching
// Uses advanced extraction methods for Instagram content

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
 * Extract media ID from Instagram URL
 * @param {string} url - Instagram URL
 * @returns {string|null} - Media ID or null
 */
const extractMediaIdFromUrl = (url) => {
  try {
    // Extract post ID from various Instagram URL formats
    const postMatch = url.match(/\/p\/([^\/\?]+)/);
    const reelMatch = url.match(/\/reel\/([^\/\?]+)/);
    const tvMatch = url.match(/\/tv\/([^\/\?]+)/);
    
    if (postMatch) return postMatch[1];
    if (reelMatch) return reelMatch[1];
    if (tvMatch) return tvMatch[1];
    
    return null;
  } catch (error) {
    console.log('Error extracting media ID:', error.message);
    return null;
  }
};

/**
 * Fetch Instagram data using Graph API with token
 * @param {string} url - Instagram URL
 * @param {string} token - Instagram API token
 * @returns {Promise<Object>} - Preview data object
 */
const fetchWithInstagramGraphAPI = async (url, token) => {
  try {
    console.log('=== INSTAGRAM GRAPH API ===');
    console.log('URL:', url);
    console.log('Using token:', token ? 'Yes' : 'No');
    
    const mediaId = extractMediaIdFromUrl(url);
    if (!mediaId) {
      throw new Error('Could not extract media ID from URL');
    }
    
    console.log('Media ID:', mediaId);
    
    // Fetch post data from Graph API
    const response = await fetch(
      `https://graph.instagram.com/${mediaId}?fields=id,caption,media_type,media_url,thumbnail_url,like_count,comments_count,username,timestamp&access_token=${token}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SocialVault/1.0 (Instagram Preview Bot)'
        },
        timeout: 10000
      }
    );
    
    if (!response.ok) {
      throw new Error(`Graph API error: ${response.status} - ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Graph API response:', data);
    
    // Process the data
    const title = data.caption || 'Instagram Post';
    const thumbnail = data.media_url || data.thumbnail_url;
    const description = `Likes: ${data.like_count || 0} • Comments: ${data.comments_count || 0}`;
    const author = data.username ? `@${data.username}` : 'Instagram';
    
    // Clean the title
    const cleanTitle = cleanInstagramTitle(title);
    
    return {
      title: cleanTitle,
      description: description,
      image: thumbnail,
      siteName: 'Instagram',
      timestamp: new Date().toISOString(),
      source: 'instagram_graph_api',
      success: true,
      titleExtracted: true,
      thumbnailExtracted: !!thumbnail,
      author: author,
      likes: data.like_count || 0,
      comments: data.comments_count || 0,
      mediaType: data.media_type || 'IMAGE'
    };
    
  } catch (error) {
    console.error('Instagram Graph API failed:', error.message);
    throw error;
  }
};

/**
 * Extract Instagram title using multiple strategies with high priority
 * @param {string} url - Instagram URL
 * @param {string} html - HTML content (optional)
 * @returns {Promise<string>} - Extracted title
 */
const extractInstagramTitle = async (url, html = null) => {
  console.log('=== EXTRACTING INSTAGRAM TITLE ===');
  console.log('URL:', url);
  
  let title = null;
  
  // Strategy 1: Try Instagram oEmbed API first (most reliable for titles)
  try {
    console.log('Title Strategy 1: Instagram oEmbed API');
    const oembedUrl = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`;
    const response = await fetch(oembedUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
        'Accept': 'application/json',
        'Referer': 'https://www.instagram.com/',
      },
      timeout: 8000,
    });

    if (response.ok) {
      const oembedData = await response.json();
      if (oembedData.title) {
        title = oembedData.title;
        console.log('Title found via oEmbed API:', title);
        return cleanInstagramTitle(title);
      }
    }
  } catch (error) {
    console.log('Title Strategy 1 failed:', error.message);
  }
  
  // Strategy 2: Extract from HTML if available
  if (!title && html) {
    console.log('Title Strategy 2: HTML meta tags');
    const titlePatterns = [
      '<meta[^>]*property=["\']og:title["\'][^>]*content=["\']([^"\']+)["\']',
      '<meta[^>]*name=["\']twitter:title["\'][^>]*content=["\']([^"\']+)["\']',
      '<meta[^>]*property=["\']twitter:title["\'][^>]*content=["\']([^"\']+)["\']',
      '<title[^>]*>([^<]+)</title>'
    ];
    
    title = extractMetaContent(html, titlePatterns);
    if (title) {
      console.log('Title found via HTML meta tags:', title);
      return cleanInstagramTitle(title);
    }
  }
  
  // Strategy 3: Try to get HTML and extract title
  if (!title) {
    console.log('Title Strategy 3: Fetch HTML and extract');
    try {
      // Try direct fetch first
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Referer': 'https://www.instagram.com/',
        },
        timeout: 10000,
      });

      if (response.ok) {
        const htmlContent = await response.text();
        const titlePatterns = [
          '<meta[^>]*property=["\']og:title["\'][^>]*content=["\']([^"\']+)["\']',
          '<meta[^>]*name=["\']twitter:title["\'][^>]*content=["\']([^"\']+)["\']',
          '<title[^>]*>([^<]+)</title>'
        ];
        
        title = extractMetaContent(htmlContent, titlePatterns);
        if (title) {
          console.log('Title found via direct HTML fetch:', title);
          return cleanInstagramTitle(title);
        }
      }
    } catch (error) {
      console.log('Title Strategy 3 failed:', error.message);
    }
  }
  
  // Strategy 4: Try proxy services for title extraction
  if (!title) {
    console.log('Title Strategy 4: Proxy services');
    const proxyServices = [
      `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
      `https://corsproxy.io/?${encodeURIComponent(url)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
    ];
    
    for (const proxyUrl of proxyServices) {
      try {
        const response = await fetch(proxyUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
          },
          timeout: 8000,
        });

        if (response.ok) {
          const data = await response.json();
          const htmlContent = data.contents || data.data || data;
          
          if (htmlContent && typeof htmlContent === 'string') {
            const titlePatterns = [
              '<meta[^>]*property=["\']og:title["\'][^>]*content=["\']([^"\']+)["\']',
              '<meta[^>]*name=["\']twitter:title["\'][^>]*content=["\']([^"\']+)["\']',
              '<title[^>]*>([^<]+)</title>'
            ];
            
            title = extractMetaContent(htmlContent, titlePatterns);
            if (title) {
              console.log('Title found via proxy service:', title);
              return cleanInstagramTitle(title);
            }
          }
        }
      } catch (error) {
        console.log(`Proxy service failed for title: ${error.message}`);
        continue;
      }
    }
  }
  
  // Strategy 5: Extract from URL patterns
  if (!title) {
    console.log('Title Strategy 5: URL pattern extraction');
    const postIdMatch = url.match(/\/p\/([^\/\?]+)/) || url.match(/\/reel\/([^\/\?]+)/);
    if (postIdMatch) {
      const postId = postIdMatch[1];
      const isReel = url.includes('/reel/');
      title = isReel ? `Instagram Reel ${postId}` : `Instagram Post ${postId}`;
      console.log('Title generated from URL pattern:', title);
      return title;
    }
  }
  
  // Final fallback
  console.log('All title extraction strategies failed, using fallback');
  return 'Instagram Post';
};

/**
 * Clean Instagram title by removing unwanted parts
 * @param {string} title - Raw title
 * @returns {string} - Cleaned title
 */
const cleanInstagramTitle = (title) => {
  if (!title) return title;
  
  return title
    .replace(/\s*on Instagram:?\s*$/gi, '')
    .replace(/\s*•\s*Instagram.*$/gi, '')
    .replace(/\s*-\s*Instagram.*$/gi, '')
    .replace(/\s*@\w+\s*/g, ' ')
    .replace(/\s*#\w+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Extract Instagram thumbnail using multiple strategies with high priority
 * @param {string} url - Instagram URL
 * @param {string} html - HTML content (optional)
 * @returns {Promise<string|null>} - Extracted thumbnail URL
 */
const extractInstagramThumbnail = async (url, html = null) => {
  console.log('=== EXTRACTING INSTAGRAM THUMBNAIL ===');
  console.log('URL:', url);
  
  let thumbnail = null;
  
  // Strategy 1: Try Instagram oEmbed API first (most reliable for thumbnails)
  try {
    console.log('Thumbnail Strategy 1: Instagram oEmbed API');
    const oembedUrl = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`;
    const response = await fetch(oembedUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
        'Accept': 'application/json',
        'Referer': 'https://www.instagram.com/',
      },
      timeout: 8000,
    });

    if (response.ok) {
      const oembedData = await response.json();
      if (oembedData.thumbnail_url) {
        thumbnail = oembedData.thumbnail_url;
        console.log('Thumbnail found via oEmbed API:', thumbnail);
        return thumbnail;
      }
    }
  } catch (error) {
    console.log('Thumbnail Strategy 1 failed:', error.message);
  }
  
  // Strategy 2: Extract from HTML if available
  if (!thumbnail && html) {
    console.log('Thumbnail Strategy 2: HTML meta tags');
    const imagePatterns = [
      '<meta[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']',
      '<meta[^>]*name=["\']twitter:image["\'][^>]*content=["\']([^"\']+)["\']',
      '<meta[^>]*property=["\']twitter:image["\'][^>]*content=["\']([^"\']+)["\']',
      '<meta[^>]*property=["\']twitter:image:src["\'][^>]*content=["\']([^"\']+)["\']'
    ];
    
    thumbnail = extractMetaContent(html, imagePatterns);
    if (thumbnail) {
      console.log('Thumbnail found via HTML meta tags:', thumbnail);
      return thumbnail;
    }
  }
  
  // Strategy 3: Try to get HTML and extract thumbnail
  if (!thumbnail) {
    console.log('Thumbnail Strategy 3: Fetch HTML and extract');
    try {
      // Try direct fetch first
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Referer': 'https://www.instagram.com/',
        },
        timeout: 10000,
      });

      if (response.ok) {
        const htmlContent = await response.text();
        const imagePatterns = [
          '<meta[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']',
          '<meta[^>]*name=["\']twitter:image["\'][^>]*content=["\']([^"\']+)["\']',
          '<meta[^>]*property=["\']twitter:image["\'][^>]*content=["\']([^"\']+)["\']'
        ];
        
        thumbnail = extractMetaContent(htmlContent, imagePatterns);
        if (thumbnail) {
          console.log('Thumbnail found via direct HTML fetch:', thumbnail);
          return thumbnail;
        }
      }
    } catch (error) {
      console.log('Thumbnail Strategy 3 failed:', error.message);
    }
  }
  
  // Strategy 4: Try proxy services for thumbnail extraction
  if (!thumbnail) {
    console.log('Thumbnail Strategy 4: Proxy services');
    const proxyServices = [
      `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
      `https://corsproxy.io/?${encodeURIComponent(url)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
    ];
    
    for (const proxyUrl of proxyServices) {
      try {
        const response = await fetch(proxyUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
          },
          timeout: 8000,
        });

        if (response.ok) {
          const data = await response.json();
          const htmlContent = data.contents || data.data || data;
          
          if (htmlContent && typeof htmlContent === 'string') {
            const imagePatterns = [
              '<meta[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']',
              '<meta[^>]*name=["\']twitter:image["\'][^>]*content=["\']([^"\']+)["\']',
              '<meta[^>]*property=["\']twitter:image["\'][^>]*content=["\']([^"\']+)["\']'
            ];
            
            thumbnail = extractMetaContent(htmlContent, imagePatterns);
            if (thumbnail) {
              console.log('Thumbnail found via proxy service:', thumbnail);
              return thumbnail;
            }
          }
        }
      } catch (error) {
        console.log(`Proxy service failed for thumbnail: ${error.message}`);
        continue;
      }
    }
  }
  
  // Strategy 5: Try to find images in HTML content
  if (!thumbnail && html) {
    console.log('Thumbnail Strategy 5: Search HTML for images');
    try {
      // Look for img tags with Instagram URLs
      const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
      const imgMatches = html.match(imgRegex);
      if (imgMatches) {
        for (const imgTag of imgMatches) {
          const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
          if (srcMatch) {
            const imgUrl = srcMatch[1];
            if (imgUrl && imgUrl.includes('instagram.com') && 
                (imgUrl.includes('.jpg') || imgUrl.includes('.jpeg') || imgUrl.includes('.png'))) {
              console.log('Found Instagram image in HTML:', imgUrl);
              thumbnail = imgUrl;
              return thumbnail;
            }
          }
        }
      }
    } catch (error) {
      console.log('HTML image search failed:', error.message);
    }
  }
  
  // Strategy 6: Try to extract from Instagram's internal data
  if (!thumbnail && html) {
    console.log('Thumbnail Strategy 6: Instagram internal data');
    try {
      // Look for Instagram post images in script tags
      const scriptMatches = html.match(/<script[^>]*>.*?window\._sharedData.*?<\/script>/gi);
      if (scriptMatches) {
        for (const script of scriptMatches) {
          const jsonMatch = script.match(/window\._sharedData\s*=\s*({.*?});/);
          if (jsonMatch) {
            try {
              const data = JSON.parse(jsonMatch[1]);
              if (data.entry_data && data.entry_data.PostPage) {
                const postData = data.entry_data.PostPage[0];
                if (postData.graphql && postData.graphql.shortcode_media) {
                  const media = postData.graphql.shortcode_media;
                  if (media.display_url) {
                    console.log('Found Instagram thumbnail via _sharedData:', media.display_url);
                    thumbnail = media.display_url;
                    return thumbnail;
                  }
                }
              }
            } catch (parseError) {
              console.log('Failed to parse Instagram _sharedData for thumbnail:', parseError.message);
            }
          }
        }
      }
    } catch (error) {
      console.log('Instagram internal data extraction failed:', error.message);
    }
  }
  
  // Strategy 7: Try regex patterns for Instagram images
  if (!thumbnail && html) {
    console.log('Thumbnail Strategy 7: Regex patterns');
    try {
      const instagramImageRegex = /"display_url":"([^"]+\.jpg[^"]*)"/gi;
      const imageMatches = html.match(instagramImageRegex);
      if (imageMatches) {
        for (const match of imageMatches) {
          const imageUrl = match.replace(/^"display_url":"/, '').replace(/"$/, '');
          if (imageUrl && imageUrl.includes('instagram.com') && imageUrl.includes('.jpg')) {
            console.log('Found Instagram thumbnail via regex:', imageUrl);
            thumbnail = imageUrl;
            return thumbnail;
          }
        }
      }
    } catch (error) {
      console.log('Regex pattern extraction failed:', error.message);
    }
  }
  
  console.log('All thumbnail extraction strategies failed');
  return null;
};

/**
 * Fetch Instagram preview using advanced extraction methods
 * @param {string} url - Instagram URL
 * @param {Object} options - Options object
 * @param {string} options.instagramToken - Instagram API token (optional)
 * @returns {Promise<Object>} - Preview data object
 */
export const fetchInstagramPreview = async (url, options = {}) => {
  const { instagramToken = null } = options;
  try {
    console.log('=== INSTAGRAM FETCHER ===');
    console.log('Processing Instagram URL:', url);
    console.log('Instagram Token available:', instagramToken ? 'Yes' : 'No');
    
    // STRATEGY 0: Instagram Graph API (highest priority if token available)
    if (instagramToken) {
      try {
        console.log('=== STRATEGY 0: INSTAGRAM GRAPH API ===');
        const graphResult = await fetchWithInstagramGraphAPI(url, instagramToken);
        console.log('Graph API successful:', graphResult.title);
        return graphResult;
      } catch (graphError) {
        console.log('Graph API failed, falling back to other methods:', graphError.message);
      }
    }
    
    let html = null;
    let source = 'direct';
    let title = null; // Prioritize title extraction
    
    // PRIORITY: Extract title and thumbnail first using dedicated functions
    console.log('=== PRIORITY TITLE & THUMBNAIL EXTRACTION ===');
    let thumbnail = null;
    
    try {
      title = await extractInstagramTitle(url);
      console.log('Title extracted successfully:', title);
    } catch (titleError) {
      console.log('Title extraction failed:', titleError.message);
    }
    
    try {
      thumbnail = await extractInstagramThumbnail(url);
      console.log('Thumbnail extracted successfully:', thumbnail);
    } catch (thumbnailError) {
      console.log('Thumbnail extraction failed:', thumbnailError.message);
    }
    
    // Strategy 1: Try direct fetch with mobile user agent (even for Instagram - sometimes works)
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
          'Referer': 'https://www.instagram.com/',
        },
        timeout: 15000,
      });

      if (response.ok) {
        html = await response.text();
        console.log('Direct fetch successful, HTML length:', html.length);
        source = 'direct';
      } else {
        console.log(`Direct fetch failed with status: ${response.status}`);
      }
    } catch (directError) {
      console.log('Direct fetch failed:', directError.message);
    }
    
    // Strategy 2: Use proxy services (primary for social media, fallback for others)
    if (!html) {
      if (isSocialMediaSite(url)) {
        console.log('Using proxy services for social media site');
      }
      const proxyServices = [
        // More reliable proxy services
        `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
        `https://corsproxy.io/?${encodeURIComponent(url)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}&format=json`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}&format=text`,
        // Alternative proxy services
        `https://cors-anywhere.herokuapp.com/${url}`,
        `https://thingproxy.freeboard.io/fetch/${url}`,
        // New reliable proxy services
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}&format=html`,
        `https://corsproxy.io/?${encodeURIComponent(url)}&format=html`
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
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
              'DNT': '1',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1'
            },
            timeout: 10000, // Increased timeout for better reliability
          });

          if (response.ok) {
            let data;
            const contentType = response.headers.get('content-type') || '';

            try {
              if (contentType.includes('application/json')) {
                data = await response.json();
                // Handle different response formats from different proxies
                html = data.contents || data.data || data.response || data.result || data;
              } else {
                html = await response.text();
              }

              source = 'proxy';
              if (html && typeof html === 'string' && html.length > 500) { // Ensure we got meaningful content
                console.log(`Proxy fetch successful via ${proxyUrl.split('?')[0]}, HTML length: ${html.length}`);
                break;
              } else {
                console.log(`Proxy returned empty or too short content (${html?.length || 0} chars)`);
              }
            } catch (parseError) {
              console.log('Failed to parse proxy response:', parseError.message);
            }
          } else {
            console.log(`Proxy ${proxyUrl.split('?')[0]} returned status: ${response.status}`);
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
    
    // Strategy 3: Try Instagram's public oEmbed endpoint (if direct and proxy failed)
    if (!html && url.includes('instagram.com')) {
      try {
        console.log('Strategy 3: Trying Instagram oEmbed endpoint');
        const oembedUrl = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`;
        const response = await fetch(oembedUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
            'Accept': 'application/json',
            'Referer': 'https://www.instagram.com/',
          },
          timeout: 10000,
        });

        if (response.ok) {
          const oembedData = await response.json();
          console.log('Instagram oEmbed successful:', oembedData.title);
          
          // Return data directly from oEmbed
          return {
            title: oembedData.title || 'Instagram Post',
            description: oembedData.author_name ? `by ${oembedData.author_name}` : 'Instagram post',
            image: oembedData.thumbnail_url || null,
            siteName: 'Instagram',
            timestamp: new Date().toISOString(),
            source: 'instagram_oembed',
            success: true
          };
        } else {
          console.log(`Instagram oEmbed failed with status: ${response.status}`);
        }
      } catch (oembedError) {
        console.log('Instagram oEmbed failed:', oembedError.message);
      }
    }

    if (!html) {
      throw new Error('All fetch strategies failed');
    }
    
    // Extract data from HTML
    console.log('Extracting Instagram data from HTML...');
    
    // Extract title
    const titlePatterns = [
      '<meta[^>]*property=["\']og:title["\'][^>]*content=["\']([^"\']+)["\']',
      '<meta[^>]*name=["\']twitter:title["\'][^>]*content=["\']([^"\']+)["\']',
      '<meta[^>]*property=["\']twitter:title["\'][^>]*content=["\']([^"\']+)["\']',
      '<title[^>]*>([^<]+)</title>'
    ];
    
    let extractedTitle = extractMetaContent(html, titlePatterns);
    
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
              // For Instagram, try to use actual post images
              if (url.includes('instagram.com') && imgUrl.includes('instagram.com')) {
                console.log('Found Instagram post image:', imgUrl);
                image = imgUrl;
                break;
              }
            }
          }
        }
      }

      // Special handling for Instagram - try multiple strategies
      if (url.includes('instagram.com') && !image) {
        console.log('Instagram detected - trying advanced extraction methods');

        // Strategy 1: Look for Instagram post images in script tags (window._sharedData)
        try {
          const scriptMatches = html.match(/<script[^>]*>.*?window\._sharedData.*?<\/script>/gi);
          if (scriptMatches) {
            for (const script of scriptMatches) {
              const jsonMatch = script.match(/window\._sharedData\s*=\s*({.*?});/);
              if (jsonMatch) {
                try {
                  const data = JSON.parse(jsonMatch[1]);
                  if (data.entry_data && data.entry_data.PostPage) {
                    const postData = data.entry_data.PostPage[0];
                    if (postData.graphql && postData.graphql.shortcode_media) {
                      const media = postData.graphql.shortcode_media;
                      if (media.display_url) {
                        console.log('Found Instagram post image via _sharedData:', media.display_url);
                        image = media.display_url;
                        break;
                      }
                    }
                  }
                } catch (parseError) {
                  console.log('Failed to parse Instagram _sharedData:', parseError.message);
                }
              }
            }
          }
        } catch (error) {
          console.log('Instagram _sharedData extraction failed:', error.message);
        }

        // Strategy 2: Look for Instagram post images in other script patterns (regex)
        if (!image) {
          try {
            const instagramImageRegex = /"display_url":"([^"]+\.jpg[^"]*)"/gi;
            const imageMatches = html.match(instagramImageRegex);
            if (imageMatches) {
              for (const match of imageMatches) {
                const imageUrl = match.replace(/^"display_url":"/, '').replace(/"$/, '');
                if (imageUrl && imageUrl.includes('instagram.com') && imageUrl.includes('.jpg')) {
                  console.log('Found Instagram post image via regex:', imageUrl);
                  image = imageUrl;
                  break;
                }
              }
            }
          } catch (error) {
            console.log('Instagram regex extraction failed:', error.message);
          }
        }

        // Strategy 3: Look for Instagram post images in meta tags with different patterns
        if (!image) {
          const instagramMetaPatterns = [
            '<meta[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']',
            '<meta[^>]*name=["\']twitter:image["\'][^>]*content=["\']([^"\']+)["\']',
            '<meta[^>]*property=["\']twitter:image["\'][^>]*content=["\']([^"\']+)["\']'
          ];

          for (const pattern of instagramMetaPatterns) {
            const regex = new RegExp(pattern, 'gi');
            const match = html.match(regex);
            if (match) {
              const contentMatch = match[0].match(/content=["']([^"']+)["']/i);
              if (contentMatch) {
                const imgUrl = contentMatch[1];
                if (imgUrl && imgUrl.includes('instagram.com') && !imgUrl.includes('icon')) {
                  console.log('Found Instagram post image via meta tags:', imgUrl);
                  image = imgUrl;
                  break;
                }
              }
            }
          }
        }

        // Fallback: Use Instagram icon if no post image found
        if (!image) {
          console.log('No Instagram post image found, using Instagram icon as fallback');
          image = 'https://static.cdninstagram.com/rspec.php/v4/yI/r/VsNE-OHk_8a.png';
        }
      }
    }
    
    // Clean up title
    let finalTitle = extractedTitle;
    if (finalTitle) {
      finalTitle = finalTitle
        .replace(/\s*on Instagram:?\s*$/gi, '')
        .replace(/\s*•\s*Instagram.*$/gi, '')
        .replace(/\s*-\s*Instagram.*$/gi, '')
        .replace(/\s*@\w+\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    // Special handling for Instagram - create more informative title
    if (url.includes('instagram.com') && !finalTitle) {
      try {
        const scriptMatches = html.match(/<script[^>]*>.*?window\._sharedData.*?<\/script>/gi);
        if (scriptMatches) {
          for (const script of scriptMatches) {
            const jsonMatch = script.match(/window\._sharedData\s*=\s*({.*?});/);
            if (jsonMatch) {
              try {
                const data = JSON.parse(jsonMatch[1]);
                if (data.entry_data && data.entry_data.PostPage) {
                  const postData = data.entry_data.PostPage[0];
                  if (postData.graphql && postData.graphql.shortcode_media) {
                    const media = postData.graphql.shortcode_media;
                    if (media.edge_media_to_caption && media.edge_media_to_caption.edges && media.edge_media_to_caption.edges.length > 0) {
                      const caption = media.edge_media_to_caption.edges[0].node.text;
                      if (caption && caption.length > 10) {
                        const cleanedCaption = caption.replace(/\s*#\w+\s*/g, ' ').replace(/\s*@\w+\s*/g, ' ').replace(/\s+/g, ' ').trim();
                        if (cleanedCaption.length > 5 && cleanedCaption.length < 100) {
                          console.log('Found Instagram post caption:', cleanedCaption);
                          finalTitle = cleanedCaption;
                          break;
                        }
                      }
                    }
                  }
                }
              } catch (parseError) {
                console.log('Failed to parse Instagram _sharedData for title:', parseError.message);
              }
            }
          }
        }
      } catch (error) {
        console.log('Instagram title extraction failed:', error.message);
      }

      if (!finalTitle || finalTitle === 'Instagram Link') {
        const postIdMatch = url.match(/\/p\/([^\/\?]+)/);
        if (postIdMatch) {
          finalTitle = `Instagram Post ${postIdMatch[1]}`;
        } else {
          finalTitle = 'Instagram Post';
        }
      }
    }
    
    // Create better description for Instagram
    let finalDescription = description || 'Click to view the full content';
    if (url.includes('instagram.com') && !description) {
      try {
        const scriptMatches = html.match(/<script[^>]*>.*?window\._sharedData.*?<\/script>/gi);
        if (scriptMatches) {
          for (const script of scriptMatches) {
            const jsonMatch = script.match(/window\._sharedData\s*=\s*({.*?});/);
            if (jsonMatch) {
              try {
                const data = JSON.parse(jsonMatch[1]);
                if (data.entry_data && data.entry_data.PostPage) {
                  const postData = data.entry_data.PostPage[0];
                  if (postData.graphql && postData.graphql.shortcode_media) {
                    const media = postData.graphql.shortcode_media;
                    const likes = media.edge_media_preview_like?.count || 0;
                    const comments = media.edge_media_to_comment?.count || 0;
                    const owner = media.owner?.username || '';
                    const date = media.taken_at_timestamp ? new Date(media.taken_at_timestamp * 1000).toLocaleDateString() : '';

                    if (likes > 0 || comments > 0 || owner) {
                      let desc = '';
                      if (likes > 0) desc += `${likes.toLocaleString()} likes`;
                      if (comments > 0) {
                        if (desc) desc += ', ';
                        desc += `${comments} comments`;
                      }
                      if (owner) {
                        if (desc) desc += ' - ';
                        desc += `@${owner}`;
                      }
                      if (date) {
                        if (desc) desc += ` on ${date}`;
                      }
                      if (desc) {
                        console.log('Found Instagram post details:', desc);
                        finalDescription = desc;
                        break;
                      }
                    }
                  }
                }
              } catch (parseError) {
                console.log('Failed to parse Instagram _sharedData for description:', parseError.message);
              }
            }
          }
        }
      } catch (error) {
        console.log('Instagram description extraction failed:', error.message);
      }

      if (finalDescription === 'Click to view the full content') {
        finalDescription = 'View this Instagram post in the app';
      }
    }
    
    // Ensure we always have a title (priority requirement)
    const finalTitleValue = title || finalTitle || 'Instagram Post';
    
    // Use prioritized thumbnail if available, otherwise fall back to extracted image
    const finalThumbnail = thumbnail || image;
    
    const previewData = {
      title: finalTitleValue,
      description: finalDescription,
      image: finalThumbnail,
      siteName: 'Instagram',
      timestamp: new Date().toISOString(),
      source: `instagram_${source}`,
      success: true,
      titleExtracted: !!title, // Flag to indicate if title was successfully extracted
      thumbnailExtracted: !!thumbnail // Flag to indicate if thumbnail was successfully extracted
    };
    
    console.log('Instagram extraction successful:', previewData.title);
    console.log('Title extraction status:', previewData.titleExtracted);
    return previewData;
    
  } catch (error) {
    console.error('Instagram extraction failed:', error.message);
    
    // Try to extract post ID for better fallback title
    let fallbackTitle = 'Instagram Post';
    try {
      const postIdMatch = url.match(/\/p\/([^\/\?]+)/) || url.match(/\/reel\/([^\/\?]+)/);
      if (postIdMatch) {
        const postId = postIdMatch[1];
        const isReel = url.includes('/reel/');
        fallbackTitle = isReel ? `Instagram Reel ${postId}` : `Instagram Post ${postId}`;
      }
    } catch (e) {
      console.log('Could not extract post ID:', e.message);
    }
    
    // Last resort: try to get title and thumbnail using dedicated functions
    let emergencyThumbnail = null;
    try {
      const emergencyTitle = await extractInstagramTitle(url);
      if (emergencyTitle && emergencyTitle !== 'Instagram Post') {
        fallbackTitle = emergencyTitle;
        console.log('Emergency title extraction successful:', fallbackTitle);
      }
    } catch (emergencyError) {
      console.log('Emergency title extraction failed:', emergencyError.message);
    }
    
    try {
      emergencyThumbnail = await extractInstagramThumbnail(url);
      if (emergencyThumbnail) {
        console.log('Emergency thumbnail extraction successful:', emergencyThumbnail);
      }
    } catch (emergencyError) {
      console.log('Emergency thumbnail extraction failed:', emergencyError.message);
    }
    
    return {
      title: fallbackTitle,
      description: 'View this Instagram post in the app',
      image: emergencyThumbnail || 'https://static.cdninstagram.com/rspec.php/v4/yI/r/VsNE-OHk_8a.png',
      siteName: 'Instagram',
      timestamp: new Date().toISOString(),
      source: 'instagram_fallback',
      success: false,
      error: error.message,
      titleExtracted: fallbackTitle !== 'Instagram Post',
      thumbnailExtracted: !!emergencyThumbnail
    };
  }
};

/**
 * Test Instagram fetching with various URL formats
 * @param {string} url - Instagram URL to test
 * @param {Object} options - Options object
 * @param {string} options.instagramToken - Instagram API token (optional)
 * @returns {Promise<Object>} - Test results
 */
export const testInstagramFetching = async (url, options = {}) => {
  const { instagramToken = null } = options;
  console.log('=== TESTING INSTAGRAM FETCHING ===');
  console.log('URL:', url);
  
  const results = {
    url,
    timestamp: new Date().toISOString(),
    strategies: [],
    finalResult: null,
    success: false
  };
  
  try {
    // Test each strategy individually
    if (instagramToken) {
      console.log('Testing Strategy 0: Instagram Graph API');
      try {
        const graphResult = await fetchWithInstagramGraphAPI(url, instagramToken);
        results.strategies.push({
          name: 'Instagram Graph API',
          success: true,
          data: graphResult
        });
      } catch (error) {
        results.strategies.push({
          name: 'Instagram Graph API',
          success: false,
          error: error.message
        });
      }
    }
    
    console.log('Testing Strategy 1: Direct fetch');
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Referer': 'https://www.instagram.com/',
        },
        timeout: 10000,
      });
      
      results.strategies.push({
        name: 'Direct fetch',
        success: response.ok,
        status: response.status,
        contentLength: response.ok ? (await response.text()).length : 0
      });
    } catch (error) {
      results.strategies.push({
        name: 'Direct fetch',
        success: false,
        error: error.message
      });
    }
    
    console.log('Testing Strategy 2: Instagram oEmbed');
    try {
      const oembedUrl = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`;
      const response = await fetch(oembedUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
          'Accept': 'application/json',
          'Referer': 'https://www.instagram.com/',
        },
        timeout: 10000,
      });
      
      if (response.ok) {
        const data = await response.json();
        results.strategies.push({
          name: 'Instagram oEmbed',
          success: true,
          status: response.status,
          data: data
        });
      } else {
        results.strategies.push({
          name: 'Instagram oEmbed',
          success: false,
          status: response.status
        });
      }
    } catch (error) {
      results.strategies.push({
        name: 'Instagram oEmbed',
        success: false,
        error: error.message
      });
    }
    
    // Test the main function
    console.log('Testing main fetchInstagramPreview function');
    const mainResult = await fetchInstagramPreview(url, { instagramToken });
    results.finalResult = mainResult;
    results.success = mainResult.success === true;
    
    console.log('Instagram fetching test completed:', results);
    return results;
    
  } catch (error) {
    console.error('Instagram fetching test failed:', error);
    results.error = error.message;
    return results;
  }
};

// Make test function available globally for debugging
if (typeof window !== 'undefined') {
  window.testInstagramFetching = testInstagramFetching;
  window.extractInstagramTitle = extractInstagramTitle;
  window.extractInstagramThumbnail = extractInstagramThumbnail;
}

// Export the extraction functions for use in other modules
export { extractInstagramTitle, extractInstagramThumbnail, fetchWithInstagramGraphAPI, extractMediaIdFromUrl };
