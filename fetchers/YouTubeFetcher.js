// YouTubeFetcher.js - Dedicated YouTube link preview fetching
// Uses YouTube's official oEmbed API for reliable, legal fetching

/**
 * Extract YouTube video ID from various URL formats
 * @param {string} url - YouTube URL
 * @returns {string|null} - Video ID or null if not found
 */
export const extractYouTubeVideoId = (url) => {
  try {
    console.log('Extracting YouTube video ID from:', url);
    
    // Handle various YouTube URL formats
    const patterns = [
      // youtu.be/VIDEO_ID
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
      // youtube.com/watch?v=VIDEO_ID
      /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      // youtube.com/embed/VIDEO_ID
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      // youtube.com/v/VIDEO_ID
      /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
      // youtube.com/shorts/VIDEO_ID
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        console.log('Found YouTube video ID:', match[1]);
        return match[1];
      }
    }
    
    console.log('No YouTube video ID found in URL');
    return null;
  } catch (error) {
    console.log('Error extracting YouTube video ID:', error.message);
    return null;
  }
};

/**
 * Fetch YouTube video preview using oEmbed API
 * @param {string} url - YouTube URL
 * @returns {Promise<Object>} - Preview data object
 */
export const fetchYouTubePreview = async (url) => {
  try {
    console.log('=== YOUTUBE FETCHER ===');
    console.log('Processing YouTube URL:', url);
    
    const videoId = extractYouTubeVideoId(url);
    console.log('Extracted YouTube video ID:', videoId);
    
    if (!videoId) {
      throw new Error('Could not extract YouTube video ID');
    }
    
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    console.log('Fetching YouTube oEmbed:', oembedUrl);
    
    const oembedResponse = await fetch(oembedUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LinksVault/1.0 (Link Preview Bot)'
      },
      timeout: 15000 // Increased to 15 seconds for better reliability
    });
    
    console.log('YouTube oEmbed response status:', oembedResponse.status);
    
    if (!oembedResponse.ok) {
      const errorText = await oembedResponse.text();
      console.log('YouTube oEmbed failed with status:', oembedResponse.status, 'Error:', errorText);
      throw new Error(`YouTube oEmbed failed: ${oembedResponse.status}`);
    }
    
    const oembedData = await oembedResponse.json();
    console.log('YouTube oEmbed data received:', oembedData);
    
    const previewData = {
      title: oembedData.title || 'YouTube Video',
      description: oembedData.author_name ? `by ${oembedData.author_name}` : 'YouTube video',
      image: oembedData.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      siteName: 'YouTube',
      timestamp: new Date().toISOString(),
      source: 'youtube_oembed',
      success: true
    };
    
    console.log('YouTube oEmbed success:', previewData.title);
    return previewData;
    
  } catch (error) {
    console.log('YouTube oEmbed fallback failed:', error.message);
    
    // Fallback preview
    const videoId = extractYouTubeVideoId(url);
    return {
      title: 'YouTube Video',
      description: 'Click to view the full content',
      image: videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null,
      siteName: 'YouTube',
      timestamp: new Date().toISOString(),
      source: 'youtube_fallback',
      success: false,
      error: error.message
    };
  }
};

/**
 * Test function for debugging YouTube fetching
 * @param {string} url - YouTube URL to test
 * @returns {Promise<Object>} - Test results
 */
export const testYouTubePreview = async (url) => {
  console.log('=== TESTING YOUTUBE PREVIEW ===');
  console.log('URL:', url);
  
  const videoId = extractYouTubeVideoId(url);
  console.log('Video ID:', videoId);
  
  if (videoId) {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    console.log('oEmbed URL:', oembedUrl);
    
    try {
      const response = await fetch(oembedUrl);
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('oEmbed data:', data);
        return data;
      } else {
        const errorText = await response.text();
        console.log('Error response:', errorText);
      }
    } catch (error) {
      console.log('Fetch error:', error.message);
    }
  }
  
  return null;
};

// Make test function available globally for debugging
if (typeof window !== 'undefined') {
  window.testYouTubePreview = testYouTubePreview;
}
