# Fetchers - Modular Link Preview System

This folder contains platform-specific fetchers for link previews, organized for better maintainability and code separation.

## 📁 Structure

```
fetchers/
├── index.js              # Main export file
├── MainFetcher.js        # Coordinator that routes URLs to appropriate fetchers
├── YouTubeFetcher.js     # YouTube-specific fetching using oEmbed API
├── InstagramFetcher.js   # Instagram-specific fetching with advanced extraction
├── FacebookFetcher.js    # Facebook-specific fetching with meta tag extraction
└── README.md            # This documentation
```

## 🚀 Usage

### Basic Usage
```javascript
import { fetchLinkPreview } from '../fetchers';

const preview = await fetchLinkPreview('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
console.log(preview.title); // "Never Gonna Give You Up"
```

### Platform-Specific Usage
```javascript
import { fetchYouTubePreview, fetchInstagramPreview, fetchFacebookPreview } from '../fetchers';

// YouTube
const youtubePreview = await fetchYouTubePreview('https://youtu.be/dQw4w9WgXcQ');

// Instagram
const instagramPreview = await fetchInstagramPreview('https://www.instagram.com/p/ABC123/');

// Facebook
const facebookPreview = await fetchFacebookPreview('https://www.facebook.com/posts/123456');
```

### Testing
```javascript
import { testPlatformFetcher } from '../fetchers';

// Test specific platform
const result = await testPlatformFetcher('https://youtu.be/dQw4w9WgXcQ', 'youtube');

// Test all platforms
const result = await testPlatformFetcher('https://example.com', 'all');
```

## 🔧 Platform-Specific Features

### YouTube Fetcher
- ✅ **Official oEmbed API** - Uses YouTube's official API (100% reliable)
- ✅ **Multiple URL formats** - Supports youtu.be, youtube.com, shorts, embed, etc.
- ✅ **Real thumbnails** - Gets actual video thumbnails from YouTube
- ✅ **Real titles** - Gets actual video titles and author names
- ✅ **Fallback support** - Uses YouTube thumbnail service if oEmbed fails

### Instagram Fetcher
- ✅ **Advanced extraction** - Multiple strategies to extract real post content
- ✅ **Proxy support** - Uses multiple proxy services to bypass CORS
- ✅ **Real thumbnails** - Extracts actual post images from Instagram
- ✅ **Post details** - Gets likes, comments, captions, and owner info
- ✅ **Fallback support** - Uses Instagram icon if post image not found

### Facebook Fetcher
- ✅ **Meta tag extraction** - Extracts OpenGraph and Twitter meta tags
- ✅ **Proxy support** - Uses multiple proxy services to bypass CORS
- ✅ **Real thumbnails** - Extracts actual post images from Facebook
- ✅ **Post details** - Gets post titles and descriptions
- ✅ **Fallback support** - Uses Facebook placeholder if content not found

## 📊 Return Format

All fetchers return a consistent format:

```javascript
{
  title: "Video/Post Title",
  description: "Description or author info",
  image: "https://thumbnail-url.com/image.jpg",
  siteName: "Platform Name",
  timestamp: "2025-01-15T10:30:00.000Z",
  source: "platform_method",
  success: true,
  error: "Error message if failed" // Only present if success: false
}
```

## 🛠️ Development

### Adding a New Platform Fetcher

1. Create a new file: `PlatformFetcher.js`
2. Export a `fetchPlatformPreview` function
3. Add the export to `index.js`
4. Add routing logic to `MainFetcher.js`

### Example New Fetcher
```javascript
// TikTokFetcher.js
export const fetchTikTokPreview = async (url) => {
  // Implementation here
  return {
    title: "TikTok Video",
    description: "TikTok content",
    image: "thumbnail-url",
    siteName: "TikTok",
    timestamp: new Date().toISOString(),
    source: "tiktok_api",
    success: true
  };
};
```

## 🔍 Debugging

### Console Testing
```javascript
// Available in browser console
window.testPlatformFetcher('https://youtu.be/dQw4w9WgXcQ', 'youtube');
window.fetchLinkPreview('https://www.instagram.com/p/ABC123/');
```

### Logging
All fetchers include comprehensive console logging for debugging:
- `=== PLATFORM FETCHER ===` - Start of processing
- `Processing URL:` - URL being processed
- `Success/Failed:` - Results of each step
- `Final result:` - Final preview data

## ⚡ Performance

- **Caching**: Results are cached in Firebase for future use
- **Fallbacks**: Multiple fallback strategies ensure high success rate
- **Timeouts**: Reasonable timeouts prevent hanging requests
- **Error handling**: Graceful error handling with meaningful fallbacks

## 🔒 Legal Compliance

- **YouTube**: Uses official oEmbed API (100% legal)
- **Instagram/Facebook**: Uses public meta tags and proxy services
- **Rate limiting**: Built-in rate limiting to respect platform limits
- **User agents**: Proper user agent strings for identification
