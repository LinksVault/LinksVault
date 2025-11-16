import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, Animated, ScrollView, TextInput, Linking, Share, StatusBar, Image, ActivityIndicator, Platform, Modal, FlatList, Keyboard, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import { db, auth } from '../services/firebase/Config';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, getDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import Footer from '../components/Footer';
import ToastMessage from '../components/ToastMessage';
import { fetchLinkPreview } from '../fetchers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { showAppDialog } from '../context/DialogContext';
import Constants from 'expo-constants';
// import * as Notifications from 'expo-notifications';
// import DateTimePicker from '@react-native-community/datetimepicker'; // Not compatible with Expo Go
import HamburgerMenu from '../components/HamburgerMenu';

const DEFAULT_DESIGN_KEY = 'modern';

export default function MyLinks() {
  const navigation = useNavigation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const searchAnim = useRef(new Animated.Value(0)).current;
  const { isDarkMode, getBackgroundColor, themeMode } = useTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // State management
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [linkInput, setLinkInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Preview state management
  const [linkPreviews, setLinkPreviews] = useState({});
  const [loadingPreviews, setLoadingPreviews] = useState({});
  const [failedPreviews, setFailedPreviews] = useState(new Set());
  const [slowLoadingPreviews, setSlowLoadingPreviews] = useState(new Set());
  
  // Design state management
  const [currentDesign, setCurrentDesign] = useState(null); // 'modern', 'classic', 'minimal', 'grid'
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
  const activeDesignKey = currentDesign ?? DEFAULT_DESIGN_KEY;
  const [isDesignSelectorVisible, setIsDesignSelectorVisible] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [toastVariant, setToastVariant] = useState('success');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Search functionality state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  // Hamburger menu state
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showLinkEmailModal, setShowLinkEmailModal] = useState(false);
  const [isLinkPasswordVisible, setIsLinkPasswordVisible] = useState(false);
  const [isLinkConfirmPasswordVisible, setIsLinkConfirmPasswordVisible] = useState(false);
  const scrollViewRef = useRef(null);
  
  // Reminder state
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [selectedLinkForReminder, setSelectedLinkForReminder] = useState(null);
  const [reminderDate, setReminderDate] = useState(new Date());
  const [reminderTime, setReminderTime] = useState(new Date());
  const [reminderContext, setReminderContext] = useState('');
  const [reminderDateText, setReminderDateText] = useState('');
  const [reminderTimeText, setReminderTimeText] = useState('');
  const [isDateTimePickerVisible, setIsDateTimePickerVisible] = useState(false);
  const [tempDateTime, setTempDateTime] = useState(new Date());
  const [dayScrollRef, setDayScrollRef] = useState(null);
  const [hourScrollRef, setHourScrollRef] = useState(null);
  const [minuteScrollRef, setMinuteScrollRef] = useState(null);
  
  // Dropdown menu state (replacing bottom sheet)
  const [activeDropdownIndex, setActiveDropdownIndex] = useState(null);
  const [selectedLinkForActions, setSelectedLinkForActions] = useState(null);
  const collectionModalTimeoutRef = useRef(null);
  
  // Cache for sorted links to avoid unnecessary re-sorting
  const linksCacheRef = useRef({
    ids: '',
    sortBy: null,
    sortOrder: null,
    sortedOrder: null, // Array of IDs in sorted order
    timestamp: null
  });
  
  const userSortPreferenceOverrideRef = useRef(false);
  
  // Flag to track if preferences have been loaded to prevent duplicate loads
  const preferencesLoadedRef = useRef(false);
  
  // Sorting state
  const [sortBy, setSortBy] = useState('dateAdded'); // dateAdded, favorites, alphabetical, platform, recentlyModified
  const [sortOrder, setSortOrder] = useState('desc'); // asc, desc
  const [showSortMenu, setShowSortMenu] = useState(false);
  
  // Collection selection modal state
  const [showCollectionSelector, setShowCollectionSelector] = useState(false);
  const [collections, setCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [linkForCollectionMove, setLinkForCollectionMove] = useState(null);
  
  // Custom preview editor modal state
  const [isCustomPreviewModalVisible, setIsCustomPreviewModalVisible] = useState(false);
  const [editingLinkForPreview, setEditingLinkForPreview] = useState(null);
  const [customPreviewData, setCustomPreviewData] = useState({
    title: '',
    description: '',
    image: null
  });
  const [isRefetchingPreview, setIsRefetchingPreview] = useState(false);
  const toastTimerRef = useRef(null);
  
  // Animation refs for modals
  const collectionModalAnim = useRef(new Animated.Value(0)).current;
  const previewModalAnim = useRef(new Animated.Value(0)).current;
  const addModalAnim = useRef(new Animated.Value(0)).current;

  const formatDate = (date) => {
    try {
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}.${month}.${year}`; // DD.MM.YYYY
    } catch {
      return '';
    }
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

  const formatTime = (date) => {
    try {
      const d = new Date(date);
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch {
      return '';
    }
  };

  // Load user authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        // Reset preferences loaded flag for new user
        preferencesLoadedRef.current = false;
        loadGeneralLinks(user.uid);
        loadCollections(user.uid); // Load collections when user logs in
        requestNotificationPermissions(); // Request notification permissions
      } else {
        setLinks([]);
        setCollections([]);
        setLoading(false);
        preferencesLoadedRef.current = false;
      }
    });

    return () => unsubscribe();
  }, []);

  // Refresh collections when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (currentUser) {
        loadCollections(currentUser.uid);
      }
      setIsMenuOpen(false);
      menuAnim.setValue(0);
    }, [currentUser, menuAnim])
  );

  // Request notification permissions (disabled for Expo Go)
  const requestNotificationPermissions = async () => {
    console.log('Notifications disabled in Expo Go - will work in standalone build');
  };

  // Load cached sort preferences from AsyncStorage first, then Firebase
  const loadCachedDesignPreference = useCallback(async (userId) => {
    try {
      const cacheKey = `myLinks_design_preference_${userId}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached && designs[cached]) {
        setCurrentDesign(cached);
        return true;
      }
    } catch (error) {
      console.error('Error loading cached design preference:', error);
    }
    return false;
  }, [designs]);

  const loadCachedSortPreference = useCallback(async (userId) => {
    try {
      const cacheKey = `myLinks_sort_preference_${userId}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (!userSortPreferenceOverrideRef.current) {
          if (parsed.sortBy) {
            setSortBy(parsed.sortBy);
          }
          if (parsed.sortOrder) {
            setSortOrder(parsed.sortOrder);
          }
        }
        // Preferences loaded from cache silently
        return true;
      }
    } catch (error) {
      console.error('Error loading cached sort preference:', error);
    }
    return false;
  }, []);

  // Load design and sort preferences when currentUser changes (only once)
  useEffect(() => {
    if (currentUser && !preferencesLoadedRef.current) {
      preferencesLoadedRef.current = true;

      (async () => {
        const [sortFound, designFound] = await Promise.all([
          loadCachedSortPreference(currentUser.uid),
          loadCachedDesignPreference(currentUser.uid)
        ]);

        if (!sortFound) {
          loadSortPreference();
        }
        if (!designFound) {
          setCurrentDesign(prev => prev ?? DEFAULT_DESIGN_KEY);
        }

      loadDesignPreference();
      })();
    }
  }, [currentUser, loadCachedSortPreference, loadCachedDesignPreference]);

  // Animation on mount
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
      header: () => null,
      gestureEnabled: false,
    });

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  // Hide footer when keyboard is open (no flicker): use "will" events with did fallback
  useEffect(() => {
    const willShow = Keyboard.addListener('keyboardWillShow', () => setIsKeyboardVisible(true));
    const willHide = Keyboard.addListener('keyboardWillHide', () => setIsKeyboardVisible(false));
    const didShow = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const didHide = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      willShow.remove();
      willHide.remove();
      didShow.remove();
      didHide.remove();
    };
  }, []);

  // Animate Collection Selector Modal - Smooth slide up from bottom
  useEffect(() => {
    if (showCollectionSelector) {
      Animated.spring(collectionModalAnim, {
        toValue: 1,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(collectionModalAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [showCollectionSelector, collectionModalAnim]);

  // Animate Preview Modal - Smooth scale and fade
  useEffect(() => {
    if (isCustomPreviewModalVisible) {
      Animated.parallel([
        Animated.spring(previewModalAnim, {
          toValue: 1,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.timing(previewModalAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isCustomPreviewModalVisible, previewModalAnim]);

  // Animate Add Link Modal - Smooth scale and fade
  useEffect(() => {
    if (showAddModal) {
      Animated.parallel([
        Animated.spring(addModalAnim, {
          toValue: 1,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.timing(addModalAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [showAddModal, addModalAnim]);

  // Load collections from Firebase
  const loadCollections = async (userId) => {
    try {
      setLoadingCollections(true);
      const albumsRef = collection(db, 'albums');
      const q = query(
        albumsRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const collectionsData = [];
      
      querySnapshot.forEach((doc) => {
        const collectionData = {
          id: doc.id,
          ...doc.data()
        };
        // Only include collections that are NOT deleted (not in trash)
        if (!collectionData.isDeleted) {
          collectionsData.push(collectionData);
        }
      });
      
      setCollections(collectionsData);
    } catch (error) {
      console.error('Error loading collections:', error);
    } finally {
      setLoadingCollections(false);
    }
  };

  // Load general links from Firebase
  const loadGeneralLinks = async (userId) => {
    try {
      setLoading(true);
      
      // Load cached sort order FIRST before fetching links
      await loadCachedSortOrder(userId);
      
      const generalLinksRef = collection(db, 'generalLinks');
      const q = query(
        generalLinksRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const linksData = [];
      
      querySnapshot.forEach((doc) => {
        linksData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setLinks(linksData);
    } catch (error) {
      console.error('Error loading general links:', error);
      
      // Only show error alert for actual errors, not empty collections
      if (error.code === 'permission-denied' || error.code === 'unavailable') {
        showAppDialog('Error', 'Failed to load links. Please check your connection and try again.');
      } else if (error.code === 'failed-precondition') {
        showAppDialog('Error', 'Database index is being created. Please wait a moment and try again.');
      } else {
        // For other errors, just log them without showing alert to user
        console.warn('Non-critical error loading links:', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Simple function to fetch preview for a single link using the fetcher system
  const fetchLinkPreviewData = async (url, index) => {
    if (linkPreviews[url] || loadingPreviews[index] || failedPreviews.has(url)) {
      return; // Already have preview, loading, or failed
    }

    try {
      setLoadingPreviews(prev => ({ ...prev, [index]: true }));
      
      // Use the existing fetcher system - it has its own timeout handling
      const result = await fetchLinkPreview(url, { timeout: 15000 });
      
      if (result && result.success !== false) {
        setLinkPreviews(prev => ({ ...prev, [url]: result }));
        
        // ALSO save to AsyncStorage for instant loading next time
        try {
          const localCacheKey = 'linkPreviewsCache';
          const existingCacheStr = await AsyncStorage.getItem(localCacheKey);
          const existingCache = existingCacheStr ? JSON.parse(existingCacheStr) : {};
          existingCache[url] = result;
          await AsyncStorage.setItem(localCacheKey, JSON.stringify(existingCache));
        } catch (error) {
          // AsyncStorage save failed - not critical
        }
        
        // Remove from slow loading set on success
        setSlowLoadingPreviews(prev => {
          const newSet = new Set(prev);
          newSet.delete(url);
          return newSet;
        });
      } else {
        // Mark as failed
        setFailedPreviews(prev => new Set([...prev, url]));
        // Remove from slow loading set on failure
        setSlowLoadingPreviews(prev => {
          const newSet = new Set(prev);
          newSet.delete(url);
          return newSet;
        });
      }
    } catch (error) {
      console.error('Error fetching preview:', error);
      
      // Check if it's a timeout error from MainFetcher
      if (error.message && error.message.includes('timeout')) {
        console.log('Timeout error detected, marking as failed for retry');
      }
      
      setFailedPreviews(prev => new Set([...prev, url]));
      // Remove from slow loading set on error
      setSlowLoadingPreviews(prev => {
        const newSet = new Set(prev);
        newSet.delete(url);
        return newSet;
      });
    } finally {
      setLoadingPreviews(prev => ({ ...prev, [index]: false }));
    }
  };

  // Retry failed previews with exponential backoff
  const retryFailedPreview = async (url, index) => {
    if (loadingPreviews[index]) {
      return; // Already loading
    }

    try {
      setLoadingPreviews(prev => ({ ...prev, [index]: true }));
      setFailedPreviews(prev => {
        const newSet = new Set(prev);
        newSet.delete(url);
        return newSet;
      });
      // Remove from slow loading set when retrying
      setSlowLoadingPreviews(prev => {
        const newSet = new Set(prev);
        newSet.delete(url);
        return newSet;
      });
      
      // Use the existing fetcher system - it has its own timeout handling
      const result = await fetchLinkPreview(url, { timeout: 15000 });
      
      if (result && result.success !== false) {
        setLinkPreviews(prev => ({ ...prev, [url]: result }));
        // Remove from slow loading set on success
        setSlowLoadingPreviews(prev => {
          const newSet = new Set(prev);
          newSet.delete(url);
          return newSet;
        });
      } else {
        // Mark as failed again
        setFailedPreviews(prev => new Set([...prev, url]));
        // Remove from slow loading set on failure
        setSlowLoadingPreviews(prev => {
          const newSet = new Set(prev);
          newSet.delete(url);
          return newSet;
        });
      }
    } catch (error) {
      console.error('Error retrying preview:', error);
      
      // Check if it's a timeout error from MainFetcher
      if (error.message && error.message.includes('timeout')) {
        console.log('Retry timeout error detected, marking as failed');
      }
      
      setFailedPreviews(prev => new Set([...prev, url]));
      // Remove from slow loading set on error
      setSlowLoadingPreviews(prev => {
        const newSet = new Set(prev);
        newSet.delete(url);
        return newSet;
      });
    } finally {
      setLoadingPreviews(prev => ({ ...prev, [index]: false }));
    }
  };

  // Track slow loading previews (after 3 seconds)
  useEffect(() => {
    const timeoutIds = [];
    
    Object.keys(loadingPreviews).forEach(index => {
      if (loadingPreviews[index]) {
        // Set slow loading state after 3 seconds
        const slowTimeoutId = setTimeout(() => {
          const link = links[index];
          if (link && link.url) {
            setSlowLoadingPreviews(prev => new Set([...prev, link.url]));
          }
        }, 3000); // 3 seconds
        
        timeoutIds.push(slowTimeoutId);
      }
    });
    
    return () => {
      timeoutIds.forEach(id => clearTimeout(id));
    };
  }, [loadingPreviews, links]);

  // Auto-timeout for stuck loading previews (after 20 seconds to match MainFetcher timeout)
  useEffect(() => {
    const timeoutIds = [];
    
    Object.keys(loadingPreviews).forEach(index => {
      if (loadingPreviews[index]) {
        const timeoutId = setTimeout(() => {
          console.log('Auto-timeout for stuck preview at index:', index);
          setLoadingPreviews(prev => ({ ...prev, [index]: false }));
          // Mark as failed if it's been loading too long
          const link = links[index];
          if (link && link.url) {
            setFailedPreviews(prev => new Set([...prev, link.url]));
            // Remove from slow loading set
            setSlowLoadingPreviews(prev => {
              const newSet = new Set(prev);
              newSet.delete(link.url);
              return newSet;
            });
          }
        }, 20000); // 20 second auto-timeout (5 seconds after MainFetcher timeout)
        timeoutIds.push(timeoutId);
      }
    });
    
    return () => {
      timeoutIds.forEach(id => clearTimeout(id));
    };
  }, [loadingPreviews, links]);

  // Load cached previews and fetch new ones - only for new links
  useEffect(() => {
    const processLinks = async () => {
      const safeLinks = links || [];
      if (safeLinks.length === 0) return;
      
      // Only process new links that don't have previews yet
      const linksNeedingPreviews = safeLinks.filter((link, index) => {
        return link.url && 
               !linkPreviews[link.url] && 
               !loadingPreviews[index] && 
               !failedPreviews.has(link.url) &&
               // Additional check: make sure no other link with same URL is currently loading
               !Object.values(loadingPreviews).some((isLoading, otherIndex) => 
                 isLoading && otherIndex !== index && safeLinks[otherIndex]?.url === link.url
               );
      });
      
      if (linksNeedingPreviews.length === 0) return;
      
      // STEP 1: Load from AsyncStorage FIRST (instant, no network)
      const localCacheKey = 'linkPreviewsCache';
      const localCacheStr = await AsyncStorage.getItem(localCacheKey);
      const instantPreviews = {}; // Declare outside the if block
      
      if (localCacheStr) {
        try {
          const localCache = JSON.parse(localCacheStr);
          
          linksNeedingPreviews.forEach(link => {
            if (link.url && localCache[link.url]) {
              instantPreviews[link.url] = localCache[link.url];
            }
          });
          
          // Show cached previews IMMEDIATELY (no loading spinner!)
          if (Object.keys(instantPreviews).length > 0) {
            setLinkPreviews(prev => ({ ...prev, ...instantPreviews }));
          }
        } catch (e) {
          // Local cache corrupted, clear it
          await AsyncStorage.removeItem(localCacheKey);
        }
      }
      
      // STEP 2: Only sync from Firestore if we don't have it in AsyncStorage
      // This prevents unnecessary Firebase reads when AsyncStorage already has the data
      const linksNeedingFirestore = linksNeedingPreviews.filter(link => {
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
              if (previewData.title && previewData.title !== 'Loading preview...') {
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
      
      // Fetch previews for links that don't have them and aren't cached - SEQUENTIALLY
      // Process links one by one from top to bottom as fast as possible
      const processSequentialPreviews = async () => {
        // Only fetch if we don't have it in AsyncStorage or Firestore
        const linksStillNeedingFetch = linksNeedingPreviews.filter(link => 
          link.url && !instantPreviews[link.url]
        );
        
        for (let i = 0; i < linksStillNeedingFetch.length; i++) {
          const link = linksStillNeedingFetch[i];
          const actualIndex = safeLinks.findIndex(l => l.id === link.id);
          
          if (actualIndex !== -1) {
            console.log(`Sequentially fetching preview ${i + 1}/${linksStillNeedingFetch.length}: ${link.url}`);
            
            // Wait for the current preview to complete before starting the next one
            await new Promise((resolve) => {
              const checkCompletion = () => {
                // Check if this preview is still loading
                if (loadingPreviews[actualIndex]) {
                  // Still loading, check again immediately (no delay)
                  setTimeout(checkCompletion, 50);
                } else {
                  // Finished loading (success or failure), move to next immediately
                  resolve();
                }
              };
              
              // Start fetching this preview
              fetchLinkPreviewData(link.url, actualIndex);
              
              // Start checking for completion immediately
              setTimeout(checkCompletion, 10);
            });
          }
        }
      };
      
      // Start sequential processing
      processSequentialPreviews().catch(error => {
        console.error('Error in sequential preview processing:', error);
      });
    };
    
    const timeoutId = setTimeout(processLinks, 100);
    return () => clearTimeout(timeoutId);
  }, [links]);

  // Design functions
  const changeDesign = (designKey) => {
    if (!designs[designKey]) {
      setIsDesignSelectorVisible(false);
      return;
    }

    // Only show notification if actually switching to a different design
    if (activeDesignKey !== designKey) {
      setCurrentDesign(designKey);
      setIsDesignSelectorVisible(false);
      showSuccessMessage(`Switched to ${designs[designKey].name} design!`);

      if (currentUser) {
        AsyncStorage.setItem(`myLinks_design_preference_${currentUser.uid}`, designKey).catch(() => {});
      }
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
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          generalLinksDesign: designKey,
          lastUpdated: new Date().toISOString()
        });
        // Design preference saved
        AsyncStorage.setItem(`myLinks_design_preference_${currentUser.uid}`, designKey).catch(() => {});
      }
    } catch (error) {
      console.error('Error saving design preference:', error);
    }
  };

  const loadDesignPreference = async () => {
    try {
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.generalLinksDesign && designs[userData.generalLinksDesign]) {
            setCurrentDesign(userData.generalLinksDesign);
            // Design preference loaded silently
            AsyncStorage.setItem(`myLinks_design_preference_${currentUser.uid}`, userData.generalLinksDesign).catch(() => {});
          }
        } else if (!currentDesign) {
          setCurrentDesign(DEFAULT_DESIGN_KEY);
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
    setShowSortMenu(false); // Close sort menu when opening design selector
  };

  const showSuccessMessage = (message, options = {}) => {
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
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Handle search toggle - WhatsApp style animation
  const toggleSearch = () => {
    if (!isSearchOpen) {
      // Opening search - show immediately and animate in with scale effect
      setIsSearchOpen(true);
      Animated.spring(searchAnim, {
        toValue: 1,
        duration: 300,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      // Closing search - animate out then hide
      Animated.timing(searchAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setIsSearchOpen(false);
        // Clear search and blur
        setSearchQuery('');
      });
    }
  };

  // Handle hamburger menu toggle
  const openMenu = useCallback(() => {
    if (isMenuOpen) return;
    setIsMenuOpen(true);
    Animated.timing(menuAnim, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [isMenuOpen, menuAnim]);

  const closeMenu = useCallback((callback) => {
    if (!isMenuOpen) {
      callback?.();
      return;
    }
    Animated.timing(menuAnim, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true,
    }).start(() => {
    setIsMenuOpen(false);
      callback?.();
    });
  }, [isMenuOpen, menuAnim]);

  const toggleMenu = useCallback(() => {
    if (isMenuOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }, [isMenuOpen, openMenu, closeMenu]);

  // Handle menu item selection
  const handleMenuAction = useCallback((action) => {
    closeMenu(async () => {
      try {
    switch (action) {
          case 'rate': {
            const storeUrl = Platform.OS === 'ios' ? 'https://apps.apple.com' : 'https://play.google.com/store';
            await Linking.openURL(storeUrl);
            break;
          }
          case 'share': {
            await Share.share({ message: shareMessage });
            break;
          }
          case 'support': {
            try {
              await Linking.openURL(`mailto:${supportEmail}`);
            } catch {
              showInfoDialog('Support', `Contact us at ${supportEmail}`);
            }
            break;
          }
          case 'privacy': {
          navigation.navigate('PrivacyPolicy');
            break;
          }
          case 'terms': {
          navigation.navigate('TermsAndConditions');
            break;
          }
      case 'help':
        navigation.navigate('HelpSupport');
        break;
      case 'about':
        navigation.navigate('About');
        break;
      case 'statistics':
        navigation.navigate('Statistics');
        break;
      case 'plans':
            showInfoDialog('Plans', 'Plans feature coming soon!', [{ text: 'Got it', style: 'default' }]);
        break;
      default:
        break;
    }
      } catch (error) {
        console.error('Menu action error:', error);
        showInfoDialog('Action unavailable', 'Please try again in a moment.');
      }
    });
  }, [closeMenu, navigation, shareMessage, supportEmail, privacyUrl, termsUrl, showInfoDialog]);

  // Get dynamic styles based on current design
  const gridColumnGap = 12;
  const horizontalPadding = 16;
  const gridCardWidth = (screenWidth - (horizontalPadding * 2) - gridColumnGap) / 2;

  const getDesignStyles = () => {
    switch (activeDesignKey) {
      case 'classic':
        return {
          linkItem: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            backgroundColor: 'transparent',
            paddingVertical: 6,
            paddingLeft: 4,
            paddingRight: 12,
            borderRadius: 16,
            marginVertical: 4,
            borderWidth: 0,
            shadowOpacity: 0,
            elevation: 0,
            minHeight: 110,
          },
          previewContainer: {
            width: 132,
            borderRadius: 12,
            backgroundColor: '#e0e0e0',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 10,
            marginLeft: 0,
            overflow: 'hidden',
            aspectRatio: 1,
            height: undefined,
            alignSelf: 'flex-start',
          },
          linkContent: {
            flex: 1,
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingVertical: 4,
            paddingRight: 0,
            rowGap: 4,
          },
          linkActions: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingLeft: 4,
            borderTopWidth: 0,
            borderTopColor: 'transparent',
            minHeight: 24,
            position: 'absolute',
            right: 12,
            bottom: 10,
          },
          linkTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: '#1a1a1a',
            marginBottom: 4,
            lineHeight: 20,
            flexShrink: 1,
            flexWrap: 'wrap',
            maxWidth: '100%',
          },
          linkUrl: {
            display: 'none',
          },
          linkDescription: {
            display: 'none',
          }
        };
      case 'minimal':
        return {
          linkItem: {
            backgroundColor: 'transparent',
            padding: 6,
            borderRadius: 12,
            marginVertical: 4,
            borderWidth: 0,
            borderColor: 'transparent',
            shadowOpacity: 0,
            elevation: 0,
          },
          previewContainer: {
            width: '100%',
            height: 150,
            borderRadius: 12,
            backgroundColor: '#f0f0f0',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            marginBottom: 6,
          },
          linkContent: {
            marginTop: 0,
            paddingTop: 0,
          },
          linkActions: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingTop: 6,
            borderTopWidth: 0,
            borderTopColor: 'transparent',
          },
          linkTitle: {
            fontSize: 16,
            fontWeight: '500',
            color: '#333',
            marginBottom: 4,
            lineHeight: 20,
          },
          linkUrl: {
            display: 'none',
          },
          linkDescription: {
            display: 'none',
          }
        };
      case 'grid':
        return {
          linkItem: {
            backgroundColor: 'transparent',
            padding: 2,
            borderRadius: 12,
            marginVertical: 4,
            borderWidth: 0,
            borderColor: 'transparent',
            shadowOpacity: 0,
            elevation: 0,
            width: gridCardWidth,
          },
          previewContainer: {
            width: '100%',
            // Fill half of the row; no strict aspect ratio to avoid uneven gaps
            height: 160,
            borderRadius: 12,
            backgroundColor: '#e0e0e0',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            marginBottom: 6,
          },
          linkContent: {
            marginTop: 0,
            paddingHorizontal: 0,
            width: '100%',
            paddingTop: 0,
          },
          linkActions: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 6,
            paddingHorizontal: 2,
            borderTopWidth: 0,
            borderTopColor: 'transparent',
          },
          linkTitle: {
            fontSize: 14,
            fontWeight: '600',
            color: '#333',
            marginBottom: 4,
            width: '100%',
            textAlign: 'left',
            lineHeight: 18,
          },
          linkUrl: {
            display: 'none',
          },
          linkDescription: {
            display: 'none',
          }
        };
      default: // modern
        return {
          linkItem: {
            backgroundColor: 'transparent',
            padding: 8,
            borderRadius: 14,
            marginVertical: 6,
            borderWidth: 0,
            borderColor: 'transparent',
            shadowOpacity: 0,
            elevation: 0,
          },
          previewContainer: {
            width: '100%',
            aspectRatio: 1, // Default to square for best quality
            height: undefined,
            borderRadius: 12,
            backgroundColor: '#e0e0e0',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            shadowOpacity: 0,
            elevation: 0,
            marginBottom: 6,
          },
          linkContent: {
            marginTop: 0,
            paddingTop: 4,
          },
          linkActions: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingTop: 6,
            borderTopWidth: 0,
            borderTopColor: 'transparent',
          },
          linkTitle: {
            fontSize: 18,
            fontWeight: '600',
            color: '#333',
            marginBottom: 4,
            lineHeight: 24,
          },
          linkUrl: {
            display: 'none',
          },
          linkDescription: {
            display: 'none',
          }
        };
    }
  };

  // Add or edit a general link
  const addGeneralLink = async () => {
    if (!linkInput.trim() || !currentUser || isAddingLink) return;

    setIsAddingLink(true);
    try {
      let formattedUrl = linkInput.trim();
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = 'https://' + formattedUrl;
      }

      if (editingLink) {
        // Update existing link
      const linkData = {
        url: formattedUrl,
        title: titleInput.trim() || formattedUrl,
          customTitle: titleInput.trim() || null,
          platform: getPlatformFromUrl(formattedUrl),
          lastUpdated: new Date().toISOString()
        };

        await updateDoc(doc(db, 'generalLinks', editingLink.id), linkData);
        
        // Update the link in state
        setLinks(prev => prev.map(link => 
          link.id === editingLink.id 
            ? { ...link, ...linkData }
            : link
        ));
        
        // Invalidate cache since link was edited
        invalidateLinksCache();
        
        // Clear preview cache if URL changed
        if (editingLink.url !== formattedUrl) {
          setLinkPreviews(prev => {
            const newPreviews = { ...prev };
            delete newPreviews[editingLink.url];
            return newPreviews;
          });
          // Fetch new preview
          setTimeout(() => {
            const linkIndex = links.findIndex(l => l.id === editingLink.id);
            if (linkIndex !== -1) {
              fetchLinkPreviewData(formattedUrl, linkIndex);
            }
          }, 500);
        }
        
        showAppDialog('Success', 'Link updated successfully!');
      } else {
        // Add new link
        const linkData = {
          url: formattedUrl,
          title: titleInput.trim() || formattedUrl,
          customTitle: titleInput.trim() || null,
        userId: currentUser.uid,
        createdAt: new Date().toISOString(),
        platform: getPlatformFromUrl(formattedUrl)
      };

      const docRef = await addDoc(collection(db, 'generalLinks'), linkData);
      
      // Add the new link to the existing links array instead of reloading all
      const newLink = { id: docRef.id, ...linkData };
      setLinks(prev => [newLink, ...prev]);
      
        // Invalidate cache since links changed
        invalidateLinksCache();
      
      // Fetch preview for the new link only
      setTimeout(() => {
        fetchLinkPreviewData(newLink.url, 0); // Index 0 since it's the first item
      }, 500);
      
        showAppDialog('Success', 'Link added to general links!');
      }
      
      // Reset form
      setLinkInput('');
      setTitleInput('');
      setEditingLink(null);
      setShowAddModal(false);
    } catch (error) {
      console.error('Error saving general link:', error);
      showAppDialog('Error', editingLink ? 'Failed to update link' : 'Failed to add link');
    } finally {
      setIsAddingLink(false);
    }
  };

  // Delete a general link
  const deleteGeneralLink = async (linkId) => {
    try {
      await deleteDoc(doc(db, 'generalLinks', linkId));
      
      // Remove the link from state instead of reloading all
      const linkToDelete = links.find(link => link.id === linkId);
      if (linkToDelete) {
        setLinks(prev => prev.filter(link => link.id !== linkId));
        
        // Invalidate cache since link was deleted
        invalidateLinksCache();
        
        // Clean up preview data for the deleted link only if no other links have the same URL
        setLinkPreviews(prev => {
          const newPreviews = { ...prev };
          // Check if there are other links with the same URL
          const remainingLinksWithSameUrl = links.filter(link => 
            link.id !== linkId && link.url === linkToDelete.url
          );
          
          // Only remove preview if no other links have the same URL
          if (remainingLinksWithSameUrl.length === 0) {
            delete newPreviews[linkToDelete.url];
          }
          
          return newPreviews;
        });
        
        // Clean up loading state
        setLoadingPreviews(prev => {
          const newLoading = { ...prev };
          const linkIndex = links.findIndex(link => link.id === linkId);
          if (linkIndex !== -1) {
            delete newLoading[linkIndex];
          }
          return newLoading;
        });
        
        // Clean up failed state for the deleted link only if no other links have the same URL
        setFailedPreviews(prev => {
          const newFailed = new Set(prev);
          // Check if there are other links with the same URL
          const remainingLinksWithSameUrl = links.filter(link => 
            link.id !== linkId && link.url === linkToDelete.url
          );
          
          // Only remove from failed set if no other links have the same URL
          if (remainingLinksWithSameUrl.length === 0) {
            newFailed.delete(linkToDelete.url);
          }
          
          return newFailed;
        });
        
        // Clean up slow loading state for the deleted link only if no other links have the same URL
        setSlowLoadingPreviews(prev => {
          const newSlowLoading = new Set(prev);
          // Check if there are other links with the same URL
          const remainingLinksWithSameUrl = links.filter(link => 
            link.id !== linkId && link.url === linkToDelete.url
          );
          
          // Only remove from slow loading set if no other links have the same URL
          if (remainingLinksWithSameUrl.length === 0) {
            newSlowLoading.delete(linkToDelete.url);
          }
          
          return newSlowLoading;
        });
      }
      
      showAppDialog('Success', 'Link deleted successfully!');
    } catch (error) {
      console.error('Error deleting general link:', error);
      showAppDialog('Error', 'Failed to delete link');
    }
  };

  // Get platform from URL
  const getPlatformFromUrl = (url) => {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      if (hostname.includes('instagram.com')) return 'Instagram';
      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'YouTube';
      if (hostname.includes('tiktok.com')) return 'TikTok';
      if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'X (Twitter)';
      if (hostname.includes('facebook.com')) return 'Facebook';
      if (hostname.includes('linkedin.com')) return 'LinkedIn';
      if (hostname.includes('reddit.com')) return 'Reddit';
      
      return 'Web';
    } catch (error) {
      return 'Web';
    }
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
      // Some environments may not support String.normalize
    }

    working = working
      .toLocaleLowerCase(undefined)
      .replace(/[\s\u00A0]+/g, ' ')
      .trim();

    return working;
  };

  const buildSearchCandidates = (link, preview) => {
    const candidates = [];

    if (link?.customTitle && link.customTitle.trim()) {
      candidates.push(link.customTitle.trim());
    }

    if (preview?.title && preview.title.trim() && preview.title !== 'Loading preview...') {
      candidates.push(preview.title.trim());
    }

    if (link?.title && link.title.trim()) {
      candidates.push(link.title.trim());
    }

    if (link?.platform && link.platform.trim()) {
      candidates.push(link.platform.trim());
    }

    return candidates.filter(Boolean);
  };

  // (removed duplicate isYouTubeLandscape definition)

  // Handle link press - open link in browser
  const handleLinkPress = async (link) => {
    try {
      const supported = await Linking.canOpenURL(link.url);
      if (supported) {
        await Linking.openURL(link.url);
      } else {
        showAppDialog('Error', 'Cannot open this URL');
      }
    } catch (error) {
      console.error('Error opening link:', error);
      showAppDialog('Error', 'Failed to open link');
    }
  };

  // Handle share link
  const handleShareLink = async (link) => {
    try {
      const shareMessage = `${link.title}\n\n${link.url}`;
      
      await Share.share({
        message: shareMessage,
        url: link.url,
        title: link.title,
      });
    } catch (error) {
      console.error('Error sharing link:', error);
      showAppDialog('Error', 'Failed to share link');
    }
  };

  // Calculate dropdown position instantly based on design layout
  const calculateDropdownPosition = (index, pageX, pageY) => {
    const dropdownWidth = 220;
    const dropdownHeight = 280;
    
    let x, y;
    
    // Position based on current design
    switch (activeDesignKey) {
      case 'modern':
        // Three-dots at top-left (14px from top, 14px from left)
        x = screenWidth - dropdownWidth - 20; // Align to right side
        y = pageY - 5; // Below the button - closer gap
        break;
        
      case 'classic':
        // Three-dots at bottom-right
        x = screenWidth - dropdownWidth - 20; // Align to right
        y = pageY - 5; // Below the button - closer gap
        break;
        
      case 'grid':
        // Three-dots at top-left, check if left or right column
        const isLeftColumn = index % 2 === 0;
        if (isLeftColumn) {
          x = 20; // Left side for left column
        } else {
          x = screenWidth - dropdownWidth - 20; // Right side for right column
        }
        y = pageY - 5; // Below the button - closer gap
        break;
        
      case 'minimal':
        // Three-dots at top-right
        x = screenWidth - dropdownWidth - 20;
        y = pageY - 5; // Below the button - closer gap
        break;
        
      default:
        x = screenWidth - dropdownWidth - 20;
        y = pageY ; // Below the button - closer gap
    }
    
    // Ensure dropdown stays on screen
    x = Math.max(10, Math.min(x, screenWidth - dropdownWidth - 10));
    
    // Check if dropdown would go off bottom of screen
    const bottomSpace = screenHeight - pageY;
    if (bottomSpace < dropdownHeight + 40) {
      // Position above the button - closer to it with minimal gap
      y = Math.max(10, pageY - dropdownHeight + 30);
    } else {
      y = Math.max(10, y);
    }
    
    return { x, y };
  };

  // Open dropdown menu for link actions
  const showLinkDropdown = (index, link, event) => {
    event.stopPropagation();
    
    // Get touch position
    const { pageX, pageY } = event.nativeEvent;
    
    // Calculate position instantly based on design layout
    const position = calculateDropdownPosition(index, pageX, pageY);
    
    // Update state immediately - dropdown appears instantly with correct position
    setDropdownPosition(position);
    setActiveDropdownIndex(index);
    setSelectedLinkForActions(link);
  };

  // Close dropdown menu
  const closeLinkDropdown = () => {
    setActiveDropdownIndex(null);
    setSelectedLinkForActions(null);
  };

  // Close collection selector modal
  const closeCollectionSelector = () => {
    // Clear timeout if modal is being closed
    if (collectionModalTimeoutRef.current) {
      clearTimeout(collectionModalTimeoutRef.current);
      collectionModalTimeoutRef.current = null;
    }
    setShowCollectionSelector(false);
    setSelectedCollections([]);
    setLinkForCollectionMove(null);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (collectionModalTimeoutRef.current) {
        clearTimeout(collectionModalTimeoutRef.current);
      }
    };
  }, []);

  // Handle dropdown menu actions
  const handleDropdownAction = async (action) => {
    if (!selectedLinkForActions) return;

    // Preserve the link reference before closing dropdown (since closeLinkDropdown sets it to null)
    const linkToHandle = selectedLinkForActions;
    
    closeLinkDropdown();

    switch (action) {
      case 'open':
        await handleLinkPress(linkToHandle);
        break;
      case 'share':
        await handleShareLink(linkToHandle);
        break;
      case 'edit':
        // Open custom preview editor modal
        openCustomPreviewEditor(linkToHandle);
        break;
      case 'favorite':
        await toggleFavorite(linkToHandle);
        break;
      case 'moveToCollection':
        // Clear any existing timeout
        if (collectionModalTimeoutRef.current) {
          clearTimeout(collectionModalTimeoutRef.current);
          collectionModalTimeoutRef.current = null;
        }
        
        // Set link data first
        setLinkForCollectionMove(linkToHandle);
        setSelectedCollections([]);
        
        // Load collections if needed, then open modal
        const openCollectionModal = async () => {
          if (collections.length === 0 && currentUser) {
            await loadCollections(currentUser.uid);
          }
          // Small delay to ensure state updates and dropdown closes
          setTimeout(() => {
            setShowCollectionSelector(true);
          }, 150);
        };
        
        openCollectionModal();
        break;
      case 'delete':
        showAppDialog(
          'Delete Link',
          'Are you sure you want to delete this link?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Delete', 
              style: 'destructive',
              onPress: () => deleteGeneralLink(linkToHandle.id)
            }
          ]
        );
        break;
    }
  };

  // Toggle collection selection
  const toggleCollectionSelection = (collectionId) => {
    setSelectedCollections(prev => 
      prev.includes(collectionId)
        ? prev.filter(id => id !== collectionId)
        : [...prev, collectionId]
    );
  };

  // Move link to selected collections
  const moveLinkToCollections = async () => {
    const linkToMove = linkForCollectionMove || selectedLinkForActions;
    if (!linkToMove || selectedCollections.length === 0) {
      showAppDialog('Error', 'Please select at least one collection');
      return;
    }

    try {
      const linkData = {
        url: linkToMove.url,
        title: linkToMove.customTitle || linkToMove.title,
        timestamp: linkToMove.createdAt || new Date().toISOString(),
        platform: linkToMove.platform || getPlatformFromUrl(linkToMove.url)
      };

      // Add link to each selected collection
      const promises = selectedCollections.map(async (collectionId) => {
        const collectionRef = doc(db, 'albums', collectionId);
        await updateDoc(collectionRef, {
          listLink: arrayUnion(linkData),
          lastModified: new Date().toISOString()
        });
      });

      await Promise.all(promises);

      const collectionsCount = selectedCollections.length;

      // Ask if user wants to remove from MyLinks
      showAppDialog(
        'Success',
        `Link moved to ${collectionsCount} collection(s)!`,
        [
          {
            text: 'Keep in My Links',
            style: 'cancel',
            onPress: closeCollectionSelector
          },
          {
            text: 'Remove from My Links',
            style: 'destructive',
            onPress: () => {
              const linkToRemove = linkForCollectionMove || selectedLinkForActions;
              if (linkToRemove) {
                deleteGeneralLink(linkToRemove.id);
              }
              closeCollectionSelector();
            }
          }
        ],
        { cancelable: true }
      );

      showSuccessMessage(`Link moved to ${collectionsCount} collection(s)!`);
    } catch (error) {
      console.error('Error moving link to collections:', error);
      showAppDialog('Error', 'Failed to move link to collections. Please try again.');
    }
  };

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
      return 'Unknown site';
    }
  };

  const normalizeSiteName = (siteName, url) => {
    const fallback = siteName || (url ? getSiteNameFromUrl(url) : '');
    const lower = (fallback || '').toLowerCase();

    if (lower.includes('tiktok')) return 'TikTok';

    return fallback;
  };

  // Open custom preview editor
  const openCustomPreviewEditor = (link) => {
    const currentPreview = linkPreviews[link.url];
    
    setEditingLinkForPreview(link);
    setCustomPreviewData({
      title: currentPreview?.title || link.customTitle || link.title || '',
      description: currentPreview?.description || '',
      image: currentPreview?.image || null
    });
    setIsCustomPreviewModalVisible(true);
  };

  // Save custom preview
  const saveCustomPreview = async () => {
    if (!editingLinkForPreview) return;
    
    try {
      const link = editingLinkForPreview;
      const updatedPreview = {
        ...linkPreviews[link.url],
        title: customPreviewData.title || link.customTitle || link.title,
        description: customPreviewData.description || 'No description available',
        image: customPreviewData.image,
        siteName: normalizeSiteName(linkPreviews[link.url]?.siteName, link.url),
        timestamp: new Date().toISOString(),
        isCustom: true // Mark as custom preview
      };

      // Update the preview in state
      setLinkPreviews(prev => ({
        ...prev,
        [link.url]: updatedPreview
      }));

      // Update the link customTitle if it was changed
      if (customPreviewData.title && customPreviewData.title !== link.customTitle) {
        const linkRef = doc(db, 'generalLinks', link.id);
        await updateDoc(linkRef, {
          customTitle: customPreviewData.title,
          lastModified: new Date().toISOString()
        });

        // Update local state
        setLinks(prev => prev.map(l => 
          l.id === link.id 
            ? { ...l, customTitle: customPreviewData.title }
            : l
        ));
      }

      // Save custom preview to Firebase
      const safeDocId = encodeURIComponent(link.url).replace(/[^a-zA-Z0-9]/g, '_');
      const previewDocRef = doc(db, 'linkPreviews', safeDocId);
      await setDoc(previewDocRef, updatedPreview);

      // Also save to AsyncStorage for instant loading
      try {
        const localCacheKey = 'linkPreviewsCache';
        const existingCacheStr = await AsyncStorage.getItem(localCacheKey);
        const existingCache = existingCacheStr ? JSON.parse(existingCacheStr) : {};
        existingCache[link.url] = updatedPreview;
        await AsyncStorage.setItem(localCacheKey, JSON.stringify(existingCache));
      } catch (error) {
        // AsyncStorage save failed - not critical
      }

      setIsCustomPreviewModalVisible(false);
      setEditingLinkForPreview(null);
      setCustomPreviewData({ title: '', description: '', image: null });
      
      showSuccessMessage('Custom preview saved successfully!');
    } catch (error) {
      console.error('Error saving custom preview:', error);
      showSuccessMessage('Failed to save custom preview');
    }
  };

  // Refetch original preview data from the web
  const refetchOriginalPreview = async () => {
    if (!editingLinkForPreview) return;
    
    try {
      setIsRefetchingPreview(true);
      const link = editingLinkForPreview;
      
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
        const result = await fetchLinkPreview(normalizedUrl, { timeout: 15000 });
        
        if (result && result.success !== false) {
          const newPreview = {
            title: result.title || 'Untitled',
            description: result.description || '',
            image: result.image || null,
            siteName: normalizeSiteName(result.siteName, normalizedUrl),
            timestamp: new Date().toISOString(),
            source: result.source || 'refetch',
            url: normalizedUrl
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
          
          // Also save to AsyncStorage
          try {
            const localCacheKey = 'linkPreviewsCache';
            const existingCacheStr = await AsyncStorage.getItem(localCacheKey);
            const existingCache = existingCacheStr ? JSON.parse(existingCacheStr) : {};
            existingCache[link.url] = newPreview;
            await AsyncStorage.setItem(localCacheKey, JSON.stringify(existingCache));
          } catch (error) {
            // AsyncStorage save failed - not critical
          }
          
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
        showAppDialog('Permission Required', 'Permission to access camera roll is required!');
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
      showAppDialog('Error', 'Failed to select image. Please try again.');
    }
  };

  // Toggle favorite status
  const toggleFavorite = async (link) => {
    try {
      const newFavoriteStatus = !link.isFavorite;
      await updateDoc(doc(db, 'generalLinks', link.id), {
        isFavorite: newFavoriteStatus,
        lastUpdated: new Date().toISOString()
      });

      // Update local state
      setLinks(prev => prev.map(l => 
        l.id === link.id 
          ? { ...l, isFavorite: newFavoriteStatus }
          : l
      ));
      
      // Invalidate cache since favorite status changed (affects favorites sort)
      invalidateLinksCache();

      showSuccessMessage(newFavoriteStatus ? 'Link favorited!' : 'Link unfavorited!');
    } catch (error) {
      console.error('Error toggling favorite:', error);
      showAppDialog('Error', 'Failed to update favorite status');
    }
  };

  // Handle reminder button press
  const handleReminderPress = (link) => {
    const now = new Date();
    setSelectedLinkForReminder(link);
    setReminderDate(now);
    setReminderTime(now);
    setReminderContext('');
    setReminderDateText(formatDate(now));
    setReminderTimeText(formatTime(now));
    setShowReminderModal(true);
  };

  const snapToItem = (scrollRef, itemHeight, itemCount, currentIndex) => {
    if (!scrollRef) return;
    
    const targetOffset = currentIndex * itemHeight;
    scrollRef.scrollTo({
      y: targetOffset,
      animated: true,
    });
  };

  const handleDayScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const itemHeight = 40;
    const currentIndex = Math.round(offsetY / itemHeight);
    
    // Ensure index is within bounds
    const clampedIndex = Math.max(0, Math.min(currentIndex, getDayOptions().length - 1));
    
    // Update the selected day
    const dayOptions = getDayOptions();
    if (dayOptions[clampedIndex]) {
      const newDateTime = new Date(dayOptions[clampedIndex].value);
      newDateTime.setHours(tempDateTime.getHours(), tempDateTime.getMinutes());
      setTempDateTime(newDateTime);
    }
  };

  const handleHourScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const itemHeight = 40;
    const currentIndex = Math.round(offsetY / itemHeight);
    
    // Ensure index is within bounds
    const clampedIndex = Math.max(0, Math.min(currentIndex, 23));
    
    // Update the selected hour
    const newDateTime = new Date(tempDateTime);
    newDateTime.setHours(clampedIndex, tempDateTime.getMinutes());
    setTempDateTime(newDateTime);
  };

  const handleMinuteScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const itemHeight = 40;
    const currentIndex = Math.round(offsetY / itemHeight);
    
    // Ensure index is within bounds
    const clampedIndex = Math.max(0, Math.min(currentIndex, 59));
    
    // Update the selected minute
    const newDateTime = new Date(tempDateTime);
    newDateTime.setMinutes(clampedIndex);
    setTempDateTime(newDateTime);
  };


  const confirmDateTime = () => {
    setReminderDate(tempDateTime);
    setReminderTime(tempDateTime);
    setReminderDateText(formatDate(tempDateTime));
    setReminderTimeText(formatTime(tempDateTime));
    setIsDateTimePickerVisible(false);
  };

  const openDateTimePicker = () => {
    const now = new Date();
    setTempDateTime(now);
    setIsDateTimePickerVisible(true);
    
    // Initialize scroll positions after a short delay to ensure refs are set
    setTimeout(() => {
      const dayOptions = getDayOptions();
      const dayIndex = dayOptions.findIndex(option => 
        option.value.toDateString() === now.toDateString()
      );
      
      if (dayScrollRef && dayIndex !== -1) {
        dayScrollRef.scrollToIndex({ index: dayIndex, animated: false });
      }
      
      if (hourScrollRef) {
        hourScrollRef.scrollToIndex({ index: now.getHours(), animated: false });
      }
      
      if (minuteScrollRef) {
        minuteScrollRef.scrollToIndex({ index: now.getMinutes(), animated: false });
      }
    }, 100);
  };

  const cancelDateTimePicker = () => {
    setIsDateTimePickerVisible(false);
  };

  const getDayOptions = () => {
    const options = [];
    const today = new Date();
    
    // Add "Today" option
    options.push({
      label: 'Today',
      value: new Date(today),
      isToday: true
    });
    
    // Add next 7 days
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      options.push({
        label: `${dayNames[date.getDay()]} ${date.getDate()} ${monthNames[date.getMonth()]}`,
        value: new Date(date),
        isToday: false
      });
    }
    
    return options;
  };

  const getTimeOptions = () => {
    const options = [];
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Generate hours (0-23)
    for (let hour = 0; hour < 24; hour++) {
      options.push({
        label: String(hour).padStart(2, '0'),
        value: hour,
        type: 'hour'
      });
    }
    
    return options;
  };

  const getMinuteOptions = () => {
    const options = [];
    
    // Generate minutes (0-59)
    for (let minute = 0; minute < 60; minute++) {
      options.push({
        label: String(minute).padStart(2, '0'),
        value: minute,
        type: 'minute'
      });
    }
    
    return options;
  };

  // Schedule reminder notification
  const scheduleReminder = async () => {
    if (!selectedLinkForReminder || !reminderContext.trim()) {
      showAppDialog('Error', 'Please add a reminder context');
      return;
    }

    try {
      // Parse date and time from text inputs
      let reminderDateTime;
      try {
        // Parse date - handle both MM/DD/YYYY and DD.MM.YYYY formats
        let month, day, year;
        
        if (reminderDateText.includes('/')) {
          // MM/DD/YYYY format
          const dateParts = reminderDateText.split('/');
          if (dateParts.length !== 3) {
            throw new Error('Invalid date format');
          }
          month = parseInt(dateParts[0]);
          day = parseInt(dateParts[1]);
          year = parseInt(dateParts[2]);
        } else if (reminderDateText.includes('.')) {
          // DD.MM.YYYY format
          const dateParts = reminderDateText.split('.');
          if (dateParts.length !== 3) {
            throw new Error('Invalid date format');
          }
          day = parseInt(dateParts[0]);
          month = parseInt(dateParts[1]);
          year = parseInt(dateParts[2]);
        } else {
          throw new Error('Invalid date format');
        }
        
        // Parse time - handle HH:MM format
        const timeParts = reminderTimeText.split(':');
        if (timeParts.length !== 2) {
          throw new Error('Invalid time format');
        }
        
        const hours = parseInt(timeParts[0]);
        const minutes = parseInt(timeParts[1]);
        
        // Validate ranges
        if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2024) {
          throw new Error('Invalid date values');
        }
        
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
          throw new Error('Invalid time values');
        }
        
        // Create date (month is 0-indexed in JavaScript Date constructor)
        reminderDateTime = new Date(year, month - 1, day, hours, minutes);
        
        // Check if the date is valid
        if (isNaN(reminderDateTime.getTime())) {
          throw new Error('Invalid date');
        }
        
      } catch (error) {
        showAppDialog('Error', 'Please enter a valid date and time format:\nDate: MM/DD/YYYY or DD.MM.YYYY (e.g., 12/25/2024 or 25.12.2024)\nTime: HH:MM (e.g., 14:30)');
        return;
      }

      // Check if the reminder is in the future
      if (reminderDateTime <= new Date()) {
        showAppDialog('Error', 'Please select a future date and time');
        return;
      }

      // Schedule the notification (disabled for Expo Go)
      let notificationId = null;
      console.log('Notification scheduling disabled in Expo Go - will work in standalone build');

      // Save reminder to Firebase
      const reminderData = {
        linkId: selectedLinkForReminder.id,
        linkTitle: selectedLinkForReminder.title,
        linkUrl: selectedLinkForReminder.url,
        context: reminderContext,
        scheduledFor: reminderDateTime.toISOString(),
        notificationId: notificationId,
        userId: currentUser.uid,
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'linkReminders'), reminderData);

      // Update the link to show it has a reminder
      await updateDoc(doc(db, 'generalLinks', selectedLinkForReminder.id), {
        hasReminder: true,
        reminderContext: reminderContext,
        reminderScheduledFor: reminderDateTime.toISOString(),
      });

      // Update the link in state instead of reloading all
      setLinks(prev => prev.map(link => 
        link.id === selectedLinkForReminder.id 
          ? {
              ...link,
              hasReminder: true,
              reminderContext: reminderContext,
              reminderScheduledFor: reminderDateTime.toISOString(),
            }
          : link
      ));

      setShowReminderModal(false);
      showAppDialog('Success', 'Reminder scheduled successfully!');
    } catch (error) {
      console.error('Error scheduling reminder:', error);
      showAppDialog('Error', 'Failed to schedule reminder');
    }
  };

  // Cancel reminder
  const cancelReminder = async (link) => {
    try {
      // Find and cancel the notification
      const remindersRef = collection(db, 'linkReminders');
      const q = query(
        remindersRef,
        where('linkId', '==', link.id),
        where('userId', '==', currentUser.uid)
      );
      
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(async (doc) => {
        const reminderData = doc.data();
        if (reminderData.notificationId) {
          console.log('Notification cancellation disabled in Expo Go - will work in standalone build');
        }
        await deleteDoc(doc.ref);
      });

      // Update the link
      await updateDoc(doc(db, 'generalLinks', link.id), {
        hasReminder: false,
        reminderContext: null,
        reminderScheduledFor: null,
      });

      // Update the link in state instead of reloading all
      setLinks(prev => prev.map(l => 
        l.id === link.id 
          ? {
              ...l,
              hasReminder: false,
              reminderContext: null,
              reminderScheduledFor: null,
            }
          : l
      ));
      
      showAppDialog('Success', 'Reminder cancelled');
    } catch (error) {
      console.error('Error cancelling reminder:', error);
      showAppDialog('Error', 'Failed to cancel reminder');
    }
  };

  // Smart sorting function for links
  const smartSortName = (a, b, order) => {
    const titleA = (a.customTitle || linkPreviews[a.url]?.title || a.title || '').toLowerCase();
    const titleB = (b.customTitle || linkPreviews[b.url]?.title || b.title || '').toLowerCase();
    const cleanA = titleA.replace(/^(the|a|an)\s+/i, '');
    const cleanB = titleB.replace(/^(the|a|an)\s+/i, '');
    return order === 'asc' ? cleanA.localeCompare(cleanB) : cleanB.localeCompare(cleanA);
  };

  // Sort links function
  const sortLinks = (linksToSort, sortByValue, sortOrderValue) => {
    const sorted = [...linksToSort];
    
    switch (sortByValue) {
      case 'dateAdded':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return sortOrderValue === 'asc' ? dateA - dateB : dateB - dateA;
        });
      
      case 'favorites':
        return sorted.sort((a, b) => {
          const favoriteA = a.isFavorite ? 1 : 0;
          const favoriteB = b.isFavorite ? 1 : 0;
          // Favorites first, then sort by date
          if (favoriteA !== favoriteB) {
            return sortOrderValue === 'asc' ? favoriteA - favoriteB : favoriteB - favoriteA;
          }
          // If both have same favorite status, sort by date
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA; // Newest first when same favorite status
        });
      
      case 'alphabetical':
        return sorted.sort((a, b) => smartSortName(a, b, sortOrderValue === 'asc' ? 'asc' : 'desc'));
      
      case 'platform':
        return sorted.sort((a, b) => {
          const platformA = (a.platform || 'Web').toLowerCase();
          const platformB = (b.platform || 'Web').toLowerCase();
          if (platformA !== platformB) {
            const comparison = platformA.localeCompare(platformB);
            return sortOrderValue === 'asc' ? comparison : -comparison;
          }
          // If same platform, sort by date (newest first)
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA;
        });
      
      case 'recentlyModified':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.lastUpdated || a.createdAt || 0);
          const dateB = new Date(b.lastUpdated || b.createdAt || 0);
          return sortOrderValue === 'asc' ? dateA - dateB : dateB - dateA;
        });
      
      default:
        return sorted;
    }
  };

  // Clear cache when links are modified or sort settings change
  const invalidateLinksCache = useCallback(() => {
    linksCacheRef.current = {
      ids: '',
      sortBy: null,
      sortOrder: null,
      sortedOrder: null,
      timestamp: null
    };
    // Also clear from AsyncStorage
    if (currentUser) {
      AsyncStorage.removeItem(`myLinks_sort_cache_${currentUser.uid}`).catch(() => {});
    }
  }, [currentUser]);

  // Handle sorting changes
  const handleSortChange = useCallback((newSortBy, newSortOrder) => {
    userSortPreferenceOverrideRef.current = true;

    // Clear cache FIRST before state update
    invalidateLinksCache();
    
    // Update state
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    
    // Save sort preference to AsyncStorage first (fast)
    if (currentUser) {
      AsyncStorage.setItem(`myLinks_sort_preference_${currentUser.uid}`, JSON.stringify({
        sortBy: newSortBy,
        sortOrder: newSortOrder,
        timestamp: Date.now()
      })).catch(() => {});
    }
    
    // Save sort preference to Firebase (async, non-blocking)
    saveSortPreference(newSortBy, newSortOrder);
  }, [currentUser, invalidateLinksCache]);

  // Save sort preference to Firebase
  const saveSortPreference = async (sortByValue, sortOrderValue) => {
    try {
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          generalLinksSortBy: sortByValue,
          generalLinksSortOrder: sortOrderValue,
          lastUpdated: new Date().toISOString()
        });
        // Sort preference saved to Firebase
      }
    } catch (error) {
      console.error('Error saving sort preference:', error);
    }
  };

  // Load cached sort order from AsyncStorage
  const loadCachedSortOrder = useCallback(async (userId) => {
    try {
      const cacheKey = `myLinks_sort_cache_${userId}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        linksCacheRef.current = {
          ids: parsed.ids || '',
          sortBy: parsed.sortBy || null,
          sortOrder: parsed.sortOrder || null,
          sortedOrder: parsed.sortedOrder || null,
          timestamp: parsed.timestamp || null
        };
        // Cache loaded silently
        return true;
      }
    } catch (error) {
      console.error('Error loading cached sort order:', error);
    }
    return false;
  }, []);

  // Save cached sort order to AsyncStorage
  const saveCachedSortOrder = useCallback(async (userId) => {
    try {
      const cacheKey = `myLinks_sort_cache_${userId}`;
      const cacheData = {
        ids: linksCacheRef.current.ids,
        sortBy: linksCacheRef.current.sortBy,
        sortOrder: linksCacheRef.current.sortOrder,
        sortedOrder: linksCacheRef.current.sortedOrder,
        timestamp: linksCacheRef.current.timestamp
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error saving cached sort order:', error);
    }
  }, []);

  // Load sort preference from Firebase (only when cache miss)
  const loadSortPreference = async () => {
    try {
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (!userSortPreferenceOverrideRef.current) {
            if (userData.generalLinksSortBy) {
              setSortBy(userData.generalLinksSortBy);
            }
            if (userData.generalLinksSortOrder) {
              setSortOrder(userData.generalLinksSortOrder);
            }
            // Also cache it for next time
            if (currentUser) {
              AsyncStorage.setItem(`myLinks_sort_preference_${currentUser.uid}`, JSON.stringify({
                sortBy: userData.generalLinksSortBy,
                sortOrder: userData.generalLinksSortOrder,
                timestamp: Date.now()
              })).catch(() => {});
            }
            // Sort preference loaded from Firebase (only when cache miss)
          }
        }
      }
    } catch (error) {
      console.error('Error loading sort preference:', error);
    }
  };

  // Get filtered and sorted links - Memoized to prevent unnecessary recalculations
  const filteredLinks = useMemo(() => {
    // Early return if no links
    if (links.length === 0) {
      return [];
    }
    
    // Check if we can skip sorting (cache optimization) - check BEFORE filtering
    const allLinkIds = links.map(l => l.id).sort().join(',');
    const cached = linksCacheRef.current;
    
    // Check if cache is valid and matches current state
    const cacheExists = cached && cached.sortedOrder && cached.sortedOrder.length > 0;
    const linksMatch = cacheExists && cached.ids === allLinkIds;
    const sortMatches = cacheExists && cached.sortBy === sortBy && cached.sortOrder === sortOrder;
    
    // Cache is valid if all conditions match
    const cacheIsValid = cacheExists && linksMatch && sortMatches;
    
    let sortedAll;
    
    if (cacheIsValid) {
      // Use cached order - NO SORTING NEEDED!
      // Create a map for quick lookup
      const linkMap = new Map(links.map(l => [l.id, l]));
      
      // Reorder ALL links based on cached sorted order
      sortedAll = cached.sortedOrder
        .map(id => linkMap.get(id))
        .filter(Boolean); // Remove any that don't exist (safety check)
      
      // Add any links that weren't in cache (shouldn't happen if cache is valid)
      links.forEach(l => {
        if (!sortedAll.find(s => s.id === l.id)) {
          sortedAll.push(l);
        }
      });
    } else {
      // Cache is invalid or doesn't exist - need to sort
      // Apply sorting to ALL links
      sortedAll = sortLinks(links, sortBy, sortOrder);
      
      // Update cache with sorted order of ALL links
      linksCacheRef.current = {
        ids: allLinkIds,
        sortBy,
        sortOrder,
        sortedOrder: sortedAll.map(l => l.id), // Store just the IDs in sorted order
        timestamp: Date.now()
      };
      
      // Save to AsyncStorage if user is logged in
      if (currentUser) {
        saveCachedSortOrder(currentUser.uid);
      }
    }
    
    // Now apply search filter to the already-sorted links
    const normalizedQuery = normalizeSearchText(searchQuery);
    if (!normalizedQuery) {
      return sortedAll;
    }

    const queryTokens = normalizedQuery.split(' ').filter(Boolean);
    if (queryTokens.length === 0) {
      return sortedAll;
    }

    return sortedAll.filter((link) => {
      const preview = linkPreviews[link.url];
      const candidates = buildSearchCandidates(link, preview);

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
  }, [links, sortBy, sortOrder, searchQuery, currentUser, saveCachedSortOrder, linkPreviews]);

  // Get platform icon
  const getPlatformIcon = (platform) => {
    switch (platform.toLowerCase()) {
      case 'instagram':
        return 'photo-camera';
      case 'youtube':
        return 'play-circle-filled';
      case 'tiktok':
        return 'music-note';
      case 'twitter':
        return 'chat';
      case 'facebook':
        return 'people';
      default:
        return 'link';
    }
  };

  // Get loading message for slow loading previews
  const getLoadingMessage = (isSlowLoading) => {
    if (!isSlowLoading) return null;
    return 'It may take a moment';
  };

  // Get platform color
  const getPlatformColor = (platform) => {
    switch (platform.toLowerCase()) {
      case 'instagram':
        return '#E4405F';
      case 'youtube':
        return '#FF0000';
      case 'tiktok':
        return '#000000';
      case 'twitter':
        return '#1DA1F2';
      case 'facebook':
        return '#1877F2';
      default:
        return '#4A90E2';
    }
  };

  const accentColor = '#2F6BFF';
  const supportEmail = 'help.linksvault.app@gmail.com';
  const privacyUrl = 'https://linksvault.app/privacy-policy';
  const termsUrl = 'https://linksvault.app/terms-and-conditions';
  const shareMessage = 'Check out LinksVault – the easiest way to save and organize every link you love. Download it now!';
  const appVersion = useMemo(() => {
    return Constants?.expoConfig?.version ?? Constants?.manifest?.version ?? '—';
  }, []);
  const statusBarHeight = useMemo(() => {
    const expoStatusBar = Constants?.statusBarHeight ?? 0;
    if (Platform.OS === 'android') {
      return StatusBar.currentHeight ?? expoStatusBar;
    }
    return expoStatusBar;
  }, []);
  const menuAnim = useRef(new Animated.Value(0)).current;
  const menuTranslateX = useMemo(
    () => menuAnim.interpolate({ inputRange: [0, 1], outputRange: [-340, 0] }),
    [menuAnim]
  );
  const menuSections = useMemo(() => [
    {
      title: 'Stay Connected',
      items: [
        { key: 'rate', title: 'Rate Us', subtitle: 'Love LinksVault? Support us with 5 stars.', icon: 'star-rate', iconColor: accentColor, action: 'rate' },
        { key: 'share', title: 'Share', subtitle: 'Invite friends to organize their links.', icon: 'share', iconColor: accentColor, action: 'share' },
        { key: 'support', title: 'Support', subtitle: 'Need help? Reach out to our team.', icon: 'support-agent', iconColor: accentColor, action: 'support' },
      ],
    },
    {
      title: 'Company',
      items: [
        { key: 'privacy', title: 'Privacy Policy', subtitle: 'Understand how we protect your data.', icon: 'privacy-tip', iconColor: accentColor, action: 'privacy' },
        { key: 'terms', title: 'Terms & Conditions', subtitle: 'Review the rules of using LinksVault.', icon: 'gavel', iconColor: accentColor, action: 'terms' },
        { key: 'about', title: 'About', subtitle: 'Discover the story behind LinksVault.', icon: 'info-outline', iconColor: accentColor, action: 'about' },
      ],
    },
    {
      title: 'Product',
      items: [
        { key: 'help', title: 'Help & Tutorials', subtitle: 'Guided answers to common questions.', icon: 'help-outline', iconColor: accentColor, action: 'help' },
        { key: 'statistics', title: 'Statistics', subtitle: 'See how your content performs.', icon: 'insights', iconColor: accentColor, action: 'statistics' },
        { key: 'plans', title: 'Plans', subtitle: 'Upgrade for more powerful features.', icon: 'card-membership', iconColor: accentColor, action: 'plans' },
      ],
    },
  ], [accentColor]);
  const showInfoDialog = useCallback((title, message, buttons = [{ text: 'OK' }], options = {}) => {
    return showAppDialog(title, message, buttons, options);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: getBackgroundColor() }]}>
      {/* Status Bar */}
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={getBackgroundColor()}
        translucent={false}
      />
      
      {/* Header Bar - fades in/out with search */}
      <Animated.View style={[
        styles.header, 
        { 
          opacity: isSearchOpen 
            ? searchAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              })
            : fadeAnim
        }
      ]}>
        {/* Top Left Controls */}
        <View style={styles.topLeftControls}>
          <TouchableOpacity 
            style={[styles.hamburgerButton, { 
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' 
            }]}
            onPress={toggleMenu}
          >
            <View style={[styles.hamburgerLine, { backgroundColor: isDarkMode ? '#ffffff' : '#333' }]} />
            <View style={[styles.hamburgerLine, { backgroundColor: isDarkMode ? '#ffffff' : '#333' }]} />
            <View style={[styles.hamburgerLine, { backgroundColor: isDarkMode ? '#ffffff' : '#333' }]} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.searchIconButton, { 
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' 
            }]}
            onPress={toggleSearch}
          >
            <MaterialIcons 
              name="search" 
              size={24} 
              color={isDarkMode ? '#ffffff' : '#333'} 
            />
          </TouchableOpacity>
        </View>

        {/* Top Right Controls */}
        <View style={styles.topRightControls}>
          <Text style={[styles.pageTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
          My Links
        </Text>
          <TouchableOpacity 
            style={[styles.addCollectionButton, { 
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' 
            }]}
            onPress={() => setShowAddModal(true)}
          >
            <MaterialIcons name="add" size={24} color={isDarkMode ? '#ffffff' : '#333'} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* WhatsApp-style Animated Search Bar - covers header */}
      {isSearchOpen && (
        <Animated.View 
          style={[
            styles.animatedSearchContainer,
            {
              backgroundColor: getBackgroundColor(),
              opacity: searchAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 0.7, 1],
              }),
              transform: [
                {
                  translateX: searchAnim.interpolate({
                    inputRange: [0, 0.3, 1],
                    outputRange: [-screenWidth * 0.35, -screenWidth * 0.15, 0],
                  })
                },
                {
                  scaleX: searchAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.2, 1],
                  })
                },
                {
                  scaleY: searchAnim.interpolate({
                    inputRange: [0, 0.3, 1],
                    outputRange: [0.8, 0.9, 1],
                  })
                }
              ]
            }
          ]}
        >
          {/* Search input with arrow inside */}
          <View style={[styles.searchInputContainer, { 
            backgroundColor: isDarkMode ? '#1A1C1E' : '#ffffff'
          }]}>
            {/* Left Arrow Button - inside the search bar */}
            <TouchableOpacity 
              onPress={() => { Keyboard.dismiss(); setIsKeyboardVisible(false); setIsSearchOpen(false); setIsSearchFocused(false); setSearchQuery(''); }}
              style={styles.searchBackButtonInside}
            >
              <MaterialIcons 
                name="arrow-back" 
                size={20} 
                color={isDarkMode ? '#cccccc' : '#666'} 
              />
            </TouchableOpacity>
            
            <TextInput
              style={[styles.animatedSearchInput, { color: isDarkMode ? '#ffffff' : '#333' }]}
              placeholder="Search links/platforms..."
              placeholderTextColor={isDarkMode ? '#cccccc' : '#666'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={true}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
            />
          </View>
        </Animated.View>
      )}

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={true}>
        {/* Page Description */}
        <View style={styles.pageDescriptionSection}>
          <Text style={[styles.pageDescriptionText, { color: isDarkMode ? '#999' : '#999' }]}>
            Individual links • Quick access
          </Text>
        </View>

        {/* Quick Add Link Input - Modern & Compact */}
        <View style={styles.linkInputContainer}>
          <View style={[styles.inputFieldsContainer, { 
            backgroundColor: isDarkMode ? '#1a1a1a' : '#fff',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : '#e8eaed'
          }]}>
            <TextInput
              style={[styles.linkInput, { color: isDarkMode ? '#ffffff' : '#333' }]}
              placeholder="Add a new link..."
              value={linkInput}
              onChangeText={setLinkInput}
              placeholderTextColor={isDarkMode ? '#999' : '#999'}
              autoCapitalize="none"
              keyboardType="url"
              returnKeyType="done"
              onSubmitEditing={() => {
                if (linkInput.trim() && !isAddingLink) {
                  addGeneralLink();
                }
              }}
            />
          </View>
          <TouchableOpacity 
            style={[
              styles.addButton,
              (!linkInput.trim() || isAddingLink) && styles.addButtonDisabled
            ]} 
            onPress={addGeneralLink}
            disabled={!linkInput.trim() || isAddingLink}
            activeOpacity={0.7}
          >
            {isAddingLink ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <MaterialIcons name="add" size={24} color="white" />
            )}
          </TouchableOpacity>
        </View>

        {/* Design Selector and Sorting Section */}
        <View style={[
          styles.designSelectorSection,
          activeDesignKey === 'modern' && styles.designSelectorSectionModern
        ]}>
          <View style={styles.sortingControls}>
            {/* Design Button - Left side */}
          <TouchableOpacity 
            style={[styles.designChangeButton, { backgroundColor: isDarkMode ? '#2a2a2a' : '#f0f8ff' }]}
            onPress={(e) => showDesignSelector(e)}
          >
            <MaterialIcons name="palette" size={22} color="#4a90e2" />
              <Text style={styles.designChangeText}>{designs[activeDesignKey]?.name}</Text>
            <MaterialIcons name="expand-more" size={18} color="#4a90e2" />
            </TouchableOpacity>
            
            {/* Sort Options - Right side */}
            <View style={styles.sortOptionsContainer}>
              <TouchableOpacity 
                style={styles.sortButton}
                onPress={() => {
                  setShowSortMenu(!showSortMenu);
                  setIsDesignSelectorVisible(false); // Close design selector when opening sort menu
                }}
              >
                <MaterialIcons name="sort" size={20} color={isDarkMode ? '#ffffff' : '#333'} />
                <Text style={[styles.sortButtonText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                  {sortBy === 'dateAdded' ? 'Date Added' : 
                   sortBy === 'favorites' ? 'Favorites' : 
                   sortBy === 'alphabetical' ? 'A-Z' : 
                   sortBy === 'platform' ? 'Platform' : 
                   sortBy === 'recentlyModified' ? 'Recently Modified' : 'Custom Order'}
                </Text>
                <MaterialIcons 
                  name={showSortMenu ? "arrow-drop-up" : "arrow-drop-down"} 
                  size={20} 
                  color={isDarkMode ? '#ffffff' : '#333'} 
                />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.orderButton}
                onPress={() => handleSortChange(sortBy, sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                <MaterialIcons 
                  name={sortOrder === 'asc' ? 'arrow-upward' : 'arrow-downward'} 
                  size={20} 
                  color={isDarkMode ? '#ffffff' : '#333'} 
                />
          </TouchableOpacity>
            </View>
          </View>
          
          {/* Sort Menu */}
          {showSortMenu && (
            <View style={[styles.sortMenu, { 
              backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'
            }]}>
              <TouchableOpacity 
                style={[styles.sortMenuItem, { 
                  backgroundColor: sortBy === 'dateAdded' ? (isDarkMode ? '#3a3a3a' : '#f0f5ff') : 'transparent',
                  borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }]}
                onPress={() => {
                  handleSortChange('dateAdded', sortOrder);
                  setShowSortMenu(false);
                }}
              >
                <MaterialIcons name="schedule" size={18} color={isDarkMode ? '#ffffff' : '#333'} />
                <Text style={[styles.sortMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Date Added</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.sortMenuItem, { 
                  backgroundColor: sortBy === 'favorites' ? (isDarkMode ? '#3a3a3a' : '#f0f5ff') : 'transparent',
                  borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }]}
                onPress={() => {
                  handleSortChange('favorites', sortOrder);
                  setShowSortMenu(false);
                }}
              >
                <MaterialIcons name="star" size={18} color={isDarkMode ? '#ffffff' : '#333'} />
                <Text style={[styles.sortMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Favorites</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.sortMenuItem, { 
                  backgroundColor: sortBy === 'alphabetical' ? (isDarkMode ? '#3a3a3a' : '#f0f5ff') : 'transparent',
                  borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }]}
                onPress={() => {
                  handleSortChange('alphabetical', 'asc');
                  setShowSortMenu(false);
                }}
              >
                <MaterialIcons name="sort-by-alpha" size={18} color={isDarkMode ? '#ffffff' : '#333'} />
                <Text style={[styles.sortMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Alphabetical</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.sortMenuItem, { 
                  backgroundColor: sortBy === 'platform' ? (isDarkMode ? '#3a3a3a' : '#f0f5ff') : 'transparent',
                  borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }]}
                onPress={() => {
                  handleSortChange('platform', sortOrder);
                  setShowSortMenu(false);
                }}
              >
                <MaterialIcons name="apps" size={18} color={isDarkMode ? '#ffffff' : '#333'} />
                <Text style={[styles.sortMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Platform</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.sortMenuItem, { 
                  backgroundColor: sortBy === 'recentlyModified' ? (isDarkMode ? '#3a3a3a' : '#f0f5ff') : 'transparent',
                  borderBottomColor: 'transparent'
                }]}
                onPress={() => {
                  handleSortChange('recentlyModified', sortOrder);
                  setShowSortMenu(false);
                }}
              >
                <MaterialIcons name="update" size={18} color={isDarkMode ? '#ffffff' : '#333'} />
                <Text style={[styles.sortMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Recently Modified</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
              Loading links...
            </Text>
          </View>
        ) : filteredLinks.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <View style={[styles.emptyState, { 
              backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
            }]}>
              <MaterialIcons name="link-off" size={50} color="#4A90E2" style={styles.emptyIcon} />
              <Text style={[styles.emptyTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                {searchQuery ? 'No Results Found' : 'No General Links Yet'}
              </Text>
              <Text style={[styles.emptyText, { color: isDarkMode ? '#cccccc' : '#666' }]}>
                {searchQuery 
                  ? 'Try adjusting your search terms'
                  : 'Add links that don\'t belong to any collection yet'
                }
              </Text>
              {!searchQuery.trim() && (
                <>
                  <TouchableOpacity
                    style={[
                      styles.emptyStateAddButton,
                      {
                        backgroundColor: '#4A90E2',
                        shadowColor: isDarkMode ? '#000000' : '#4A90E2',
                      },
                    ]}
                    onPress={() => setShowAddModal(true)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Add your first general link"
                  >
                    <MaterialIcons name="add" size={30} color="#ffffff" />
                  </TouchableOpacity>
                  <Text
                    style={[
                      styles.emptyStateInfoText,
                      { color: isDarkMode ? '#bbbbbb' : '#666666' },
                    ]}
                  >
                    For first-time use, tap this button to add your initial link. Afterwards, use the plus button in the top right of this screen.
                  </Text>
                </>
              )}
            </View>
          </View>
        ) : (
          <Animated.View style={[
            styles.linksList, 
            activeDesignKey === 'grid' && styles.gridLinksContainer,
            { opacity: fadeAnim }
          ]}>
            {filteredLinks.map((link, index) => {
              const designStyles = getDesignStyles();
              const isLastItem = index === filteredLinks.length - 1;
              const shouldShowSeparator = !isLastItem && (
                activeDesignKey !== 'grid' || ((index + 1) % 2 === 0)
              );
              const isPortraitReel = isPortraitThreeFour(link.url);
              const isInstaStandard = isInstagramStandardPost(link.url);
              const isInstagramStandardPreview = activeDesignKey === 'modern' && !isPortraitReel && isInstaStandard;
              const isLeftColumn = index % 2 === 0;
              const hasPairInRow = index + 1 < filteredLinks.length;
              const gridItemSpacingStyle = activeDesignKey === 'grid'
                ? { marginRight: isLeftColumn && hasPairInRow ? gridColumnGap : 0 }
                : {};
              return (
                <React.Fragment key={link.id}>
                <View
                  style={[
                    styles.linkCard,
                    designStyles.linkItem,
                    gridItemSpacingStyle,
                    { 
                      backgroundColor: 'transparent',
                      borderWidth: 0,
                    }
                  ]}
                >
                {/* Preview Image - Clickable to open link */}
                <TouchableOpacity 
                  style={[
                    styles.previewContainer,
                    designStyles.previewContainer,
                    activeDesignKey === 'modern' && isYouTubeLandscape(link.url) && styles.aspect16x9,
                    activeDesignKey === 'modern' && isPortraitReel && styles.aspect9x16,
                    !isInstagramStandardPreview && !isPortraitReel && isInstaStandard && styles.aspect4x5,
                    isInstagramStandardPreview && styles.instagramPreviewContainer,
                    isYouTubeLandscape(link.url) && styles.videoThumbBackground
                  ]}
                  onPress={() => handleLinkPress(link)}
                  activeOpacity={0.8}
                >
                  {failedPreviews.has(link.url) ? (
                    <View style={styles.previewPlaceholder}>
                      <TouchableOpacity 
                        style={styles.retryButton}
                        onPress={() => retryFailedPreview(link.url, index)}
                      >
                        <MaterialIcons name="refresh" size={24} color="#4a90e2" />
                        <Text style={styles.retryText}>Retry</Text>
                        <Text style={styles.retrySubtext}>Tap to try again</Text>
                      </TouchableOpacity>
                    </View>
                  ) : loadingPreviews[index] ? (
                    <View style={styles.previewLoading}>
                      <ActivityIndicator size="small" color="#4a90e2" />
                    </View>
                  ) : linkPreviews[link.url]?.image ? (
                    isYouTubeLandscape(link.url) ? (
                      <View style={styles.videoBox16x9}>
                    <Image
                      source={{ 
                        uri: linkPreviews[link.url].image,
                        cache: 'force-cache'
                      }}
                          style={styles.videoImageCover}
                      resizeMode="cover"
                      onError={() => {
                        console.log('Image failed to load, removing it');
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
                          cache: activeDesignKey === 'modern' ? 'force-cache' : 'default'
                        }}
                        style={[
                          styles.previewImage,
                          isInstagramStandardPreview && styles.instagramPreviewImage,
                          activeDesignKey === 'modern' && { resizeMethod: 'scale' }
                        ]}
                        resizeMode={activeDesignKey === 'modern' ? 'cover' : (isInstagramStandardPreview ? 'contain' : 'cover')}
                        fadeDuration={0}
                        onError={() => {
                          console.log('Image failed to load, removing it');
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
                    <View style={styles.previewPlaceholder}>
                      <MaterialIcons name="link" size={32} color="#ccc" />
                    </View>
                  ) : (
                    <TouchableOpacity 
                      style={styles.previewLoading}
                      onLongPress={() => {
                        // Force retry stuck loading previews
                        console.log('Force retrying stuck preview for:', link.url);
                        retryFailedPreview(link.url, index);
                      }}
                    >
                      <ActivityIndicator size="small" color="#4a90e2" />
                      <Text style={styles.loadingText}>Loading...</Text>
                      {slowLoadingPreviews.has(link.url) && (
                        <Text style={styles.slowLoadingText}>
                          {getLoadingMessage(true)}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                  
                  {/* Site Name Badge - Positioned opposite to three-dots button */}
                  {linkPreviews[link.url]?.siteName && (
                    <View style={[
                      styles.siteNameBadge,
                      activeDesignKey === 'classic'
                        ? styles.siteNameBadgeClassic
                        : activeDesignKey === 'modern'
                          ? styles.siteNameBadgeModern
                          : activeDesignKey === 'grid'
                            ? styles.siteNameBadgeGrid
                            : activeDesignKey === 'minimal'
                              ? styles.siteNameBadgeMinimal
                              : styles.siteNameBadgeTopLeft
                    ]}>
                      <Text style={styles.siteNameText}>
                      {normalizeSiteName(linkPreviews[link.url].siteName, link.url)}
                    </Text>
                  </View>
                  )}
                </TouchableOpacity>
                
                {/* Three-dots menu button - Left side for Modern/Grid, bottom for Classic, right side for Minimal */}
                <TouchableOpacity
                  style={[
                    styles.threeDots, 
                    activeDesignKey === 'classic' 
                      ? styles.threeDotsBottom
                      : activeDesignKey === 'modern'
                        ? styles.threeDotsModern
                        : activeDesignKey === 'grid'
                          ? styles.threeDotsLeft 
                          : styles.threeDotsRight,
                    { 
                      backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.9)' 
                    }
                  ]}
                  onPress={(event) => showLinkDropdown(index, link, event)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons 
                    name="more-vert" 
                    size={20} 
                    color={isDarkMode ? '#ffffff' : '#333'} 
                  />
                </TouchableOpacity>
                
                {/* Link Content */}
                <View
                  style={[styles.linkContent, designStyles.linkContent]}
                >
                  {/* Title */}
                  <Text style={[
                    styles.linkTitle, 
                    designStyles.linkTitle,
                    { color: isDarkMode ? '#ffffff' : designStyles.linkTitle.color }
                  ]} numberOfLines={2}>
                    {link.customTitle || linkPreviews[link.url]?.title || link.title}
                </Text>
                
                  {/* Description hidden in MyLinks previews */}
                  {/* URL hidden in MyLinks previews */}
                  
                  {/* Date */}
                <Text style={[styles.linkDate, { color: isDarkMode ? '#999' : '#999' }]}>
                    Added {new Date(link.createdAt).toLocaleDateString()}
                </Text>
                  
                  {/* Reminder Info */}
                  {link.hasReminder && link.reminderContext && (
                    <View style={[styles.reminderInfo, { 
                      backgroundColor: isDarkMode ? 'rgba(255, 149, 0, 0.1)' : 'rgba(255, 149, 0, 0.1)',
                      borderColor: isDarkMode ? 'rgba(255, 149, 0, 0.3)' : 'rgba(255, 149, 0, 0.3)'
                    }]}>
                      <MaterialIcons name="schedule" size={14} color="#FF9500" />
                      <Text style={[styles.reminderText, { color: '#FF9500' }]}>
                        {link.reminderContext}
                      </Text>
                      <Text style={[styles.reminderDate, { color: '#FF9500' }]}>
                        {new Date(link.reminderScheduledFor).toLocaleDateString()} at {new Date(link.reminderScheduledFor).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </Text>
                    </View>
                  )}
              </View>

                {/* Action Buttons hidden as requested */}
                  </View>
                {shouldShowSeparator && (
                  <View style={[
                    styles.linkSeparator,
                    activeDesignKey === 'modern' && styles.linkSeparatorModern,
                    { backgroundColor: (isDarkMode || themeMode === 'gray') ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.18)' }
                  ]} />
                )}
                </React.Fragment>
              );
            })}
          </Animated.View>
        )}
      </ScrollView>

      {!(isKeyboardVisible || isSearchOpen || isSearchFocused) && <Footer />}

      {/* Design Selector Dropdown */}
      {isDesignSelectorVisible && (
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          activeOpacity={1}
          onPress={() => {
            setIsDesignSelectorVisible(false);
            setShowSortMenu(false);
          }}
        >
          <View 
            style={[
              styles.designDropdownContent,
              {
                top: dropdownPosition.y + 16,
                left: Math.max(10, dropdownPosition.x - 110),
                backgroundColor: isDarkMode ? '#2a2a2a' : '#fff',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
              }
            ]}
          >
            {Object.entries(designs).map(([designKey, design]) => (
              <TouchableOpacity
                key={designKey}
                style={[
                  styles.designDropdownItem,
                  activeDesignKey === designKey && styles.designDropdownItemActive,
                  { backgroundColor: isDarkMode ? '#2a2a2a' : '#fff' }
                ]}
                onPress={() => changeDesign(designKey)}
              >
                <View style={styles.designDropdownItemHeader}>
                  <MaterialIcons 
                    name="palette" 
                    size={18} 
                    color={activeDesignKey === designKey ? "#4a90e2" : "#666"} 
                  />
                  <Text style={[
                    styles.designDropdownItemTitle,
                    activeDesignKey === designKey && styles.designDropdownItemTitleActive,
                    { color: isDarkMode ? '#ffffff' : '#333' }
                  ]}>
                    {design.name}
                  </Text>
                  {activeDesignKey === designKey && (
                    <MaterialIcons name="check-circle" size={18} color="#4CAF50" />
                  )}
                </View>
                <Text style={[
                  styles.designDropdownItemDescription,
                  activeDesignKey === designKey && styles.designDropdownItemDescriptionActive,
                  { color: isDarkMode ? '#cccccc' : '#666' }
                ]}>
                  {design.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      )}

      {/* Link Actions Dropdown */}
      {activeDropdownIndex !== null && (
        <TouchableOpacity
          style={styles.linkDropdownOverlay}
          activeOpacity={1}
          onPress={closeLinkDropdown}
        >
          <View
            style={[
              styles.linkDropdownMenu,
              {
                // Modern design positioning
                ...(activeDesignKey === 'modern' && {
                  top: dropdownPosition.y + 20,
                  right: 150,
                }),
                // Classic design positioning (button at bottom-right)
                ...(activeDesignKey === 'classic' && {
                  top: dropdownPosition.y + 20,
                  right: 30,
                }),
                // Minimal design positioning (button at top-right)
                ...(activeDesignKey === 'minimal' && {
                  top: dropdownPosition.y + 20,
                  right: 30,
                }),
                // Grid design positioning (button at top-left)
                // Different position for left column vs right column items
                ...(activeDesignKey === 'grid' && {
                  top: dropdownPosition.y + 20,
                  // If click is on left half of screen (left column), position differently
                  right: dropdownPosition.x < screenWidth / 2 ? 150 : 30,
                }),
                backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.linkDropdownItem,
                { borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }
              ]}
              onPress={() => handleDropdownAction('share')}
            >
              <MaterialIcons name="share" size={18} color={isDarkMode ? '#ffffff' : '#333'} />
              <Text style={[styles.linkDropdownText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                Share
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.linkDropdownItem,
                { borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }
              ]}
              onPress={() => handleDropdownAction('edit')}
            >
              <MaterialIcons name="edit" size={18} color={isDarkMode ? '#ffffff' : '#333'} />
              <Text style={[styles.linkDropdownText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                Edit
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.linkDropdownItem,
                { borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }
              ]}
              onPress={() => handleDropdownAction('favorite')}
            >
              <MaterialIcons 
                name={selectedLinkForActions?.isFavorite ? "star" : "star-border"} 
                size={18} 
                color={selectedLinkForActions?.isFavorite ? "#FFD700" : (isDarkMode ? '#ffffff' : '#333')} 
              />
              <Text style={[styles.linkDropdownText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                {selectedLinkForActions?.isFavorite ? 'Unfavorite' : 'Favorite'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.linkDropdownItem,
                { borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }
              ]}
              onPress={() => handleDropdownAction('moveToCollection')}
            >
              <MaterialIcons name="drive-file-move" size={18} color={isDarkMode ? '#ffffff' : '#333'} />
              <Text style={[styles.linkDropdownText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                Move to Collection
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.linkDropdownItem, styles.linkDropdownItemLast]}
              onPress={() => handleDropdownAction('delete')}
            >
              <MaterialIcons name="delete" size={18} color="#FF4444" />
              <Text style={[styles.linkDropdownText, { color: '#FF4444' }]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* Success Message Toast */}
      <ToastMessage
        visible={showSuccess}
        message={successMessage}
        variant={toastVariant}
        topOffset={Platform.OS === 'ios' ? 70 : 50}
      />

      {/* Add Link Modal */}
      <Modal
        transparent={true}
        visible={showAddModal}
        animationType="none"
        statusBarTranslucent={true}
        onRequestClose={() => {
          if (!isAddingLink) {
            setShowAddModal(false);
            setLinkInput('');
            setTitleInput('');
            setEditingLink(null);
          }
        }}
      >
        <Animated.View 
          style={[
            styles.modalOverlay,
            {
              opacity: addModalAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
            }
          ]}
        >
          <Animated.View 
            style={[
              styles.modalContent, 
              { 
                backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
                transform: [
                  {
                    scale: addModalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
                opacity: addModalAnim,
              }
            ]}
          >
            <Text style={[styles.modalTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
              {editingLink ? 'Edit Link' : 'Add General Link'}
            </Text>
            
            <TextInput
              style={[styles.modalInput, { 
                backgroundColor: isDarkMode ? '#1a1a1a' : '#f9f9f9',
                color: isDarkMode ? '#ffffff' : '#333',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#e0e0e0',
                opacity: isAddingLink ? 0.6 : 1
              }]}
              placeholder="Enter URL..."
              placeholderTextColor={isDarkMode ? '#999' : '#666'}
              value={linkInput}
              onChangeText={setLinkInput}
              autoCapitalize="none"
              keyboardType="url"
              editable={!isAddingLink}
            />
            
            <View style={{ position: 'relative' }}>
              <TextInput
                style={[styles.modalInput, { 
                  backgroundColor: isDarkMode ? '#1a1a1a' : '#f9f9f9',
                  color: isDarkMode ? '#ffffff' : '#333',
                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#e0e0e0',
                  opacity: isAddingLink ? 0.6 : 1
                }]}
                placeholder="Custom title (optional)..."
                placeholderTextColor={isDarkMode ? '#999' : '#666'}
                value={titleInput}
                onChangeText={setTitleInput}
                maxLength={200}
                editable={!isAddingLink}
              />
              <Text style={[styles.characterCountInline, { color: isDarkMode ? '#999' : '#999' }]}>
                {titleInput.length}/200
              </Text>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[
                  styles.modalButton, 
                  styles.cancelButton, 
                  { 
                    backgroundColor: isDarkMode ? '#3a3a3a' : '#f0f0f0',
                    opacity: isAddingLink ? 0.6 : 1
                  }
                ]}
                onPress={() => {
                  if (isAddingLink) return;
                  setShowAddModal(false);
                  setLinkInput('');
                  setTitleInput('');
                  setEditingLink(null);
                }}
                disabled={isAddingLink}
              >
                <Text style={[styles.buttonText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.modalButton, 
                  styles.saveButton,
                  isAddingLink && styles.saveButtonDisabled
                ]}
                onPress={addGeneralLink}
                disabled={!linkInput.trim() || isAddingLink}
              >
                {isAddingLink ? (
                  <View style={styles.loadingButtonContent}>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <Text style={[styles.saveButtonText, { marginLeft: 8 }]}>
                      {editingLink ? 'Saving...' : 'Adding...'}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.saveButtonText}>{editingLink ? 'Save Changes' : 'Add Link'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Hamburger Menu Modal */}
      <HamburgerMenu
        visible={isMenuOpen}
        onClose={() => closeMenu()}
        menuAnim={menuAnim}
        translateX={menuTranslateX}
        statusBarHeight={statusBarHeight}
        isDarkMode={isDarkMode}
        accentColor={accentColor}
        profileImage={currentUser?.photoURL}
        headerTitle={`Hello, ${currentUser?.displayName || 'Guest User'}`}
        headerSubtitle="Here's everything you can do today"
        sections={menuSections}
        onSelectAction={handleMenuAction}
        footerTitle="LinksVault"
        versionLabel={`Version ${appVersion}`}
        footerIconName="shield"
      />

      {/* Reminder Modal */}
      {showReminderModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
            <Text style={[styles.modalTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
              Set Reminder
            </Text>
            
            <Text style={[styles.linkTitleInModal, { color: isDarkMode ? '#cccccc' : '#666' }]}>
              {selectedLinkForReminder?.title}
            </Text>
            
            <TextInput
              style={[styles.modalInput, { 
                backgroundColor: isDarkMode ? '#1a1a1a' : '#f9f9f9',
                color: isDarkMode ? '#ffffff' : '#333',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#e0e0e0'
              }]}
              placeholder="Why do you want to be reminded about this link?"
              placeholderTextColor={isDarkMode ? '#999' : '#666'}
              value={reminderContext}
              onChangeText={setReminderContext}
              multiline={true}
              numberOfLines={3}
            />
            
            {/* Combined Date & Time Input */}
            <View style={styles.dateTimeInputContainer}>
              <MaterialIcons name="schedule" size={20} color="#4a90e2" style={styles.dateTimeIcon} />
              <TouchableOpacity style={{ flex: 1 }} onPress={openDateTimePicker} activeOpacity={0.8}>
                <TextInput
                  style={[styles.dateTimeInput, { 
                    backgroundColor: isDarkMode ? '#1a1a1a' : '#f9f9f9',
                    color: isDarkMode ? '#ffffff' : '#333',
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#e0e0e0'
                  }]}
                  placeholder="Select date and time"
                  placeholderTextColor={isDarkMode ? '#999' : '#666'}
                  value={`${reminderDateText} at ${reminderTimeText}`}
                  editable={false}
                  pointerEvents="none"
                />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: isDarkMode ? '#3a3a3a' : '#f0f0f0' }]}
                onPress={() => {
                  setShowReminderModal(false);
                  setReminderContext('');
                  setReminderDateText('');
                  setReminderTimeText('');
                }}
              >
                <Text style={[styles.buttonText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]}
                onPress={scheduleReminder}
                disabled={!reminderContext.trim()}
              >
                <Text style={styles.saveButtonText}>Set Reminder</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Combined Date & Time Picker Modal */}
      <Modal
        transparent={true}
        visible={isDateTimePickerVisible}
        animationType="slide"
        onRequestClose={cancelDateTimePicker}
      >
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerModal, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={cancelDateTimePicker} style={styles.pickerButton}>
                <Text style={[styles.pickerButtonText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.pickerTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>Select Date & Time</Text>
              <TouchableOpacity onPress={confirmDateTime} style={styles.pickerButton}>
                <Text style={[styles.pickerButtonText, { color: '#4a90e2' }]}>Done</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.pickerContent}>
              <View style={styles.pickerWheel}>
                {/* Day Picker */}
                <View style={styles.pickerColumn}>
                  <FlatList
                    ref={setDayScrollRef}
                    data={getDayOptions()}
                    keyExtractor={(item, index) => `day-${index}`}
                    renderItem={({ item, index }) => {
                      const isSelected = tempDateTime.toDateString() === item.value.toDateString();
                      return (
                        <TouchableOpacity
                          style={[
                            styles.pickerItem,
                            isSelected && styles.pickerItemSelected,
                          ]}
                          onPress={() => {
                            const newDateTime = new Date(item.value);
                            newDateTime.setHours(tempDateTime.getHours(), tempDateTime.getMinutes());
                            setTempDateTime(newDateTime);
                            // Snap to this item with perfect centering
                            dayScrollRef.scrollToIndex({ 
                              index, 
                              animated: true,
                              viewPosition: 0.5
                            });
                          }}
                        >
                          <Text style={[
                            styles.pickerItemText,
                            { 
                              color: isSelected ? '#4a90e2' : (isDarkMode ? '#ffffff' : '#333'),
                              fontWeight: item.isToday ? 'bold' : 'normal'
                            }
                          ]}>
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    }}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={40}
                    snapToAlignment="center"
                    decelerationRate="normal"
                    scrollEventThrottle={16}
                    getItemLayout={(data, index) => ({
                      length: 40,
                      offset: 40 * index,
                      index,
                    })}
                    onMomentumScrollEnd={(event) => {
                      const offsetY = event.nativeEvent.contentOffset.y;
                      const index = Math.round(offsetY / 40);
                      const clampedIndex = Math.max(0, Math.min(index, getDayOptions().length - 1));
                      
                      // Snap to the closest item
                      dayScrollRef.scrollToIndex({ 
                        index: clampedIndex, 
                        animated: true,
                        viewPosition: 0.5 // Center the item
                      });
                      
                      const dayOptions = getDayOptions();
                      if (dayOptions[clampedIndex]) {
                        const newDateTime = new Date(dayOptions[clampedIndex].value);
                        newDateTime.setHours(tempDateTime.getHours(), tempDateTime.getMinutes());
                        setTempDateTime(newDateTime);
                      }
                    }}
                    contentContainerStyle={{
                      paddingVertical: 80,
                      paddingHorizontal: 0,
                      alignItems: 'center',
                    }}
                  />
                </View>

                {/* Hour Picker */}
                <View style={styles.pickerColumn}>
                  <FlatList
                    ref={setHourScrollRef}
                    data={getTimeOptions()}
                    keyExtractor={(item, index) => `hour-${index}`}
                    renderItem={({ item, index }) => {
                      const isSelected = tempDateTime.getHours() === item.value;
                      return (
                        <TouchableOpacity
                          style={[
                            styles.pickerItem,
                            isSelected && styles.pickerItemSelected,
                          ]}
                          onPress={() => {
                            const newDateTime = new Date(tempDateTime);
                            newDateTime.setHours(item.value, tempDateTime.getMinutes());
                            setTempDateTime(newDateTime);
                            // Snap to this item with perfect centering
                            hourScrollRef.scrollToIndex({ 
                              index, 
                              animated: true,
                              viewPosition: 0.5
                            });
                          }}
                        >
                          <Text style={[
                            styles.pickerItemText,
                            { color: isSelected ? '#4a90e2' : (isDarkMode ? '#ffffff' : '#333') }
                          ]}>
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    }}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={40}
                    snapToAlignment="center"
                    decelerationRate="normal"
                    scrollEventThrottle={16}
                    getItemLayout={(data, index) => ({
                      length: 40,
                      offset: 40 * index,
                      index,
                    })}
                    onMomentumScrollEnd={(event) => {
                      const offsetY = event.nativeEvent.contentOffset.y;
                      const index = Math.round(offsetY / 40);
                      const clampedIndex = Math.max(0, Math.min(index, 23));
                      
                      // Snap to the closest item
                      hourScrollRef.scrollToIndex({ 
                        index: clampedIndex, 
                        animated: true,
                        viewPosition: 0.5 // Center the item
                      });
                      
                      const newDateTime = new Date(tempDateTime);
                      newDateTime.setHours(clampedIndex, tempDateTime.getMinutes());
                      setTempDateTime(newDateTime);
                    }}
                    contentContainerStyle={{
                      paddingVertical: 80,
                      paddingHorizontal: 0,
                      alignItems: 'center',
                    }}
                  />
                </View>

                {/* Minute Picker */}
                <View style={styles.pickerColumn}>
                  <FlatList
                    ref={setMinuteScrollRef}
                    data={getMinuteOptions()}
                    keyExtractor={(item, index) => `minute-${index}`}
                    renderItem={({ item, index }) => {
                      const isSelected = tempDateTime.getMinutes() === item.value;
                      return (
                        <TouchableOpacity
                          style={[
                            styles.pickerItem,
                            isSelected && styles.pickerItemSelected,
                          ]}
                          onPress={() => {
                            const newDateTime = new Date(tempDateTime);
                            newDateTime.setMinutes(item.value);
                            setTempDateTime(newDateTime);
                            // Snap to this item with perfect centering
                            minuteScrollRef.scrollToIndex({ 
                              index, 
                              animated: true,
                              viewPosition: 0.5
                            });
                          }}
                        >
                          <Text style={[
                            styles.pickerItemText,
                            { color: isSelected ? '#4a90e2' : (isDarkMode ? '#ffffff' : '#333') }
                          ]}>
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    }}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={40}
                    snapToAlignment="center"
                    decelerationRate="normal"
                    scrollEventThrottle={16}
                    getItemLayout={(data, index) => ({
                      length: 40,
                      offset: 40 * index,
                      index,
                    })}
                    onMomentumScrollEnd={(event) => {
                      const offsetY = event.nativeEvent.contentOffset.y;
                      const index = Math.round(offsetY / 40);
                      const clampedIndex = Math.max(0, Math.min(index, 59));
                      
                      // Snap to the closest item
                      minuteScrollRef.scrollToIndex({ 
                        index: clampedIndex, 
                        animated: true,
                        viewPosition: 0.5 // Center the item
                      });
                      
                      const newDateTime = new Date(tempDateTime);
                      newDateTime.setMinutes(clampedIndex);
                      setTempDateTime(newDateTime);
                    }}
                    contentContainerStyle={{
                      paddingVertical: 80,
                      paddingHorizontal: 0,
                      alignItems: 'center',
                    }}
                  />
                </View>
              </View>
              
              {/* Single Continuous Shadowed Selection Line */}
              <View style={styles.selectionLine} pointerEvents="none" />
            </View>
          </View>
        </View>
      </Modal>


      {/* Collection Selector Modal */}
      <Modal
        visible={showCollectionSelector}
        transparent={true}
        animationType="none"
        statusBarTranslucent={true}
        onRequestClose={closeCollectionSelector}
      >
        <View style={styles.collectionModalOverlay}>
          {/* Background overlay - dismisses on tap */}
          <Animated.View 
            style={[
              styles.collectionModalBackdrop,
              {
                opacity: collectionModalAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
              }
            ]}
          >
            <TouchableOpacity 
              style={StyleSheet.absoluteFillObject}
              activeOpacity={1}
              onPress={closeCollectionSelector}
            />
          </Animated.View>
          {/* Modal content - positioned at bottom */}
          <Animated.View
            style={[
              styles.collectionModalContent, 
              { 
                backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
                transform: [
                  {
                    translateY: collectionModalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [600, 0],
                    }),
                  },
                ],
              }
            ]}
          >
              <View style={[styles.collectionModalHeader, { 
              borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' 
            }]}>
              <Text style={[styles.collectionModalTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                Select Collections
              </Text>
              <TouchableOpacity
                onPress={closeCollectionSelector}
                style={styles.collectionModalCloseButton}
              >
                <MaterialIcons name="close" size={24} color={isDarkMode ? '#ffffff' : '#333'} />
              </TouchableOpacity>
            </View>

            {loadingCollections ? (
              <View style={styles.collectionModalLoading}>
                <ActivityIndicator size="large" color="#4a90e2" />
                <Text style={[styles.collectionModalLoadingText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                  Loading collections...
                </Text>
              </View>
            ) : collections.length === 0 ? (
              <View style={styles.collectionModalEmpty}>
                <MaterialIcons name="folder-off" size={64} color={isDarkMode ? '#666' : '#ccc'} />
                <Text style={[styles.collectionModalEmptyText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                  No collections available
                </Text>
                <Text style={[styles.collectionModalEmptySubtext, { color: isDarkMode ? '#999' : '#666' }]}>
                  Create a collection first
                </Text>
              </View>
            ) : (
              <>
                <ScrollView style={styles.collectionModalList}>
                  {collections.map((collection) => {
                    const isSelected = selectedCollections.includes(collection.id);
                    return (
                      <TouchableOpacity
                        key={collection.id}
                        style={[
                          styles.collectionModalItem,
                          isSelected && styles.collectionModalItemSelected,
                          { 
                            backgroundColor: isSelected 
                              ? (isDarkMode ? '#3a3a3a' : '#f0f5ff') 
                              : 'transparent',
                            borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                          }
                        ]}
                        onPress={() => toggleCollectionSelection(collection.id)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.collectionModalItemCheckbox, {
                          backgroundColor: isSelected ? '#4a90e2' : 'transparent',
                          borderColor: isSelected ? '#4a90e2' : (isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)')
                        }]}>
                          {isSelected && <MaterialIcons name="check" size={16} color="#ffffff" />}
                        </View>
                        
                        {collection.imageLink ? (
                          <Image
                            source={{ uri: collection.imageLink }}
                            style={styles.collectionModalItemImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[styles.collectionModalItemImagePlaceholder, {
                            backgroundColor: isDarkMode ? '#3a3a3a' : '#f5f5f5'
                          }]}>
                            <MaterialIcons name="folder" size={24} color={isDarkMode ? '#666' : '#ccc'} />
                          </View>
                        )}
                        
                        <View style={styles.collectionModalItemInfo}>
                          <Text style={[styles.collectionModalItemTitle, { color: isDarkMode ? '#ffffff' : '#333' }]} numberOfLines={1}>
                            {collection.title}
                          </Text>
                          {collection.listLink && (
                            <Text style={[styles.collectionModalItemCount, { color: isDarkMode ? '#999' : '#666' }]}>
                              {collection.listLink.length} link{collection.listLink.length !== 1 ? 's' : ''}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={[styles.collectionModalFooter, {
                  borderTopColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }]}>
                  <TouchableOpacity
                    style={[styles.collectionModalCancelButton, {
                      backgroundColor: isDarkMode ? '#3a3a3a' : '#f0f0f0'
                    }]}
                    onPress={closeCollectionSelector}
                  >
                    <Text style={[styles.collectionModalButtonText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.collectionModalMoveButton,
                      selectedCollections.length === 0 && styles.collectionModalMoveButtonDisabled
                    ]}
                    onPress={() => {
                      moveLinkToCollections();
                    }}
                    disabled={selectedCollections.length === 0}
                  >
                    <Text style={styles.collectionModalMoveButtonText}>
                      Move ({selectedCollections.length})
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        </View>
      </Modal>

      {/* Custom Preview Editor Modal */}
      <Modal
        visible={isCustomPreviewModalVisible}
        transparent={true}
        animationType="none"
        statusBarTranslucent={true}
        onRequestClose={() => setIsCustomPreviewModalVisible(false)}
      >
        <Animated.View 
          style={[
            styles.customPreviewModalOverlay,
            {
              opacity: previewModalAnim,
            }
          ]}
        >
          <Animated.View 
            style={[
              styles.customPreviewModal, 
              { 
                backgroundColor: isDarkMode ? '#2a2a2a' : '#fff',
                transform: [
                  {
                    scale: previewModalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1],
                    }),
                  },
                ],
                opacity: previewModalAnim,
              }
            ]}
          >
            <View style={styles.customPreviewHeader}>
              <Text style={[styles.customPreviewTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>Customize Preview</Text>
              <TouchableOpacity 
                onPress={() => setIsCustomPreviewModalVisible(false)}
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
                <Text style={[styles.imageHintText, { color: isDarkMode ? '#cccccc' : '#666' }]}>
                  Take a screenshot of the content or upload your own image
                </Text>
              </View>

              {/* Title Section */}
              <View style={styles.customPreviewSection}>
                <Text style={[styles.customPreviewSectionTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>Title</Text>
                <TextInput
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
                />
              </View>

              {/* Description Section */}
              <View style={styles.customPreviewSection}>
                <Text style={[styles.customPreviewSectionTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>Description</Text>
                <TextInput
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
                onPress={() => setIsCustomPreviewModalVisible(false)}
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
          </Animated.View>
        </Animated.View>
      </Modal>

      <View style={styles.linkSeparator} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 12,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  
  // Top Left Controls
  topLeftControls: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 20 : 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  hamburgerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  hamburgerLine: {
    width: 18,
    height: 2,
    marginVertical: 2,
    borderRadius: 1,
  },
  searchIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Top Right Controls
  topRightControls: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 20 : 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginRight: 12,
    textAlign: 'right',
  },
  addCollectionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  // ScrollView content container
  scrollContent: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: 80, // Further reduced space for absolutely positioned footer
  },
  pageDescriptionSection: {
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  pageDescriptionText: {
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  designSelectorSection: {
    marginBottom: 4,
  },
  designSelectorSectionModern: {
    marginBottom: 0,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
    paddingVertical: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    opacity: 0.7,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyState: {
    borderRadius: 24,
    padding: 32,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
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
  },
  emptyStateAddButton: {
    marginTop: 24,
    padding: 14,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  emptyStateInfoText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 16,
    paddingHorizontal: 12,
  },
  linksList: {
    paddingVertical: 4,
  },
  linkCard: {
    borderRadius: 16,
    padding: 0,
    marginBottom: 12,
    borderWidth: 0,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  previewContainer: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    marginLeft: 0,
    overflow: 'hidden',
    aspectRatio: 1,
    height: undefined,
    alignSelf: 'flex-start',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  instagramPreviewContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    width: '100%', // Changed from 80% to 100% for full width
    aspectRatio: 4/5, // Use aspect ratio instead of fixed height
    height: undefined,
    padding: 0, // Remove padding for full image display
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
  // Letterboxed video preview for 16:9 within any container
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
  // Container-level aspect helpers for modern design
  aspect16x9: {
    aspectRatio: 16/9,
    height: undefined,
    width: '100%',
  },
  aspect9x16: {
    aspectRatio: 3/4, // Changed from 9/16 to 3/4 for better quality and width
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
  previewLoading: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  slowLoadingText: {
    marginTop: 4,
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  siteNameBadge: {
    position: 'absolute',
    top: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  siteNameBadgeTopRight: {
    right: 12,
  },
  siteNameBadgeModern: {
    top: 10,
    right: 8,
  },
  siteNameBadgeClassic: {
    top: 8,
    right: 8,
  },
  siteNameBadgeGrid: {
    top: 8,
    right: 8,
  },
  siteNameBadgeMinimal: {
    top: 8,
    right: 8,
  },
  siteNameBadgeTopLeft: {
    left: 12,
  },
  siteNameText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
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
  retrySubtext: {
    color: '#4a90e2',
    fontSize: 10,
    opacity: 0.8,
    marginTop: 2,
    textAlign: 'center',
  },
  linkContent: {
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    gap: 12,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  linkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  platformIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  linkInfo: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 20,
    flexShrink: 1,
    flexWrap: 'wrap',
    maxWidth: '100%',
  },
  linkDescription: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  linkPlatform: {
    fontSize: 14,
    opacity: 0.8,
  },
  linkUrl: {
    fontSize: 14,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  linkDescription: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  linkDate: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
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
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 10,
    paddingBottom: 30, // Extra padding at bottom for counter
    marginBottom: 12,
    fontSize: 16,
    minHeight: 44, // Even more compact
  },
  characterCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: -12,
    marginBottom: 2,
    paddingRight: 4,
  },
  characterCountInline: {
    fontSize: 10,
    position: 'absolute',
    right: 10,
    bottom: 10,
    pointerEvents: 'none',
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
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  loadingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Design system styles
  headerContent: {
    alignItems: 'center',
    marginBottom: 16,
  },
  designChangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
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
  // Sorting Controls Styles
  sortingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
    paddingHorizontal: 0,
  },
  sortOptionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  sortButtonText: {
    marginLeft: 6,
    marginRight: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  orderButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortMenuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 998,
  },
  sortMenu: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 999,
    position: 'relative',
  },
  sortMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sortMenuItemText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  gridLinksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
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
  // WhatsApp-style Animated Search Bar Styles
  animatedSearchContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 100 : 90,
    zIndex: 9999,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingHorizontal: 16,
    paddingBottom: 8,
    justifyContent: 'flex-end',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 4,
    minHeight: 45,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchBackButtonInside: {
    paddingLeft: 12,
    paddingRight: 8,
  },
  animatedSearchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
    paddingRight: 12,
    minHeight: 40,
  },
  
  // Hamburger Menu Styles
  menuOverlay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuContent: {
    width: '82%',
    maxWidth: 340,
    height: '100%',
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: {
      width: -12,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 18,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
  },
  menuTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuProfileImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuProfileImageInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  menuProfileFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuHeaderTextGroup: {
    marginLeft: 12,
    flex: 1,
  },
  menuGreeting: {
    fontSize: 18,
    fontWeight: '700',
  },
  menuSubGreeting: {
    fontSize: 12,
    marginTop: 2,
  },
  menuCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginLeft: 12,
  },
  menuBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'flex-start',
  },
  menuSection: {
    marginBottom: 12,
  },
  menuSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: 'rgba(15,23,42,0.45)',
  },
  menuListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 6,
  },
  menuIconWrapperBare: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  menuItemSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  menuFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  menuFooterTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  menuFooterSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  
  // Reminder styles
  reminderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  reminderText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
    flex: 1,
  },
  reminderDate: {
    fontSize: 10,
    marginLeft: 6,
    opacity: 0.8,
  },
  reminderActiveButton: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
  },
  linkTitleInModal: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  dateTimeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateTimeIcon: {
    marginRight: 12,
  },
  dateTimeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  
  // Custom Picker Styles - Native Look
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
    minHeight: 300,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
  },
  pickerButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  pickerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  pickerContent: {
    flex: 1,
    paddingVertical: 20,
  },
  pickerWheel: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 200,
    position: 'relative',
    paddingHorizontal: 8,
  },
  pickerColumn: {
    flex: 1,
    height: 200,
    marginHorizontal: 8,
    position: 'relative',
  },
  pickerScroll: {
    flex: 1,
  },
  pickerScrollContent: {
    paddingVertical: 80, // Padding to center items in the selection line
    paddingHorizontal: 0,
  },
  pickerItem: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 0, // Remove vertical margin for perfect alignment
    position: 'relative',
    zIndex: 2,
  },
  pickerItemSelected: {
    backgroundColor: 'transparent',
  },
  pickerItemText: {
    fontSize: 20,
    fontWeight: '500',
    textAlign: 'center',
  },
  selectionLine: {
    position: 'absolute',
    top: 100, // Exactly at the center of the 200px height pickerWheel
    left: 8,
    right: 8,
    height: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 4,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  
  // Collection Selector Modal Styles
  collectionModalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: 0,
    marginTop: 0,
  },
  collectionModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  collectionModalContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    minHeight: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 30,
  },
  collectionModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  collectionModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  collectionModalCloseButton: {
    padding: 4,
  },
  collectionModalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  collectionModalLoadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  collectionModalEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  collectionModalEmptyText: {
    marginTop: 24,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  collectionModalEmptySubtext: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  collectionModalList: {
    flex: 1,
  },
  collectionModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  collectionModalItemSelected: {
    backgroundColor: '#f0f5ff',
  },
  collectionModalItemCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  collectionModalItemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  collectionModalItemImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  collectionModalItemInfo: {
    flex: 1,
  },
  collectionModalItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  collectionModalItemCount: {
    fontSize: 12,
  },
  collectionModalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  collectionModalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionModalMoveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#4a90e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionModalMoveButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.5,
  },
  collectionModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  collectionModalMoveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Custom Preview Modal Styles
  customPreviewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
    marginTop: 0,
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
  customPreviewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  saveButtonText: {
    color: 'white',
  },
  linkSeparator: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    marginVertical: 8,
    alignSelf: 'stretch',
    width: '100%',
  },
  linkSeparatorModern: {
    marginVertical: 4,
  },
  
  // Three-dots button styles
  threeDots: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 10,
  },
  threeDotsLeft: {
    top: 8,
    left: 8,
  },
  threeDotsModern: {
    top: 14,
    left: 14,
  },
  threeDotsRight: {
    top: 8,
    right: 8,
  },
  threeDotsBottom: {
    bottom: 8,
    right: 8,
  },
  
  // Link dropdown menu styles
  linkDropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 9998,
  },
  linkDropdownMenu: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 12,
    overflow: 'hidden',
    zIndex: 9999,
  },
  linkDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  linkDropdownItemLast: {
    borderBottomWidth: 0,
  },
  linkDropdownText: {
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '500',
  },
  
  menuOverlay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuContent: {
    width: '82%',
    maxWidth: 340,
    height: '100%',
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: {
      width: -12,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 18,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
  },
  menuTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuProfileImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuProfileImageInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  menuProfileFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuHeaderTextGroup: {
    marginLeft: 12,
    flex: 1,
  },
  menuGreeting: {
    fontSize: 18,
    fontWeight: '700',
  },
  menuSubGreeting: {
    fontSize: 12,
    marginTop: 2,
  },
  menuCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginLeft: 12,
  },
  menuBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'flex-start',
  },
  menuSection: {
    marginBottom: 12,
  },
  menuSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: 'rgba(15,23,42,0.45)',
  },
  menuListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 6,
  },
  menuIconWrapperBare: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  menuItemSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  menuFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  menuFooterTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  menuFooterSubtitle: {
    fontSize: 11,
    marginTop: 2,
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
});
