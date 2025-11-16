// TikTokFetcher.js - Uses TikTok oEmbed to get reliable titles and thumbnails
// Legal approach: public oEmbed endpoint, no scraping
import { fetchEnhancedMetadata } from '../utils/SocialMediaFetcher.js';

/**
 * Fetch TikTok preview using TikTok's public oEmbed endpoint.
 * Falls back to enhanced metadata or placeholder on failure.
 * @param {string} url
 * @param {Object} options
 * @returns {Promise<{title:string, description:string, image:string|null, siteName:string, timestamp:string, source:string, success:boolean}>}
 */
export const fetchTikTokPreview = async (url, options = {}) => {
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    const response = await fetch(oembedUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        // Mobile UA tends to be more permissive
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
      },
      timeout: 6000
    });

    if (!response.ok) {
      throw new Error(`TikTok oEmbed HTTP ${response.status}`);
    }

    const data = await response.json();
    // data: { author_name, author_url, title, thumbnail_url, html }
    const rawTitle = (data.title || '').trim();
    // Clean common marketing suffixes if any slipped in
    const cleanTitle = rawTitle
      .replace(/\s*-\s*TikTok\s*(?:\|\s*Make Your Day)?\s*$/i, '')
      .replace(/\s*\|\s*TikTok\s*(?:\|\s*Make Your Day)?\s*$/i, '')
      .replace(/\s*TikTok\s*Make Your Day\s*$/i, '')
      .trim();

    return {
      title: cleanTitle || 'TikTok Video',
      description: data.author_name ? `by ${data.author_name}` : 'TikTok video',
      image: data.thumbnail_url || null,
      siteName: 'TikTok',
      timestamp: new Date().toISOString(),
      source: 'tiktok_oembed',
      success: true
    };
  } catch (error) {
    // Fallback: try enhanced metadata (Microlink/placeholder pipeline)
    try {
      const meta = await fetchEnhancedMetadata(url, { showUserFeedback: false });
      if (meta && meta.title) {
        return {
          title: meta.title,
          description: meta.description || 'TikTok video',
          image: meta.thumbnail || null,
          siteName: meta.siteName || 'TikTok',
          timestamp: new Date().toISOString(),
          source: `tiktok_fallback_${meta.source || 'meta'}`,
          success: true
        };
      }
    } catch {}

    return {
      title: 'TikTok Video',
      description: 'Watch this video on TikTok',
      image: `https://via.placeholder.com/400x300/000000/ffffff?text=TikTok`,
      siteName: 'TikTok',
      timestamp: new Date().toISOString(),
      source: 'tiktok_placeholder',
      success: false,
      error: error.message
    };
  }
};


