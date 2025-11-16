import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Image, StyleSheet, SafeAreaView, ScrollView, TextInput, TouchableOpacity, Linking, Modal, ActivityIndicator, StatusBar, Keyboard, Share, Animated, Platform, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { db } from '../services/firebase/Config';
import { useTheme } from '../ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ToastMessage from '../components/ToastMessage';
import { showAppDialog } from '../context/DialogContext';
import { doc, updateDoc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { fetchEnhancedMetadata } from '../utils/SocialMediaFetcher';
import { fetchLinkPreview as fetchLinkPreviewNew } from '../fetchers';
import { extractYouTubeVideoId } from '../fetchers/YouTubeFetcher';
import { auth } from '../services/firebase/Config';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageAsync } from '../services/cloudinary/imageUpload.js';
import { onAuthStateChanged } from 'firebase/auth';
import { sharedLinkLayoutStyles, getLinkDesignStyles, LINK_LAYOUT_CONSTANTS } from './LinksLayoutDesign';

const debugLog = (...args) => {
  if (__DEV__ && false) {
    console.log(...args);
  }
};

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

const normalizeSiteName = (siteName, url) => {
  const fallback = siteName || (url ? getSiteNameFromUrl(url) : '');
  const lower = (fallback || '').toLowerCase();

  if (lower.includes('tiktok')) return 'TikTok';

  return fallback;
};

const selectPreferredLanguageSegment = (text) => {
  if (!text) {
    return text;
  }

  const segments = text
    .split(/\n+/)
    .map(segment => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return text.trim();
  }

  const scoreSegment = (segment) => {
    const latinChars = (segment.match(/[A-Za-z]/g) || []).length;
    const nonLatinChars = (segment.match(/[\u0400-\u052F\u0590-\u05FF\u0600-\u06FF\u4E00-\u9FFF]/g) || []).length;
    const totalLetters = latinChars + nonLatinChars;
    if (latinChars === 0 && nonLatinChars === 0) {
      return 0;
    }
    if (latinChars === 0) {
      return 0;
    }
    if (totalLetters === 0) {
      return 0;
    }
    const ratio = latinChars / totalLetters;
    return ratio;
  };

  const preferredSegment = segments.find(segment => {
    const score = scoreSegment(segment);
    const latinCount = (segment.match(/[A-Za-z]/g) || []).length;
    return score >= 0.6 || latinCount >= 16;
  });

  const cleaned = (preferredSegment || segments[0]).replace(/[•·]+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : text.trim();
};

const sanitizePreviewText = (text) => {
  if (!text) {
    return text;
  }
  return selectPreferredLanguageSegment(text);
};

const resolvePreviewTitle = (rawTitle, fallback = 'Untitled') => {
  const sanitized = sanitizePreviewText(rawTitle);
  if (sanitized && sanitized.length >= 3) {
    const trimmedRaw = (rawTitle || '').trim();
    const containsLatin = /[A-Za-z]/.test(trimmedRaw);
    const containsNonLatin = /[\u0590-\u05FF\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u3040-\u30FF\u4E00-\u9FFF]/.test(trimmedRaw);

    if (containsLatin && containsNonLatin && sanitized !== trimmedRaw) {
      const rawSegments = trimmedRaw
        .split(/\n+/)
        .map(segment => segment.trim())
        .filter(Boolean);

      const nonLatinSegment = rawSegments.find(segment => /[\u0590-\u05FF\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u3040-\u30FF\u4E00-\u9FFF]/.test(segment));

      if (nonLatinSegment) {
        const condensed = nonLatinSegment.replace(/\s+/g, ' ');
        const snippet = condensed.length > 40 ? `${condensed.slice(0, 37)}…` : condensed;
        if (snippet && !sanitized.toLowerCase().includes(snippet.toLowerCase())) {
          return `${sanitized} · ${snippet}`;
        }
      }
    }

    return sanitized;
  }
  if (rawTitle && rawTitle.trim().length > 0) {
    return rawTitle.trim();
  }
  return fallback;
};

const resolvePreviewDescription = (rawDescription) => {
  const sanitized = sanitizePreviewText(rawDescription);
  if (sanitized && sanitized.length >= 3) {
    return sanitized;
  }
  return rawDescription ? rawDescription.trim() : '';
};

const normalizeSearchText = (text) => {
  if (!text) {
    return '';
  }

  let working = String(text);

  try {
    working = working.normalize('NFKC');
    working = working.replace(/[\u0300-\u036f]/g, '');
  } catch (error) {
    // Some environments may not support String.normalize; ignore gracefully.
  }

  working = working
    .toLocaleLowerCase(undefined)
    .replace(/[\s\u00A0]+/g, ' ')
    .trim();

  return working;
};

const buildTitleCandidates = (link, preview) => {
  const candidates = [];

  if (link?.customTitle && link.customTitle.trim()) {
    candidates.push(link.customTitle.trim());
  }

  if (preview?.title && preview.title.trim() && preview.title !== 'Loading preview...') {
    candidates.push(preview.title.trim());
  }

  if (link?.title && link.title.trim() && link.title !== link.url) {
    candidates.push(link.title.trim());
  }

  if (preview?.siteName && preview.siteName.trim()) {
    candidates.push(preview.siteName.trim());
  }

  return candidates.filter(Boolean);
};

// Aspect detection for modern design
const isYouTubeLandscape = (url) => {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    if (h.includes('youtube.com')) {
      const path = u.pathname.toLowerCase();
      if (path.startsWith('/shorts')) return false; // portrait, not landscape
      return path.startsWith('/watch') || Boolean(u.searchParams.get('v'));
    }
    if (h.includes('youtu.be')) return true; // default to landscape
    return false;
  } catch (_) {
    return false;
  }
};

const isPortraitThreeFour = (url) => {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    if (h.includes('tiktok.com')) return true;
    if (h.includes('instagram.com')) {
      const p = u.pathname.toLowerCase();
      // Reels/Stories style content is portrait
      if (p.includes('/reel') || p.includes('/reels') || p.includes('/stories')) return true;
      // Standard Instagram posts
      if (p.includes('/p/')) return true;
      if (p.includes('/tv/')) return true;
      // Fallback: certain shared URLs use query params to identify reels
      const hasReelQuery = Array.from(u.searchParams.keys()).some((key) => key.toLowerCase().includes('reel')); 
      if (hasReelQuery) return true;
      const hasPostQuery = Array.from(u.searchParams.keys()).some((key) => key.toLowerCase().includes('post'));
      if (hasPostQuery) return true;
    }
    // YouTube Shorts
    if (h.includes('youtube.com') && u.pathname.toLowerCase().startsWith('/shorts')) return true;
    return false;
  } catch (_) {
    return false;
  }
};

const isInstagramStandardPost = (url) => {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    if (!h.includes('instagram.com')) return false;

    const p = u.pathname.toLowerCase();
    if (p.includes('/p/')) return true;
    if (p.includes('/tv/')) return true;

    const hasPostQuery = Array.from(u.searchParams.keys()).some((key) => key.toLowerCase().includes('post'));
    if (hasPostQuery) return true;

    return false;
  } catch (_) {
    return false;
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
    const siteName = normalizeSiteName(getSiteNameFromUrl(url), url);
    
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
    
    debugLog('Generated fallback preview:', preview);
    return preview;
  } catch (error) {
    debugLog('Failed to generate fallback preview:', error.message);
    return null;
  }
};

export default function CollectionFormat({ route, navigation }) {
  const { collection } = route.params;
  const { isDarkMode, themeMode, getBackgroundColor } = useTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const transitionFast = route.params?.transitionFast === true;
  // Start fully visible for instant display
  const entryOpacity = useRef(new Animated.Value(1)).current;
  
  const screenBackgroundColor = getBackgroundColor();
  const themedColors = useMemo(() => {
    switch (themeMode) {
      case 'gray':
        return {
          background: screenBackgroundColor,
          surface: '#1a1a1a',
          elevated: '#242424',
          actionButton: '#2a2a2a',
          input: '#1f1f1f',
          border: 'rgba(255, 255, 255, 0.12)',
          textPrimary: '#ffffff',
          textSecondary: '#d0d0d0',
          textMuted: '#999999',
        };
      case 'black':
        return {
          background: screenBackgroundColor,
          surface: '#000000',
          elevated: '#111111',
          actionButton: '#151515',
          input: '#0d0d0d',
          border: 'rgba(255, 255, 255, 0.16)',
          textPrimary: '#ffffff',
          textSecondary: '#d0d0d0',
          textMuted: '#aaaaaa',
        };
      default:
        return {
          background: '#ffffff', // Pure white for light mode
          surface: '#ffffff',
          elevated: '#f8f9fa',
          actionButton: '#f8f9fa',
          input: '#ffffff',
          border: 'rgba(0, 0, 0, 0.08)',
          textPrimary: '#333333',
          textSecondary: '#666666',
          textMuted: '#999999',
        };
    }
  }, [screenBackgroundColor, themeMode]);
  
  // Safety check - if collection is not provided, return early
  if (!collection || !collection.id) {
    console.error('Collection data missing in route params:', route.params);
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: getBackgroundColor() }}>
        <Text style={{ color: isDarkMode ? '#ffffff' : '#333', fontSize: 16 }}>Collection data is missing. Please go back and try again.</Text>
      </View>
    );
  }
  
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
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [currentCollection, setCurrentCollection] = useState(collection);
  const [linkPreviews, setLinkPreviews] = useState({});
  const [loadingPreviews, setLoadingPreviews] = useState({});
  const [processedLinks, setProcessedLinks] = useState(new Set()); // Track which links have been processed
  const [currentError, setCurrentError] = useState(null);
  const [isErrorDialogVisible, setIsErrorDialogVisible] = useState(false);
  
  // Preview server URL from app.json or environment
  const PREVIEW_SERVER_URL = 
    (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_PREVIEW_SERVER_URL) ||
    (__DEV__ ? 'http://localhost:3000' : null); // Use localhost for development
  
  // Log collection data only once on mount (no render-loop spam)
  useEffect(() => {
    // No fade-in animation - content displays instantly
    entryOpacity.setValue(1);
  }, []); // Empty deps = only on mount
  
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
              debugLog('Loaded user API tokens:', userData.apiTokens);
            }
          }
        }
      } catch (error) {
        debugLog('Error loading user tokens:', error.message);
      }
    };
    
    loadUserTokens();
  }, []);

  // Load cached previews from AsyncStorage INSTANTLY (no loading!), then sync Firebase in background
  useEffect(() => {
    const loadCachedPreviews = async () => {
      const safeLinks = links || [];
      if (safeLinks.length === 0) {
        return;
      }
      
      try {
        // STEP 1: Load from AsyncStorage FIRST (instant, no network)
        const localCacheKey = 'linkPreviewsCache';
        const localCacheStr = await AsyncStorage.getItem(localCacheKey);
        const instantPreviews = {}; // Declare outside the if block so it's accessible
        const instantLinks = [];
        
        if (localCacheStr) {
          try {
            const localCache = JSON.parse(localCacheStr);
            
            safeLinks.forEach(link => {
              if (link.url && localCache[link.url]) {
                instantPreviews[link.url] = localCache[link.url];
                instantLinks.push(link.url);
              }
            });
            
            // Show cached previews IMMEDIATELY (no loading spinner!)
            if (Object.keys(instantPreviews).length > 0) {
              setLinkPreviews(instantPreviews);
              setProcessedLinks(new Set(instantLinks));
            }
          } catch (e) {
            // Local cache corrupted, clear it
            await AsyncStorage.removeItem(localCacheKey);
          }
        }
        
        // STEP 2: Only sync from Firestore if we don't have it in AsyncStorage
        // This prevents unnecessary Firebase reads when AsyncStorage already has the data
        const linksNeedingFirestore = safeLinks.filter(link => {
          // Only fetch from Firestore if we don't have this URL in AsyncStorage
          return link.url && !instantPreviews[link.url];
        });
        
        if (linksNeedingFirestore.length > 0) {
          const cachedPreviews = {};
          
          const previewPromises = linksNeedingFirestore.map(async (link) => {
            if (!link.url) return;
            
            try {
              const safeDocId = encodeURIComponent(link.url.trim()).replace(/[^a-zA-Z0-9]/g, '_');
              const docRef = doc(db, 'linkPreviews', safeDocId);
              const docSnap = await getDoc(docRef);
              
              if (docSnap.exists()) {
                const previewData = docSnap.data();
                
                const isBrokenCache = !previewData.title || 
                                     previewData.title === 'Loading preview...' ||
                                     previewData.title === 'Preview unavailable';
                
                if (!isBrokenCache) {
                  cachedPreviews[link.url] = previewData;
                }
              }
            } catch (error) {
              // Silently fail
            }
          });
          
          await Promise.all(previewPromises);
          
          // Update local cache for next time (only the new ones)
          if (Object.keys(cachedPreviews).length > 0) {
            const existingCacheStr = await AsyncStorage.getItem(localCacheKey);
            const existingCache = existingCacheStr ? JSON.parse(existingCacheStr) : {};
            Object.assign(existingCache, cachedPreviews);
            await AsyncStorage.setItem(localCacheKey, JSON.stringify(existingCache));
            
            // Only update state if we got new previews
            setLinkPreviews(prev => ({ ...prev, ...cachedPreviews }));
          }
        }
        
      } catch (error) {
        // Silently fail
      }
    };
    
    loadCachedPreviews();
  }, [linksSignature]);

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
          debugLog('Fresh data from Firebase:', freshData);
          setCurrentCollection({ ...freshData, id: collection.id }); // Ensure ID is preserved
          
          // Note: Design preference is already set from collection prop, 
          // so we don't need to reload it here to avoid flashing
        } else {
          // Document missing; nothing to update
        }
      } catch (error) {
        console.error('Error refreshing collection data:', error);
      }
    };
    
    refreshCollectionData();
  }, [collection.id]);
  
  // Handle both old and new data formats with deduplication
  const initializeLinks = (listLink) => {
    if (!listLink || !Array.isArray(listLink) || listLink.length === 0) {
      return [];
    }
    
    const processedLinks = listLink.map((link) => {
      // If link is a string (old format), convert to new format
      if (typeof link === 'string') {
        const rawUrl = link.trim();
        const legacyTimestamp = `legacy_${rawUrl.toLowerCase()}`;
        return {
          url: rawUrl,
          title: rawUrl,
          timestamp: legacyTimestamp,
          isFavorite: false,
          customTitle: null,
          isCustomTitle: false,
        };
      }
      // If link is already an object (new format), use as is
      const rawUrl = (link.url || link).trim();
      const legacyTimestamp = `legacy_${rawUrl.toLowerCase()}`;
      return {
        url: rawUrl,
        title: link.title || rawUrl,
        timestamp: link.timestamp || legacyTimestamp,
        isFavorite: Boolean(link.isFavorite),
        customTitle: link.customTitle || null,
        isCustomTitle: Boolean(link.isCustomTitle),
      };
    });
    
    // Deduplicate links by URL to prevent multiple API calls for same URL
    const uniqueLinks = [];
    const seenUrls = new Set();
    
    for (const link of processedLinks) {
      const normalizedUrl = link.url.trim().toLowerCase();
      if (!seenUrls.has(normalizedUrl)) {
        seenUrls.add(normalizedUrl);
        uniqueLinks.push(link);
      }
    }
    
    return uniqueLinks;
  };

  const [links, setLinks] = useState(() => {
    try {
      return initializeLinks(currentCollection?.listLink) || [];
    } catch (error) {
      debugLog('Error initializing links:', error);
      return [];
    }
  });
  
  const sortPreferenceOverrideRef = useRef(null);
  const reversePreferenceOverrideRef = useRef(null);
  
  // Stable signature of current URLs to prevent effect loops on unrelated state changes
  const linksSignature = useMemo(() => {
    try {
      const urls = (links || []).map(l => l?.url || '').filter(Boolean);
      // Sort to make signature independent of order while we only care about set membership for fetching
      urls.sort();
      return urls.join('|');
    } catch {
      return '';
    }
  }, [links]);
  const [isTitleModalVisible, setIsTitleModalVisible] = useState(false);
  const [editingLinkIndex, setEditingLinkIndex] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isUpdatingTitle, setIsUpdatingTitle] = useState(false);
  const [sortType, setSortType] = useState(collection?.sortType || 'newest'); // Initialize from collection prop
  const [isReversed, setIsReversed] = useState(collection?.isReversed || false); // Initialize from collection prop
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredLinks, setFilteredLinks] = useState([]);
  const [currentDesign, setCurrentDesign] = useState(collection?.preferredDesign || 'modern'); // Initialize from collection prop
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
  const [toastVariant, setToastVariant] = useState('success');
  const [failedPreviews, setFailedPreviews] = useState(new Set()); // Track failed previews
  const [isCustomPreviewModalVisible, setIsCustomPreviewModalVisible] = useState(false);
  const [editingPreviewIndex, setEditingPreviewIndex] = useState(null);
  const [customPreviewData, setCustomPreviewData] = useState({
    title: '',
    description: '',
    image: null
  });
  const [isRefetchingPreview, setIsRefetchingPreview] = useState(false);
  const [linkFavorites, setLinkFavorites] = useState({}); // Track favorite status for links
  const [isOptionsMenuVisible, setIsOptionsMenuVisible] = useState(false);
  const [optionsMenuPosition, setOptionsMenuPosition] = useState({ x: 0, y: 0, width: 0, height: 0, measured: false });
  // Global toggle: show action buttons on cards vs. use dropdown like minimal design
  const [actionDisplayMode, setActionDisplayMode] = useState(collection?.actionDisplayMode || 'on_card'); // Initialize from collection prop
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isSortMenuVisible, setIsSortMenuVisible] = useState(false);
  const [isDesignMenuVisible, setIsDesignMenuVisible] = useState(false);
  
  // Collection management state
  const [currentUser, setCurrentUser] = useState(null);
  const [editingCollectionId, setEditingCollectionId] = useState(null);
  const [editingCollectionTitle, setEditingCollectionTitle] = useState('');
  const [showImageSourceModal, setShowImageSourceModal] = useState(false);
  const [showThumbnailSelector, setShowThumbnailSelector] = useState(false);
  const [collectionThumbnails, setCollectionThumbnails] = useState([]);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const [updatingImage, setUpdatingImage] = useState(false);
  const [deleteConfirmModalVisible, setDeleteConfirmModalVisible] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState(null);
  const [isRestoringCollection, setIsRestoringCollection] = useState(false);
  const [isSettingsMenuVisible, setIsSettingsMenuVisible] = useState(false);
  const [editingCollectionDescription, setEditingCollectionDescription] = useState('');
  const toastTimerRef = useRef(null);
  const menuButtonRefs = useRef({});
  const optionsMenuButtonRef = useRef(null);
  const [cardActionMenu, setCardActionMenu] = useState({
    visible: false,
    index: null,
    position: { x: 0, y: 0, width: 0, height: 0 },
    design: null,
  });

  // Get current user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Update links when currentCollection changes
  useEffect(() => {
    if (currentCollection && currentCollection.listLink) {
      const initializedLinks = initializeLinks(currentCollection.listLink);

      const linksAreDifferent = (() => {
        if (!links || links.length !== initializedLinks.length) {
          return true;
        }
        for (let i = 0; i < initializedLinks.length; i++) {
          const nextLink = initializedLinks[i];
          const existingLink = links[i];
          if (!existingLink || existingLink.url !== nextLink.url || existingLink.title !== nextLink.title || existingLink.timestamp !== nextLink.timestamp) {
            return true;
          }
        }
        return false;
      })();

      if (linksAreDifferent) {
        setLinks(initializedLinks);
      }

      // Load per-collection action display preference (fallback to on_card)
      if (currentCollection.actionDisplayMode === 'dropdown' || currentCollection.actionDisplayMode === 'on_card') {
        setActionDisplayMode(currentCollection.actionDisplayMode);
      }
      
      const collectionSortType = currentCollection.sortType;
      const pendingSortOverride = sortPreferenceOverrideRef.current;

      if (collectionSortType) {
        if (!(pendingSortOverride !== null && collectionSortType !== pendingSortOverride)) {
          if (pendingSortOverride !== null && collectionSortType === pendingSortOverride) {
            sortPreferenceOverrideRef.current = null;
          }
          if (sortType !== collectionSortType) {
            setSortType(collectionSortType);
          }
        }
      }

      const collectionReversePreference = currentCollection.isReversed;
      const pendingOverride = reversePreferenceOverrideRef.current;

      if (collectionReversePreference !== undefined) {
        if (!(pendingOverride !== null && collectionReversePreference !== pendingOverride)) {
          if (pendingOverride !== null && collectionReversePreference === pendingOverride) {
            reversePreferenceOverrideRef.current = null;
          }
          if (isReversed !== collectionReversePreference) {
            setIsReversed(collectionReversePreference);
          }
        }
      }
      
      // Initialize link favorites state
      const favoritesState = {};
      initializedLinks.forEach(link => {
        if (link.isFavorite) {
          favoritesState[link.url] = true;
        }
      });
      setLinkFavorites(favoritesState);
    } else {
      setLinks([]);
      setLinkFavorites({});
    }
  }, [currentCollection, links, sortType, isReversed]);

  // Listen for selected links from SelectLinksScreen
  useEffect(() => {
    if (route.params?.selectedLinksFromMyLinks) {
      const selectedLinks = route.params.selectedLinksFromMyLinks;
      debugLog('Adding links from MyLinks to collection:', selectedLinks);
      
      // Add each selected link to the collection
      const addLinksToCollection = async () => {
        try {
          // Safety check for currentCollection
          if (!currentCollection || !currentCollection.id) {
            console.error('currentCollection or currentCollection.id is undefined:', currentCollection);
            showSuccessMessage('Error: Collection data missing. Please try again.');
            navigation.setParams({ selectedLinksFromMyLinks: undefined });
            return;
          }

          const newLinks = [];
          
          for (const link of selectedLinks) {
            // Check if this link already exists in the collection
            const linkUrl = typeof link === 'string' ? link : link.url;
            if (!linkUrl) continue;
            
            if (isDuplicateLink(linkUrl)) {
              debugLog('Skipping duplicate link:', linkUrl);
              continue;
            }

            // Format the link properly
            let formattedLink = linkUrl;
            if (!formattedLink.startsWith('http://') && !formattedLink.startsWith('https://')) {
              formattedLink = 'https://' + formattedLink;
            }

            // Prepare the link data
            const linkData = {
              url: formattedLink,
              title: link.title || link.customTitle || formattedLink,
              timestamp: new Date().toISOString(),
              customTitle: link.customTitle || null,
              isCustomTitle: Boolean(link.customTitle),
              isFavorite: Boolean(link.isFavorite)
            };

            newLinks.push(linkData);
            debugLog('Prepared link to add:', linkData.url);
          }
          
          if (newLinks.length === 0) {
            showSuccessMessage('No new links to add (duplicates skipped)');
            navigation.setParams({ selectedLinksFromMyLinks: undefined });
            return;
          }

          // Add all new links at once
          const updatedLinks = [...links, ...newLinks];
          
          // Update Firebase in a single operation
          const albumRef = doc(db, 'albums', currentCollection.id);
          await updateDoc(albumRef, {
            listLink: updatedLinks.map(link => ({
              url: link.url,
              title: link.title,
              timestamp: link.timestamp,
              customTitle: link.customTitle || null,
              isCustomTitle: Boolean(link.isCustomTitle),
              isFavorite: link.isFavorite || false
            })),
            lastModified: new Date().toISOString()
          });

          // Update local state
          setLinks(updatedLinks);
          // Immediately hydrate previews for newly added links from AsyncStorage cache
          try {
            const localCacheKey = 'linkPreviewsCache';
            const localCacheStr = await AsyncStorage.getItem(localCacheKey);
            if (localCacheStr) {
              const localCache = JSON.parse(localCacheStr);
              const cachedForNew = {};
              newLinks.forEach((l) => {
                if (l.url && localCache[l.url]) {
                  cachedForNew[l.url] = localCache[l.url];
                }
              });
              if (Object.keys(cachedForNew).length > 0) {
                setLinkPreviews(prev => ({ ...prev, ...cachedForNew }));
                // Prevent re-fetch for these URLs in this session
                setProcessedLinks(prev => new Set([...prev, ...Object.keys(cachedForNew)]));
              }
            }
          } catch (_) {
            // Ignore cache read errors
          }
          
          debugLog(`Added ${newLinks.length} link(s) to collection`);
          showSuccessMessage(`Added ${newLinks.length} link(s) to collection!`);
          
          // Clear the route params
          navigation.setParams({ selectedLinksFromMyLinks: undefined });
        } catch (error) {
          console.error('Error adding links to collection:', error);
          showSuccessMessage('Error adding links to collection');
          // Clear the route params even on error
          navigation.setParams({ selectedLinksFromMyLinks: undefined });
        }
      };

      addLinksToCollection();
    }
  }, [route.params?.selectedLinksFromMyLinks, links, currentCollection, navigation]);
  
  
  // Single, reliable preview fetching system - only process new links
  useEffect(() => {
    const safeLinks = links || [];
    if (safeLinks.length === 0) return;
    
    // Process only new links that don't have previews yet
    const processNewLinks = async () => {
      // Check AsyncStorage FIRST before deciding what to fetch
      const localCacheKey = 'linkPreviewsCache';
      let asyncStorageCache = {};
      
      try {
        const localCacheStr = await AsyncStorage.getItem(localCacheKey);
        if (localCacheStr) {
          asyncStorageCache = JSON.parse(localCacheStr);
        }
      } catch (e) {
        // AsyncStorage check failed - continue without it
      }
      
      const newLinks = [];
      
      for (let i = 0; i < safeLinks.length; i++) {
        const link = safeLinks[i];
        if (!link.url) continue;
        
        // Only process if we don't have a preview and haven't processed this URL
        // AND it's not in AsyncStorage or Firebase already loaded
        const hasPreviewsInState = linkPreviews[link.url];
        const hasPreviewsInAsyncStorage = asyncStorageCache[link.url];
        
        if (!hasPreviewsInState && !hasPreviewsInAsyncStorage && !processedLinks.has(link.url) && !loadingPreviews[i]) {
          newLinks.push({ link, index: i });
        }
      }
      
      if (newLinks.length === 0) {
        // Silent return - no new links to fetch (already in AsyncStorage or state)
        return;
      }
      
      // PERFORMANCE OPTIMIZATION: Fetch all links in parallel instead of staggering
      // This dramatically reduces total wait time from sequential to parallel
      newLinks.forEach(({ link, index }) => {
        setProcessedLinks(prev => new Set([...prev, link.url]));
        fetchLinkPreview(link.url, index);
      });
    };
    
    // Add a delay to allow cached previews to load first, then fetch new ones
    const timeoutId = setTimeout(processNewLinks, 200);
    
    return () => clearTimeout(timeoutId);
  }, [linksSignature]); // Only re-run when the set of URLs changes
  
  // No repetitive logging - commented out to prevent terminal spam

  // פונקציה למיון הקישורים
  const sortLinks = (linksToSort, type, reverse = false) => {
    // Ensure linksToSort is always an array
    const safeLinksToSort = linksToSort || [];
    const sortedLinks = [...safeLinksToSort];
    
    let result;
    switch (type) {
      case 'newest':
        result = sortedLinks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        break;
      case 'alphabetical':
        result = sortedLinks.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'favorites':
        result = sortedLinks.sort((a, b) => {
          const aFav = a.isFavorite ? 1 : 0;
          const bFav = b.isFavorite ? 1 : 0;
          return bFav - aFav; // Favorites first
        });
        break;
      default:
        result = sortedLinks;
    }
    
    // Apply reverse if requested
    return reverse ? result.reverse() : result;
  };

  // Update filtered links whenever search query or links change
  useEffect(() => {
    const safeLinks = links || [];
    const queryNormalized = normalizeSearchText(searchQuery);
    
    if (!queryNormalized) {
      setFilteredLinks(safeLinks);
      return;
    }

    const queryTokens = queryNormalized.split(' ').filter(Boolean);

    if (queryTokens.length === 0) {
      setFilteredLinks(safeLinks);
      return;
    }

    const filtered = safeLinks.filter((link) => {
      const preview = linkPreviews[link.url];
      const candidates = buildTitleCandidates(link, preview);

      if (candidates.length === 0) {
        return false;
      }

      return candidates.some((candidate) => {
        const normalizedCandidate = normalizeSearchText(candidate);
        if (!normalizedCandidate) {
          return false;
        }
        return queryTokens.every((token) => normalizedCandidate.includes(token));
      });
    });

    setFilteredLinks(filtered);
  }, [searchQuery, links, linkPreviews]);

  // קבלת הקישורים המסוננים והממוינים (memoized to prevent unnecessary re-computation)
  const displayedLinks = useMemo(() => {
    const sortedLinks = sortLinks(filteredLinks, sortType, isReversed);
    // Ensure we always return an array
    return sortedLinks || [];
  }, [filteredLinks, sortType, isReversed]);

  // הוספת קישור חדש לאוסף
  const addLink = async () => {
    if (isAddingLink) {
      return;
    }

    const rawInput = linkInput.trim();
    if (!rawInput) {
      return;
    }

    setIsAddingLink(true);

    try {
      // Safety check for currentCollection
      if (!currentCollection || !currentCollection.id) {
        console.error('currentCollection or currentCollection.id is undefined:', currentCollection);
        showSuccessMessage('Error: Collection data missing');
        return;
      }

      let formattedLink = rawInput;
      if (!formattedLink.startsWith('http://') && !formattedLink.startsWith('https://')) {
        formattedLink = 'https://' + formattedLink;
      }

      // Check if this link already exists in the collection
      if (isDuplicateLink(formattedLink)) {
        debugLog('Duplicate link detected:', formattedLink);
        
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
        timestamp: new Date().toISOString(),
        customTitle: null,
        isCustomTitle: false,
        isFavorite: false
      };

      debugLog('Adding new link:', newLink);
      debugLog('Current links:', links);
      debugLog('Current collection ID:', currentCollection.id);

      const newLinks = [...links, newLink];
      const sortedLinks = sortLinks(newLinks, sortType, isReversed);
      
      debugLog('Sorted links to save:', sortedLinks);
      
      // עדכון הדאטהבייס - שמירה בפורמט החדש
      const docRef = doc(db, 'albums', currentCollection.id);
      const dataToSave = {
        listLink: sortedLinks.map(link => ({
          url: link.url,
          title: link.title,
          timestamp: link.timestamp,
          customTitle: link.customTitle || null,
          isCustomTitle: Boolean(link.isCustomTitle),
          isFavorite: link.isFavorite || false
        })),
        lastModified: new Date().toISOString()
      };
      
      debugLog('Data to save to Firebase:', dataToSave);
      debugLog('Document reference:', docRef);
      
      await updateDoc(docRef, dataToSave);

      // עדכון המצב המקומי
      setLinks(sortedLinks);
      setLinkInput('');
      
      debugLog('Link added successfully');
      
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
    } finally {
      setIsAddingLink(false);
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
          title: editingTitle.trim(),
          customTitle: editingTitle.trim(),
          isCustomTitle: true
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
            timestamp: link.timestamp,
            customTitle: link.customTitle || null,
            isCustomTitle: Boolean(link.isCustomTitle),
            isFavorite: link.isFavorite || false
          })),
          lastModified: new Date().toISOString()
        });

        setLinks(newLinks);
        setEditingLinkIndex(null);
        setEditingTitle('');
        
        // Show success feedback
        debugLog('Title updated successfully');
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
          timestamp: link.timestamp,
          customTitle: link.customTitle || null,
          isCustomTitle: Boolean(link.isCustomTitle),
          isFavorite: link.isFavorite || false
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
      debugLog('handleLinkPress called with URL:', url);
      debugLog('URL type:', typeof url);
      debugLog('URL length:', url?.length);
      
      // Ensure URL is a string and not empty
      if (!url || typeof url !== 'string' || url.trim() === '') {
        console.error('Invalid URL provided:', url);
        showSuccessMessage('Invalid URL');
        return;
      }
      
      // Some sources paste a label + a URL on the next line. Extract the first real URL.
      const extractFirstUrl = (value) => {
        try {
          const cleaned = String(value).replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
          const matches = cleaned.match(/https?:\/\/[^\s]+/gi) || [];
          // Prefer the last valid http(s) URL in the string
          for (let i = matches.length - 1; i >= 0; i--) {
            const candidate = matches[i];
            try {
              const u = new URL(candidate);
              // Accept only ASCII hostnames with a dot (avoid things like https://מקור:)
              const host = u.hostname;
              const isAscii = /^[A-Za-z0-9.-]+$/.test(host);
              const hasDot = host.includes('.');
              if (isAscii && hasDot) return candidate;
            } catch (_) {
              // ignore invalid candidate
            }
          }
          // Fallback: if we had any match, return the last one
          if (matches.length > 0) return matches[matches.length - 1];
          return cleaned;
        } catch (e) {
          return String(value).trim();
        }
      };

      const trimmedUrl = extractFirstUrl(url);
      debugLog('Sanitized URL for open:', trimmedUrl);
      
      const supported = await Linking.canOpenURL(trimmedUrl);
      debugLog('URL supported:', supported);
      
      if (supported) {
        debugLog('Opening URL:', trimmedUrl);
        await Linking.openURL(trimmedUrl);
      } else {
        debugLog('URL not supported:', trimmedUrl);
        showSuccessMessage(`Cannot open URL: ${trimmedUrl}`);
      }
    } catch (error) {
      console.error('Error opening link:', error);
      console.error('Error details:', {
        url,
        errorMessage: error.message,
        errorStack: error.stack
      });
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
      debugLog('Share sheet opened');
    } catch (error) {
      console.error('Error opening share sheet:', error);
      showSuccessMessage('Error opening share sheet');
    }
  };

  // Share entire collection
  const handleShareCollection = async () => {
    try {
      if (!currentCollection) {
        showSuccessMessage('Error: Collection data missing');
        return;
      }

      const collectionTitle = currentCollection.title || 'My Collection';
      const collectionDescription = currentCollection.description || '';
      const collectionLinks = links || [];
      const collectionImageUrl = currentCollection.imageLink;

      if (collectionLinks.length === 0) {
        showSuccessMessage('Collection is empty. Add some links first!');
        return;
      }

      // Build share message (without raw image URL - it shows as text, not preview)
      let shareMessage = `📁 ${collectionTitle}\n\n`;
      
      if (collectionDescription) {
        shareMessage += `${collectionDescription}\n\n`;
      }

      shareMessage += `🔗 Links (${collectionLinks.length}):\n\n`;

      // Add each link with its title
      collectionLinks.forEach((link, index) => {
        const linkTitle = getDisplayTitle(link, linkPreviews[link.url]);
        shareMessage += `${index + 1}. ${linkTitle}\n${link.url}\n\n`;
      });

      shareMessage += `\n---\nShared from SocialVault`;

      // Prepare share options
      const shareOptions = {
        message: shareMessage,
        title: collectionTitle,
      };

      // Use the first link's URL as the primary URL for rich preview
      // This works better than raw image URLs since links have proper metadata
      const firstLinkUrl = collectionLinks.length > 0 ? collectionLinks[0].url : null;
      
      // On iOS, use the first link URL for preview (better than raw image URL)
      // The first link will show its own rich preview with image
      if (Platform.OS === 'ios' && firstLinkUrl) {
        shareOptions.url = firstLinkUrl;
      }

      // Share the collection
      await Share.share(shareOptions);

      debugLog('Collection share sheet opened');
    } catch (error) {
      console.error('Error sharing collection:', error);
      showSuccessMessage('Error sharing collection. Please try again.');
    }
  };

  // Remove old complex functions that are no longer needed
  // The simple fetchLinkMetadata approach handles everything now

  // Fetch only the title for a link (used by refresh button)
  const fetchLinkTitleOnly = async (url) => {
    try {
      debugLog('Fetching title only for URL:', url);
      const normalizedUrl = url.trim();
      
      // Use the new fetcher system to get the title
      const result = await fetchLinkPreviewNew(normalizedUrl, {
        instagramToken: userApiTokens.instagram,
        previewServerUrl: PREVIEW_SERVER_URL || undefined
      });
      
      if (result && result.title) {
        debugLog('Successfully fetched title:', result.title);
        return result.title;
      } else {
        debugLog('No title found in result');
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
    
    debugLog('Original title:', JSON.stringify(title));
    
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
    
    debugLog('After regex cleaning:', JSON.stringify(cleaned));
    
    // Final cleanup for quotation marks at start and end only
    // Remove leading quotation marks (only basic ones to avoid removing content)
    while (cleaned.length > 0 && (cleaned.startsWith('"') || cleaned.startsWith("'") || cleaned.startsWith('`'))) {
      cleaned = cleaned.substring(1);
    }
    
    // Remove trailing quotation marks (only basic ones to avoid removing content)
    while (cleaned.length > 0 && (cleaned.endsWith('"') || cleaned.endsWith("'") || cleaned.endsWith('`'))) {
      cleaned = cleaned.substring(0, cleaned.length - 1);
    }
    
    debugLog('After while loop cleaning:', JSON.stringify(cleaned));
    
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
    
    debugLog('Final cleaned title:', JSON.stringify(cleaned));
    
    return cleaned.trim();
  };



  // extractInstagramData function removed - now handled by InstagramFetcher.js

  // extractFacebookData function removed - now handled by FacebookFetcher.js

  // Enhanced Instagram title extraction function with better error handling and legal compliance
  const extractInstagramTitle = async (url) => {
    try {
      debugLog('Extracting Instagram title for:', url);
      
      // Use the new Instagram fetcher with user's token
      const { fetchInstagramPreview } = await import('../fetchers/InstagramFetcher.js');
      const instagramData = await fetchInstagramPreview(url, {
        instagramToken: userApiTokens.instagram
      });
      
      if (instagramData && instagramData.success) {
        debugLog('Using data from Instagram fetcher:', instagramData);
        
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
          debugLog('Found Instagram title via Instagram fetcher:', extractedTitle);
          return extractedTitle;
        }
      }
      
      // No fallback needed - InstagramFetcher handles all extraction
      debugLog('No meaningful Instagram title found via Instagram fetcher');
      return null;
      
    } catch (error) {
      debugLog('Error extracting Instagram title:', error.message);
      return null;
    }
  };

  // fetchWhatsAppStylePreview function removed - now handled by MainFetcher.js

  // Helper function to check if a link has a custom title (different from URL)
  const hasCustomTitle = (link) => {
    if (!link) {
      return false;
    }
    if (link.customTitle && link.customTitle.trim()) {
      return true;
    }
    if (link.isCustomTitle) {
      return true;
    }
    return false;
  };

  // Detect if URL is a video-like link where 16:9 is preferred (YouTube, TikTok, etc.)
  const isVideoLink = (url) => {
    try {
      const u = new URL(url);
      const h = u.hostname.toLowerCase();
      if (h.includes('youtube.com') || h.includes('youtu.be')) return true;
      if (h.includes('tiktok.com')) return true;
      // Add more platforms as needed
      return false;
    } catch (_) {
      return false;
    }
  };

  // Helper function to get the display title with priority: custom title > preview title > URL
  const getDisplayTitle = (link, preview) => {
    if (!link && !preview) {
      return '';
    }

    if (hasCustomTitle(link)) {
      return link.customTitle?.trim() || link.title?.trim() || link.url;
    }

    if (preview && preview.title && preview.title !== 'Loading preview...') {
      return preview.title;
    }

    if (link?.title && link.title.trim() && link.title !== link.url) {
      return link.title.trim();
    }

    return link?.url || '';
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
    debugLog('=== FETCH LINK PREVIEW CALLED ===');
    debugLog('URL:', url, 'Index:', index);

    // Check if this link has a custom title - if so, we'll preserve it but still fetch preview data
    const link = links[index];
    const hasCustomTitleFlag = Boolean(link && hasCustomTitle(link));
    if (hasCustomTitleFlag) {
      debugLog('Link has custom title, will preserve it but still fetch preview data:', link.title);
    }

    // Don't fetch if we already have a preview for this URL
    if (linkPreviews[url]) {
      debugLog('Preview already exists for URL, skipping fetch:', url);
      return;
    }

    // Don't fetch if we're already loading this preview
    if (loadingPreviews[index]) {
      debugLog('Already loading preview for index:', index, 'URL:', url);
      return;
    }

    // PERFORMANCE: Skip retry mechanism for failed previews to avoid delays
    // If it failed once, let user manually retry instead of auto-retry with delay
    const hasFailedBefore = failedPreviews.has(url);
    if (hasFailedBefore) {
      debugLog('Link has failed before, skipping auto-retry to avoid delays:', url);
      // Don't auto-retry - user can manually retry if needed
      return;
    }

    try {
      debugLog('Starting preview fetch for URL:', url, 'Index:', index);
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
          debugLog('Found cached preview:', previewData);
          
          // PERFORMANCE: Use cache immediately if it has valid data
          // Only reject cache if it's clearly broken (loading state or error)
          const isBrokenCache = !previewData.title || 
                               previewData.title === 'Loading preview...' ||
                               previewData.title === 'Preview unavailable';
          
          if (!isBrokenCache) {
            debugLog('✅ Using cached data immediately for instant load:', url);
            
            // Check if the link has a custom title and preserve it
            const link = links[index];
            if (link && hasCustomTitle(link)) {
              debugLog('Preserving custom title in cached data:', link.title);
              previewData.title = link.title;
              previewData.isCustomTitle = true;
            }
            
            setLinkPreviews(prev => ({ ...prev, [url]: previewData }));
            setLoadingPreviews(prev => ({ ...prev, [index]: false }));
            
            // OPTIONAL: For very old cache (7+ days), fetch fresh data in background
            const cacheAge = Date.now() - (previewData.timestamp ? new Date(previewData.timestamp).getTime() : 0);
            const isVeryOld = cacheAge > 604800000; // 7 days
            
            if (isVeryOld) {
              debugLog('Cache is old (7+ days), will update in background');
              // Continue to fetch fresh data below, but user already sees cached version
            } else {
              // Cache is fresh enough, no need to fetch
              return;
            }
          } else {
            debugLog('Cache is broken, will fetch fresh data');
          }
        }
      } catch (cacheError) {
        debugLog('Cache check failed:', cacheError.message);
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
        debugLog('Using new modular fetching system for:', normalizedUrl);
        const result = await fetchLinkPreviewNew(normalizedUrl, {
          instagramToken: userApiTokens.instagram
        });
        
        if (result && result.success !== false) {
          const resolvedTitle = hasCustomTitleFlag ? link.title : resolvePreviewTitle(result.title, 'Untitled');
          const resolvedDescription = resolvePreviewDescription(result.description);
          previewData = {
            title: resolvedTitle,
            description: resolvedDescription,
            image: result.image || null,
      siteName: normalizeSiteName(result.siteName, normalizedUrl),
            timestamp: result.timestamp || new Date().toISOString(),
            source: result.source || 'unknown',
            isCustomTitle: hasCustomTitleFlag,
            url: normalizedUrl
          };
          debugLog('New fetching system success:', previewData.title, hasCustomTitleFlag ? '(custom title preserved)' : '');
        } else {
          throw new Error('New fetching system failed');
        }
      } catch (newFetcherError) {
        debugLog('New fetching system failed, falling back to old methods:', newFetcherError.message);
        
        // Fallback to old methods if new system fails
        try {
            const metadata = await fetchEnhancedMetadata(normalizedUrl, {
              showUserFeedback: false,
              onError: null,
              instagramToken: userApiTokens.instagram
            });
          
          if (metadata && metadata.title) {
            const resolvedTitle = hasCustomTitleFlag ? link.title : resolvePreviewTitle(metadata.title, 'Untitled');
            const resolvedDescription = resolvePreviewDescription(metadata.description);
            previewData = {
              title: resolvedTitle,
              description: resolvedDescription,
              image: metadata.thumbnail || null,
          siteName: normalizeSiteName(metadata.siteName, normalizedUrl),
              timestamp: new Date().toISOString(),
              source: metadata.source || 'microlink',
              isCustomTitle: hasCustomTitleFlag,
              url: normalizedUrl
            };
          } else {
            throw new Error('Enhanced metadata failed');
          }
        } catch (enhancedError) {
          debugLog('Enhanced metadata fallback failed:', enhancedError.message);
          const fallbackTitle = hasCustomTitleFlag ? link.title : `${getSiteNameFromUrl(normalizedUrl)} Link`;
          previewData = {
            title: resolvePreviewTitle(fallbackTitle, `${getSiteNameFromUrl(normalizedUrl)} Link`),
            description: resolvePreviewDescription('Click to view the full content'),
            image: null,
          siteName: normalizeSiteName(getSiteNameFromUrl(normalizedUrl), normalizedUrl),
            timestamp: new Date().toISOString(),
            source: 'fallback',
            isCustomTitle: hasCustomTitleFlag,
            url: normalizedUrl
          };
        }
      }
      
      // Save to Firebase for future use
      try {
        await setDoc(docRef, previewData);
      } catch (error) {
        console.error('Error saving preview to Firebase:', error);
      }
      
      // ALSO save to AsyncStorage for instant loading next time
      try {
        const localCacheKey = 'linkPreviewsCache';
        const existingCacheStr = await AsyncStorage.getItem(localCacheKey);
        const existingCache = existingCacheStr ? JSON.parse(existingCacheStr) : {};
        existingCache[url] = previewData;
        await AsyncStorage.setItem(localCacheKey, JSON.stringify(existingCache));
      } catch (error) {
        // AsyncStorage save failed - not critical
      }
      
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
          siteName: normalizeSiteName(null, url),
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
    debugLog('Retrying failed preview for:', url);
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
      debugLog(`${failedPreviews.size} previews failed. Users can manually retry.`);
    }
  }, [failedPreviews.size]);

  useEffect(() => {
    if (actionDisplayMode !== 'on_card' && cardActionMenu.visible) {
      closeCardActionMenu();
    }
  }, [actionDisplayMode, cardActionMenu.visible, closeCardActionMenu]);

  const OPTIONS_MENU_WIDTH = 220;
  const SETTINGS_MENU_WIDTH = 220;

  const optionsMenuAnchorStyle = useMemo(() => {
    if (!optionsMenuPosition?.measured) {
      return { top: 56, right: 12 };
    }
    return {
      top: Math.max(8, optionsMenuPosition.y + optionsMenuPosition.height - 15),
      left: Math.max(8, optionsMenuPosition.x + optionsMenuPosition.width - (OPTIONS_MENU_WIDTH + 20)),
    };
  }, [OPTIONS_MENU_WIDTH, optionsMenuPosition]);

  const settingsMenuAnchorStyle = useMemo(() => {
    if (!optionsMenuPosition?.measured) {
      return { top: 96, right: 24 };
    }
    return {
      top: Math.max(8, optionsMenuPosition.y + optionsMenuPosition.height - 15),
      left: Math.max(8, optionsMenuPosition.x + optionsMenuPosition.width - (SETTINGS_MENU_WIDTH )),
    };
  }, [SETTINGS_MENU_WIDTH, optionsMenuPosition]);

  // This useEffect is now handled by the main preview fetching system above
  // Removed to prevent conflicts and duplicate fetching

  const openTitleModal = (index) => {
    setEditingLinkIndex(index);
    setTitleInput(links[index].title);
    setIsTitleModalVisible(true);
  };

  // שינוי סוג המיון
  const changeSortType = (type) => {
    sortPreferenceOverrideRef.current = type;
    setSortType(type);
    const sortedLinks = sortLinks(links, type, isReversed);
    setLinks(sortedLinks);
    setCurrentCollection(prev => prev ? { ...prev, sortType: type } : prev);
    // Save sort preference
    saveSortPreference(type);
  };

  // Toggle reverse sorting
  const toggleReverse = () => {
    const newReversed = !isReversed;
    reversePreferenceOverrideRef.current = newReversed;
    setIsReversed(newReversed);
    setCurrentCollection(prev => prev ? { ...prev, isReversed: newReversed } : prev);
    // Save reverse preference
    saveReversePreference(newReversed);
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
        debugLog('Design preference saved:', designKey);
      }
    } catch (error) {
      console.error('Error saving design preference:', error);
    }
  };

  const saveActionDisplayPreference = async (mode) => {
    try {
      if (currentCollection && currentCollection.id) {
        const docRef = doc(db, 'albums', currentCollection.id);
        await updateDoc(docRef, {
          actionDisplayMode: mode,
          lastUpdated: new Date().toISOString()
        });
        debugLog('Action display preference saved:', mode);
      }
    } catch (error) {
      console.error('Error saving action display preference:', error);
    }
  };

  const saveSortPreference = async (sortType) => {
    try {
      if (currentCollection && currentCollection.id) {
        const docRef = doc(db, 'albums', currentCollection.id);
        await updateDoc(docRef, {
          sortType: sortType,
          lastUpdated: new Date().toISOString()
        });
        debugLog('Sort preference saved:', sortType);
      }
    } catch (error) {
      console.error('Error saving sort preference:', error);
    }
  };

  const saveReversePreference = async (isReversed) => {
    try {
      if (currentCollection && currentCollection.id) {
        const docRef = doc(db, 'albums', currentCollection.id);
        await updateDoc(docRef, {
          isReversed: isReversed,
          lastUpdated: new Date().toISOString()
        });
        debugLog('Reverse preference saved:', isReversed);
      }
    } catch (error) {
      console.error('Error saving reverse preference:', error);
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
            debugLog('Loaded design preference:', data.preferredDesign);
          }
        }
      }
    } catch (error) {
      console.error('Error loading design preference:', error);
    }
  };

  const showDesignSelector = (event) => {
    const { pageY, pageX } = event.nativeEvent;
    
    // Adjust position to ensure dropdown is visible on screen
    const dropdownWidth = 220;
    const dropdownHeight = 400; // Approximate height for design selector (4 designs)
    
    // Horizontal adjustment
    const adjustedX = Math.max(10, Math.min(pageX, screenWidth - dropdownWidth - 10));
    
    // Vertical adjustment
    const bottomSpace = screenHeight - pageY;
    let adjustedY;
    // Only flip above if dropdown would actually go off screen (very close to bottom)
    if (bottomSpace < dropdownHeight - 100) {
      // Position above the click point if not enough space below
      // Add offset to bring dropdown closer to the click point
      adjustedY = Math.max(10, pageY - dropdownHeight + 80);
    } else {
      adjustedY = pageY;
    }
    
    setDropdownPosition({ x: adjustedX, y: adjustedY });
    setIsDesignSelectorVisible(true);
    console.log('Design selector positioned at:', { x: adjustedX, y: adjustedY });
  };

  const toggleMenu = (index, event) => {
    if (activeMenuIndex === index) {
      setActiveMenuIndex(null);
      setSelectedLinkForMenu(null);
    } else {
      // Calculate position for the dropdown
      event.target.measure((x, y, width, height, pageX, pageY) => {
        // Adjust position to ensure dropdown is visible on screen
        const dropdownWidth = 140;
        const dropdownHeight = 280; // 5 menu items + divider + padding (updated from 200)
        
        // Horizontal adjustment - ensure dropdown stays within screen bounds
        const adjustedX = Math.max(10, Math.min(pageX + width - dropdownWidth, screenWidth - dropdownWidth - 10));
        
        // Vertical adjustment - flip above if not enough space below
        const bottomSpace = screenHeight - (pageY + height);
        let adjustedY;
        // Only flip above if dropdown would actually go off screen (very close to bottom)
        if (bottomSpace < dropdownHeight - 50) {
          // Position above the button if not enough space below
          // Add offset to bring dropdown closer to the button (50px offset for button height)
          adjustedY = Math.max(10, pageY - dropdownHeight + 50);
        } else {
          adjustedY = pageY + height + 5;
        }
        
        setDropdownMenuPosition({
          x: adjustedX,
          y: adjustedY,
          width: dropdownWidth,
          height: dropdownHeight
        });
        console.log('Dropdown menu positioned at:', { 
          x: adjustedX, 
          y: adjustedY, 
          buttonY: pageY, 
          bottomSpace,
          flippedAbove: bottomSpace < dropdownHeight + 10 
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
  const showLinkDropdown = (index, link, event) => {
    // Close any existing menus first
    closeMenu();
    
    // Get the exact position of the link card
    event.target.measure((x, y, width, height, pageX, pageY) => {
      // Calculate center position of the link card
      const cardCenterX = pageX + (width / 2);
      const cardCenterY = pageY + (height / 2);
      
      // Dropdown dimensions
      const dropdownWidth = 200;
      const dropdownHeight = 100; // Approximate height for link dropdown
      
      // Adjust horizontal position to ensure dropdown stays on screen
      let adjustedX = cardCenterX - (dropdownWidth / 2); // Center the dropdown
      adjustedX = Math.max(10, Math.min(adjustedX, screenWidth - dropdownWidth - 10));
      
      // Adjust vertical position to ensure dropdown stays on screen
      let adjustedY = cardCenterY - (dropdownHeight / 2); // Center vertically
      
      // Check if dropdown would go off bottom of screen
      const bottomSpace = screenHeight - (cardCenterY + dropdownHeight / 2);
      // Only flip above if dropdown would actually go off screen (very close to bottom)
      if (bottomSpace < -30) {
        // Position above if not enough space below
        // Bring it closer to the card (reduce the gap)
        adjustedY = Math.max(10, cardCenterY - dropdownHeight + 30);
      }
      
      // Ensure doesn't go off top of screen
      adjustedY = Math.max(10, adjustedY);
      
      // Position dropdown with adjusted coordinates
      setLinkDropdownPosition({
        x: adjustedX,
        y: adjustedY
      });
      
      setSelectedLinkForDropdown({ index, link });
      setLinkDropdownVisible(true);
      console.log('Link dropdown positioned at:', { x: adjustedX, y: adjustedY });
    });
  };

  // Close link dropdown
  const closeLinkDropdown = () => {
    setLinkDropdownVisible(false);
    setSelectedLinkForDropdown(null);
  };

  const showCardActionMenu = useCallback((index, designKey) => {
    const targetRef = menuButtonRefs.current[`${designKey}-${index}`];
    if (targetRef && typeof targetRef.measureInWindow === 'function') {
      targetRef.measureInWindow((x, y, width, height) => {
        // Adjust position to ensure dropdown is visible on screen
        const dropdownWidth = 196; // Card menu width
        const dropdownHeight = 220; // 4 menu items + divider + padding
        
        // Horizontal adjustment - prefer right-aligned but ensure it stays on screen
        let adjustedX = x + width - dropdownWidth;
        adjustedX = Math.max(12, Math.min(adjustedX, screenWidth - dropdownWidth - 12));
        
        // Vertical adjustment - flip above if not enough space below
        const buttonBottomY = y + height;
        const bottomSpace = screenHeight - buttonBottomY;
        let adjustedY;
        
        // Only flip above if dropdown would actually go off screen (very close to bottom)
        if (bottomSpace < dropdownHeight - 50) {
          // Position above the button if not enough space below
          // Add offset to bring dropdown closer to the button (50px offset for button height)
          adjustedY = Math.max(40, y - dropdownHeight + 50);
        } else {
          // Position below the button
          adjustedY = designKey === 'classic' ? buttonBottomY - 8 : y + 4;
        }
        
        setCardActionMenu({
          visible: true,
          index,
          position: { x: adjustedX, y: adjustedY, width, height },
          design: designKey,
        });
        
        console.log('Card action menu positioned at:', { 
          x: adjustedX, 
          y: adjustedY,
          buttonY: y,
          bottomSpace,
          flippedAbove: bottomSpace < dropdownHeight + 10
        });
      });
    } else {
      setCardActionMenu({
        visible: true,
        index,
        position: { x: 0, y: 0, width: 0, height: 0 },
        design: designKey,
      });
    }
  }, [screenWidth, screenHeight]);

  const closeCardActionMenu = useCallback(() => {
    setCardActionMenu({
      visible: false,
      index: null,
      position: { x: 0, y: 0, width: 0, height: 0 },
      design: null,
    });
  }, []);

  const cardMenuLink = cardActionMenu.index != null ? links[cardActionMenu.index] : null;

  // Toggle favorite status for a link
  const toggleLinkFavorite = async (linkIndex) => {
    try {
      if (!currentCollection || !currentCollection.id) {
        showSuccessMessage('Error: Collection data missing');
        return;
      }

      const link = links[linkIndex];
      const currentFavoriteStatus = linkFavorites[link.url] || link.isFavorite || false;
      const newFavoriteStatus = !currentFavoriteStatus;
      
      // Update local state
      setLinkFavorites(prev => ({
        ...prev,
        [link.url]: newFavoriteStatus
      }));

      // Update Firebase
      const docRef = doc(db, 'albums', currentCollection.id);
      const updatedLinks = [...links];
      updatedLinks[linkIndex] = {
        ...updatedLinks[linkIndex],
        isFavorite: newFavoriteStatus
      };

      await updateDoc(docRef, {
        listLink: updatedLinks.map(link => ({
          url: link.url,
          title: link.title,
          timestamp: link.timestamp,
          customTitle: link.customTitle || null,
          isCustomTitle: Boolean(link.isCustomTitle),
          isFavorite: link.isFavorite || false
        })),
        lastModified: new Date().toISOString()
      });

      // Update local links state immediately
      setLinks(updatedLinks);
      
      // Also ensure linkFavorites state is updated
      setLinkFavorites(prev => ({
        ...prev,
        [link.url]: newFavoriteStatus
      }));
      
      showSuccessMessage(newFavoriteStatus ? 'Link added to favorites!' : 'Link removed from favorites!');
    } catch (error) {
      console.error('Error toggling link favorite:', error);
      showSuccessMessage('Failed to update favorite. Please try again.');
    }
  };


  // Get dynamic styles based on current design
  const { gridColumnGap } = LINK_LAYOUT_CONSTANTS;
  const currentDesignStyles = useMemo(
    () => getLinkDesignStyles(currentDesign, screenWidth),
    [currentDesign, screenWidth]
  );

  const linksListTopSpacingStyle = useMemo(() => {
    const marginVertical = typeof currentDesignStyles?.linkItem?.marginVertical === 'number'
      ? currentDesignStyles.linkItem.marginVertical
      : 0;
    const desiredSpacing = 8;
    const computedMargin = desiredSpacing - marginVertical;
    return { marginTop: computedMargin > 0 ? computedMargin : 0 };
  }, [currentDesignStyles]);

  const openCustomPreviewEditor = useCallback((index) => {
    if (index == null) {
      return;
    }

    const link = links[index];
    if (!link) {
      return;
    }

    const preview = linkPreviews[link.url];
    setEditingPreviewIndex(index);
    setCustomPreviewData({
      title: preview?.title || link.customTitle || link.title || '',
      description: preview?.description || '',
      image: preview?.image || null,
    });
    setIsCustomPreviewModalVisible(true);
  }, [links, linkPreviews]);

  const closeCustomPreviewModal = useCallback(() => {
    setIsCustomPreviewModalVisible(false);
    setEditingPreviewIndex(null);
    setCustomPreviewData({ title: '', description: '', image: null });
    setIsRefetchingPreview(false);
  }, []);

  const saveCustomPreview = useCallback(async () => {
    if (editingPreviewIndex == null) {
      return;
    }

    const link = links[editingPreviewIndex];
    if (!link) {
      return;
    }

    try {
      const updatedPreview = {
        ...linkPreviews[link.url],
        title: customPreviewData.title || link.customTitle || link.title,
        description: customPreviewData.description || 'No description available',
        image: customPreviewData.image,
        siteName: normalizeSiteName(linkPreviews[link.url]?.siteName, link.url),
        timestamp: new Date().toISOString(),
        isCustom: true,
      };

      setLinkPreviews((prev) => ({
        ...prev,
        [link.url]: updatedPreview,
      }));

      if (customPreviewData.title && customPreviewData.title !== link.customTitle) {
        const linkDocId = link.id || link.documentId;
        if (linkDocId) {
          const linkRef = doc(db, 'generalLinks', linkDocId);
          await updateDoc(linkRef, {
            customTitle: customPreviewData.title,
            lastModified: new Date().toISOString(),
          });
        }

        setLinks((prev) => prev.map((item, idx) => (
          idx === editingPreviewIndex
            ? { ...item, customTitle: customPreviewData.title }
            : item
        )));
      }

      const safeDocId = encodeURIComponent(link.url).replace(/[^a-zA-Z0-9]/g, '_');
      const previewDocRef = doc(db, 'linkPreviews', safeDocId);
      await setDoc(previewDocRef, updatedPreview);

      try {
        const localCacheKey = 'linkPreviewsCache';
        const existingCacheStr = await AsyncStorage.getItem(localCacheKey);
        const existingCache = existingCacheStr ? JSON.parse(existingCacheStr) : {};
        existingCache[link.url] = updatedPreview;
        await AsyncStorage.setItem(localCacheKey, JSON.stringify(existingCache));
      } catch (cacheError) {
        debugLog('Failed to persist custom preview locally:', cacheError);
      }

      closeCustomPreviewModal();
      showSuccessMessage('Custom preview saved successfully!');
    } catch (error) {
      console.error('Error saving custom preview:', error);
      showSuccessMessage('Failed to save custom preview');
    }
  }, [closeCustomPreviewModal, customPreviewData, editingPreviewIndex, linkPreviews, showSuccessMessage]);

const refetchOriginalPreview = useCallback(async () => {
    if (editingPreviewIndex == null) {
      return;
    }

    const link = links[editingPreviewIndex];
    if (!link) {
      return;
    }

    try {
      setIsRefetchingPreview(true);
      showSuccessMessage('Refetching preview data...');

      setLinkPreviews((prev) => {
        const next = { ...prev };
        delete next[link.url];
        return next;
      });

      setFailedPreviews((prev) => {
        const next = new Set(prev);
        next.delete(link.url);
        return next;
      });

      const normalizedUrl = link.url.trim();
    const result = await fetchLinkPreviewNew(normalizedUrl, { timeout: 15000 });

      if (!result || result.success === false) {
        throw new Error('Failed to fetch preview data');
      }

      const newPreview = {
        title: result.title || 'Untitled',
        description: result.description || '',
        image: result.image || null,
        siteName: normalizeSiteName(result.siteName, normalizedUrl),
        timestamp: new Date().toISOString(),
        source: result.source || 'refetch',
        url: normalizedUrl,
      };

      setLinkPreviews((prev) => ({ ...prev, [link.url]: newPreview }));
      setCustomPreviewData({
        title: newPreview.title,
        description: newPreview.description,
        image: newPreview.image,
      });

      const safeDocId = encodeURIComponent(link.url).replace(/[^a-zA-Z0-9]/g, '_');
      const previewDocRef = doc(db, 'linkPreviews', safeDocId);
      await setDoc(previewDocRef, newPreview);

      try {
        const localCacheKey = 'linkPreviewsCache';
        const existingCacheStr = await AsyncStorage.getItem(localCacheKey);
        const existingCache = existingCacheStr ? JSON.parse(existingCacheStr) : {};
        existingCache[link.url] = newPreview;
        await AsyncStorage.setItem(localCacheKey, JSON.stringify(existingCache));
      } catch (cacheError) {
        debugLog('Failed to persist refetched preview locally:', cacheError);
      }

      showSuccessMessage('Preview refetched successfully!');
    } catch (error) {
      console.error('Error refetching preview:', error);
      showSuccessMessage('Failed to refetch preview. Please try again.');
  } finally {
    setIsRefetchingPreview(false);
  }
}, [editingPreviewIndex, links, showSuccessMessage]);

  const handleImageSelection = useCallback(async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showAppDialog('Permission Required', 'Permission to access camera roll is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setCustomPreviewData((prev) => ({ ...prev, image: result.assets[0].uri }));
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      showAppDialog('Error', 'Failed to select image. Please try again.');
    }
  }, [showAppDialog]);

  const showSuccessMessage = useCallback((message, options = {}) => {
    if (!message) {
      return;
    }

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    const lowerMessage = message.toLowerCase();
    let resolvedVariant = options.variant;

    if (!resolvedVariant) {
      if (lowerMessage.includes('error') || lowerMessage.includes('failed') || lowerMessage.includes('cannot')) {
        resolvedVariant = 'error';
      } else if (lowerMessage.includes('soon') || lowerMessage.includes('info')) {
        resolvedVariant = 'info';
      } else {
        resolvedVariant = 'success';
      }
    }

    setSuccessMessage(message);
    setToastVariant(resolvedVariant);
    setShowSuccess(true);

    const autoHideDuration =
      options.duration ??
      (resolvedVariant === 'error' ? 3600 : resolvedVariant === 'info' ? 2800 : 3000);

    toastTimerRef.current = setTimeout(() => {
      setShowSuccess(false);
      toastTimerRef.current = null;
      setTimeout(() => setSuccessMessage(''), 200);
    }, autoHideDuration);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Collection management functions
  const handleUpdateTitle = async () => {
    if (!editingCollectionTitle.trim()) {
      showSuccessMessage('Please enter a title');
        return;
      }
      
    try {
      const docRef = doc(db, 'albums', currentCollection.id);
      await updateDoc(docRef, {
        title: editingCollectionTitle.trim(),
        description: editingCollectionDescription.trim(),
        lastModified: new Date().toISOString()
      });

      setCurrentCollection({
        ...currentCollection,
        title: editingCollectionTitle.trim(),
        description: editingCollectionDescription.trim()
      });

      setEditingCollectionId(null);
      setEditingCollectionTitle('');
      setEditingCollectionDescription('');
      showSuccessMessage('Collection updated successfully!');
    } catch (error) {
      console.error('Error updating collection:', error);
      showSuccessMessage('Failed to update collection');
    }
  };

  const startEditingTitle = () => {
    setEditingCollectionId(currentCollection.id);
    setEditingCollectionTitle(currentCollection.title || '');
    setEditingCollectionDescription(currentCollection.description || '');
  };

  const handleChangeImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showAppDialog('Permission Required', 'Permission to access camera roll is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setUpdatingImage(true);
        const imageUri = result.assets[0].uri;
        
        // Upload to Cloudinary
        const uploadedUrl = await uploadImageAsync(imageUri);
        
        if (uploadedUrl) {
          // Update Firestore
        const docRef = doc(db, 'albums', currentCollection.id);
        await updateDoc(docRef, {
            imageLink: uploadedUrl,
          lastModified: new Date().toISOString()
        });
        
          setCurrentCollection({
            ...currentCollection,
            imageLink: uploadedUrl
          });
        
        showSuccessMessage('Image updated successfully!');
        } else {
          showSuccessMessage('Failed to upload image');
        }
      }
    } catch (error) {
      console.error('Error changing image:', error);
      showSuccessMessage('Failed to change image');
    } finally {
      setUpdatingImage(false);
    }
  };

  const handleDeleteImage = async () => {
    try {
      const docRef = doc(db, 'albums', currentCollection.id);
      await updateDoc(docRef, {
        imageLink: null,
        lastModified: new Date().toISOString()
      });

      setCurrentCollection({
        ...currentCollection,
        imageLink: null
      });

      showSuccessMessage('Image deleted successfully!');
    } catch (error) {
      console.error('Error deleting image:', error);
      showSuccessMessage('Failed to delete image');
    }
  };

  const openThumbnailSelector = async () => {
      try {
        setLoadingThumbnails(true);
        
      // Collect all thumbnails from link previews
        const thumbnails = [];
      for (const link of links) {
        if (linkPreviews[link.url]?.image) {
                  thumbnails.push({
            url: linkPreviews[link.url].image,
            title: linkPreviews[link.url].title
                  });
          }
        }
        
        if (thumbnails.length === 0) {
        showSuccessMessage('No thumbnails available from links');
          return;
        }
        
        setCollectionThumbnails(thumbnails);
        setShowThumbnailSelector(true);
      } catch (error) {
        console.error('Error loading thumbnails:', error);
      showSuccessMessage('Failed to load thumbnails');
    } finally {
        setLoadingThumbnails(false);
    }
  };

  const selectThumbnailAsImage = async (thumbnailUrl) => {
    try {
      setShowThumbnailSelector(false);
      setUpdatingImage(true);
      
      // Update Firestore
      const docRef = doc(db, 'albums', currentCollection.id);
      await updateDoc(docRef, {
        imageLink: thumbnailUrl,
        lastModified: new Date().toISOString()
      });
      
      setCurrentCollection({
        ...currentCollection,
        imageLink: thumbnailUrl
      });

      showSuccessMessage('Image updated successfully!');
    } catch (error) {
      console.error('Error updating image:', error);
      showSuccessMessage('Failed to update image');
    } finally {
      setUpdatingImage(false);
    }
  };

  const handleDeleteCollection = () => {
    setCollectionToDelete(currentCollection);
    setDeleteConfirmModalVisible(true);
  };

  const confirmDeleteCollection = async () => {
    if (!collectionToDelete) return;

    try {
      const docRef = doc(db, 'albums', collectionToDelete.id);
      await updateDoc(docRef, {
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      });
      
      setDeleteConfirmModalVisible(false);
      setCollectionToDelete(null);
      showSuccessMessage('Collection moved to trash');
      
      // Navigate back to collections
      setTimeout(() => {
        navigation.navigate('Collections');
      }, 1000);
    } catch (error) {
      console.error('Error deleting collection:', error);
      showSuccessMessage('Failed to delete collection');
    }
  };

  const restoreCollection = async () => {
    try {
      setIsRestoringCollection(true);
      
      const docRef = doc(db, 'albums', currentCollection.id);
      await updateDoc(docRef, {
        isDeleted: false,
        deletedAt: null,
        lastModified: new Date().toISOString()
      });
      
      setCurrentCollection({
        ...currentCollection,
        isDeleted: false,
        deletedAt: null
      });

      showSuccessMessage('Collection restored successfully!');
      
      // Navigate back to collections
      setTimeout(() => {
        navigation.navigate('Collections');
      }, 1000);
    } catch (error) {
      console.error('Error restoring collection:', error);
      showSuccessMessage('Failed to restore collection');
    } finally {
      setIsRestoringCollection(false);
    }
  };

  const permanentDeleteCollection = async () => {
    try {
    showAppDialog(
        'Permanently Delete Collection',
        'Are you sure you want to permanently delete this collection? This action cannot be undone.',
      [
        {
          text: 'Cancel',
            style: 'cancel'
        },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            try {
              const docRef = doc(db, 'albums', currentCollection.id);
              await deleteDoc(docRef);
                
                showSuccessMessage('Collection permanently deleted');
                
                // Navigate back to collections
                setTimeout(() => {
                  navigation.navigate('Collections');
                }, 1000);
            } catch (error) {
              console.error('Error permanently deleting collection:', error);
                showSuccessMessage('Failed to delete collection');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in permanent delete:', error);
      showSuccessMessage('Failed to delete collection');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themedColors.background }]}>
      {/* Configure Status Bar for better visibility */}
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={themedColors.background}
        translucent={false}
      />
      
      {/* Message Toast (Success or Error) */}
      <ToastMessage
        visible={showSuccess}
        message={successMessage}
        variant={toastVariant}
        topOffset={Platform.OS === 'ios' ? 70 : 50}
      />
      
      <Animated.View style={{ flex: 1, opacity: entryOpacity, backgroundColor: themedColors.background }} renderToHardwareTextureAndroid={true} shouldRasterizeIOS={true}>
      <ScrollView 
        style={{ backgroundColor: themedColors.background }}
        contentContainerStyle={{ flexGrow: 1, backgroundColor: themedColors.background }}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={true}
        removeClippedSubviews={true}
      >
        {/* Sticky Navigation Only */}
        <View style={[styles.stickyNavigationOnly, { backgroundColor: themedColors.surface }]}>
          <View style={styles.topNavigationBar}>
            <TouchableOpacity 
              onPress={() => navigation.navigate('Collections')}
              style={styles.backButton}
              accessibilityLabel="Go back"
              accessibilityHint="Return to Collections screen"
              accessibilityRole="button"
            >
              <MaterialIcons name="arrow-back" size={24} color={isDarkMode ? "#ffffff" : "#333"} />
            </TouchableOpacity>
            
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={() => {
                  // Open SelectLinksScreen to add links (modal presentation handled by navigator)
                  navigation.navigate('SelectLinksScreen', {
                    currentSelectedLinks: [],
                    sourceScreen: 'CollectionFormat',
                    originalCollection: currentCollection
                  });
                }}
                accessibilityLabel="Add new link"
                accessibilityHint="Add a new link to this collection"
              >
                <MaterialIcons name="add" size={24} color={isDarkMode ? "#ffffff" : "#333"} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                ref={optionsMenuButtonRef}
                style={styles.headerButton}
                onPress={() => {
                  // Show options menu anchored to button
                  if (optionsMenuButtonRef.current && typeof optionsMenuButtonRef.current.measureInWindow === 'function') {
                    optionsMenuButtonRef.current.measureInWindow((x, y, width, height) => {
                      setOptionsMenuPosition({ x, y, width, height, measured: true });
                      setIsOptionsMenuVisible(true);
                    });
                  } else {
                    setOptionsMenuPosition({ x: 0, y: 0, width: 0, height: 0, measured: false });
                    setIsOptionsMenuVisible(true);
                  }
                }}
                accessibilityLabel="More options"
                accessibilityHint="Show more options for this collection"
              >
                <MaterialIcons name="more-vert" size={24} color={isDarkMode ? "#ffffff" : "#333"} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Collection Info - Scrollable */}
        <View style={[styles.collectionInfoScrollable, { backgroundColor: themedColors.surface }]}>
          {editingCollectionId === currentCollection.id ? (
            <>
              <TextInput
                style={[styles.collectionTitleInput, { 
                  backgroundColor: themedColors.input,
                  color: themedColors.textPrimary,
                  borderColor: '#4A90E2'
                }]}
                value={editingCollectionTitle}
                onChangeText={setEditingCollectionTitle}
                placeholder="Enter collection title"
                placeholderTextColor={themedColors.textMuted}
                textAlign="center"
                autoFocus
                multiline={false}
              />
              <TextInput
                style={[styles.collectionDescriptionInput, { 
                  backgroundColor: themedColors.input,
                  color: themedColors.textPrimary,
                  borderColor: themedColors.border
                }]}
                value={editingCollectionDescription}
                onChangeText={setEditingCollectionDescription}
                placeholder="Enter collection description (optional)"
                placeholderTextColor={themedColors.textMuted}
                textAlign="center"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <View style={styles.collectionEditButtons}>
                <TouchableOpacity
                  style={[styles.collectionEditButton, styles.collectionCancelButton, {
                    backgroundColor: themedColors.elevated
                  }]}
                  onPress={() => {
                    setEditingCollectionId(null);
                    setEditingCollectionTitle('');
                    setEditingCollectionDescription('');
                  }}
                >
                  <MaterialIcons name="close" size={20} color={themedColors.textPrimary} />
                  <Text style={[styles.collectionEditButtonText, { color: themedColors.textPrimary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.collectionEditButton, styles.collectionSaveButton]}
                  onPress={handleUpdateTitle}
                >
                  <MaterialIcons name="check" size={20} color="#ffffff" />
                  <Text style={styles.collectionEditButtonTextSave}>Save</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.collectionTitle, { color: themedColors.textPrimary }]}>
                {currentCollection.title}
              </Text>
              {currentCollection.description && (
                <Text style={[styles.collectionDescription, { color: themedColors.textSecondary }]}>
                  {currentCollection.description}
                </Text>
              )}
            </>
          )}
        </View>

        {/* Content Area */}
        <View style={[styles.contentContainer, { backgroundColor: themedColors.surface }]}>
          {/* Links Section Header */}
          <View style={styles.linksSectionHeader}>
            <Text style={[styles.linksCount, { color: themedColors.textSecondary }]}>
              {(displayedLinks || []).length} links
            </Text>
            
            {/* Action Buttons Row */}
            <View style={styles.actionButtonsRow}>
              {/* Search Button */}
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: themedColors.actionButton }]}
                onPress={() => {
                  // Toggle search visibility
                  setIsSearchVisible(!isSearchVisible);
                }}
              >
                <MaterialIcons name="search" size={20} color={themedColors.textPrimary} />
              </TouchableOpacity>
              
              {/* Sort Button */}
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: themedColors.actionButton }]}
                onPress={() => {
                  // Show sort options
                  setIsSortMenuVisible(!isSortMenuVisible);
                }}
              >
                <MaterialIcons name="sort" size={20} color={themedColors.textPrimary} />
              </TouchableOpacity>
              
              {/* Reverse Sort Button */}
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: themedColors.actionButton }]}
                onPress={toggleReverse}
              >
                <MaterialIcons 
                  name={isReversed ? "arrow-upward" : "arrow-downward"} 
                  size={20} 
                  color={themedColors.textPrimary} 
                />
              </TouchableOpacity>
              
              {/* Design Button */}
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: themedColors.actionButton }]}
                onPress={() => {
                  // Show design options
                  setIsDesignMenuVisible(!isDesignMenuVisible);
                }}
              >
                <MaterialIcons name="view-module" size={20} color={themedColors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Search Bar - Conditional */}
          {isSearchVisible && (
            <View style={[styles.searchContainer, { 
              backgroundColor: themedColors.elevated,
              borderColor: themedColors.border
            }]}>
              <Ionicons name="search" size={20} color={themedColors.textSecondary} style={styles.searchIcon} />
              <TextInput
                id="search-links-input"
                name="search-links"
                style={[styles.searchInput, { color: isDarkMode ? '#ffffff' : '#333' }]}
                placeholder="Search links..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={isDarkMode ? '#999' : '#666'}
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
                  <Ionicons name="close-circle" size={20} color={themedColors.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {/* אזור הזנת קישור חדש */}
          <View style={styles.linkInputContainer}>
            <View style={[styles.inputFieldsContainer, { 
              backgroundColor: isDarkMode ? '#1a1a1a' : '#fff',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : '#e8eaed'
            }]}>
              <TextInput
                id="add-link-input"
                name="add-link"
                ref={linkInputRef}
                style={[styles.linkInput, { color: themedColors.textPrimary }]}
                placeholder="Add a new link..."
                value={linkInput}
                onChangeText={setLinkInput}
                accessibilityLabel="Add a new link"
                accessibilityHint="Enter a URL to add to your collection"
                placeholderTextColor={themedColors.textMuted}
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
              style={[
                styles.addButton,
                (!linkInput.trim() || isAddingLink) && styles.addButtonDisabled
              ]} 
              onPress={() => {
                debugLog('Add button pressed!');
                addLink();
              }}
              disabled={!linkInput.trim() || isAddingLink}
              activeOpacity={0.7}
              accessibilityLabel="Add link"
              accessibilityHint="Add the entered URL to your collection"
              accessibilityRole="button"
            >
              {isAddingLink ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <MaterialIcons name="add" size={24} color="white" />
              )}
            </TouchableOpacity>
          </View>

          {/* רשימת הקישורים */}
          <View style={[
            styles.linksContainer,
            currentDesign === 'grid' && styles.gridLinksContainer,
            linksListTopSpacingStyle
          ]}>
            {displayedLinks.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <View style={[styles.emptyState, { 
                  backgroundColor: themedColors.elevated,
                  borderColor: themedColors.border
                }]}>
                  <MaterialIcons name="link-off" size={50} color="#4A90E2" style={styles.emptyIcon} />
                  <Text style={[styles.emptyTitle, { color: themedColors.textPrimary }]}>
                    This collection is empty
                  </Text>
                  <Text style={[styles.emptyText, { color: themedColors.textSecondary }]}>
                    Add links from your saved links or add a new link manually
                  </Text>
                  
                  <TouchableOpacity 
                    style={styles.emptyAddButton}
                    onPress={() => {
                      // Navigate to SelectLinksScreen to add links from MyLinks
                      navigation.navigate('SelectLinksScreen', {
                        currentSelectedLinks: [],
                        sourceScreen: 'CollectionFormat',
                        originalCollection: currentCollection
                      });
                    }}
                  >
                    <MaterialIcons name="add-link" size={24} color="#ffffff" />
                    <Text style={styles.emptyAddButtonText}>Add Links from My Links</Text>
                  </TouchableOpacity>
                  
                  <Text style={[styles.emptySubtext, { color: themedColors.textMuted }]}>
                    Or use the input field above to add a new link manually
                  </Text>
                </View>
              </View>
            ) : displayedLinks.map((displayLink, displayIndex) => {
              const designStyles = currentDesignStyles || {};
              // Find the actual index in the links array to get the most up-to-date link data
              const actualIndex = links.findIndex(l => l.url === displayLink.url);
              const linkIndex = actualIndex !== -1 ? actualIndex : displayIndex;
              // Use the actual link from links array to get current favorite status
              const link = links[linkIndex] || displayLink;
              const isLastItem = displayIndex === displayedLinks.length - 1;
              const isLeftColumn = displayIndex % 2 === 0;
              const hasPairInRow = displayIndex + 1 < displayedLinks.length;
              const gridItemSpacing = currentDesign === 'grid'
                ? {
                    marginRight: isLeftColumn && hasPairInRow ? gridColumnGap : 0,
                    marginBottom: gridColumnGap,
                  }
                : {};
              const shouldShowSeparator = !isLastItem && (
                currentDesign !== 'grid' || ((displayIndex + 1) % 2 === 0)
              );
              const linkWrapperStyle = currentDesign === 'grid' ? null : styles.linkItemWrapper;
              const fragmentKey = `${link.url || 'link'}_${link.timestamp || displayIndex}`;
              return (
                <React.Fragment key={fragmentKey}>
                  {currentDesign === 'classic' ? (
                    <TouchableOpacity 
                      style={[
                        sharedLinkLayoutStyles.linkCard,
                        designStyles.linkItem,
                        linkWrapperStyle,
                        editingLinkIndex === linkIndex && styles.linkItemEditing,
                        gridItemSpacing,
                        styles.classicCard,
                        { 
                          backgroundColor: 'transparent',
                          borderWidth: 0,
                        }
                      ]}
                      onPress={(event) => {
                        debugLog('Classic card tapped for link:', link);
                        debugLog('Link URL:', link.url);
                        debugLog('Action display mode:', actionDisplayMode);
                        
                        if (actionDisplayMode === 'dropdown') {
                          showLinkDropdown(linkIndex, link, event);
                        } else {
                          handleLinkPress(link.url);
                        }
                      }}
                      activeOpacity={0.9}
                    >
                      <View style={styles.previewWrapper}>
                        <View style={[sharedLinkLayoutStyles.previewContainer, designStyles.previewContainer]}>
                          {loadingPreviews[linkIndex] ? (
                            <View style={sharedLinkLayoutStyles.previewLoading}>
                              <ActivityIndicator size="small" color="#4a90e2" />
                            </View>
                          ) : linkPreviews[link.url]?.image ? (
                            <Image
                              source={{ 
                                uri: linkPreviews[link.url].image,
                                cache: 'force-cache'
                              }}
                              style={sharedLinkLayoutStyles.previewImage}
                              resizeMode="cover"
                              fadeDuration={0}
                              onError={() => {
                                debugLog('Image failed to load, removing it');
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
                            <View style={sharedLinkLayoutStyles.previewPlaceholder}>
                              {failedPreviews.has(link.url) ? (
                                <TouchableOpacity 
                                  style={styles.retryButton}
                                  onPress={() => retryFailedPreview(link.url, linkIndex)}
                                >
                                  <MaterialIcons name="refresh" size={24} color="#4a90e2" />
                                  <Text style={styles.retryText}>Retry</Text>
                                </TouchableOpacity>
                              ) : (
                                <MaterialIcons name="link" size={32} color="#ccc" />
                              )}
                            </View>
                          ) : (
                            <View style={sharedLinkLayoutStyles.previewLoading}>
                              <ActivityIndicator size="small" color="#4a90e2" />
                            </View>
                          )}
                          {linkPreviews[link.url]?.siteName && (
                            <View style={styles.siteNameBadge}>
                              <Text style={styles.siteNameText}>
                                {normalizeSiteName(linkPreviews[link.url].siteName, link.url)}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      
                      <View style={[sharedLinkLayoutStyles.linkContent, designStyles.linkContent]}>
                        {editingLinkIndex === linkIndex ? (
                          <View style={styles.titleEditContainer}>
                            <TextInput
                              id={`edit-title-input-${linkIndex}`}
                              name={`edit-title-${linkIndex}`}
                              style={[styles.linkTitleInput, { color: isDarkMode ? '#ffffff' : '#333' }]}
                              value={editingTitle}
                              onChangeText={setEditingTitle}
                              accessibilityLabel="Edit link title"
                              accessibilityHint="Enter a new title for this link"
                              onBlur={() => {
                                // Don't auto-save on blur - only save when user explicitly clicks check button
                              }}
                              onSubmitEditing={() => {
                                if (editingTitle.trim() && editingTitle !== link.title) {
                                  updateLinkTitle(linkIndex);
                                }
                                setEditingLinkIndex(null);
                              }}
                              autoFocus
                              placeholder="Enter title"
                              placeholderTextColor={isDarkMode ? '#999' : '#666'}
                              returnKeyType="done"
                              maxLength={200}
                            />
                            <Text style={[styles.editingHint, { color: themedColors.textSecondary }]}>
                              {isUpdatingTitle ? 'Saving...' : 'Press ✓ to save, ✕ to cancel, or ↻ to restore original title'}
                            </Text>
                          </View>
                        ) : (
                          <>
                            <Text style={[designStyles.linkTitle, { color: isDarkMode ? '#ffffff' : '#333' }]} numberOfLines={2}>
                              {getDisplayTitle(link, linkPreviews[link.url])}
                            </Text>
                            <Text style={[sharedLinkLayoutStyles.linkDate, { color: isDarkMode ? '#999' : '#999' }]}>
                              Added {link.timestamp ? new Date(link.timestamp).toLocaleDateString() : 'Unknown date'}
                            </Text>
                          </>
                        )}
                      </View>
                      {actionDisplayMode === 'on_card' && (
                        <TouchableOpacity
                          ref={(ref) => {
                            if (ref) {
                              menuButtonRefs.current[`classic-${linkIndex}`] = ref;
                            } else {
                              delete menuButtonRefs.current[`classic-${linkIndex}`];
                            }
                          }}
                          style={[
                            styles.classicMenuButton,
                            isDarkMode
                              ? {
                                  backgroundColor: 'rgba(24, 24, 26, 0.92)',
                                  borderColor: 'rgba(255, 255, 255, 0.16)',
                                }
                              : {
                                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                  borderColor: 'rgba(0, 0, 0, 0.08)',
                                },
                          ]}
                          onPress={() => showCardActionMenu(linkIndex, 'classic')}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                          <MaterialIcons
                            name="more-vert"
                            size={18}
                            color={isDarkMode ? '#F5F5F5' : '#1A1A1A'}
                          />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  ) : currentDesign === 'minimal' ? (
                    <TouchableOpacity 
                      style={[
                        sharedLinkLayoutStyles.linkCard,
                        designStyles.linkItem,
                        linkWrapperStyle,
                        editingLinkIndex === linkIndex && styles.linkItemEditing,
                        gridItemSpacing,
                        { 
                          backgroundColor: 'transparent',
                          borderWidth: 0,
                        }
                      ]}
                      onPress={(event) => {
                        debugLog('Minimal card tapped for link:', link);
                        debugLog('Link URL:', link.url);
                        debugLog('Action display mode:', actionDisplayMode);
                        
                        if (editingLinkIndex !== linkIndex) {
                          if (actionDisplayMode === 'dropdown') {
                            showLinkDropdown(linkIndex, link, event);
                          } else {
                            handleLinkPress(link.url);
                          }
                        }
                      }}
                      disabled={editingLinkIndex === linkIndex}
                      activeOpacity={editingLinkIndex === linkIndex ? 1 : 0.7}
                      pointerEvents={editingLinkIndex === linkIndex ? "none" : "auto"}
                    >
                      {/* Preview Image - Full width on top */}
                      <View style={styles.previewWrapper}>
                        <View style={[sharedLinkLayoutStyles.previewContainer, designStyles.previewContainer]}>
                          {loadingPreviews[linkIndex] ? (
                            <View style={sharedLinkLayoutStyles.previewLoading}>
                              <ActivityIndicator size="small" color="#4a90e2" />
                            </View>
                          ) : linkPreviews[link.url]?.image ? (
                            <Image
                              source={{ 
                                uri: linkPreviews[link.url].image,
                                cache: 'force-cache'
                              }}
                              style={sharedLinkLayoutStyles.previewImage}
                              resizeMode="cover"
                              fadeDuration={0}
                              onError={() => {
                                debugLog('Image failed to load, removing it');
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
                            <View style={sharedLinkLayoutStyles.previewPlaceholder}>
                              {failedPreviews.has(link.url) ? (
                                <TouchableOpacity 
                                  style={styles.retryButton}
                                  onPress={() => retryFailedPreview(link.url, linkIndex)}
                                >
                                  <MaterialIcons name="refresh" size={24} color="#4a90e2" />
                                  <Text style={styles.retryText}>Retry</Text>
                                </TouchableOpacity>
                              ) : (
                                <MaterialIcons name="link" size={32} color="#ccc" />
                              )}
                            </View>
                          ) : (
                            <View style={sharedLinkLayoutStyles.previewLoading}>
                              <ActivityIndicator size="small" color="#4a90e2" />
                            </View>
                          )}
                          
                          {linkPreviews[link.url]?.siteName && (
                            <View style={styles.siteNameBadge}>
                              <Text style={styles.siteNameText}>
                                {normalizeSiteName(linkPreviews[link.url].siteName, link.url)}
                              </Text>
                            </View>
                          )}
                        </View>
                        {actionDisplayMode === 'on_card' && (
                          <TouchableOpacity
                            ref={(ref) => {
                              if (ref) {
                                menuButtonRefs.current[`minimal-${linkIndex}`] = ref;
                              } else {
                                delete menuButtonRefs.current[`minimal-${linkIndex}`];
                              }
                            }}
                            style={[
                              styles.minimalMenuButton,
                              isDarkMode
                                ? {
                                    backgroundColor: 'rgba(24, 24, 26, 0.85)',
                                    borderColor: 'rgba(255, 255, 255, 0.12)',
                                  }
                                : {
                                    backgroundColor: 'rgba(255, 255, 255, 0.88)',
                                    borderColor: 'rgba(0, 0, 0, 0.06)',
                                  },
                            ]}
                            onPress={() => showCardActionMenu(linkIndex, 'minimal')}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          >
                            <MaterialIcons
                              name="more-vert"
                              size={18}
                              color={isDarkMode ? '#F5F5F5' : '#1A1A1A'}
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                      
                      {/* Link Content - Below preview */}
                      <View style={[sharedLinkLayoutStyles.linkContent, designStyles.linkContent]}>
                        {editingLinkIndex === linkIndex ? (
                          <View style={styles.titleEditContainer}>
                            <TextInput
                              id={`edit-title-input-${linkIndex}`}
                              name={`edit-title-${linkIndex}`}
                              style={[styles.linkTitleInput, { color: isDarkMode ? '#ffffff' : '#333' }]}
                              value={editingTitle}
                              onChangeText={setEditingTitle}
                              accessibilityLabel="Edit link title"
                              accessibilityHint="Enter a new title for this link"
                              onBlur={() => {
                                // Don't auto-save on blur - only save when user explicitly clicks check button
                              }}
                              onSubmitEditing={() => {
                                if (editingTitle.trim() && editingTitle !== link.title) {
                                  updateLinkTitle(linkIndex);
                                }
                                setEditingLinkIndex(null);
                              }}
                              autoFocus
                              placeholder="Enter title"
                              placeholderTextColor={isDarkMode ? '#999' : '#666'}
                              returnKeyType="done"
                              maxLength={200}
                            />
                            <Text style={[styles.editingHint, { color: themedColors.textSecondary }]}>
                              {isUpdatingTitle ? 'Saving...' : 'Press ✓ to save, ✕ to cancel, or ↻ to restore original title'}
                            </Text>
                          </View>
                        ) : (
                          <>
                            <Text style={[designStyles.linkTitle, { color: isDarkMode ? '#ffffff' : '#333' }]} numberOfLines={2}>
                              {getDisplayTitle(link, linkPreviews[link.url])}
                            </Text>
                            <Text style={[sharedLinkLayoutStyles.linkDate, { color: isDarkMode ? '#999' : '#999' }]}>
                              Added {link.timestamp ? new Date(link.timestamp).toLocaleDateString() : 'Unknown date'}
                            </Text>
                          </>
                        )}
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={[
                        sharedLinkLayoutStyles.linkCard,
                        designStyles.linkItem,
                        linkWrapperStyle,
                        editingLinkIndex === linkIndex && styles.linkItemEditing,
                        gridItemSpacing,
                        { 
                          backgroundColor: 'transparent',
                          borderWidth: 0,
                        }
                      ]}
                      onPress={(event) => {
                        debugLog('Card content tapped for link:', link);
                        debugLog('Link URL:', link.url);
                        debugLog('Action display mode:', actionDisplayMode);
                        debugLog('Editing index:', editingLinkIndex, 'Current index:', linkIndex);
                        
                        if (editingLinkIndex !== linkIndex) {
                          // In dropdown mode (any design), show dropdown
                          if (actionDisplayMode === 'dropdown') {
                            showLinkDropdown(linkIndex, link, event);
                          } else {
                            handleLinkPress(link.url);
                          }
                        }
                      }}
                      disabled={editingLinkIndex === linkIndex}
                      activeOpacity={editingLinkIndex === linkIndex ? 1 : 0.7}
                      pointerEvents={editingLinkIndex === linkIndex ? "none" : "auto"}
                    >
                      {/* Link Preview Image - Positioned on the left */}
                      <View style={[
                        sharedLinkLayoutStyles.previewContainer,
                        designStyles.previewContainer,
                        currentDesign === 'modern' && isYouTubeLandscape(link.url) && styles.aspect16x9,
                        currentDesign === 'modern' && isPortraitThreeFour(link.url) && styles.aspect9x16,
                        currentDesign === 'modern' && isInstagramStandardPost(link.url) && !isPortraitThreeFour(link.url) && styles.aspect4x5,
                        currentDesign === 'modern' && isYouTubeLandscape(link.url) && styles.videoThumbBackground
                      ]}>
                        {loadingPreviews[linkIndex] ? (
                          <View style={sharedLinkLayoutStyles.previewLoading}>
                            <ActivityIndicator size="small" color="#4a90e2" />
                          </View>
                        ) : linkPreviews[link.url]?.image ? (
                          currentDesign === 'modern' && isYouTubeLandscape(link.url) ? (
                            <View style={styles.videoBox16x9}>
                              <Image
                                source={{ 
                                  uri: linkPreviews[link.url].image,
                                  cache: 'force-cache'
                                }}
                                style={styles.videoImageCover}
                                resizeMode="cover"
                                onError={() => {
                                  debugLog('Image failed to load, removing it');
                                  setLinkPreviews(prev => ({
                                    ...prev,
                                    [link.url]: {
                                      ...prev[link.url],
                                      image: null
                                    }
                                  }));
                                }}
                              />
                            </View>
                          ) : (
                            <Image
                              source={{ 
                                uri: linkPreviews[link.url].image,
                                cache: currentDesign === 'modern' ? 'force-cache' : 'default'
                              }}
                              style={[
                                sharedLinkLayoutStyles.previewImage,
                                currentDesign === 'modern' && { resizeMethod: 'scale' }
                              ]}
                              resizeMode="cover"
                              fadeDuration={0}
                              onError={() => {
                                debugLog('Image failed to load, removing it');
                                setLinkPreviews(prev => ({
                                  ...prev,
                                  [link.url]: {
                                    ...prev[link.url],
                                    image: null
                                  }
                                }));
                              }}
                            />
                          )
                        ) : linkPreviews[link.url] ? (
                          <View style={sharedLinkLayoutStyles.previewPlaceholder}>
                            {failedPreviews.has(link.url) ? (
                              <TouchableOpacity 
                                style={styles.retryButton}
                                onPress={() => retryFailedPreview(link.url, linkIndex)}
                              >
                                <MaterialIcons name="refresh" size={24} color="#4a90e2" />
                                <Text style={styles.retryText}>Retry</Text>
                              </TouchableOpacity>
                            ) : (
                              <MaterialIcons name="link" size={32} color="#ccc" />
                            )}
                          </View>
                        ) : (
                          <View style={sharedLinkLayoutStyles.previewLoading}>
                            <ActivityIndicator size="small" color="#4a90e2" />
                          </View>
                        )}
                        {linkPreviews[link.url]?.siteName && (
                          <View style={styles.siteNameBadge}>
                            <Text style={styles.siteNameText}>
                            {normalizeSiteName(linkPreviews[link.url].siteName, link.url)}
                            </Text>
                          </View>
                        )}
                        {actionDisplayMode === 'on_card' && currentDesign === 'grid' && (
                          <TouchableOpacity
                            ref={(ref) => {
                              if (ref) {
                                menuButtonRefs.current[`grid-${linkIndex}`] = ref;
                              } else {
                                delete menuButtonRefs.current[`grid-${linkIndex}`];
                              }
                            }}
                            style={[
                              styles.gridMenuButton,
                              isDarkMode
                                ? {
                                    backgroundColor: 'rgba(24, 24, 26, 0.85)',
                                    borderColor: 'rgba(255, 255, 255, 0.12)',
                                  }
                                : {
                                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                    borderColor: 'rgba(0, 0, 0, 0.08)',
                                  },
                            ]}
                            onPress={() => showCardActionMenu(linkIndex, 'grid')}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          >
                            <MaterialIcons
                              name="more-vert"
                              size={18}
                              color={isDarkMode ? '#F5F5F5' : '#1A1A1A'}
                            />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Text content positioned on the right */}
                      <View style={[sharedLinkLayoutStyles.linkContent, designStyles.linkContent]}>
                        <View style={[
                          styles.linkTextContainer,
                          currentDesign === 'classic' && {
                            overflow: 'hidden',
                            justifyContent: 'center',
                            maxWidth: '100%',
                            flexShrink: 1,
                          }
                        ]}>
                          {editingLinkIndex === linkIndex ? (
                            <View style={styles.editingContainer}>
                              <TextInput
                                id={`edit-title-input-${linkIndex}`}
                                name={`edit-title-${linkIndex}`}
                                style={[styles.linkTitleInput, { color: isDarkMode ? '#ffffff' : '#333' }]}
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
                                    updateLinkTitle(linkIndex);
                                  }
                                  setEditingLinkIndex(null);
                                }}
                                autoFocus
                                placeholder="Enter title"
                                placeholderTextColor={isDarkMode ? '#999' : '#666'}
                                returnKeyType="done"
                                maxLength={200}
                              />
                              <Text style={[styles.editingHint, { color: themedColors.textSecondary }]}>
                                {isUpdatingTitle ? 'Saving...' : 'Press ✓ to save, ✕ to cancel, or ↻ to restore original title'}
                              </Text>
                            </View>
                          ) : (
                            <>
                              <Text style={[designStyles.linkTitle, { color: isDarkMode ? '#ffffff' : '#333' }]} numberOfLines={2}>
                                {getDisplayTitle(link, linkPreviews[link.url])}
                              </Text>
                              <Text style={[sharedLinkLayoutStyles.linkDate, { color: isDarkMode ? '#999' : '#999' }]}>
                                Added {link.timestamp ? new Date(link.timestamp).toLocaleDateString() : 'Unknown date'}
                              </Text>
                            </>
                          )}
                          {currentDesign !== 'classic' && linkPreviews[link.url]?.description && (
                            <Text style={[styles.linkDescription, designStyles.linkDescription, { color: themedColors.textSecondary }]} numberOfLines={3}>
                              {linkPreviews[link.url].description}
                            </Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Action buttons - conditional based on design */}
                  {actionDisplayMode === 'dropdown' ? (
                    editingLinkIndex === linkIndex && (
                      <View style={[styles.linkActions, designStyles.linkActions]} pointerEvents="auto">
                        <TouchableOpacity 
                          style={[styles.editButton, designStyles.editButton]}
                          onPress={() => {
                            if (editingLinkIndex === linkIndex) {
                              updateLinkTitle(linkIndex);
                            } else {
                              setEditingLinkIndex(linkIndex);
                              setEditingTitle(getDisplayTitle(link, linkPreviews[link.url]));
                            }
                          }}
                          disabled={isUpdatingTitle}
                        >
                          {isUpdatingTitle && editingLinkIndex === linkIndex ? (
                            <ActivityIndicator size="small" color="#4CAF50" />
                          ) : (
                            <MaterialIcons 
                              name={editingLinkIndex === linkIndex ? "check" : "edit"} 
                              size={20} 
                              color={editingLinkIndex === linkIndex ? "#4CAF50" : (isDarkMode ? "#ffffff" : "#1a1a1a")} 
                            />
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.refreshEditButton, designStyles.editButton]}
                          onPress={async () => {
                            try {
                              showSuccessMessage('Re-fetching original title...');
                              const freshTitle = await fetchLinkTitleOnly(link.url);
                              if (freshTitle) {
                                setEditingTitle(freshTitle);
                                showSuccessMessage('Original title restored!');
                              } else {
                                const cachedTitle = getDisplayTitle(link, linkPreviews[link.url]);
                                setEditingTitle(cachedTitle);
                                showSuccessMessage('Using cached title');
                              }
                            } catch (error) {
                              const cachedTitle = getDisplayTitle(link, linkPreviews[link.url]);
                              setEditingTitle(cachedTitle);
                              showSuccessMessage('Failed to re-fetch, using cached title');
                            }
                          }}
                          activeOpacity={0.7}
                          pointerEvents="auto"
                        >
                          <MaterialIcons name="refresh" size={20} color={isDarkMode ? "#ffffff" : "#4a90e2"} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.cancelEditButton, designStyles.editButton]}
                          onPress={() => {
                            setEditingLinkIndex(null);
                            setEditingTitle('');
                          }}
                          activeOpacity={0.7}
                          pointerEvents="auto"
                        >
                          <MaterialIcons name="close" size={20} color={isDarkMode ? "#ffffff" : "#FF4444"} />
                        </TouchableOpacity>
                      </View>
                    )
                  ) : currentDesign === 'classic' ? null : currentDesign === 'minimal' ? (
                    editingLinkIndex === linkIndex && (
                      <View style={[styles.linkActions, designStyles.linkActions]} pointerEvents="auto">
                        <TouchableOpacity 
                          style={[styles.editButton, designStyles.editButton]}
                          onPress={() => {
                            if (editingLinkIndex === linkIndex) {
                              // Save the changes
                              updateLinkTitle(linkIndex);
                            } else {
                              // Start editing
                              setEditingLinkIndex(linkIndex);
                              // Use the same logic as display: custom title > preview title > URL
                              setEditingTitle(getDisplayTitle(link, linkPreviews[link.url]));
                            }
                          }}
                          disabled={isUpdatingTitle}
                        >
                          {isUpdatingTitle && editingLinkIndex === linkIndex ? (
                            <ActivityIndicator size="small" color="#4CAF50" />
                          ) : (
                            <MaterialIcons 
                              name={editingLinkIndex === linkIndex ? "check" : "edit"} 
                              size={20} 
                              color={editingLinkIndex === linkIndex ? "#4CAF50" : (isDarkMode ? "#ffffff" : "#1a1a1a")} 
                            />
                          )}
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={[styles.refreshEditButton, designStyles.editButton]}
                          onPress={async () => {
                            debugLog('Refresh button pressed!');
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
                          <MaterialIcons name="refresh" size={20} color={isDarkMode ? "#ffffff" : "#4a90e2"} />
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={[styles.cancelEditButton, designStyles.editButton]}
                          onPress={() => {
                            debugLog('Cancel button pressed!');
                            setEditingLinkIndex(null);
                            setEditingTitle('');
                          }}
                          activeOpacity={0.7}
                          pointerEvents="auto"
                        >
                          <MaterialIcons name="close" size={20} color={isDarkMode ? "#ffffff" : "#FF4444"} />
                        </TouchableOpacity>
                      </View>
                    )
                  ) : (
                    actionDisplayMode === 'on_card'
                      ? currentDesign === 'grid'
                        ? null
                        : (
                          <View style={[styles.linkActions, designStyles.linkActions]}>
                            <TouchableOpacity 
                              style={[styles.editButton, designStyles.editButton]}
                              onPress={() => openCustomPreviewEditor(linkIndex)}
                            >
                              <MaterialIcons 
                                name="edit" 
                                size={20} 
                                color={isDarkMode ? "#ffffff" : "#1a1a1a"} 
                              />
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                              style={[styles.deleteButton, designStyles.deleteButton]}
                              onPress={() => deleteLink(linkIndex)}
                            >
                              <MaterialIcons name="delete-outline" size={20} color={isDarkMode ? "#ffffff" : "#1a1a1a"} />
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={[styles.customPreviewButton, designStyles.editButton]}
                              onPress={() => toggleLinkFavorite(linkIndex)}
                            >
                              <MaterialIcons 
                                name={link.isFavorite ? "star" : "star-border"} 
                                size={20} 
                                color={link.isFavorite ? "#FFD700" : (isDarkMode ? "#ffffff" : "#1a1a1a")} 
                              />
                            </TouchableOpacity>
                            <TouchableOpacity 
                              onPress={() => handleShareLink(link.url, getDisplayTitle(link, linkPreviews[link.url]))}
                              style={[styles.openButton, designStyles.openButton]}
                            >
                              <MaterialIcons name="share" size={20} color={isDarkMode ? "#ffffff" : "#1a1a1a"} />
                            </TouchableOpacity>
                          </View>
                        )
                      : null
                  )}
                {shouldShowSeparator && (
                  <View
                    style={[
                    styles.linkSeparator,
                    currentDesign === 'modern' && styles.linkSeparatorModern,
                      { backgroundColor: (isDarkMode || themeMode === 'gray') ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.18)' }
                    ]}
                  />
                )}
                </React.Fragment>
              );
            })}
          </View>
        </View>
      </ScrollView>
      </Animated.View>

      {/* Global Dropdown Menu - rendered outside ScrollView to prevent clipping */}
      {actionDisplayMode === 'dropdown' && activeMenuIndex !== null && selectedLinkForMenu !== null && (
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
                backgroundColor: isDarkMode ? '#2a2a2a' : '#fff',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
              }
            ]}
          >
              <TouchableOpacity 
                style={styles.menuItem}
              onPress={() => {
                openCustomPreviewEditor(selectedLinkForMenu);
                closeMenu();
              }}
            >
              <MaterialIcons name="edit" size={18} color={isDarkMode ? "#ffffff" : "#1a1a1a"} />
              <Text style={[styles.menuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Edit</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                deleteLink(selectedLinkForMenu);
                closeMenu();
              }}
            >
              <MaterialIcons name="delete-outline" size={18} color={isDarkMode ? "#ffffff" : "#1a1a1a"} />
              <Text style={[styles.menuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Delete</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                const link = links[selectedLinkForMenu];
                if (link) {
                  handleShareLink(link.url, getDisplayTitle(link, linkPreviews[link.url]));
                }
                closeMenu();
              }}
            >
              <MaterialIcons name="share" size={18} color={isDarkMode ? "#ffffff" : "#1a1a1a"} />
              <Text style={[styles.menuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Share</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                openCustomPreviewEditor(selectedLinkForMenu);
                closeMenu();
              }}
            >
              <MaterialIcons name="image" size={18} color={isDarkMode ? "#ffffff" : "#1a1a1a"} />
              <Text style={[styles.menuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Edit</Text>
            </TouchableOpacity>
            
            <View style={[styles.menuDivider, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#e0e0e0' }]} />
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={closeMenu}
            >
              <MaterialIcons name="close" size={18} color={themedColors.textSecondary} />
              <Text style={[styles.menuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {cardActionMenu.visible && cardMenuLink && (
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          activeOpacity={1}
          onPress={closeCardActionMenu}
        >
          <View
            style={[
              styles.cardMenuContainer,
              {
                top: cardActionMenu.position.y,
                left: cardActionMenu.position.x,
                backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
              }
            ]}
          >
            <TouchableOpacity
              style={styles.cardMenuItem}
              onPress={() => {
                closeCardActionMenu();
                openCustomPreviewEditor(cardActionMenu.index);
              }}
            >
              <MaterialIcons name="edit" size={18} color={isDarkMode ? '#ffffff' : '#1a1a1a'} />
              <Text style={[styles.cardMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                Edit
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cardMenuItem}
              onPress={async () => {
                await toggleLinkFavorite(cardActionMenu.index);
                closeCardActionMenu();
              }}
            >
              <MaterialIcons
                name={
                  (linkFavorites[cardMenuLink.url] ?? cardMenuLink.isFavorite)
                    ? 'star'
                    : 'star-border'
                }
                size={18}
                color={
                  (linkFavorites[cardMenuLink.url] ?? cardMenuLink.isFavorite)
                    ? '#FFD700'
                    : (isDarkMode ? '#ffffff' : '#1a1a1a')
                }
              />
              <Text style={[styles.cardMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                {(linkFavorites[cardMenuLink.url] ?? cardMenuLink.isFavorite) ? 'Unfavorite' : 'Favorite'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cardMenuItem}
              onPress={async () => {
                await handleShareLink(
                  cardMenuLink.url,
                  getDisplayTitle(cardMenuLink, linkPreviews[cardMenuLink.url])
                );
                closeCardActionMenu();
              }}
            >
              <MaterialIcons name="share" size={18} color={isDarkMode ? '#ffffff' : '#1a1a1a'} />
              <Text style={[styles.cardMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                Share
              </Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#e0e0e0' }]} />
            <TouchableOpacity
              style={[styles.cardMenuItem, { backgroundColor: isDarkMode ? 'rgba(255, 68, 68, 0.12)' : 'rgba(255, 68, 68, 0.08)' }]}
              onPress={async () => {
                await deleteLink(cardActionMenu.index);
                closeCardActionMenu();
              }}
            >
              <MaterialIcons name="delete-outline" size={18} color="#FF4444" />
              <Text style={[styles.cardMenuItemText, { color: '#FF4444', fontWeight: '600' }]}>
                Delete
              </Text>
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
                backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
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
              <Text style={[styles.minimalMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Open Link</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.minimalMenuItem}
              onPress={() => {
                openCustomPreviewEditor(selectedLinkForDropdown.index);
                closeLinkDropdown();
              }}
            >
              <MaterialIcons name="image" size={18} color={isDarkMode ? "#ffffff" : "#1a1a1a"} />
              <Text style={[styles.minimalMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Edit</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.minimalMenuItem}
              onPress={() => {
                toggleLinkFavorite(selectedLinkForDropdown.index);
                closeLinkDropdown();
              }}
            >
              <MaterialIcons 
                name={linkFavorites[selectedLinkForDropdown.link.url] ? "star" : "star-border"} 
                size={18} 
                color="#FFD700" 
              />
              <Text style={[styles.minimalMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                {linkFavorites[selectedLinkForDropdown.link.url] ? 'Unfavorite' : 'Favorite'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.minimalMenuItem}
              onPress={() => {
                handleShareLink(selectedLinkForDropdown.link.url, getDisplayTitle(selectedLinkForDropdown.link, linkPreviews[selectedLinkForDropdown.link.url]));
                closeLinkDropdown();
              }}
            >
              <MaterialIcons name="share" size={18} color={isDarkMode ? "#ffffff" : "#1a1a1a"} />
              <Text style={[styles.minimalMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Share</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.minimalMenuItem}
              onPress={() => {
                deleteLink(selectedLinkForDropdown.index);
                closeLinkDropdown();
              }}
            >
              <MaterialIcons name="delete-outline" size={18} color={isDarkMode ? "#ffffff" : "#1a1a1a"} />
              <Text style={[styles.minimalMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Delete</Text>
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
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#2a2a2a' : '#fff' }]}>
            <Text style={[styles.modalTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>Edit Title</Text>
            <TextInput
              id="modal-title-input"
              name="modal-title"
              style={[styles.modalInput, { 
                backgroundColor: isDarkMode ? '#1a1a1a' : '#fff',
                color: isDarkMode ? '#ffffff' : '#333',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#e0e0e0'
              }]}
              value={titleInput}
              onChangeText={setTitleInput}
              placeholder="Enter new title"
              placeholderTextColor={isDarkMode ? '#999' : '#a9a9a9'}
              textAlign="left"
              accessibilityLabel="Enter new title"
              accessibilityHint="Type a new title for your link"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: isDarkMode ? '#3a3a3a' : '#f0f0f0' }]} 
                onPress={() => {
                  setIsTitleModalVisible(false);
                  setTitleInput('');
                  setEditingLinkIndex(null);
                }}
              >
                <Text style={[styles.buttonText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Cancel</Text>
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
                backgroundColor: themedColors.surface,
                borderColor: themedColors.border
              }
            ]}
          >
            {Object.entries(designs).map(([designKey, design]) => (
              <TouchableOpacity
                key={designKey}
                style={[
                  styles.designDropdownItem,
                  currentDesign === designKey && styles.designDropdownItemActive,
                  { backgroundColor: isDarkMode ? '#2a2a2a' : '#fff' }
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
                    currentDesign === designKey && styles.designDropdownItemTitleActive,
                    { color: isDarkMode ? '#ffffff' : '#333' }
                  ]}>
                    {design.name}
                  </Text>
                  {currentDesign === designKey && (
                    <MaterialIcons name="check-circle" size={18} color="#4CAF50" />
                  )}
                </View>
                <Text style={[
                  styles.designDropdownItemDescription,
                  currentDesign === designKey && styles.designDropdownItemDescriptionActive,
                  { color: isDarkMode ? '#cccccc' : '#666' }
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
        animationType="fade"
        onRequestClose={closeCustomPreviewModal}
      >
        <View style={styles.customPreviewModalOverlay}>
          <View style={[styles.customPreviewModal, { backgroundColor: isDarkMode ? '#2a2a2a' : '#fff' }]}>
            <View style={styles.customPreviewHeader}>
              <Text style={[styles.customPreviewTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>Customize Preview</Text>
              <TouchableOpacity 
                onPress={closeCustomPreviewModal}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color={isDarkMode ? '#cccccc' : '#666'} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.customPreviewContent}>
              {/* Image Section */}
              <View style={styles.customPreviewSection}>
                <View style={styles.sectionTitleContainer}>
                  <Text style={[styles.customPreviewSectionTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>Preview Image</Text>
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
                <Text style={[styles.imageHintText, { color: themedColors.textSecondary }]}>
                  Take a screenshot of the content or upload your own image
                </Text>
              </View>

              {/* Title Section */}
              <View style={styles.customPreviewSection}>
                <Text style={[styles.customPreviewSectionTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>Title</Text>
                <TextInput
                  id="custom-preview-title-input"
                  name="custom-preview-title"
                  style={[styles.customPreviewInput, { 
                    backgroundColor: isDarkMode ? '#1a1a1a' : '#f9f9f9',
                    color: isDarkMode ? '#ffffff' : '#333',
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#e0e0e0'
                  }]}
                  value={customPreviewData.title}
                  onChangeText={(text) => setCustomPreviewData(prev => ({ ...prev, title: text }))}
                  placeholder="Enter custom title"
                  placeholderTextColor={isDarkMode ? '#999' : '#999'}
                  multiline
                  accessibilityLabel="Custom preview title"
                  accessibilityHint="Enter a custom title for your link preview"
                />
              </View>

              {/* Description Section */}
              <View style={styles.customPreviewSection}>
                <Text style={[styles.customPreviewSectionTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>Description</Text>
                <TextInput
                  id="custom-preview-description-input"
                  name="custom-preview-description"
                  style={[styles.customPreviewInput, styles.descriptionInput, { 
                    backgroundColor: isDarkMode ? '#1a1a1a' : '#f9f9f9',
                    color: isDarkMode ? '#ffffff' : '#333',
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#e0e0e0'
                  }]}
                  value={customPreviewData.description}
                  onChangeText={(text) => setCustomPreviewData(prev => ({ ...prev, description: text }))}
                  placeholder="Enter custom description"
                  placeholderTextColor={isDarkMode ? '#999' : '#999'}
                  multiline
                  numberOfLines={3}
                  accessibilityLabel="Custom preview description"
                  accessibilityHint="Enter a custom description for your link preview"
                  maxLength={500}
                />
                {customPreviewData.description.length > 0 && (
                  <Text style={[styles.characterCount, { color: isDarkMode ? '#999' : '#999' }]}>
                    {customPreviewData.description.length}/500
                  </Text>
                )}
              </View>
            </ScrollView>

            <View style={styles.customPreviewActions}>
              <TouchableOpacity 
                style={[styles.customPreviewButton, styles.cancelButton, { backgroundColor: isDarkMode ? '#3a3a3a' : '#f0f0f0' }]}
                onPress={closeCustomPreviewModal}
              >
                <Text style={[styles.customPreviewButtonText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Cancel</Text>
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

      {/* Options Menu Dropdown */}
      {isOptionsMenuVisible && (
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          activeOpacity={1}
          onPress={() => setIsOptionsMenuVisible(false)}
        >
          <View 
            style={[
              styles.optionsDropdownMenu,
              optionsMenuAnchorStyle,
              {
                position: 'absolute',
                backgroundColor: isDarkMode ? '#2a2a2a' : '#fff',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
              }
            ]}
          >
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                setIsOptionsMenuVisible(false);
                showSuccessMessage('Export feature coming soon!');
              }}
            >
              <MaterialIcons name="file-download" size={18} color={isDarkMode ? "#ffffff" : "#1a1a1a"} />
              <Text style={[styles.menuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Export</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                setIsOptionsMenuVisible(false);
                handleShareCollection();
              }}
            >
              <MaterialIcons name="share" size={18} color={isDarkMode ? "#ffffff" : "#1a1a1a"} />
              <Text style={[styles.menuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Share Collection</Text>
            </TouchableOpacity>
            
            <View style={[styles.menuDivider, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#e0e0e0' }]} />

            <TouchableOpacity 
              style={[styles.menuItem, actionDisplayMode === 'on_card' && styles.menuItemActive]}
              onPress={() => {
                setActionDisplayMode('on_card');
                saveActionDisplayPreference('on_card');
                setIsOptionsMenuVisible(false);
              }}
            >
              <MaterialIcons name="more-vert" size={15} color={isDarkMode ? "#ffffff" : "#1a1a1a"} />
              <Text style={[styles.menuItemText, { color: isDarkMode ? '#ffffff' : '#333', fontSize: 13 }]}>Show buttons on cards</Text>
              {actionDisplayMode === 'on_card' && <MaterialIcons name="check" size={16} color="#4CAF50" />}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, actionDisplayMode === 'dropdown' && styles.menuItemActive]}
              onPress={() => {
                setActionDisplayMode('dropdown');
                saveActionDisplayPreference('dropdown');
                setIsOptionsMenuVisible(false);
              }}
            >
              <MaterialIcons name="view-agenda" size={15} color={isDarkMode ? "#ffffff" : "#1a1a1a"} />
              <Text style={[styles.menuItemText, { color: isDarkMode ? '#ffffff' : '#333', fontSize: 13 }]}>Show dropdown on tap</Text>
              {actionDisplayMode === 'dropdown' && <MaterialIcons name="check" size={16} color="#4CAF50" />}
            </TouchableOpacity>
            
            <View style={[styles.menuDivider, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#e0e0e0' }]} />
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                setIsOptionsMenuVisible(false);
                setIsSettingsMenuVisible(true);
              }}
            >
              <MaterialIcons name="settings" size={18} color={isDarkMode ? "#ffffff" : "#1a1a1a"} />
              <Text style={[styles.menuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Settings</Text>
              <MaterialIcons name="chevron-right" size={18} color={isDarkMode ? '#666' : '#999'} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* Sort Menu Dropdown */}
      {isSortMenuVisible && (
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          activeOpacity={1}
          onPress={() => setIsSortMenuVisible(false)}
        >
          <View 
            style={[
              styles.sortDropdownMenu,
              {
                position: 'absolute',
                top: 200,
                right: 20,
                backgroundColor: isDarkMode ? '#2a2a2a' : '#fff',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
              }
            ]}
          >
            <TouchableOpacity 
              style={[styles.sortMenuItem, sortType === 'newest' && styles.sortMenuItemActive]}
              onPress={() => {
                changeSortType('newest');
                setIsSortMenuVisible(false);
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="access-time" size={20} color={isDarkMode ? "#ffffff" : "#1a1a1a"} />
              <Text style={[styles.sortMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Newest First</Text>
              {sortType === 'newest' && <MaterialIcons name="check" size={20} color="#4CAF50" />}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.sortMenuItem, sortType === 'alphabetical' && styles.sortMenuItemActive]}
              onPress={() => {
                changeSortType('alphabetical');
                setIsSortMenuVisible(false);
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="sort-by-alpha" size={20} color={isDarkMode ? "#ffffff" : "#1a1a1a"} />
              <Text style={[styles.sortMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>A-Z</Text>
              {sortType === 'alphabetical' && <MaterialIcons name="check" size={20} color="#4CAF50" />}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.sortMenuItem, sortType === 'favorites' && styles.sortMenuItemActive]}
              onPress={() => {
                changeSortType('favorites');
                setIsSortMenuVisible(false);
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="star" size={20} color={isDarkMode ? "#ffffff" : "#1a1a1a"} />
              <Text style={[styles.sortMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Favorites</Text>
              {sortType === 'favorites' && <MaterialIcons name="check" size={20} color="#4CAF50" />}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        transparent={true}
        visible={deleteConfirmModalVisible}
        animationType="fade"
        onRequestClose={() => setDeleteConfirmModalVisible(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={[styles.deleteModalContent, { 
            backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
          }]}>
            <MaterialIcons name="warning" size={50} color="#FF4444" style={styles.deleteWarningIcon} />
            <Text style={[styles.deleteModalTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
              Move to Trash
            </Text>
            <Text style={[styles.deleteModalText, { color: themedColors.textSecondary }]}>
              Are you sure you want to move "{collectionToDelete?.title}" to trash? You can restore it within 30 days.
            </Text>
            
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity 
                style={[styles.deleteModalButton, styles.cancelDeleteButton, { 
                  backgroundColor: isDarkMode ? '#3a3a3a' : '#f0f0f0',
                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'
                }]}
                onPress={() => {
                  setDeleteConfirmModalVisible(false);
                  setCollectionToDelete(null);
                }}
              >
                <Text style={[styles.deleteModalButtonText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.deleteModalButton, styles.confirmDeleteButton]}
                onPress={confirmDeleteCollection}
              >
                <Text style={styles.confirmDeleteButtonText}>
                  Move to Trash
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings Menu Dropdown - Clean & Minimal Design */}
      {isSettingsMenuVisible && (
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          activeOpacity={1}
          onPress={() => setIsSettingsMenuVisible(false)}
        >
          <Animated.View 
            style={[
              styles.settingsDropdownMenu,
              settingsMenuAnchorStyle,
              {
                position: 'absolute',
                backgroundColor: isDarkMode ? '#2c2c2c' : '#ffffff',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'
              }
            ]}
          >
            {!currentCollection?.isDeleted && (
              <>
                <TouchableOpacity 
                  style={styles.settingsMenuItem}
                  onPress={() => {
                    setIsSettingsMenuVisible(false);
                    setShowImageSourceModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="photo-library" size={20} color={isDarkMode ? '#ffffff' : '#333'} />
                  <Text style={[styles.settingsMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Change Image</Text>
                  <MaterialIcons name="chevron-right" size={18} color={isDarkMode ? '#666' : '#ccc'} style={styles.menuChevron} />
                </TouchableOpacity>
                
                {currentCollection?.imageLink && (
                  <TouchableOpacity 
                    style={styles.settingsMenuItem}
                    onPress={() => {
                      setIsSettingsMenuVisible(false);
                      handleDeleteImage();
                    }}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="delete" size={20} color={isDarkMode ? '#ffffff' : '#333'} />
                    <Text style={[styles.settingsMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Delete Image</Text>
                    <MaterialIcons name="chevron-right" size={18} color={isDarkMode ? '#666' : '#ccc'} style={styles.menuChevron} />
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity 
                  style={styles.settingsMenuItem}
                  onPress={() => {
                    setIsSettingsMenuVisible(false);
                    startEditingTitle();
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="edit" size={20} color={isDarkMode ? '#ffffff' : '#333'} />
                  <Text style={[styles.settingsMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Edit Collection</Text>
                  <MaterialIcons name="chevron-right" size={18} color={isDarkMode ? '#666' : '#ccc'} style={styles.menuChevron} />
                </TouchableOpacity>
                
                <View style={[styles.settingsMenuDivider, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' }]} />
                
                <TouchableOpacity 
                  style={styles.settingsMenuItem}
                  onPress={() => {
                    setIsSettingsMenuVisible(false);
                    handleDeleteCollection();
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="delete-forever" size={20} color="#FF4444" />
                  <Text style={[styles.settingsMenuItemText, { color: '#FF4444' }]}>Move to Trash</Text>
                  <MaterialIcons name="chevron-right" size={18} color="#FF4444" style={styles.menuChevron} />
                </TouchableOpacity>
              </>
            )}
            
            {currentCollection?.isDeleted && (
              <>
                <TouchableOpacity 
                  style={styles.settingsMenuItem}
                  onPress={() => {
                    setIsSettingsMenuVisible(false);
                    restoreCollection();
                  }}
                  disabled={isRestoringCollection}
                  activeOpacity={0.7}
                >
                  {isRestoringCollection ? (
                    <>
                      <ActivityIndicator size="small" color={isDarkMode ? '#ffffff' : '#333'} />
                      <Text style={[styles.settingsMenuItemText, { color: isDarkMode ? '#ffffff' : '#333', marginLeft: 12, flex: 1 }]}>Restoring...</Text>
                    </>
                  ) : (
                    <>
                      <MaterialIcons name="restore" size={20} color={isDarkMode ? '#ffffff' : '#333'} />
                      <Text style={[styles.settingsMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Restore Collection</Text>
                      <MaterialIcons name="chevron-right" size={18} color={isDarkMode ? '#666' : '#ccc'} style={styles.menuChevron} />
                    </>
                  )}
                </TouchableOpacity>
                
                <View style={[styles.settingsMenuDivider, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' }]} />
                
                <TouchableOpacity 
                  style={[styles.settingsMenuItem, { opacity: isRestoringCollection ? 0.5 : 1 }]}
                  onPress={() => {
                    setIsSettingsMenuVisible(false);
                    permanentDeleteCollection();
                  }}
                  disabled={isRestoringCollection}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="delete-forever" size={20} color="#FF4444" />
                  <Text style={[styles.settingsMenuItemText, { color: '#FF4444' }]}>Delete Forever</Text>
                  <MaterialIcons name="chevron-right" size={18} color="#FF4444" style={styles.menuChevron} />
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </TouchableOpacity>
      )}

      {/* Image Source Selection Modal */}
      <Modal
        transparent={true}
        visible={showImageSourceModal}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => {
          setShowImageSourceModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.imageSourceModalContent, { 
            backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' 
          }]}>
            <View style={styles.imageSourceModalHeader}>
              <Text style={[styles.imageSourceModalTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                Select Image Source
              </Text>
              <TouchableOpacity 
                onPress={() => {
                  setShowImageSourceModal(false);
                }}
                style={styles.imageSourceModalCloseButton}
              >
                <MaterialIcons name="close" size={24} color={isDarkMode ? '#ffffff' : '#333'} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.imageSourceOptions}>
              <TouchableOpacity
                style={[styles.imageSourceOption, { 
                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                  backgroundColor: isDarkMode ? '#3a3a3a' : '#f8f9fa'
                }]}
                onPress={() => {
                  setShowImageSourceModal(false);
                  handleChangeImage();
                }}
                activeOpacity={0.7}
              >
                <MaterialIcons name="photo-library" size={32} color="#4A90E2" />
                <Text style={[styles.imageSourceOptionText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                  Gallery
                </Text>
                <Text style={[styles.imageSourceOptionSubtext, { color: themedColors.textSecondary }]}>
                  Choose from your photos
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.imageSourceOption, { 
                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                  backgroundColor: isDarkMode ? '#3a3a3a' : '#f8f9fa',
                  opacity: loadingThumbnails ? 0.6 : 1
                }]}
                onPress={async () => {
                  setShowImageSourceModal(false);
                  await openThumbnailSelector();
                }}
                activeOpacity={0.7}
                disabled={loadingThumbnails}
              >
                {loadingThumbnails ? (
                  <ActivityIndicator size="small" color="#4CAF50" />
                ) : (
                  <MaterialIcons name="image-search" size={32} color="#4CAF50" />
                )}
                <Text style={[styles.imageSourceOptionText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                  Link Thumbnails
                </Text>
                <Text style={[styles.imageSourceOptionSubtext, { color: themedColors.textSecondary }]}>
                  Use thumbnails from links in this collection
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {loadingThumbnails && (
        <Modal
          transparent={true}
          visible={loadingThumbnails}
          animationType="fade"
        >
          <View style={styles.loadingThumbnailsOverlay}>
            <View style={[styles.loadingThumbnailsContent, { 
              backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' 
            }]}>
              <ActivityIndicator size="large" color="#4A90E2" />
              <Text style={[styles.loadingThumbnailsText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                Loading thumbnails...
              </Text>
            </View>
          </View>
        </Modal>
      )}

      {updatingImage && (
        <Modal
          transparent={true}
          visible={updatingImage}
          animationType="fade"
        >
          <View style={styles.updatingImageOverlay}>
            <View style={[styles.updatingImageContent, { 
              backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' 
            }]}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={[styles.updatingImageText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                Updating image...
              </Text>
            </View>
          </View>
        </Modal>
      )}

      <Modal
        transparent={true}
        visible={showThumbnailSelector}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setShowThumbnailSelector(false)}
      >
        <View style={styles.thumbnailModalOverlay}>
          <View style={[styles.thumbnailModalContent, { 
            backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' 
          }]}>
            <View style={styles.thumbnailModalHeader}>
              <Text style={[styles.thumbnailModalTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                Select Image from Links
              </Text>
              <TouchableOpacity 
                onPress={() => setShowThumbnailSelector(false)}
                style={styles.thumbnailModalCloseButton}
              >
                <MaterialIcons name="close" size={24} color={isDarkMode ? '#ffffff' : '#333'} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.thumbnailScrollView}>
              <View style={styles.thumbnailGrid}>
                {collectionThumbnails.map((thumbnail, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.thumbnailCard}
                    onPress={() => selectThumbnailAsImage(thumbnail.url)}
                    activeOpacity={0.7}
                  >
                    <Image 
                      source={{ uri: thumbnail.url }} 
                      style={styles.thumbnailImage}
                      resizeMode="cover"
                    />
                    <View style={styles.thumbnailOverlay}>
                      <MaterialIcons name="check-circle" size={24} color="#4CAF50" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {isDesignMenuVisible && (
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          activeOpacity={1}
          onPress={() => setIsDesignMenuVisible(false)}
        >
          <View 
            style={[
              styles.designDropdownMenu,
              {
                position: 'absolute',
                top: 200,
                right: 20,
                backgroundColor: isDarkMode ? '#2a2a2a' : '#fff',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
              }
            ]}
          >
            {Object.entries(designs).map(([designKey, design]) => {
              const getDesignIcon = (key) => {
                switch (key) {
                  case 'modern':
                    return 'dashboard';
                  case 'classic':
                    return 'view-list';
                  case 'minimal':
                    return 'view-stream';
                  case 'grid':
                    return 'view-module';
                  default:
                    return 'view-module';
                }
              };

              return (
                <TouchableOpacity
                  key={designKey}
                  style={[
                    styles.menuItem,
                    currentDesign === designKey && styles.menuItemActive
                  ]}
                  onPress={() => {
                    changeDesign(designKey);
                    setIsDesignMenuVisible(false);
                  }}
                >
                  <MaterialIcons 
                    name={getDesignIcon(designKey)} 
                    size={18} 
                    color={isDarkMode ? "#ffffff" : "#1a1a1a"} 
                  />
                  <Text style={[styles.menuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                    {design.name}
                  </Text>
                  {currentDesign === designKey && <MaterialIcons name="check" size={18} color="#4CAF50" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  // Sticky Navigation Only Styles
  stickyNavigationOnly: {
    paddingTop: 0,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  topNavigationBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    paddingHorizontal: 8,
  },
  // Collection Info - Scrollable
  collectionInfoScrollable: {
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  backButton: {
    padding: 12,
    borderRadius: 24,
    backgroundColor: 'transparent',
    marginLeft: -12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 2,
    marginRight: -12,
  },
  headerButton: {
    padding: 12,
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
  collectionInfo: {
    alignItems: 'center',
  },
  collectionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  collectionTitleInput: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    minHeight: 60,
  },
  collectionDescriptionInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    minHeight: 80,
    maxHeight: 150,
  },
  collectionDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  collectionEditButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  collectionEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  collectionCancelButton: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  collectionSaveButton: {
    backgroundColor: '#4a90e2',
  },
  collectionEditButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  collectionEditButtonTextSave: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  contentContainer: {
    padding: 16,
    paddingTop: 12,
  },
  // New Section Header Styles
  linksSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  linksCount: {
    fontSize: 16,
    fontWeight: '500',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  // Legacy section header (keeping for compatibility)
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
  // Quick Add Link Input Styles - Modern & Compact
  linkInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
    backgroundColor: 'transparent',
    borderRadius: 14,
    padding: 0,
  },
  inputFieldsContainer: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    height: 46,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#e8eaed',
    shadowColor: '#4a90e2',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  linkInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#333',
    textAlign: 'left',
  },
  addButtonContainer: {
  },
  addButton: {
    width: 46,
    height: 46,
    backgroundColor: '#4a90e2',
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4a90e2',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  addButtonDisabled: {
    backgroundColor: '#d0d0d0',
    shadowOpacity: 0.08,
    shadowColor: '#000',
  },
  linksContainer: {
    marginTop: 0,
  },
  linkItemWrapper: {
    width: '100%',
    alignSelf: 'stretch',
  },
  gridLinksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  linkItem: {
    backgroundColor: 'transparent',
    padding: 0,
    borderRadius: 0,
    marginVertical: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
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
    marginBottom: 8,
  },
  linkContent: {
    marginTop: 8,
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
    marginBottom: 4,
    lineHeight: 24,
  },
  linkUrl: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    lineHeight: 18,
  },
  linkDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  linkDate: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  linkSeparator: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    marginVertical: 6,
    alignSelf: 'stretch',
    width: '100%',
  },
  linkSeparatorModern: {
    marginVertical: 4,
  },
  linkActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  // Classic design list structure styles (similar to Collections.js)
  cardContentList: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 0,
  },
  titleSection: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginLeft: 0,
  },
  cardActions: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 12,
  },
  optionsButton: {
    padding: 8,
    borderRadius: 20,
  },
  titleEditContainer: {
    width: '100%',
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
    paddingTop: 0,
    marginTop: 0,
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
    marginBottom: 16,
    textAlign: 'left',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
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
  previewWrapper: {
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  instagramPreviewContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    width: '100%',
    aspectRatio: 4/5,
    height: undefined,
    padding: 0,
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  instagramPreviewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  videoThumbBackground: {
    backgroundColor: '#000',
  },
  videoBox16x9: {
    width: '100%',
    aspectRatio: 16/9,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoImageCover: {
    width: '100%',
    height: '100%',
  },
  aspect16x9: {
    aspectRatio: 16/9,
    height: undefined,
    width: '100%',
  },
  aspect9x16: {
    aspectRatio: 3/4,
    height: undefined,
    width: '100%',
  },
  aspect4x5: {
    aspectRatio: 4/5,
    height: undefined,
    width: '100%',
  },
  previewPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  classicCard: {
    position: 'relative',
  },
  classicMenuButton: {
    position: 'absolute',
    bottom: 6,
    right: 12,
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 7,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  minimalMenuButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 7,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  gridMenuButton: {
    position: 'absolute',
    top: 4,
    left: 6,
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
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
    top: 6,
    right: 6,
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
    flex: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  menuChevron: {
    marginLeft: 'auto',
    opacity: 0.4,
  },
  menuItemActive: {
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
  },
  // Settings Menu - Clean & Minimal Design
  settingsDropdownMenu: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 200,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingsMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  settingsMenuItemText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  settingsMenuDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 4,
    marginHorizontal: 12,
  },
  optionsDropdownMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 220,
  },
  sortDropdownMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 170,
  },
  sortMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginHorizontal: 2,
    marginVertical: 1,
  },
  sortMenuItemText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#333',
    flex: 1,
    fontWeight: '500',
  },
  sortMenuItemActive: {
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
  },
  designDropdownMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 160,
  },
  minimalLinkDropdown: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 6,
    minWidth: 180,
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  minimalMenuItemText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  cardMenuContainer: {
    position: 'absolute',
    minWidth: 188,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 1,
    zIndex: 9999,
  },
  cardMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  cardMenuItemText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '500',
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
  customPreviewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
  characterCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
    marginRight: 4,
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
  emptyStateContainer: {
    width: '100%',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    borderRadius: 24,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90E2',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  emptyAddButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModalContent: {
    borderRadius: 24,
    padding: 32,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
  },
  deleteWarningIcon: {
    marginBottom: 20,
  },
  deleteModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  deleteModalText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  deleteModalButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  cancelDeleteButton: {
    borderWidth: 1,
  },
  confirmDeleteButton: {
    backgroundColor: '#FF4444',
  },
  deleteModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmDeleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  imageSourceModalContent: {
    width: '85%',
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  imageSourceModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  imageSourceModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  imageSourceModalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  imageSourceOptions: {
    padding: 24,
  },
  imageSourceOption: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 16,
  },
  imageSourceOptionText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  imageSourceOptionSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  
  thumbnailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
    marginTop: 0,
  },
  thumbnailModalContent: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 24,
    overflow: 'hidden',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  thumbnailModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  thumbnailModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  thumbnailModalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  thumbnailScrollView: {
    maxHeight: 400,
  },
  thumbnailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    justifyContent: 'space-between',
  },
  thumbnailCard: {
    width: '48%',
    height: 150,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    padding: 4,
    opacity: 0,
  },
  
  loadingThumbnailsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingThumbnailsContent: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingThumbnailsText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  
  updatingImageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  updatingImageContent: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  updatingImageText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  linkItemWrapper: {
    flex: 1,
    marginBottom: 12,
  },
}); 
