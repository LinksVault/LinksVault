import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Image, StyleSheet, SafeAreaView, ScrollView, TextInput, TouchableOpacity, Linking, Dimensions, Modal, ActivityIndicator, Alert, StatusBar, Keyboard, Share } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { db } from '../services/firebase/Config';

const { width: screenWidth } = Dimensions.get('window');
import { doc, updateDoc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { fetchEnhancedMetadata } from '../utils/SocialMediaFetcher';
import { fetchLinkPreview as fetchLinkPreviewNew } from '../fetchers';
import { extractYouTubeVideoId } from '../fetchers/YouTubeFetcher';
import { auth } from '../services/firebase/Config';
import * as ImagePicker from 'expo-image-picker';

// PREVIEW_CONFIG removed - now handled by dedicated fetcher modules

// requestTracker removed - now handled by dedicated fetcher modules

// Helper function to get site name from URL (imported from fetcher modules)
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

// Helper function to decode HTML entities (imported from fetcher modules)
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

// requestManager removed - now handled by dedicated fetcher modules

// scraperServer removed - now handled by dedicated fetcher modules

// Helper function to get site name from URL

// Fallback function to generate basic preview when all fetch strategies fail
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
      site: siteName,
      timestamp: new Date().toISOString()
    };
    
    console.log('Generated fallback preview:', preview);
    return preview;
  } catch (error) {
    console.log('Failed to generate fallback preview:', error.message);
    return null;
  }
};

export default function CollectionFormat({ route, navigation }) {
  const { collection } = route.params;
  
  // State for user's API tokens
  const [userApiTokens, setUserApiTokens] = useState({
    instagram: '',
    tiktok: '',
    youtube: '',
    twitter: '',
    facebook: ''
  });
  const [linkInput, setLinkInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [currentCollection, setCurrentCollection] = useState(collection);
  const [linkPreviews, setLinkPreviews] = useState({});
  const [loadingPreviews, setLoadingPreviews] = useState({});
  const [processedLinks, setProcessedLinks] = useState(new Set()); // Track which links have been processed
  const [currentError, setCurrentError] = useState(null);
  const [isErrorDialogVisible, setIsErrorDialogVisible] = useState(false);
  
  console.log('Collection data received:', collection);
  console.log('Collection listLink:', collection.listLink);
  console.log('Collection ID:', collection.id);
  

  // Load user's API tokens and cached previews
  useEffect(() => {
    const loadUserTokens = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.apiTokens) {
              setUserApiTokens(userData.apiTokens);
              console.log('Loaded user API tokens:', userData.apiTokens);
            }
          }
        }
      } catch (error) {
        console.log('Error loading user tokens:', error.message);
      }
    };
    
    loadUserTokens();
  }, []);

  // Load cached previews from Firebase when links are available
  useEffect(() => {
    const loadCachedPreviews = async () => {
      // Ensure links is properly initialized
      const safeLinks = links || [];
      if (safeLinks.length === 0) {
        console.log('No links available yet, skipping cache load');
        return;
      }
      
      console.log('Loading cached previews for', safeLinks.length, 'links');
      
      try {
        const cachedPreviews = {};
        const cachedLinks = [];
        
        // Load all cached previews in parallel
        const previewPromises = safeLinks.map(async (link) => {
          if (!link.url) return;
          
          try {
            const safeDocId = encodeURIComponent(link.url.trim()).replace(/[^a-zA-Z0-9]/g, '_');
            const docRef = doc(db, 'linkPreviews', safeDocId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
              const previewData = docSnap.data();
              
              // Only use cache if it has valid data
              const isBrokenCache = !previewData.title || 
                                   previewData.title === 'Loading preview...' ||
                                   previewData.title === 'Preview unavailable';
              
              if (!isBrokenCache) {
                cachedPreviews[link.url] = previewData;
                cachedLinks.push(link.url);
                console.log('✅ Loaded cached preview for:', link.url);
              } else {
                console.log('❌ Skipping broken cache for:', link.url);
              }
            } else {
              console.log('ℹ️ No cache found for:', link.url);
            }
          } catch (error) {
            console.log('Error loading cache for', link.url, ':', error.message);
          }
        });
        
        await Promise.all(previewPromises);
        
        // Update state with all cached previews at once
        if (Object.keys(cachedPreviews).length > 0) {
          setLinkPreviews(cachedPreviews);
          setProcessedLinks(new Set(cachedLinks));
          console.log(`✅ Loaded ${Object.keys(cachedPreviews).length} cached previews from Firebase`);
        } else {
          console.log('ℹ️ No valid cached previews found, will fetch fresh data');
        }
        
      } catch (error) {
        console.error('Error loading cached previews:', error);
      }
    };
    
    // Add a small delay to ensure links state is stable
    const timeoutId = setTimeout(loadCachedPreviews, 100);
    
    return () => clearTimeout(timeoutId);
  }, [links]); // Run when links change, not just links.length

  // Refresh collection data from Firebase
  useEffect(() => {
    const refreshCollectionData = async () => {
      try {
        if (!collection || !collection.id) {
          console.error('Collection or collection.id is undefined:', collection);
          return;
        }
        
        const docRef = doc(db, 'albums', collection.id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const freshData = docSnap.data();
          console.log('Fresh data from Firebase:', freshData);
          setCurrentCollection({ ...freshData, id: collection.id }); // Ensure ID is preserved
          
          // Load design preference after getting fresh data
          if (freshData.preferredDesign && designs[freshData.preferredDesign]) {
            setCurrentDesign(freshData.preferredDesign);
            console.log('Loaded design preference from fresh data:', freshData.preferredDesign);
          }
        } else {
          console.log('Document does not exist in Firebase');
        }
      } catch (error) {
        console.error('Error refreshing collection data:', error);
      }
    };
    
    refreshCollectionData();
  }, [collection.id]);
  
  // Handle both old and new data formats with deduplication
  const initializeLinks = (listLink) => {
    console.log('Initializing links with:', listLink);
    if (!listLink || !Array.isArray(listLink) || listLink.length === 0) {
      console.log('No links found or invalid format, returning empty array');
      return [];
    }
    
    const processedLinks = listLink.map((link, index) => {
      console.log(`Processing link ${index}:`, link, 'Type:', typeof link);
      // If link is a string (old format), convert to new format
      if (typeof link === 'string') {
        const newLink = {
          url: link,
          title: link,
          timestamp: new Date().toISOString() // Add current timestamp for old links
        };
        console.log(`Converted string link to object:`, newLink);
        return newLink;
      }
      // If link is already an object (new format), use as is
      const processedLink = {
        url: link.url || link,
        title: link.title || link.url || link,
        timestamp: link.timestamp || new Date().toISOString()
      };
      console.log(`Processed object link:`, processedLink);
      return processedLink;
    });
    
    // Deduplicate links by URL to prevent multiple API calls for same URL
    const uniqueLinks = [];
    const seenUrls = new Set();
    
    for (const link of processedLinks) {
      const normalizedUrl = link.url.trim().toLowerCase();
      if (!seenUrls.has(normalizedUrl)) {
        seenUrls.add(normalizedUrl);
        uniqueLinks.push(link);
      } else {
        console.log('Duplicate link removed:', link.url);
      }
    }
    
    console.log('Final processed links (deduplicated):', uniqueLinks);
    return uniqueLinks;
  };

  const [links, setLinks] = useState(() => {
    try {
      return initializeLinks(currentCollection?.listLink) || [];
    } catch (error) {
      console.log('Error initializing links:', error);
      return [];
    }
  });
  const [isTitleModalVisible, setIsTitleModalVisible] = useState(false);
  const [editingLinkIndex, setEditingLinkIndex] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isUpdatingTitle, setIsUpdatingTitle] = useState(false);
  const [sortType, setSortType] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredLinks, setFilteredLinks] = useState([]);
  const [currentDesign, setCurrentDesign] = useState('modern'); // 'modern', 'classic', 'minimal'
  const [designs, setDesigns] = useState({
    modern: {
      name: 'Modern',
      description: 'Current mobile-optimized design'
    },
    classic: {
      name: 'Classic',
      description: 'Traditional horizontal layout'
    },
    minimal: {
      name: 'Minimal',
      description: 'Clean and simple design'
    },
    grid: {
      name: 'Grid',
      description: 'Two cards side by side'
    }
  });
  const [activeMenuIndex, setActiveMenuIndex] = useState(null);
  const linkInputRef = useRef(null);
  const [isDesignSelectorVisible, setIsDesignSelectorVisible] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const [dropdownMenuPosition, setDropdownMenuPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [selectedLinkForMenu, setSelectedLinkForMenu] = useState(null);
  const [pressedButtonIndex, setPressedButtonIndex] = useState(null);
  
  // New state for minimal link dropdown
  const [linkDropdownVisible, setLinkDropdownVisible] = useState(false);
  const [selectedLinkForDropdown, setSelectedLinkForDropdown] = useState(null);
  const [linkDropdownPosition, setLinkDropdownPosition] = useState({ x: 0, y: 0 });
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [failedPreviews, setFailedPreviews] = useState(new Set()); // Track failed previews
  const [isCustomPreviewModalVisible, setIsCustomPreviewModalVisible] = useState(false);
  const [editingPreviewIndex, setEditingPreviewIndex] = useState(null);
  const [customPreviewData, setCustomPreviewData] = useState({
    title: '',
    description: '',
    image: null
  });
  const [isRefetchingPreview, setIsRefetchingPreview] = useState(false);

  // Update links when currentCollection changes
  useEffect(() => {
    console.log('Current collection updated:', currentCollection);
    if (currentCollection && currentCollection.listLink) {
      const initializedLinks = initializeLinks(currentCollection.listLink);
      setLinks(initializedLinks);
      console.log('Links initialized:', initializedLinks.length);
    } else {
      console.log('No collection data or listLink, setting empty links');
      setLinks([]);
    }
  }, [currentCollection]);
  
  
  // Single, reliable preview fetching system - only process new links
  useEffect(() => {
    const safeLinks = links || [];
    if (safeLinks.length === 0) return;
    
    console.log('Checking for new links to process. Total links:', safeLinks.length);
    
    // Process only new links that don't have previews yet
    const processNewLinks = async () => {
      const newLinks = [];
      
      for (let i = 0; i < safeLinks.length; i++) {
        const link = safeLinks[i];
        if (!link.url) continue;
        
        // Only process if we don't have a preview and haven't processed this URL
        if (!linkPreviews[link.url] && !processedLinks.has(link.url) && !loadingPreviews[i]) {
          newLinks.push({ link, index: i });
        }
      }
      
      if (newLinks.length === 0) {
        console.log('No new links to process');
        return;
      }
      
      console.log(`Processing ${newLinks.length} new links IN PARALLEL for better performance`);
      
      // PERFORMANCE OPTIMIZATION: Fetch all links in parallel instead of staggering
      // This dramatically reduces total wait time from sequential to parallel
      newLinks.forEach(({ link, index }) => {
        console.log(`Starting parallel fetch for link ${index}: ${link.url}`);
        setProcessedLinks(prev => new Set([...prev, link.url]));
        fetchLinkPreview(link.url, index);
      });
    };
    
    // Add a delay to allow cached previews to load first, then fetch new ones
    const timeoutId = setTimeout(processNewLinks, 200);
    
    return () => clearTimeout(timeoutId);
  }, [links, linkPreviews, processedLinks, loadingPreviews]); // Depend on all relevant state
  
  console.log('Initial links state:', links);
  console.log('LinkPreviews state:', Object.keys(linkPreviews || {}).length, 'previews');
  console.log('ProcessedLinks state:', (processedLinks || new Set()).size, 'processed');
  console.log('LoadingPreviews state:', Object.keys(loadingPreviews || {}).length, 'loading');

  // פונקציה למיון הקישורים
  const sortLinks = (linksToSort, type) => {
    // Ensure linksToSort is always an array
    const safeLinksToSort = linksToSort || [];
    const sortedLinks = [...safeLinksToSort];
    switch (type) {
      case 'newest':
        return sortedLinks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      case 'oldest':
        return sortedLinks.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      case 'alphabetical':
        return sortedLinks.sort((a, b) => a.title.localeCompare(b.title));
      case 'reverse-alphabetical':
        return sortedLinks.sort((a, b) => b.title.localeCompare(a.title));
      default:
        return sortedLinks;
    }
  };

  // Update filtered links whenever search query or links change
  useEffect(() => {
    console.log('Search query changed:', searchQuery);
    console.log('Current links:', links);
    
    // Ensure links is always an array
    const safeLinks = links || [];
    
    if (!searchQuery.trim()) {
      console.log('Empty search query, showing all links');
      setFilteredLinks(safeLinks);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = safeLinks.filter(link => {
      const titleMatch = link.title.toLowerCase().includes(query);
      const urlMatch = link.url.toLowerCase().includes(query);
      console.log(`Link "${link.title}" - Title match: ${titleMatch}, URL match: ${urlMatch}`);
      return titleMatch || urlMatch;
    });
    
    console.log('Filtered links:', filtered);
    setFilteredLinks(filtered);
  }, [searchQuery, links]);

  // קבלת הקישורים המסוננים והממוינים
  const getDisplayedLinks = () => {
    console.log('Getting displayed links');
    const sortedLinks = sortLinks(filteredLinks);
    console.log('After sorting:', sortedLinks);
    // Ensure we always return an array
    return sortedLinks || [];
  };

  // הוספת קישור חדש לאוסף
  const addLink = async () => {
    if (linkInput.trim()) {
      try {
        // Safety check for currentCollection
        if (!currentCollection || !currentCollection.id) {
          console.error('currentCollection or currentCollection.id is undefined:', currentCollection);
          showSuccessMessage('Error: Collection data missing');
          return;
        }

        let formattedLink = linkInput.trim();
        if (!formattedLink.startsWith('http://') && !formattedLink.startsWith('https://')) {
          formattedLink = 'https://' + formattedLink;
        }

        // Check if this link already exists in the collection
        if (isDuplicateLink(formattedLink)) {
          console.log('Duplicate link detected:', formattedLink);
          
          // Find the existing link to show more helpful message
          const existingLink = links.find(link => 
            normalizeUrlForComparison(link.url) === normalizeUrlForComparison(formattedLink)
          );
          
          const existingTitle = existingLink ? getDisplayTitle(existingLink, linkPreviews[existingLink.url]) : 'this link';
          showSuccessMessage(`This link already exists in your collection as "${existingTitle}"!`);
          setLinkInput(''); // Clear the input field
          return;
        }

        const newLink = {
          url: formattedLink,
          title: formattedLink,
          timestamp: new Date().toISOString()
        };

        console.log('Adding new link:', newLink);
        console.log('Current links:', links);
        console.log('Current collection ID:', currentCollection.id);

        const newLinks = [...links, newLink];
        const sortedLinks = sortLinks(newLinks, sortType);
        
        console.log('Sorted links to save:', sortedLinks);
        
        // עדכון הדאטהבייס - שמירה בפורמט החדש
        const docRef = doc(db, 'albums', currentCollection.id);
        const dataToSave = {
          listLink: sortedLinks.map(link => ({
            url: link.url,
            title: link.title,
            timestamp: link.timestamp
          })),
          lastModified: new Date().toISOString()
        };
        
        console.log('Data to save to Firebase:', dataToSave);
        console.log('Document reference:', docRef);
        
        await updateDoc(docRef, dataToSave);

        // עדכון המצב המקומי
        setLinks(sortedLinks);
        setLinkInput('');
        
        console.log('Link added successfully');
        
        // PERFORMANCE: Fetch preview immediately for new link (no artificial delay)
        fetchLinkPreview(newLink.url, (sortedLinks || []).length - 1);
        
        // Show subtle success feedback
        showSuccessMessage('Link added successfully!');
        
        // Refresh the collection data after adding - reduced to improve performance
        setTimeout(async () => {
          try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              setCurrentCollection({ ...docSnap.data(), id: currentCollection.id });
            }
          } catch (error) {
            console.error('Error refreshing collection data:', error);
          }
        }, 200);
              } catch (error) {
          console.error('Error adding link:', error);
          console.error('Error details:', error.message, error.code);
          console.error('Error stack:', error.stack);
          showSuccessMessage('Failed to add link. Please try again.');
        }
    }
  };

  // עדכון כותרת הקישור
  const updateLinkTitle = async (index) => {
    if (editingTitle.trim()) {
      try {
        setIsUpdatingTitle(true);
        
        if (!currentCollection || !currentCollection.id) {
          console.error('currentCollection or currentCollection.id is undefined:', currentCollection);
          showSuccessMessage('Error: Collection data missing');
          return;
        }

        const newLinks = [...links];
        const updatedLink = {
          ...newLinks[index],
          title: editingTitle.trim()
        };
        newLinks[index] = updatedLink;

        // Update the linkPreviews state to reflect the new title and mark it as custom
        const updatedPreview = {
          ...linkPreviews[updatedLink.url],
          title: editingTitle.trim(),
          isCustomTitle: true // Mark that this has a custom title
        };
        setLinkPreviews(prev => ({
          ...prev,
          [updatedLink.url]: updatedPreview
        }));

        const docRef = doc(db, 'albums', currentCollection.id);
        await updateDoc(docRef, {
          listLink: newLinks.map(link => ({
            url: link.url,
            title: link.title,
            timestamp: link.timestamp
          })),
          lastModified: new Date().toISOString()
        });

        setLinks(newLinks);
        setEditingLinkIndex(null);
        setEditingTitle('');
        
        // Show success feedback
        console.log('Title updated successfully');
        showSuccessMessage('Title updated successfully!');
        
        // Show brief success state
        setTimeout(async () => {
          try {
            // Refresh the collection data after updating
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              setCurrentCollection({ ...docSnap.data(), id: currentCollection.id });
            }
          } catch (error) {
            console.error('Error refreshing collection data:', error);
          }
        }, 500);
              } catch (error) {
          console.error('Error updating link title:', error);
          showSuccessMessage('Failed to update link title. Please try again.');
        } finally {
        setIsUpdatingTitle(false);
      }
    }
  };

  // מחיקת קישור
  const deleteLink = async (index) => {
    try {
      if (!currentCollection || !currentCollection.id) {
        console.error('currentCollection or currentCollection.id is undefined:', currentCollection);
        alert('Collection data is missing. Please try again.');
        return;
      }

      const newLinks = links.filter((_, i) => i !== index);
      
      const docRef = doc(db, 'albums', currentCollection.id);
      await updateDoc(docRef, {
        listLink: newLinks.map(link => ({
          url: link.url,
          title: link.title,
          timestamp: link.timestamp
        })),
        lastModified: new Date().toISOString()
      });

      setLinks(newLinks);
      showSuccessMessage('Link deleted successfully!');
      
      // Refresh the collection data after deleting
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setCurrentCollection({ ...docSnap.data(), id: currentCollection.id });
      }
            } catch (error) {
          console.error('Error deleting link:', error);
          showSuccessMessage('Failed to delete link. Please try again.');
        }
  };

  // טיפול בלחיצה על קישור - פתיחת הקישור בדפדפן
  const handleLinkPress = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showSuccessMessage(`Cannot open URL: ${url}`);
      }
    } catch (error) {
      console.error('Error opening link:', error);
      showSuccessMessage('Error opening link');
    }
  };

  // טיפול בשיתוף קישור - פתיחת חלון השיתוף
  const handleShareLink = async (url, title) => {
    try {
      const shareTitle = title || 'Check out this link';
      const shareMessage = `${shareTitle}\n\n${url}`;
      
      await Share.share({
        message: shareMessage,
        url: url,
        title: shareTitle,
      });

      // No success notification - we can't reliably know if user actually shared
      console.log('Share sheet opened');
    } catch (error) {
      console.error('Error opening share sheet:', error);
      showSuccessMessage('Error opening share sheet');
    }
  };

  // Remove old complex functions that are no longer needed
  // The simple fetchLinkMetadata approach handles everything now

  // Fetch only the title for a link (used by refresh button)
  const fetchLinkTitleOnly = async (url) => {
    try {
      console.log('Fetching title only for URL:', url);
      const normalizedUrl = url.trim();
      
      // Use the new fetcher system to get the title
      const result = await fetchLinkPreviewNew(normalizedUrl, {
        instagramToken: userApiTokens.instagram
      });
      
      if (result && result.title) {
        console.log('Successfully fetched title:', result.title);
        return result.title;
      } else {
        console.log('No title found in result');
        return null;
      }
    } catch (error) {
      console.error('Error fetching title only:', error);
      return null;
    }
  };

  // Helper function to clean Instagram titles by removing unwanted parts
  const cleanInstagramTitle = (title) => {
    if (!title) return title;
    
    console.log('Original title:', JSON.stringify(title));
    
    let cleaned = title
      .replace(/on Instagram:?\s*/gi, '') // Remove "on Instagram:" or "on Instagram"
      .replace(/^[^:]*:\s*/, '') // Remove everything before the first colon and colon itself
      .replace(/\s*-\s*(@\w+|Instagram|on Instagram).*$/gi, '') // Remove channel name after dash
      .replace(/\s*•\s*(likes?|comments?|@\w+|Instagram|on Instagram).*$/gi, '') // Remove metadata after bullet point
      .replace(/\s*on\s+Instagram\s*$/gi, '') // Remove "on Instagram" at the end
      .replace(/\s*-\s*[^:]*on\s+Instagram\s*$/gi, '') // Remove channel name and "on Instagram" at the end
      .replace(/^["'`«»\u201C\u201D\u2018\u2019\u201A\u201B\u201E\u201F\u2039\u203A\u00AB\u00BB]+/, '') // Remove leading quotation marks of all types
      .replace(/["'`«»\u201C\u201D\u2018\u2019\u201A\u201B\u201E\u201F\u2039\u203A\u00AB\u00BB]+$/, '') // Remove trailing quotation marks of all types
      .replace(/^["']+/, '') // Additional fallback for basic quotes
      .replace(/["']+$/, '') // Additional fallback for basic quotes
      .replace(/^@\w+\s*/, '') // Remove leading @username
      .replace(/\s*@\w+$/, '') // Remove trailing @username
      .replace(/\s*@\w+\s*/g, ' ') // Remove @username from anywhere in the text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
    
    console.log('After regex cleaning:', JSON.stringify(cleaned));
    
    // Final cleanup for quotation marks at start and end only
    // Remove leading quotation marks (only basic ones to avoid removing content)
    while (cleaned.length > 0 && (cleaned.startsWith('"') || cleaned.startsWith("'") || cleaned.startsWith('`'))) {
      cleaned = cleaned.substring(1);
    }
    
    // Remove trailing quotation marks (only basic ones to avoid removing content)
    while (cleaned.length > 0 && (cleaned.endsWith('"') || cleaned.endsWith("'") || cleaned.endsWith('`'))) {
      cleaned = cleaned.substring(0, cleaned.length - 1);
    }
    
    console.log('After while loop cleaning:', JSON.stringify(cleaned));
    
    // Additional aggressive cleanup for any remaining quotation marks at the end
    cleaned = cleaned.replace(/["'`]+$/, '');
    
    // Handle multiple consecutive quotation marks at the end
    while (cleaned.endsWith('"') || cleaned.endsWith("'") || cleaned.endsWith('`')) {
      cleaned = cleaned.slice(0, -1);
    }
    
    // ULTRA AGGRESSIVE cleanup - remove ALL possible quotation marks at the end
    cleaned = cleaned.replace(/["'`«»\u201C\u201D\u2018\u2019\u201A\u201B\u201E\u201F\u2039\u203A\u00AB\u00BB]+$/, '');
    
    // Remove any remaining quotation marks character by character
    while (cleaned.length > 0) {
      const lastChar = cleaned[cleaned.length - 1];
      if (lastChar === '"' || lastChar === "'" || lastChar === '`' || 
          lastChar === '«' || lastChar === '»' || lastChar === '\u201C' || 
          lastChar === '\u201D' || lastChar === '\u2018' || lastChar === '\u2019' ||
          lastChar === '\u201A' || lastChar === '\u201B' || lastChar === '\u201E' ||
          lastChar === '\u201F' || lastChar === '\u2039' || lastChar === '\u203A' ||
          lastChar === '\u00AB' || lastChar === '\u00BB') {
        cleaned = cleaned.slice(0, -1);
      } else {
        break;
      }
    }
    
    // Final trim to remove any whitespace
    cleaned = cleaned.trim();
    
    console.log('Final cleaned title:', JSON.stringify(cleaned));
    
    return cleaned.trim();
  };



  // extractInstagramData function removed - now handled by InstagramFetcher.js

  // extractFacebookData function removed - now handled by FacebookFetcher.js

  // Enhanced Instagram title extraction function with better error handling and legal compliance
  const extractInstagramTitle = async (url) => {
    try {
      console.log('Extracting Instagram title for:', url);
      
      // Use the new Instagram fetcher with user's token
      const { fetchInstagramPreview } = await import('../fetchers/InstagramFetcher.js');
      const instagramData = await fetchInstagramPreview(url, {
        instagramToken: userApiTokens.instagram
      });
      
      if (instagramData && instagramData.success) {
        console.log(`Using data from Instagram fetcher:`, instagramData);
        
        // Try to extract meaningful title from various fields
        let extractedTitle = null;
        
        // Check title field first
        if (instagramData.title && !instagramData.title.includes('Instagram') && instagramData.title.length > 10) {
          extractedTitle = cleanInstagramTitle(instagramData.title);
        }
        
        // Check description field
        if (!extractedTitle && instagramData.description && !instagramData.description.includes('Instagram') && instagramData.description.length > 10) {
          extractedTitle = cleanInstagramTitle(instagramData.description);
        }
        
        if (extractedTitle) {
          console.log('Found Instagram title via Instagram fetcher:', extractedTitle);
          return extractedTitle;
        }
      }
      
      // No fallback needed - InstagramFetcher handles all extraction
      console.log('No meaningful Instagram title found via Instagram fetcher');
      return null;
      
    } catch (error) {
      console.log('Error extracting Instagram title:', error.message);
      return null;
    }
  };

  // fetchWhatsAppStylePreview function removed - now handled by MainFetcher.js

  // Helper function to check if a link has a custom title (different from URL)
  const hasCustomTitle = (link) => {
    return link.title && link.title !== link.url && link.title.trim() !== '';
  };

  // Helper function to get the display title with priority: custom title > preview title > URL
  const getDisplayTitle = (link, preview) => {
    // Priority 1: Custom title from link data (user-edited)
    if (hasCustomTitle(link)) {
      return link.title;
    }
    // Priority 2: Title from preview data
    if (preview && preview.title && preview.title !== 'Loading preview...') {
      return preview.title;
    }
    // Priority 3: URL as fallback
    return link.url;
  };

  // Helper function to normalize URLs for comparison (handles common URL variations)
  // This is a simple, fast normalization that only runs when adding a link
  const normalizeUrlForComparison = (url) => {
    try {
      const urlObj = new URL(url.trim());
      
      // Remove protocol
      let normalized = urlObj.hostname.toLowerCase();
      
      // Remove www. prefix
      if (normalized.startsWith('www.')) {
        normalized = normalized.substring(4);
      }
      
      // Add pathname (without trailing slash)
      normalized += urlObj.pathname.replace(/\/$/, '');
      
      // Add search params if they exist
      if (urlObj.search) {
        normalized += urlObj.search;
      }
      
      return normalized;
    } catch (error) {
      // If URL parsing fails, fall back to simple normalization
      return url.trim().toLowerCase().replace(/\/$/, '');
    }
  };

  // Helper function to check if a URL already exists in the collection
  // This is ONLY called when user clicks "Add" button, NOT during render
  const isDuplicateLink = (url) => {
    const normalizedNewUrl = normalizeUrlForComparison(url);
    
    // Ensure links is always an array
    const safeLinks = links || [];
    
    // Check against existing links - this loop only runs when adding a link
    for (let i = 0; i < safeLinks.length; i++) {
      const normalizedExistingUrl = normalizeUrlForComparison(safeLinks[i].url);
      if (normalizedExistingUrl === normalizedNewUrl) {
        return true;
      }
    }
    return false;
  };

  // Fetch link preview metadata using the enhanced, legal approach
  const fetchLinkPreview = async (url, index) => {
    console.log('=== FETCH LINK PREVIEW CALLED ===');
    console.log('URL:', url, 'Index:', index);

    // Check if this link has a custom title - if so, we'll preserve it but still fetch preview data
    const link = links[index];
    const hasCustomTitleFlag = Boolean(link && hasCustomTitle(link));
    if (hasCustomTitleFlag) {
      console.log('Link has custom title, will preserve it but still fetch preview data:', link.title);
    }

    // Don't fetch if we already have a preview for this URL
    if (linkPreviews[url]) {
      console.log('Preview already exists for URL, skipping fetch:', url);
      return;
    }

    // Don't fetch if we're already loading this preview
    if (loadingPreviews[index]) {
      console.log('Already loading preview for index:', index, 'URL:', url);
      return;
    }

    // PERFORMANCE: Skip retry mechanism for failed previews to avoid delays
    // If it failed once, let user manually retry instead of auto-retry with delay
    const hasFailedBefore = failedPreviews.has(url);
    if (hasFailedBefore) {
      console.log('Link has failed before, skipping auto-retry to avoid delays:', url);
      // Don't auto-retry - user can manually retry if needed
      return;
    }

    try {
      console.log('Starting preview fetch for URL:', url, 'Index:', index);
      setLoadingPreviews(prev => ({ ...prev, [index]: true }));
      
      const normalizedUrl = url.trim();
      const safeDocId = encodeURIComponent(normalizedUrl).replace(/[^a-zA-Z0-9]/g, '_');
      const docRef = doc(db, 'linkPreviews', safeDocId);
      
      // PERFORMANCE OPTIMIZATION: Check Firebase cache first and use it immediately
      // Show cached data instantly, then optionally update in background for very old cache
      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const previewData = docSnap.data();
          console.log('Found cached preview:', previewData);
          
          // PERFORMANCE: Use cache immediately if it has valid data
          // Only reject cache if it's clearly broken (loading state or error)
          const isBrokenCache = !previewData.title || 
                               previewData.title === 'Loading preview...' ||
                               previewData.title === 'Preview unavailable';
          
          if (!isBrokenCache) {
            console.log('✅ Using cached data immediately for instant load:', url);
            
            // Check if the link has a custom title and preserve it
            const link = links[index];
            if (link && hasCustomTitle(link)) {
              console.log('Preserving custom title in cached data:', link.title);
              previewData.title = link.title;
              previewData.isCustomTitle = true;
            }
            
            setLinkPreviews(prev => ({ ...prev, [url]: previewData }));
            setLoadingPreviews(prev => ({ ...prev, [index]: false }));
            
            // OPTIONAL: For very old cache (7+ days), fetch fresh data in background
            const cacheAge = Date.now() - (previewData.timestamp ? new Date(previewData.timestamp).getTime() : 0);
            const isVeryOld = cacheAge > 604800000; // 7 days
            
            if (isVeryOld) {
              console.log('Cache is old (7+ days), will update in background');
              // Continue to fetch fresh data below, but user already sees cached version
            } else {
              // Cache is fresh enough, no need to fetch
              return;
            }
          } else {
            console.log('Cache is broken, will fetch fresh data');
          }
        }
      } catch (cacheError) {
        console.log('Cache check failed:', cacheError.message);
      }
      
      // Set initial loading state
      let previewData = {
        title: 'Loading preview...',
        description: 'Fetching link information...',
        image: null,
        siteName: 'Unknown site',
        timestamp: new Date().toISOString(),
        url: normalizedUrl
      };
      
      // Update UI immediately with loading state
      setLinkPreviews(prev => ({ ...prev, [url]: previewData }));
      
      // Use the new modular fetching system
      try {
        console.log('Using new modular fetching system for:', normalizedUrl);
        const result = await fetchLinkPreviewNew(normalizedUrl, {
          instagramToken: userApiTokens.instagram
        });
        
        if (result && result.success !== false) {
          previewData = {
            title: hasCustomTitleFlag ? link.title : (result.title || 'Untitled'), // Preserve custom title if exists
            description: result.description || '',
            image: result.image || null,
            siteName: result.siteName || getSiteNameFromUrl(normalizedUrl),
            timestamp: result.timestamp || new Date().toISOString(),
            source: result.source || 'unknown',
            isCustomTitle: hasCustomTitleFlag, // Mark if this has a custom title
            url: normalizedUrl
          };
          console.log('New fetching system success:', previewData.title, hasCustomTitleFlag ? '(custom title preserved)' : '');
        } else {
          throw new Error('New fetching system failed');
        }
      } catch (newFetcherError) {
        console.log('New fetching system failed, falling back to old methods:', newFetcherError.message);
        
        // Fallback to old methods if new system fails
        try {
            const metadata = await fetchEnhancedMetadata(normalizedUrl, {
              showUserFeedback: false,
              onError: null,
              instagramToken: userApiTokens.instagram
            });
          
          if (metadata && metadata.title) {
            previewData = {
              title: hasCustomTitleFlag ? link.title : (metadata.title || 'Untitled'), // Preserve custom title if exists
              description: metadata.description || '',
              image: metadata.thumbnail || null,
              siteName: metadata.siteName || getSiteNameFromUrl(normalizedUrl),
              timestamp: new Date().toISOString(),
              source: metadata.source || 'microlink',
              isCustomTitle: hasCustomTitleFlag, // Mark if this has a custom title
              url: normalizedUrl
            };
          } else {
            throw new Error('Enhanced metadata failed');
          }
        } catch (enhancedError) {
          console.log('Enhanced metadata fallback failed:', enhancedError.message);
          previewData = {
            title: hasCustomTitleFlag ? link.title : (getSiteNameFromUrl(normalizedUrl) + ' Link'), // Preserve custom title if exists
            description: 'Click to view the full content',
            image: null,
            siteName: getSiteNameFromUrl(normalizedUrl),
            timestamp: new Date().toISOString(),
            source: 'fallback',
            isCustomTitle: hasCustomTitleFlag, // Mark if this has a custom title
            url: normalizedUrl
          };
        }
      }
      
      // Save to Firebase for future use
      try {
        await setDoc(docRef, previewData);
        console.log('Preview saved to Firebase successfully');
      } catch (error) {
        console.error('Error saving preview to Firebase:', error);
      }
      
      console.log('Final preview data:', previewData);
      setLinkPreviews(prev => ({ ...prev, [url]: previewData }));
      
    } catch (error) {
      console.error('Error fetching link preview:', error);
      console.error('Error details:', {
        url,
        index,
        errorMessage: error.message,
        errorStack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      // Check if user has set a custom title for this link
      const linkWithCustomTitle = links.find(link => link.url === url);
      const titleToUse = linkWithCustomTitle && hasCustomTitle(linkWithCustomTitle) 
        ? linkWithCustomTitle.title 
        : 'Preview unavailable';
      
      // Set default preview data with more detailed error info
      setLinkPreviews(prev => ({ 
        ...prev, 
        [url]: {
          title: titleToUse,
          description: `Could not load preview (${error.message})`,
          image: null,
          siteName: 'Unknown',
          timestamp: new Date().toISOString(),
          error: error.message, // Store error for debugging
          isCustomTitle: Boolean(linkWithCustomTitle && hasCustomTitle(linkWithCustomTitle))
        }
      }));
      
      // Mark this preview as failed for retry functionality
      setFailedPreviews(prev => new Set([...prev, url]));
      
      // Show user-friendly error message
      showSuccessMessage(`Preview failed for ${getSiteNameFromUrl(url)} - will retry later`);
    } finally {
      setLoadingPreviews(prev => ({ ...prev, [index]: false }));
    }
  };

  // extractYouTubeVideoId function removed - now handled by YouTubeFetcher.js

  // testYouTubePreview function removed - now handled by YouTubeFetcher.js
  

  // Retry failed previews with exponential backoff
  const retryFailedPreview = (url, index) => {
    console.log('Retrying failed preview for:', url);
    setFailedPreviews(prev => {
      const newSet = new Set(prev);
      newSet.delete(url);
      return newSet;
    });
    
    // Add a delay before retrying
    setTimeout(() => {
      fetchLinkPreview(url, index);
    }, 2000); // 2 second delay for manual retries
  };

  // PERFORMANCE: Disabled auto-retry to avoid delays
  // Failed previews will show a manual retry button instead
  // This prevents the app from hanging while waiting for retries
  useEffect(() => {
    // Auto-retry disabled for performance
    // Users can manually retry failed previews using the retry button
    if (failedPreviews.size > 0) {
      console.log(`${failedPreviews.size} previews failed. Users can manually retry.`);
    }
  }, [failedPreviews.size]);

  // This useEffect is now handled by the main preview fetching system above
  // Removed to prevent conflicts and duplicate fetching

  const openTitleModal = (index) => {
    setEditingLinkIndex(index);
    setTitleInput(links[index].title);
    setIsTitleModalVisible(true);
  };

  // שינוי סוג המיון
  const changeSortType = (type) => {
    setSortType(type);
    const sortedLinks = sortLinks(links, type);
    setLinks(sortedLinks);
  };

  const changeDesign = (designKey) => {
    // Only show notification if actually switching to a different design
    if (currentDesign !== designKey) {
      setCurrentDesign(designKey);
      setIsDesignSelectorVisible(false);
      showSuccessMessage(`Switched to ${designs[designKey].name} design!`);
      // Save design preference to Firebase
      saveDesignPreference(designKey);
    } else {
      // Show a friendly message that this design is already active
      setIsDesignSelectorVisible(false);
      showSuccessMessage(`${designs[designKey].name} design is already active! ✨`);
    }
  };

  const saveDesignPreference = async (designKey) => {
    try {
      if (currentCollection && currentCollection.id) {
        const docRef = doc(db, 'albums', currentCollection.id);
        await updateDoc(docRef, {
          preferredDesign: designKey,
          lastUpdated: new Date().toISOString()
        });
        console.log('Design preference saved:', designKey);
      }
    } catch (error) {
      console.error('Error saving design preference:', error);
    }
  };

  const loadDesignPreference = async () => {
    try {
      if (currentCollection && currentCollection.id) {
        const docRef = doc(db, 'albums', currentCollection.id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.preferredDesign && designs[data.preferredDesign]) {
            setCurrentDesign(data.preferredDesign);
            console.log('Loaded design preference:', data.preferredDesign);
          }
        }
      }
    } catch (error) {
      console.error('Error loading design preference:', error);
    }
  };

  const showDesignSelector = (event) => {
    const { pageY, pageX } = event.nativeEvent;
    setDropdownPosition({ x: pageX, y: pageY });
    setIsDesignSelectorVisible(true);
  };

  const toggleMenu = (index, event) => {
    if (activeMenuIndex === index) {
      setActiveMenuIndex(null);
      setSelectedLinkForMenu(null);
    } else {
      // Calculate position for the dropdown
      event.target.measure((x, y, width, height, pageX, pageY) => {
        setDropdownMenuPosition({
          x: pageX + width - 140, // Position to the right of the button
          y: pageY + height + 5,  // Position below the button
          width: 140,
          height: 200 // Approximate height
        });
      });
      setActiveMenuIndex(index);
      setSelectedLinkForMenu(index);
    }
  };

  const closeMenu = () => {
    setActiveMenuIndex(null);
    setSelectedLinkForMenu(null);
  };

  // Show link dropdown for minimal design
  const showLinkDropdown = (index, link) => {
    // Close any existing menus first
    closeMenu();
    
    // Calculate position for the dropdown (center of the link card)
    setLinkDropdownPosition({
      x: screenWidth / 2 - 100, // Center the dropdown (200px width / 2)
      y: 300 + (index * 120) // Approximate position based on link index
    });
    
    setSelectedLinkForDropdown({ index, link });
    setLinkDropdownVisible(true);
  };

  // Close link dropdown
  const closeLinkDropdown = () => {
    setLinkDropdownVisible(false);
    setSelectedLinkForDropdown(null);
  };


  // Get dynamic styles based on current design
  const getDesignStyles = () => {
    switch (currentDesign) {
      case 'classic':
        return {
          linkItem: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#fff',
            padding: 12,
            borderRadius: 12,
            marginVertical: 6,
            borderWidth: 0,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
            height: 100,
            overflow: 'hidden',
            position: 'relative',
          },
          previewContainer: {
            width: 140,
            height: 80,
            borderRadius: 8,
            backgroundColor: '#e0e0e0',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 16,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 1,
          },
          linkContent: {
            flex: 1,
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingVertical: 4,
            paddingRight: 8,
            overflow: 'hidden',
            maxWidth: '100%',
            flexShrink: 1,
          },
          linkActions: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingLeft: 8,
            borderTopWidth: 0,
            borderTopColor: 'transparent',
            minHeight: 32,
            position: 'absolute',
            right: 12,
            top: 12,
          },
          editButton: {
            padding: 6,
            marginRight: 6,
            backgroundColor: 'transparent',
            borderRadius: 4,
          },
          deleteButton: {
            padding: 6,
            marginRight: 6,
            backgroundColor: 'transparent',
            borderRadius: 4,
          },
          openButton: {
            padding: 6,
            marginRight: 6,
            backgroundColor: 'transparent',
            borderRadius: 4,
          },
          linkTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: '#1a1a1a',
            marginBottom: 0,
            lineHeight: 20,
            flexShrink: 1,
            flexWrap: 'wrap',
            maxWidth: '100%',
          },
          linkUrl: {
            fontSize: 13,
            color: '#666666',
            marginBottom: 0,
            lineHeight: 16,
          },
          linkDescription: {
            display: 'none', // Hide description in classic design
          }
        };
      case 'minimal':
        return {
          linkItem: {
            backgroundColor: '#fff',
            padding: 12,
            borderRadius: 8,
            marginVertical: 6,
            borderWidth: 1,
            borderColor: '#f0f0f0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
          },
          previewContainer: {
            width: '100%',
            height: 120,
            borderRadius: 8,
            backgroundColor: '#f8f8f8',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
          },
          linkContent: {
            marginTop: 8,
          },
          linkActions: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingTop: 6,
            borderTopWidth: 0.5,
            borderTopColor: '#f0f0f0',
          },
          editButton: {
            padding: 6,
            marginRight: 6,
            backgroundColor: 'transparent',
            borderRadius: 4,
          },
          deleteButton: {
            padding: 6,
            marginRight: 6,
            backgroundColor: 'transparent',
            borderRadius: 4,
          },
          openButton: {
            padding: 6,
            marginRight: 6,
            backgroundColor: 'transparent',
            borderRadius: 4,
          },
          linkTitle: {
            fontSize: 16,
            fontWeight: '500',
            color: '#333',
            marginBottom: 4,
            lineHeight: 20,
          },
          linkUrl: {
            fontSize: 13,
            color: '#666',
            marginBottom: 6,
            lineHeight: 18,
          },
          linkDescription: {
            fontSize: 13,
            color: '#666',
            lineHeight: 18,
          }
        };
      case 'grid':
        return {
          linkItem: {
            backgroundColor: '#f8f9fa',
            padding: 12,
            borderRadius: 12,
            marginVertical: 6,
            borderWidth: 1,
            borderColor: '#e0e0e0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 2,
            elevation: 1,
            width: '48%',
          },
          previewContainer: {
            width: '100%',
            height: 120,
            borderRadius: 8,
            backgroundColor: '#e0e0e0',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 1,
          },
          linkContent: {
            marginTop: 8,
          },
          linkActions: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 6,
            paddingHorizontal: 2,
            borderTopWidth: 0.5,
            borderTopColor: '#e0e0e0',
          },
          editButton: {
            padding: 5,
            backgroundColor: 'transparent',
            borderRadius: 6,
          },
          deleteButton: {
            padding: 5,
            backgroundColor: 'transparent',
            borderRadius: 6,
          },
          openButton: {
            padding: 5,
            backgroundColor: 'transparent',
            borderRadius: 6,
          },
          linkTitle: {
            fontSize: 14,
            fontWeight: '600',
            color: '#333',
            marginBottom: 4,
            lineHeight: 18,
          },
          linkUrl: {
            fontSize: 12,
            color: '#666',
            marginBottom: 6,
            lineHeight: 16,
          },
          linkDescription: {
            fontSize: 12,
            color: '#666',
            lineHeight: 16,
          }
        };
      default: // modern
        return {
          linkItem: {
            backgroundColor: '#f8f9fa',
            padding: 16,
            borderRadius: 16,
            marginVertical: 12,
            borderWidth: 1,
            borderColor: '#e0e0e0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
            elevation: 2,
          },
          previewContainer: {
            width: '100%',
            height: 200,
            borderRadius: 12,
            backgroundColor: '#e0e0e0',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
            elevation: 2,
          },
          linkContent: {
            marginTop: 12,
          },
          linkActions: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: '#e0e0e0',
          },
          editButton: {
            padding: 8,
            marginRight: 8,
            backgroundColor: '#f0f0f0',
            borderRadius: 8,
          },
          deleteButton: {
            padding: 8,
            marginRight: 8,
            backgroundColor: '#ffe6e6',
            borderRadius: 8,
          },
          openButton: {
            padding: 8,
            marginRight: 8,
            backgroundColor: '#e6f3ff',
            borderRadius: 8,
          },
          linkTitle: {
            fontSize: 18,
            fontWeight: '600',
            color: '#333',
            marginBottom: 6,
            lineHeight: 24,
          },
          linkUrl: {
            fontSize: 14,
            color: '#666',
            marginBottom: 8,
            lineHeight: 18,
          },
          linkDescription: {
            fontSize: 14,
            color: '#666',
            lineHeight: 20,
          }
        };
    }
  };

  // Old renderLinkPreview function removed - now using inline preview rendering

  // Old metadata fetching functions removed - now using fetchEnhancedMetadata from SocialMediaFetcher

  // Show subtle message (success or error)
  const showSuccessMessage = (message) => {
    setSuccessMessage(message);
    setShowSuccess(true);
    
    // Auto-hide after 3 seconds for error messages, 2 for success
    const isError = message.toLowerCase().includes('error') || message.toLowerCase().includes('failed') || message.toLowerCase().includes('cannot');
    setTimeout(() => {
      setShowSuccess(false);
      setSuccessMessage('');
    }, isError ? 3000 : 2000);
  };

  // Open custom preview editor
  const openCustomPreviewEditor = (index) => {
    const link = links[index];
    const currentPreview = linkPreviews[link.url];
    
    setEditingPreviewIndex(index);
    setCustomPreviewData({
      title: currentPreview?.title || link.title || '',
      description: currentPreview?.description || '',
      image: currentPreview?.image || null
    });
    setIsCustomPreviewModalVisible(true);
  };

  // Save custom preview
  const saveCustomPreview = async () => {
    if (editingPreviewIndex === null) return;
    
    try {
      const link = links[editingPreviewIndex];
      const updatedPreview = {
        ...linkPreviews[link.url],
        title: customPreviewData.title || link.title,
        description: customPreviewData.description || 'No description available',
        image: customPreviewData.image,
        siteName: linkPreviews[link.url]?.siteName || getSiteNameFromUrl(link.url),
        timestamp: new Date().toISOString(),
        isCustom: true // Mark as custom preview
      };

      // Update the preview in state
      setLinkPreviews(prev => ({
        ...prev,
        [link.url]: updatedPreview
      }));

      // Update the link title if it was changed
      if (customPreviewData.title && customPreviewData.title !== link.title) {
        const newLinks = [...links];
        newLinks[editingPreviewIndex] = {
          ...newLinks[editingPreviewIndex],
          title: customPreviewData.title
        };
        setLinks(newLinks);

        // Update Firebase
        const docRef = doc(db, 'albums', currentCollection.id);
        await updateDoc(docRef, {
          listLink: newLinks.map(link => ({
            url: link.url,
            title: link.title,
            timestamp: link.timestamp
          })),
          lastModified: new Date().toISOString()
        });
      }

      // Save custom preview to Firebase
      const safeDocId = encodeURIComponent(link.url).replace(/[^a-zA-Z0-9]/g, '_');
      const previewDocRef = doc(db, 'linkPreviews', safeDocId);
      await setDoc(previewDocRef, updatedPreview);

      setIsCustomPreviewModalVisible(false);
      setEditingPreviewIndex(null);
      setCustomPreviewData({ title: '', description: '', image: null });
      
      showSuccessMessage('Custom preview saved successfully!');
    } catch (error) {
      console.error('Error saving custom preview:', error);
      showSuccessMessage('Failed to save custom preview');
    }
  };

  // Refetch original preview data from the web
  const refetchOriginalPreview = async () => {
    if (editingPreviewIndex === null) return;
    
    try {
      setIsRefetchingPreview(true);
      const link = links[editingPreviewIndex];
      
      console.log('Refetching original preview for:', link.url);
      showSuccessMessage('Refetching preview data...');
      
      // Clear the existing preview and failed preview state
      setLinkPreviews(prev => {
        const newPreviews = { ...prev };
        delete newPreviews[link.url];
        return newPreviews;
      });
      
      setFailedPreviews(prev => {
        const newSet = new Set(prev);
        newSet.delete(link.url);
        return newSet;
      });
      
      // Force fetch fresh preview data
      const normalizedUrl = link.url.trim();
      
      try {
        const result = await fetchLinkPreviewNew(normalizedUrl, {
          instagramToken: userApiTokens.instagram
        });
        
        if (result && result.success !== false) {
          const newPreview = {
            title: result.title || 'Untitled',
            description: result.description || '',
            image: result.image || null,
            siteName: result.siteName || getSiteNameFromUrl(normalizedUrl),
            timestamp: new Date().toISOString(),
            source: result.source || 'refetch',
            url: normalizedUrl // Ensure URL is included for Firebase validation
          };
          
          // Update preview state
          setLinkPreviews(prev => ({ ...prev, [link.url]: newPreview }));
          
          // Update custom preview modal with new data
          setCustomPreviewData({
            title: newPreview.title,
            description: newPreview.description,
            image: newPreview.image
          });
          
          // Save to Firebase
          const safeDocId = encodeURIComponent(link.url).replace(/[^a-zA-Z0-9]/g, '_');
          const previewDocRef = doc(db, 'linkPreviews', safeDocId);
          await setDoc(previewDocRef, newPreview);
          
          showSuccessMessage('Preview refetched successfully!');
          console.log('Successfully refetched preview:', newPreview);
        } else {
          throw new Error('Failed to fetch preview data');
        }
      } catch (fetchError) {
        console.error('Error refetching preview:', fetchError);
        showSuccessMessage('Failed to refetch preview. Please try again.');
      }
      
    } catch (error) {
      console.error('Error in refetchOriginalPreview:', error);
      showSuccessMessage('Failed to refetch preview');
    } finally {
      setIsRefetchingPreview(false);
    }
  };

  // Handle image selection for custom preview
  const handleImageSelection = async () => {
    try {
      console.log('=== IMAGE PICKER DEBUG ===');
      console.log('Requesting media library permissions...');
      
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('Permission result:', permissionResult);
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Permission to access camera roll is required!');
        return;
      }

      console.log('Launching image library...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });
      
      console.log('Image picker result:', result);

      if (!result.canceled) {
        console.log('Image selected successfully');
        const selectedImage = result.assets[0];
        setCustomPreviewData(prev => ({ ...prev, image: selectedImage.uri }));
        console.log('Custom preview image set to:', selectedImage.uri);
      } else {
        console.log('Image selection cancelled');
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Configure Status Bar for better visibility */}
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="transparent"
        translucent={true}
      />
      
      {/* Message Toast (Success or Error) */}
      {showSuccess && (
        <View style={[
          styles.successToast,
          {
            backgroundColor: successMessage.toLowerCase().includes('error') || successMessage.toLowerCase().includes('failed') || successMessage.toLowerCase().includes('cannot') 
              ? '#F44336' 
              : '#4CAF50'
          }
        ]}>
          <MaterialIcons 
            name={
              successMessage.toLowerCase().includes('error') || successMessage.toLowerCase().includes('failed') || successMessage.toLowerCase().includes('cannot')
                ? "error"
                : "check-circle"
            } 
            size={20} 
            color="#ffffff" 
          />
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      )}
      
      <ScrollView>
        {/* תמונת האוסף */}
        <View style={styles.imageContainer}>
          {/* Status bar area with dark background */}
          <View style={styles.statusBarArea} />
          
          {/* Header with back arrow - same as original */}
          <View style={styles.headerLine}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              accessibilityLabel="Go back"
              accessibilityHint="Return to the previous screen"
              accessibilityRole="button"
            >
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <Image 
            source={{ uri: currentCollection.imageLink }}
            style={styles.collectionImage}
            resizeMode="cover"
          />
          <View style={styles.overlay}>
            <Text style={styles.collectionTitle}>{currentCollection.title}</Text>
            {currentCollection.description && (
              <Text style={styles.description}>{currentCollection.description}</Text>
            )}
          </View>
        </View>

        {/* אזור הקישורים */}
        <View style={styles.contentContainer}>
          {/* כותרת אזור הקישורים */}
          <View style={styles.sectionHeader}>
            <View style={styles.leftSection}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="link" size={24} color="#4a90e2" />
              </View>
              <Text style={styles.sectionTitle}>Links ({(getDisplayedLinks() || []).length})</Text>
              <TouchableOpacity 
                style={styles.designChangeButton}
                onPress={(e) => showDesignSelector(e)}
              >
                <MaterialIcons name="palette" size={22} color="#4a90e2" />
                <Text style={styles.designChangeText}>{designs[currentDesign]?.name}</Text>
                <MaterialIcons name="expand-more" size={18} color="#4a90e2" />
              </TouchableOpacity>
              
            </View>
            
            <View style={styles.rightSection}>
              {/* שדה חיפוש */}
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                <TextInput
                  id="search-links-input"
                  name="search-links"
                  style={styles.searchInput}
                  placeholder="Search links..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#666"
                  selectionColor="#4a90e2"
                  accessibilityLabel="Search links"
                  accessibilityHint="Enter text to search through your saved links"
                  cursorColor="#4a90e2"
                />
                {searchQuery ? (
                  <TouchableOpacity 
                    onPress={() => setSearchQuery('')}
                    style={styles.clearSearchButton}
                  >
                    <Ionicons name="close-circle" size={20} color="#666" />
                  </TouchableOpacity>
                ) : null}
              </View>
              
              {/* כפתורי מיון */}
              <View style={styles.sortButtonsContainer}>
                <TouchableOpacity 
                  style={[styles.sortButton, sortType === 'newest' && styles.sortButtonActive]} 
                  onPress={() => changeSortType('newest')}
                >
                  <MaterialIcons name="access-time" size={20} color={sortType === 'newest' ? '#fff' : '#4a90e2'} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.sortButton, sortType === 'oldest' && styles.sortButtonActive]} 
                  onPress={() => changeSortType('oldest')}
                >
                  <MaterialIcons name="history" size={20} color={sortType === 'oldest' ? '#fff' : '#4a90e2'} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.sortButton, sortType === 'alphabetical' && styles.sortButtonActive]} 
                  onPress={() => changeSortType('alphabetical')}
                >
                  <MaterialIcons name="sort-by-alpha" size={20} color={sortType === 'alphabetical' ? '#fff' : '#4a90e2'} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.sortButton, sortType === 'reverse-alphabetical' && styles.sortButtonActive]} 
                  onPress={() => changeSortType('reverse-alphabetical')}
                >
                  <MaterialIcons name="sort-by-alpha" size={20} color={sortType === 'reverse-alphabetical' ? '#fff' : '#4a90e2'} style={styles.reverseIcon} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* אזור הזנת קישור חדש */}
          <View style={styles.linkInputContainer}>
            <View style={styles.inputFieldsContainer}>
              <TextInput
                id="add-link-input"
                name="add-link"
                ref={linkInputRef}
                style={styles.linkInput}
                placeholder="Add a new link..."
                value={linkInput}
                onChangeText={setLinkInput}
                accessibilityLabel="Add a new link"
                accessibilityHint="Enter a URL to add to your collection"
                placeholderTextColor="#a9a9a9"
                autoCapitalize="none"
                keyboardType="url"
                textAlign="left"
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (linkInput.trim()) {
                    addLink();
                  }
                }}
              />
            </View>
            <TouchableOpacity 
              style={[styles.addButton, !linkInput.trim() && styles.addButtonDisabled]} 
              onPressIn={() => {
                console.log('Add button pressed!');
                // Add link immediately on press in - before keyboard dismissal
                if (linkInput.trim()) {
                  addLink();
                }
              }}
              disabled={!linkInput.trim()}
              activeOpacity={0.7}
              accessibilityLabel="Add link"
              accessibilityHint="Add the entered URL to your collection"
              accessibilityRole="button"
            >
              <MaterialIcons name="add" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* רשימת הקישורים */}
          <View style={[
            styles.linksContainer,
            currentDesign === 'grid' && styles.gridLinksContainer
          ]}>
            {getDisplayedLinks().map((link, index) => {
              const designStyles = getDesignStyles();
              return (
                <View
                  key={index}
                  style={[
                    styles.linkItem,
                    designStyles.linkItem,
                    editingLinkIndex === index && styles.linkItemEditing
                  ]}
                >
                  <TouchableOpacity 
                    style={[
                      styles.linkMainContent,
                      currentDesign === 'classic' && {
                        flexDirection: 'row',
                        alignItems: 'center',
                        overflow: 'hidden',
                        maxWidth: '100%',
                      }
                    ]}
                    onPress={() => {
                      console.log('Link main content pressed, editing:', editingLinkIndex === index);
                      if (editingLinkIndex !== index) {
                        // For minimal design, show dropdown menu instead of opening link directly
                        if (currentDesign === 'minimal') {
                          showLinkDropdown(index, link);
                        } else {
                          // For other designs, open link directly as before
                          handleLinkPress(link.url);
                        }
                      }
                    }}
                    disabled={editingLinkIndex === index}
                    activeOpacity={editingLinkIndex === index ? 1 : 0.7}
                    pointerEvents={editingLinkIndex === index ? "none" : "auto"}
                  >
                    {/* Link Preview Image - Positioned on the left */}
                    <View style={[styles.previewContainer, designStyles.previewContainer]}>
                      {loadingPreviews[index] ? (
                        <View style={styles.previewLoading}>
                          <ActivityIndicator size="small" color="#4a90e2" />
                        </View>
                      ) : linkPreviews[link.url]?.image ? (
                        <Image
                          source={{ uri: linkPreviews[link.url].image }}
                          style={styles.previewImage}
                          resizeMode="cover"
                          onError={() => {
                            console.log('Image failed to load, removing it');
                            // If image fails to load, remove it
                            setLinkPreviews(prev => ({
                              ...prev,
                              [link.url]: {
                                ...prev[link.url],
                                image: null
                              }
                            }));
                          }}
                        />
                      ) : linkPreviews[link.url] ? (
                        <View style={styles.previewPlaceholder}>
                          {failedPreviews.has(link.url) ? (
                            <TouchableOpacity 
                              style={styles.retryButton}
                              onPress={() => retryFailedPreview(link.url, index)}
                            >
                              <MaterialIcons name="refresh" size={24} color="#4a90e2" />
                              <Text style={styles.retryText}>Retry</Text>
                            </TouchableOpacity>
                          ) : (
                            <MaterialIcons name="link" size={32} color="#ccc" />
                          )}
                        </View>
                      ) : (
                        <View style={styles.previewLoading}>
                          <ActivityIndicator size="small" color="#4a90e2" />
                        </View>
                      )}
                      {linkPreviews[link.url]?.siteName && (
                        <View style={styles.siteNameBadge}>
                          <Text style={styles.siteNameText}>
                            {linkPreviews[link.url].siteName}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Text content positioned on the right */}
                    <View style={[styles.linkContent, designStyles.linkContent]}>
                      <View style={[
                        styles.linkTextContainer,
                        currentDesign === 'classic' && {
                          overflow: 'hidden',
                          justifyContent: 'center',
                          maxWidth: '100%',
                          flexShrink: 1,
                        }
                      ]}>
                        {editingLinkIndex === index ? (
                          <View style={styles.editingContainer}>
                            <TextInput
                              id={`edit-title-input-${index}`}
                              name={`edit-title-${index}`}
                              style={styles.linkTitleInput}
                              value={editingTitle}
                              onChangeText={setEditingTitle}
                              accessibilityLabel="Edit link title"
                              accessibilityHint="Enter a new title for this link"
                              onBlur={() => {
                                // Don't auto-save on blur - only save when user explicitly clicks check button
                                // setEditingLinkIndex(null);
                              }}
                              onSubmitEditing={() => {
                                if (editingTitle.trim() && editingTitle !== link.title) {
                                  updateLinkTitle(index);
                                }
                                setEditingLinkIndex(null);
                              }}
                              autoFocus
                              placeholder="Enter title"
                              placeholderTextColor="#666"
                              returnKeyType="done"
                            />
                            <Text style={styles.editingHint}>
                              {isUpdatingTitle ? 'Saving...' : 'Press ✓ to save, ✕ to cancel, or ↻ to restore original title'}
                            </Text>
                          </View>
                        ) : (
                          <Text style={designStyles.linkTitle} numberOfLines={2}>
                            {getDisplayTitle(link, linkPreviews[link.url])}
                          </Text>
                        )}
                        {currentDesign !== 'classic' && (
                          <Text style={designStyles.linkUrl} numberOfLines={1}>{link.url}</Text>
                        )}
                        {currentDesign !== 'classic' && linkPreviews[link.url]?.description && (
                          <Text style={[styles.linkDescription, designStyles.linkDescription]} numberOfLines={3}>
                            {linkPreviews[link.url].description}
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Action buttons - conditional based on design */}
                  {currentDesign === 'minimal' ? (
                    // Minimal design - only show editing buttons when in edit mode
                    editingLinkIndex === index && (
                      <View style={[styles.linkActions, designStyles.linkActions]} pointerEvents="auto">
                        <TouchableOpacity 
                          style={[styles.editButton, designStyles.editButton]}
                          onPress={() => {
                            if (editingLinkIndex === index) {
                              // Save the changes
                              updateLinkTitle(index);
                            } else {
                              // Start editing
                              setEditingLinkIndex(index);
                              // Use the same logic as display: custom title > preview title > URL
                              setEditingTitle(getDisplayTitle(link, linkPreviews[link.url]));
                            }
                          }}
                          disabled={isUpdatingTitle}
                        >
                          {isUpdatingTitle && editingLinkIndex === index ? (
                            <ActivityIndicator size="small" color="#4CAF50" />
                          ) : (
                            <MaterialIcons 
                              name={editingLinkIndex === index ? "check" : "edit"} 
                              size={20} 
                              color={editingLinkIndex === index ? "#4CAF50" : "#4a90e2"} 
                            />
                          )}
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={[styles.refreshEditButton, designStyles.editButton]}
                          onPress={async () => {
                            console.log('Refresh button pressed!');
                            try {
                              showSuccessMessage('Re-fetching original title...');
                              
                              // Fetch only the title from the web
                              const freshTitle = await fetchLinkTitleOnly(link.url);
                              
                              if (freshTitle) {
                                // Update the edit field with the fresh title
                                setEditingTitle(freshTitle);
                                showSuccessMessage('Original title restored!');
                              } else {
                                // If we couldn't fetch a fresh title, restore the cached one
                                const cachedTitle = getDisplayTitle(link, linkPreviews[link.url]);
                                setEditingTitle(cachedTitle);
                                showSuccessMessage('Using cached title');
                              }
                              
                            } catch (error) {
                              console.error('Error re-fetching title:', error);
                              // Fallback to cached title
                              const cachedTitle = getDisplayTitle(link, linkPreviews[link.url]);
                              setEditingTitle(cachedTitle);
                              showSuccessMessage('Failed to re-fetch, using cached title');
                            }
                          }}
                          activeOpacity={0.7}
                          pointerEvents="auto"
                        >
                          <MaterialIcons name="refresh" size={20} color="#4a90e2" />
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={[styles.cancelEditButton, designStyles.editButton]}
                          onPress={() => {
                            console.log('Cancel button pressed!');
                            setEditingLinkIndex(null);
                            setEditingTitle('');
                          }}
                          activeOpacity={0.7}
                          pointerEvents="auto"
                        >
                          <MaterialIcons name="close" size={20} color="#FF4444" />
                        </TouchableOpacity>
                      </View>
                    )
                  ) : (
                    // Original action buttons for classic, modern, and grid designs
                    <View style={[styles.linkActions, designStyles.linkActions]} pointerEvents={editingLinkIndex === index ? "auto" : "auto"}>
                      {currentDesign === 'classic' ? (
                        // Classic design: Three-dot menu
                        <View style={styles.classicMenuContainer}>
                          <TouchableOpacity 
                            style={[
                              styles.threeDotButton,
                              pressedButtonIndex === index && styles.threeDotButtonPressed
                            ]}
                            onPress={(event) => toggleMenu(index, event)}
                            onPressIn={() => setPressedButtonIndex(index)}
                            onPressOut={() => setPressedButtonIndex(null)}
                            activeOpacity={0.7}
                          >
                            <MaterialIcons name="more-vert" size={18} color="#6c757d" />
                          </TouchableOpacity>
                          
                        </View>
                      ) : (
                        // Modern and Grid designs: Individual buttons
                        <>
                          <TouchableOpacity 
                            style={[styles.editButton, designStyles.editButton]}
                            onPress={() => {
                              if (editingLinkIndex === index) {
                                // Save the changes
                                updateLinkTitle(index);
                              } else {
                                // Start editing
                                setEditingLinkIndex(index);
                                // Use the same logic as display: custom title > preview title > URL
                                setEditingTitle(getDisplayTitle(link, linkPreviews[link.url]));
                              }
                            }}
                            disabled={isUpdatingTitle}
                          >
                            {isUpdatingTitle && editingLinkIndex === index ? (
                              <ActivityIndicator size="small" color="#4CAF50" />
                            ) : (
                              <MaterialIcons 
                                name={editingLinkIndex === index ? "check" : "edit"} 
                                size={20} 
                                color={editingLinkIndex === index ? "#4CAF50" : "#4a90e2"} 
                              />
                            )}
                          </TouchableOpacity>
                          
                          {/* Hide other buttons when editing in modern and grid designs (but not classic) */}
                          {!(currentDesign !== 'classic' && editingLinkIndex === index) && (
                            <>
                              <TouchableOpacity 
                                style={[styles.deleteButton, designStyles.deleteButton]}
                                onPress={() => deleteLink(index)}
                              >
                                <MaterialIcons name="delete" size={20} color="#FF4444" />
                              </TouchableOpacity>
                              <TouchableOpacity 
                                style={[styles.customPreviewButton, designStyles.editButton]}
                                onPress={() => openCustomPreviewEditor(index)}
                              >
                                <MaterialIcons name="image" size={20} color="#9C27B0" />
                              </TouchableOpacity>
                              <TouchableOpacity 
                                onPress={() => handleShareLink(link.url, getDisplayTitle(link, linkPreviews[link.url]))}
                                style={[styles.openButton, designStyles.openButton]}
                              >
                                <MaterialIcons name="share" size={20} color="#4a90e2" />
                              </TouchableOpacity>
                            </>
                          )}
                          
                          {editingLinkIndex === index && (
                            // Show editing buttons: Refresh, Cancel
                            <>
                              <TouchableOpacity 
                                style={[styles.refreshEditButton, designStyles.editButton]}
                                onPress={async () => {
                                  console.log('Refresh button pressed!');
                                  try {
                                    showSuccessMessage('Re-fetching original title...');
                                    
                                    // Fetch only the title from the web
                                    const freshTitle = await fetchLinkTitleOnly(link.url);
                                    
                                    if (freshTitle) {
                                      // Update the edit field with the fresh title
                                      setEditingTitle(freshTitle);
                                      showSuccessMessage('Original title restored!');
                                    } else {
                                      // If we couldn't fetch a fresh title, restore the cached one
                                      const cachedTitle = getDisplayTitle(link, linkPreviews[link.url]);
                                      setEditingTitle(cachedTitle);
                                      showSuccessMessage('Using cached title');
                                    }
                                    
                                  } catch (error) {
                                    console.error('Error re-fetching title:', error);
                                    // Fallback to cached title
                                    const cachedTitle = getDisplayTitle(link, linkPreviews[link.url]);
                                    setEditingTitle(cachedTitle);
                                    showSuccessMessage('Failed to re-fetch, using cached title');
                                  }
                                }}
                                activeOpacity={0.7}
                                pointerEvents="auto"
                              >
                                <MaterialIcons name="refresh" size={20} color="#4a90e2" />
                              </TouchableOpacity>
                              
                              <TouchableOpacity 
                                style={[styles.cancelEditButton, designStyles.editButton]}
                                onPress={() => {
                                  console.log('Cancel button pressed!');
                                  setEditingLinkIndex(null);
                                  setEditingTitle('');
                                }}
                                activeOpacity={0.7}
                                pointerEvents="auto"
                              >
                                <MaterialIcons name="close" size={20} color="#FF4444" />
                              </TouchableOpacity>
                            </>
                          )}
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Global Dropdown Menu - rendered outside ScrollView to prevent clipping */}
      {activeMenuIndex !== null && selectedLinkForMenu !== null && (
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          activeOpacity={1}
          onPress={closeMenu}
        >
          <View 
            style={[
              styles.classicDropdownMenu,
              {
                position: 'absolute',
                top: dropdownMenuPosition.y,
                left: dropdownMenuPosition.x,
                zIndex: 9999,
              }
            ]}
          >
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                if (editingLinkIndex === selectedLinkForMenu) {
                  setEditingLinkIndex(null);
                  setEditingTitle('');
                } else {
                  setEditingLinkIndex(selectedLinkForMenu);
                  const link = getDisplayedLinks()[selectedLinkForMenu];
                  setEditingTitle(getDisplayTitle(link, linkPreviews[link.url]));
                }
                closeMenu();
              }}
            >
              <MaterialIcons name="edit" size={18} color="#4a90e2" />
              <Text style={styles.menuItemText}>Edit</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                deleteLink(selectedLinkForMenu);
                closeMenu();
              }}
            >
              <MaterialIcons name="delete" size={18} color="#FF4444" />
              <Text style={styles.menuItemText}>Delete</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                const link = getDisplayedLinks()[selectedLinkForMenu];
                handleShareLink(link.url, getDisplayTitle(link, linkPreviews[link.url]));
                closeMenu();
              }}
            >
              <MaterialIcons name="share" size={18} color="#4a90e2" />
              <Text style={styles.menuItemText}>Share</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                openCustomPreviewEditor(selectedLinkForMenu);
                closeMenu();
              }}
            >
              <MaterialIcons name="image" size={18} color="#9C27B0" />
              <Text style={styles.menuItemText}>Customize Preview</Text>
            </TouchableOpacity>
            
            <View style={styles.menuDivider} />
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={closeMenu}
            >
              <MaterialIcons name="close" size={18} color="#666" />
              <Text style={styles.menuItemText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* Minimal Link Dropdown Menu */}
      {linkDropdownVisible && selectedLinkForDropdown && (
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          activeOpacity={1}
          onPress={closeLinkDropdown}
        >
          <View 
            style={[
              styles.minimalLinkDropdown,
              {
                position: 'absolute',
                top: linkDropdownPosition.y,
                left: linkDropdownPosition.x,
                zIndex: 9999,
              }
            ]}
          >
            <TouchableOpacity 
              style={styles.minimalMenuItem}
              onPress={() => {
                handleLinkPress(selectedLinkForDropdown.link.url);
                closeLinkDropdown();
              }}
            >
              <MaterialIcons name="open-in-new" size={20} color="#4a90e2" />
              <Text style={styles.minimalMenuItemText}>Open Link</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.minimalMenuItem}
              onPress={() => {
                // Open link preferences (edit mode)
                setEditingLinkIndex(selectedLinkForDropdown.index);
                setEditingTitle(getDisplayTitle(selectedLinkForDropdown.link, linkPreviews[selectedLinkForDropdown.link.url]));
                closeLinkDropdown();
              }}
            >
              <MaterialIcons name="settings" size={20} color="#FF9800" />
              <Text style={styles.minimalMenuItemText}>Link Preferences</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.minimalMenuItem}
              onPress={() => {
                handleShareLink(selectedLinkForDropdown.link.url, getDisplayTitle(selectedLinkForDropdown.link, linkPreviews[selectedLinkForDropdown.link.url]));
                closeLinkDropdown();
              }}
            >
              <MaterialIcons name="share" size={20} color="#4CAF50" />
              <Text style={styles.minimalMenuItemText}>Share</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      <Modal
        visible={isTitleModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsTitleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Title</Text>
            <TextInput
              id="modal-title-input"
              name="modal-title"
              style={styles.modalInput}
              value={titleInput}
              onChangeText={setTitleInput}
              placeholder="Enter new title"
              placeholderTextColor="#a9a9a9"
              textAlign="left"
              accessibilityLabel="Enter new title"
              accessibilityHint="Type a new title for your link"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => {
                  setIsTitleModalVisible(false);
                  setTitleInput('');
                  setEditingLinkIndex(null);
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]} 
                onPress={updateLinkTitle}
              >
                <Text style={[styles.buttonText, styles.saveButtonText]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Design Selector Dropdown */}
      {isDesignSelectorVisible && (
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          activeOpacity={1}
          onPress={() => setIsDesignSelectorVisible(false)}
        >
          <View 
            style={[
              styles.designDropdownContent,
              {
                top: dropdownPosition.y + 40,
                left: Math.max(10, dropdownPosition.x - 110),
              }
            ]}
          >
            {Object.entries(designs).map(([designKey, design]) => (
              <TouchableOpacity
                key={designKey}
                style={[
                  styles.designDropdownItem,
                  currentDesign === designKey && styles.designDropdownItemActive
                ]}
                onPress={() => changeDesign(designKey)}
              >
                <View style={styles.designDropdownItemHeader}>
                  <MaterialIcons 
                    name="palette" 
                    size={18} 
                    color={currentDesign === designKey ? "#4a90e2" : "#666"} 
                  />
                  <Text style={[
                    styles.designDropdownItemTitle,
                    currentDesign === designKey && styles.designDropdownItemTitleActive
                  ]}>
                    {design.name}
                  </Text>
                  {currentDesign === designKey && (
                    <MaterialIcons name="check-circle" size={18} color="#4CAF50" />
                  )}
                </View>
                <Text style={[
                  styles.designDropdownItemDescription,
                  currentDesign === designKey && styles.designDropdownItemDescriptionActive
                ]}>
                  {design.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      )}

      {/* Custom Preview Editor Modal */}
      <Modal
        visible={isCustomPreviewModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsCustomPreviewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.customPreviewModal}>
            <View style={styles.customPreviewHeader}>
              <Text style={styles.customPreviewTitle}>Customize Preview</Text>
              <TouchableOpacity 
                onPress={() => setIsCustomPreviewModalVisible(false)}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.customPreviewContent}>
              {/* Image Section */}
              <View style={styles.customPreviewSection}>
                <View style={styles.sectionTitleContainer}>
                  <Text style={styles.customPreviewSectionTitle}>Preview Image</Text>
                  <TouchableOpacity 
                    style={styles.refetchButton}
                    onPress={refetchOriginalPreview}
                    disabled={isRefetchingPreview}
                  >
                    {isRefetchingPreview ? (
                      <ActivityIndicator size="small" color="#4a90e2" />
                    ) : (
                      <>
                        <MaterialIcons name="refresh" size={18} color="#4a90e2" />
                        <Text style={styles.refetchButtonText}>Refetch Original</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity 
                  style={styles.imageSelectorButton}
                  onPress={handleImageSelection}
                >
                  {customPreviewData.image ? (
                    <Image 
                      source={{ uri: customPreviewData.image }} 
                      style={styles.previewImageThumbnail}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <MaterialIcons name="add-photo-alternate" size={48} color="#ccc" />
                      <Text style={styles.imagePlaceholderText}>Tap to add image</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <Text style={styles.imageHintText}>
                  Take a screenshot of the content or upload your own image
                </Text>
              </View>

              {/* Title Section */}
              <View style={styles.customPreviewSection}>
                <Text style={styles.customPreviewSectionTitle}>Title</Text>
                <TextInput
                  id="custom-preview-title-input"
                  name="custom-preview-title"
                  style={styles.customPreviewInput}
                  value={customPreviewData.title}
                  onChangeText={(text) => setCustomPreviewData(prev => ({ ...prev, title: text }))}
                  placeholder="Enter custom title"
                  placeholderTextColor="#999"
                  multiline
                  accessibilityLabel="Custom preview title"
                  accessibilityHint="Enter a custom title for your link preview"
                />
              </View>

              {/* Description Section */}
              <View style={styles.customPreviewSection}>
                <Text style={styles.customPreviewSectionTitle}>Description</Text>
                <TextInput
                  id="custom-preview-description-input"
                  name="custom-preview-description"
                  style={[styles.customPreviewInput, styles.descriptionInput]}
                  value={customPreviewData.description}
                  onChangeText={(text) => setCustomPreviewData(prev => ({ ...prev, description: text }))}
                  placeholder="Enter custom description"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                  accessibilityLabel="Custom preview description"
                  accessibilityHint="Enter a custom description for your link preview"
                />
              </View>
            </ScrollView>

            <View style={styles.customPreviewActions}>
              <TouchableOpacity 
                style={[styles.customPreviewButton, styles.cancelButton]}
                onPress={() => setIsCustomPreviewModalVisible(false)}
              >
                <Text style={styles.customPreviewButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.customPreviewButton, styles.saveButton]}
                onPress={saveCustomPreview}
              >
                <Text style={[styles.customPreviewButtonText, styles.saveButtonText]}>Save Preview</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Error Dialog removed - not needed for normal operations */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  imageContainer: {
    position: 'relative',
    height: 280, // Increased height to accommodate status bar area
  },
  collectionImage: {
    width: '100%',
    height: '100%',
  },
  statusBarArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 25, // Cover the Android system status bar area
    backgroundColor: 'rgba(0,0,0,0.9)', // Black background for status bar
    zIndex: 15,
  },
  headerLine: {
    position: 'absolute',
    top: 25, // Start just below the Android system status bar
    left: 0,
    right: 0,
    height: 50, // Normal height for navigation header
    backgroundColor: 'rgba(0,0,0,0.7)', // Darker background for better system icon visibility
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    zIndex: 1,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  collectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
    textAlign: 'center',
  },
  contentContainer: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'column',
    marginBottom: 20,
    gap: 8,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    justifyContent: 'flex-start',
  },
  iconContainer: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightSection: {
    flexDirection: 'column',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 4,
    flexShrink: 1,
    lineHeight: 24,
    textAlignVertical: 'center',
  },
  linkInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  inputFieldsContainer: {
    flex: 1,
    marginRight: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
  },
  linkInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 18,
    fontSize: 16,
    color: '#333',
    textAlign: 'left',
  },
  addButtonContainer: {
    // Container to prevent keyboard dismissal interference
  },
  addButton: {
    width: 56,
    height: 56,
    backgroundColor: '#4a90e2',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  addButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0.1,
  },
  linksContainer: {
    marginTop: 10,
  },
  gridLinksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 8,
  },
  linkItem: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  linkItemEditing: {
    backgroundColor: '#f0f0f0',
    borderColor: '#4a90e2',
    borderWidth: 2,
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  linkMainContent: {
    flex: 1,
    marginBottom: 12,
  },
  linkContent: {
    marginTop: 12,
  },
  linkIcon: {
    marginRight: 10,
  },
  linkTextContainer: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    lineHeight: 24,
  },
  linkUrl: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 18,
  },
  linkDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  linkActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  editButton: {
    padding: 6,
    marginRight: 6,
    backgroundColor: 'transparent',
    borderRadius: 4,
  },
  deleteButton: {
    padding: 6,
    marginRight: 6,
    backgroundColor: 'transparent',
    borderRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    marginHorizontal: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'left',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    fontSize: 16,
    textAlign: 'left',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  saveButton: {
    backgroundColor: '#4a90e2',
  },
  buttonText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  saveButtonText: {
    color: 'white',
  },
  sortButtonsContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    padding: 6,
    justifyContent: 'space-between',
    width: '100%',
  },
  sortButton: {
    padding: 12,
    marginHorizontal: 2,
    borderRadius: 18,
    backgroundColor: 'transparent',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortButtonActive: {
    backgroundColor: '#4a90e2',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 4,
    paddingHorizontal: 0,
    margin: 0,
    outlineStyle: 'none',
    borderWidth: 0,
  },
  clearSearchButton: {
    padding: 4,
    marginLeft: 4,
  },
  reverseIcon: {
    transform: [{ rotate: '180deg' }],
  },
  linkTitleInput: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    padding: 0,
    margin: 0,
    borderWidth: 0,
    textAlign: 'left',
  },
  editingContainer: {
    flex: 1,
  },
  editingHint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  openButton: {
    padding: 6,
    marginRight: 6,
    backgroundColor: 'transparent',
    borderRadius: 4,
  },
  cancelEditButton: {
    padding: 8,
    marginRight: 8,
    backgroundColor: 'transparent',
    borderRadius: 6,
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveEditButton: {
    padding: 8,
    marginRight: 8,
    backgroundColor: 'transparent',
    borderRadius: 6,
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshEditButton: {
    padding: 8,
    marginRight: 8,
    backgroundColor: 'transparent',
    borderRadius: 6,
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  previewPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  previewLoading: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  siteNameBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  siteNameText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  previewText: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  siteName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  previewDescription: {
    fontSize: 12,
    color: '#fff',
    marginTop: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  designChangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginLeft: 8,
    borderWidth: 0.5,
    borderColor: '#4a90e2',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    height: 44,
    justifyContent: 'center',
    flexShrink: 1,
    minWidth: 80,
  },
  designChangeText: {
    marginLeft: 8,
    marginRight: 6,
    fontSize: 15,
    fontWeight: '600',
    color: '#4a90e2',
    flexShrink: 1,
  },

  classicMenuContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  threeDotButton: {
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  threeDotButtonPressed: {
    backgroundColor: '#e9ecef',
    borderColor: '#dee2e6',
    shadowOpacity: 0.1,
    elevation: 3,
  },
  classicDropdownMenu: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
    minWidth: 140,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  menuItemText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#333',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  // Minimal Link Dropdown Styles
  minimalLinkDropdown: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  minimalMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  minimalMenuItemText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  designDropdownContent: {
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 8,
    width: 220,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  designDropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  designDropdownItemActive: {
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
  },
  designDropdownItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  designDropdownItemTitle: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  designDropdownItemTitleActive: {
    color: '#4a90e2',
  },
  designDropdownItemDescription: {
    fontSize: 12,
    color: '#666',
    marginLeft: 26,
    lineHeight: 16,
  },
  designDropdownItemDescriptionActive: {
    color: '#4a90e2',
  },
  successToast: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: '#4CAF50',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  successText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    textAlign: 'center',
  },
  retryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    borderWidth: 1,
    borderColor: '#4a90e2',
  },
  retryText: {
    color: '#4a90e2',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  customPreviewButton: {
    padding: 8,
    marginRight: 8,
    backgroundColor: 'transparent',
    borderRadius: 8,
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customPreviewModal: {
    backgroundColor: 'white',
    borderRadius: 20,
    margin: 20,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  customPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  customPreviewTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  customPreviewContent: {
    padding: 20,
    maxHeight: 400,
  },
  customPreviewSection: {
    marginBottom: 24,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  customPreviewSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  refetchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f3ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4a90e2',
    gap: 4,
  },
  refetchButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4a90e2',
    marginLeft: 4,
  },
  imageSelectorButton: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
  },
  previewImageThumbnail: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  imageHintText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  customPreviewInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
  },
  descriptionInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  customPreviewActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  customPreviewButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  saveButton: {
    backgroundColor: '#9C27B0',
  },
  customPreviewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
}); 