import React, { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, Animated, ScrollView, ActivityIndicator, StatusBar, Platform, Image, SafeAreaView, TextInput, Keyboard, useWindowDimensions, Linking, Share, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { db, auth } from '../services/firebase/Config.js';
import { collection, getDocs, getDoc, doc, query, where, updateDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageAsync } from '../services/cloudinary/imageUpload.js';
import Footer from '../components/Footer';
import ToastMessage from '../components/ToastMessage';
import { useTheme } from '../ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { showAppDialog } from '../context/DialogContext';
import CollectionsHamburgerMenu from '../components/CollectionsHamburgerMenu';

let lastCollectionsScrollOffset = 0;

export default function Collections({ route }) {
  const navigation = useNavigation();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true); // Only shows while checking cache (~50ms)
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [editTitleModalVisible, setEditTitleModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const [editingCollectionId, setEditingCollectionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isRestoringCollection, setIsRestoringCollection] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // State for thumbnail selector
  const [showThumbnailSelector, setShowThumbnailSelector] = useState(false);
  const [collectionThumbnails, setCollectionThumbnails] = useState([]);
  const [showImageSourceModal, setShowImageSourceModal] = useState(false);
  const [collectionForImageSource, setCollectionForImageSource] = useState(null);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const [updatingImage, setUpdatingImage] = useState(false);
  
  // Hamburger menu and search states
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const isTogglingSearch = useRef(false); // Prevent rapid toggling that causes lag
  
  // Cache for sorted collections to avoid unnecessary re-sorting
  const collectionsCacheRef = useRef({
    ids: '',
    sortBy: null,
    sortOrder: null,
    viewMode: null, // Track trash view vs regular view
    sortedOrder: null, // Array of IDs in sorted order
    timestamp: null
  });

  // Pulse animation for loading text
  useEffect(() => {
    if (isRestoringCollection) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.7,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRestoringCollection]);

  // Hide footer when keyboard is open (no flicker): use "will" events when available
  useEffect(() => {
    const willShow = Keyboard.addListener('keyboardWillShow', () => setIsKeyboardVisible(true));
    const willHide = Keyboard.addListener('keyboardWillHide', () => setIsKeyboardVisible(false));
    // Fallback for platforms without "will" events (Android)
    const didShow = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const didHide = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      willShow.remove();
      willHide.remove();
      didShow.remove();
      didHide.remove();
    };
  }, []);

  // New state for sorting
  const [sortBy, setSortBy] = useState('dateCreated'); // dateCreated, newestFirst, oldestFirst, lastModified, nameAZ, nameZA, activity, leastActive, recentlyUpdated, largest, smallest, favorites
  const [sortOrder, setSortOrder] = useState('desc'); // asc, desc - default: newest to oldest
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [originalCollections, setOriginalCollections] = useState([]);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const toastTimerRef = useRef(null);
  
  // Success message state (same as CollectionFormat.js)
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [toastVariant, setToastVariant] = useState('success');
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
        { key: 'statistics', title: 'Statistics', subtitle: 'See how your collections perform.', icon: 'insights', iconColor: accentColor, action: 'statistics' },
        { key: 'plans', title: 'Plans', subtitle: 'Upgrade for more powerful features.', icon: 'card-membership', iconColor: accentColor, action: 'plans' },
        {
          key: 'trash',
          title: showTrashView ? 'Back to Collections' : 'View Trash',
          subtitle: showTrashView ? 'Return to your active collections.' : 'Review collections moved to trash.',
          icon: showTrashView ? 'restore' : 'delete',
          iconColor: showTrashView ? '#4CAF50' : '#FF9800',
          action: 'trash',
        },
      ],
    },
  ], [accentColor, showTrashView]);
  
  // Selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedCollections, setSelectedCollections] = useState([]);
  
  // Animation for selection indicators
  const searchAnim = useRef(new Animated.Value(0)).current;
  
  
  // Delete confirmation modal state
  const [deleteConfirmModalVisible, setDeleteConfirmModalVisible] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState(null);
  
  // Trash view state
  const [showTrashView, setShowTrashView] = useState(false);
  const [deletedCollections, setDeletedCollections] = useState([]);
  


  const { isDarkMode, getBackgroundColor } = useTheme();
  const scrollViewRef = useRef(null);
  const scrollOffsetRef = useRef(lastCollectionsScrollOffset);
  const restoreOnFocusRef = useRef(lastCollectionsScrollOffset > 0);

  // Show success message (shared toast logic)
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

  // קבלת המשתמש הנוכחי וטעינת האוספים שלו
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // CRITICAL: Load cached collections IMMEDIATELY for instant display
        try {
          const cachedImages = await loadImageCache(user.uid);
          
          // Check if we have cached data in AsyncStorage
          const cacheKey = `collections_data_${user.uid}`;
          const cached = await AsyncStorage.getItem(cacheKey);
          
          if (cached) {
            const cachedCollections = JSON.parse(cached);
            // Apply cached images to cached collections
            const collectionsWithImages = cachedCollections.map(col => ({
              ...col,
              imageLink: col.imageLink || cachedImages[col.id] || null
            }));
            setOriginalCollections(collectionsWithImages);
            console.log('✅ Loaded cached collections INSTANTLY:', collectionsWithImages.length);
          }
          
          // Hide loading immediately after checking cache (whether found or not)
          setLoading(false);
        } catch (error) {
          console.log('No cached collections found, will load from Firebase');
          setLoading(false); // Hide loading even if cache check fails
        }
        
        // Then fetch fresh data in background (no loading state)
        fetchCollections(user.uid);
        // Load saved preferences
        loadViewMode(user.uid);
        loadSortPreference(user.uid);
      } else {
        setCurrentUser(null);
        setCollections([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Note: We no longer need to re-sort collections in useEffect since we're using getDisplayCollections()
  // which handles both filtering and sorting dynamically

  // Handle route parameters (e.g., resetTrashView from footer)
  useEffect(() => {
    if (route.params?.resetTrashView) {
      setShowTrashView(false);
      // Clear the parameter to prevent it from triggering again
      navigation.setParams({ resetTrashView: undefined });
    }
  }, [route.params]);

  // Load view mode from AsyncStorage
  const loadViewMode = async (userId) => {
    try {
      const viewModeKey = `collections_view_mode_${userId}`;
      const savedViewMode = await AsyncStorage.getItem(viewModeKey);
      if (savedViewMode) {
        setViewMode(savedViewMode);
        console.log('✅ Loaded view mode from AsyncStorage:', savedViewMode);
      }
    } catch (error) {
      console.error('Error loading view mode:', error);
    }
  };

  // Save view mode to AsyncStorage
  const saveViewMode = async (userId, mode) => {
    try {
      const viewModeKey = `collections_view_mode_${userId}`;
      await AsyncStorage.setItem(viewModeKey, mode);
      console.log('💾 Saved view mode to AsyncStorage:', mode);
    } catch (error) {
      console.error('Error saving view mode:', error);
    }
  };

  // Load sort preference from AsyncStorage
  const loadSortPreference = async (userId) => {
    try {
      const sortPreferenceKey = `collections_sort_preference_${userId}`;
      const savedPreference = await AsyncStorage.getItem(sortPreferenceKey);
      if (savedPreference) {
        const { sortBy: savedSortBy, sortOrder: savedSortOrder } = JSON.parse(savedPreference);
        setSortBy(savedSortBy);
        setSortOrder(savedSortOrder);
        console.log('✅ Loaded sort preference:', savedSortBy, savedSortOrder);
      }
    } catch (error) {
      console.error('Error loading sort preference:', error);
    }
  };

  // Save sort preference to AsyncStorage
  const saveSortPreference = async (userId, sortByValue, sortOrderValue) => {
    try {
      const sortPreferenceKey = `collections_sort_preference_${userId}`;
      const preference = { sortBy: sortByValue, sortOrder: sortOrderValue };
      await AsyncStorage.setItem(sortPreferenceKey, JSON.stringify(preference));
      console.log('💾 Saved sort preference:', sortByValue, sortOrderValue);
    } catch (error) {
      console.error('Error saving sort preference:', error);
    }
  };

  // Save collection images to AsyncStorage cache
  const saveImageCache = async (userId, collectionsData) => {
    try {
      const imageCacheKey = `collections_image_cache_${userId}`;
      const imageCache = {};
      
      collectionsData.forEach(collection => {
        if (collection.imageLink) {
          imageCache[collection.id] = collection.imageLink;
        }
      });
      
      await AsyncStorage.setItem(imageCacheKey, JSON.stringify(imageCache));
      console.log('💾 Saved image cache for', Object.keys(imageCache).length, 'collections');
    } catch (error) {
      console.error('Error saving image cache:', error);
    }
  };

  // Load collection images from AsyncStorage cache
  const loadImageCache = async (userId) => {
    try {
      const imageCacheKey = `collections_image_cache_${userId}`;
      const cached = await AsyncStorage.getItem(imageCacheKey);
      
      if (cached) {
        const imageCache = JSON.parse(cached);
        console.log('✅ Loaded image cache for', Object.keys(imageCache).length, 'collections');
        return imageCache;
      }
    } catch (error) {
      console.error('Error loading image cache:', error);
    }
    return {};
  };

  // Update a single collection image in cache
  const updateImageInCache = async (userId, collectionId, imageLink) => {
    try {
      const imageCacheKey = `collections_image_cache_${userId}`;
      const cached = await AsyncStorage.getItem(imageCacheKey);
      const imageCache = cached ? JSON.parse(cached) : {};
      
      if (imageLink) {
        imageCache[collectionId] = imageLink;
      } else {
        delete imageCache[collectionId];
      }
      
      await AsyncStorage.setItem(imageCacheKey, JSON.stringify(imageCache));
      console.log('💾 Updated image cache for collection:', collectionId);
    } catch (error) {
      console.error('Error updating image cache:', error);
    }
  };

  // Load cached sort order from AsyncStorage
  const loadCachedSortOrder = async (userId) => {
    try {
      const cacheKey = `collections_sort_cache_${userId}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        collectionsCacheRef.current = {
          ids: parsed.ids || '',
          sortBy: parsed.sortBy || null,
          sortOrder: parsed.sortOrder || null,
          viewMode: Boolean(parsed.viewMode ?? false), // Always convert to boolean, default to false (regular view)
          sortedOrder: parsed.sortedOrder || null,
          timestamp: parsed.timestamp || null
        };
        console.log('✅ Loaded cached sort order from AsyncStorage:', {
          ids: collectionsCacheRef.current.ids,
          sortBy: collectionsCacheRef.current.sortBy,
          sortOrder: collectionsCacheRef.current.sortOrder,
          viewMode: collectionsCacheRef.current.viewMode,
          viewModeType: typeof collectionsCacheRef.current.viewMode,
          sortedOrderLength: collectionsCacheRef.current.sortedOrder?.length || 0
        });
        return true;
      } else {
        console.log('No cached sort order found in AsyncStorage');
      }
    } catch (error) {
      console.error('Error loading cached sort order:', error);
    }
    return false;
  };

  // Save cached sort order to AsyncStorage
  const saveCachedSortOrder = async (userId) => {
    try {
      const cacheKey = `collections_sort_cache_${userId}`;
      const cacheData = {
        ids: collectionsCacheRef.current.ids,
        sortBy: collectionsCacheRef.current.sortBy,
        sortOrder: collectionsCacheRef.current.sortOrder,
        viewMode: Boolean(collectionsCacheRef.current.viewMode ?? false), // Ensure boolean when saving
        sortedOrder: collectionsCacheRef.current.sortedOrder,
        timestamp: collectionsCacheRef.current.timestamp
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log('Saved sort order to AsyncStorage');
    } catch (error) {
      console.error('Error saving cached sort order:', error);
    }
  };

  // Refresh collections when screen comes into focus (e.g., returning from CollectionFormat)
  useFocusEffect(
    React.useCallback(() => {
      if (currentUser) {
        console.log('Collections screen focused, loading cache first...');
        
        // CRITICAL: Pre-apply cached images to existing collections IMMEDIATELY
        // This prevents flicker when navigating from MyLinks
        const preApplyCachedImages = async () => {
          const cachedImages = await loadImageCache(currentUser.uid);
          
          // If we have both cached images and existing collections, apply cache immediately
          if (Object.keys(cachedImages).length > 0 && originalCollections.length > 0) {
            setOriginalCollections(prev => prev.map(collection => ({
              ...collection,
              imageLink: collection.imageLink || cachedImages[collection.id] || null
            })));
            console.log('Pre-applied cached images immediately on focus');
          }
        };
        
        // Apply cache synchronously if possible
        preApplyCachedImages();
        
        // CRITICAL: Load cached sort order FIRST before fetching collections
        // This ensures cache is available when useMemo runs
        loadCachedSortOrder(currentUser.uid).then(() => {
          console.log('Cache loaded, now fetching collections...');
          fetchCollections(currentUser.uid);
        });
        // Also reload preferences
        loadViewMode(currentUser.uid);
        loadSortPreference(currentUser.uid);
      }
      
      // Reset menu state when screen comes into focus
      setIsMenuOpen(false);
      setShowSortMenu(false);
      setDropdownVisible(false);
      setSelectedCollection(null);
      setIsSelectionMode(false);
      setSelectedCollections([]);
      setIsSearchOpen(false);
      searchAnim.setValue(0);

    }, [currentUser])
  );

  // הסרת הכותרת העליונה והגדרת אנימציית הופעה
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
      header: () => null,
      gestureEnabled: false,
    });

    // Removed fade-in animation for instant display (no transition delay)
  }, []);


  // Cleanup effect when component unmounts
  useEffect(() => {
    return () => {
      // Reset all modal and menu states when component unmounts
      setIsMenuOpen(false);
      setShowSortMenu(false);
      setDropdownVisible(false);
      setSelectedCollection(null);
      setIsSelectionMode(false);
      setSelectedCollections([]);
      setDeleteConfirmModalVisible(false);
      setIsSearchOpen(false);
      searchAnim.setValue(0);
    };
  }, []);

  // שליפת האוספים מהדאטהבייס (excluding soft-deleted)
  const fetchCollections = async (userId) => {
    try {
      console.log('Fetching collections for user:', userId);
      
      // Load cached images first for instant display
      const cachedImages = await loadImageCache(userId);
      
      // If we have cached images and existing collections, update them immediately
      // This ensures images show instantly when navigating from any screen
      if (Object.keys(cachedImages).length > 0 && originalCollections.length > 0) {
        const collectionsWithCache = originalCollections.map(collection => ({
          ...collection,
          imageLink: collection.imageLink || cachedImages[collection.id] || null
        }));
        setOriginalCollections(collectionsWithCache);
        console.log('Applied cached images to existing collections for instant display');
      }
      
      const collectionsRef = collection(db, 'albums');
      const q = query(collectionsRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      // Filter out soft-deleted collections
      let collectionsData = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(collection => !collection.isDeleted); // Exclude soft-deleted collections
      
      // Merge cached images with fetched data for instant display
      collectionsData = collectionsData.map(collection => ({
        ...collection,
        imageLink: collection.imageLink || cachedImages[collection.id] || null
      }));
      
      console.log('Fetched collections from Firebase:', collectionsData.length, 'active collections');
      
      // Check if collections have actually changed by comparing IDs
      const newIds = collectionsData.map(c => c.id).sort().join(',');
      const oldIds = originalCollections.map(c => c.id).sort().join(',');
      const collectionsChanged = newIds !== oldIds;
      
      // Store original collections (this will trigger useMemo, but it checks cache)
      setOriginalCollections(collectionsData);
      
      // Save image cache in background
      saveImageCache(userId, collectionsData);
      
      // Save full collections data to AsyncStorage for instant loading on next mount
      try {
        const cacheKey = `collections_data_${userId}`;
        await AsyncStorage.setItem(cacheKey, JSON.stringify(collectionsData));
        console.log('💾 Saved full collections data to cache');
      } catch (error) {
        console.error('Error saving collections data:', error);
      }
      
      // Don't clear cache here - let useMemo decide if sorting is needed
      // Cache will be checked in useMemo and only cleared if collections actually changed
      if (collectionsChanged || originalCollections.length === 0) {
        console.log('Collections changed, useMemo will check if sorting needed');
      } else {
        console.log('Collections unchanged, will use cached sort order');
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
    }
  };

  // Fetch deleted collections for trash view
  const fetchDeletedCollections = async (userId) => {
    try {
      console.log('Fetching deleted collections for user:', userId);
      const collectionsRef = collection(db, 'albums');
      const q = query(collectionsRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      // Calculate 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const toJsDate = (value) => {
        if (!value) return null;
        // Firestore Timestamp
        if (typeof value === 'object' && typeof value.toDate === 'function') {
          return value.toDate();
        }
        // ISO string or number
        return new Date(value);
      };
      
      // Partition soft-deleted collections into two groups:
      // - within 30 days (to show)
      // - 30+ days old (to purge automatically)
      const deletedDocs = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.isDeleted === true);
      
      const toShow = [];
      const toPurge = [];
      
      for (const c of deletedDocs) {
        const deletedDate = toJsDate(c.deletedAt);
        if (deletedDate) {
          if (deletedDate >= thirtyDaysAgo) {
            toShow.push(c);
          } else {
            toPurge.push(c);
          }
          continue;
        }
        // If no deletedAt, fallback to lastModified/createdAt
        const fallbackDate =
          toJsDate(c.lastModified) ||
          toJsDate(c.createdAt);
        if (!fallbackDate) {
          // No dates at all: consider as purgeable for safety
          toPurge.push(c);
          continue;
        }
        if (fallbackDate >= thirtyDaysAgo) {
          toShow.push(c);
        } else {
          toPurge.push(c);
        }
      }
      
      if (toPurge.length > 0) {
        console.log(`Auto-purging ${toPurge.length} collections deleted 30+ days ago`);
        await autoPurgeOldDeletedCollections(toPurge);
      }
      
      const deletedCollectionsData = toShow;
      
      // Sort by deletion date (newest first)
      deletedCollectionsData.sort((a, b) => {
        const dateA = toJsDate(a.deletedAt) || toJsDate(a.lastModified) || toJsDate(a.createdAt) || new Date(0);
        const dateB = toJsDate(b.deletedAt) || toJsDate(b.lastModified) || toJsDate(b.createdAt) || new Date(0);
        return dateB - dateA;
      });
      
      setDeletedCollections(deletedCollectionsData);
      console.log('Fetched deleted collections (auto-purge applied):', deletedCollectionsData.length);
    } catch (error) {
      console.error('Error fetching deleted collections:', error);
    }
  };

  // Navigate to create collection screen
  const openCreateCollection = () => {
    // Will invalidate cache after collection is created
    navigation.navigate('CreateCollection');
  };

  // הצגת תפריט האפשרויות לאוסף
  const showDropdown = (event, collection) => {
    const { pageY, pageX } = event.nativeEvent;
    // Adjust position to ensure dropdown is visible on screen
    const adjustedX = Math.max(10, Math.min(pageX, screenWidth - 210)); // 200 is dropdown width + 10 margin
    
    // Dropdown height estimation (depends on whether it's trash view or regular view)
    // Updated to reflect compact dropdown size
    const dropdownHeight = showTrashView ? 120 : 200; // Approximate height for compact design
    const bottomSpace = screenHeight - pageY;
    
    // If not enough space below, position dropdown above the click point
    let adjustedY;
    if (bottomSpace < dropdownHeight) {
      // Position above, much closer to the button (reduced offset)
      adjustedY = Math.max(10, pageY - dropdownHeight + 20);
    } else {
      adjustedY = Math.max(10, pageY + 5); // Slightly above the button for better alignment
    }
    
    setDropdownPosition({ x: adjustedX, y: adjustedY });
    setSelectedCollection(collection);
    setDropdownVisible(true);
    console.log('Dropdown opened for collection:', collection.title, 'at position:', { x: adjustedX, y: adjustedY });
  };

  // הסתרת תפריט האפשרויות
  const hideDropdown = () => {
    // Prevent closing dropdown while restoring collection
    if (isRestoringCollection) {
      return;
    }
    setDropdownVisible(false);
    setSelectedCollection(null);
  };

  // שינוי תמונת האוסף
  const handleChangeImage = async () => {
    try {
      const collectionToUpdate = collectionForImageSource || selectedCollection;
      
      if (!collectionToUpdate) {
        showSuccessMessage('No collection selected');
        return;
      }
      
      // Check permission first
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        alert('Permission to access camera roll is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        console.log('Image selected for change, uploading to Cloudinary...');
        
        // Upload the new image to Cloudinary first
        const newImageLink = await uploadImageAsync(result.assets[0].uri);
        console.log('New image uploaded successfully:', newImageLink);
        
        // Update Firebase with the new Cloudinary URL
        const docRef = doc(db, 'albums', collectionToUpdate.id);
        await updateDoc(docRef, {
          imageLink: newImageLink,
          lastModified: new Date().toISOString()
        });
        
        // עדכון המצב המקומי
        setCollections(prevCollections => 
          prevCollections.map(col => 
            col.id === collectionToUpdate.id 
              ? { ...col, imageLink: newImageLink }
              : col
          )
        );
        setOriginalCollections(prevOriginalCollections => 
          prevOriginalCollections.map(col => 
            col.id === collectionToUpdate.id 
              ? { ...col, imageLink: newImageLink }
              : col
          )
        );
        
        // Update image cache
        if (currentUser) {
          updateImageInCache(currentUser.uid, collectionToUpdate.id, newImageLink);
        }
        
        hideDropdown();
        setCollectionForImageSource(null);
        
        showSuccessMessage('Image updated successfully!');
      }
    } catch (error) {
      console.error('Error changing image:', error);
      let errorMessage = 'Failed to change image';
      if (error.message.includes('Upload failed')) {
        errorMessage = 'Failed to upload image. Please try again.';
      } else if (error.message.includes('Network')) {
        errorMessage = 'Network error. Please check your connection.';
      }
      alert(`${errorMessage}: ${error.message}`);
    }
  };

  // Open thumbnail selector
  const openThumbnailSelector = async (collection) => {
    console.log('openThumbnailSelector called with collection:', collection?.title);
    console.log('Collection has listLink:', collection?.listLink?.length || 0, 'links');
    
    // Get all unique thumbnails from links in the collection
    if (collection.listLink && collection.listLink.length > 0) {
      try {
        setLoadingThumbnails(true);
        
        // Fetch preview data from Firestore for each link
        const thumbnails = [];
        
        for (const link of collection.listLink) {
          if (link.url) {
            try {
              const safeDocId = encodeURIComponent(link.url.trim()).replace(/[^a-zA-Z0-9]/g, '_');
              const previewDocRef = doc(db, 'linkPreviews', safeDocId);
              const previewSnap = await getDoc(previewDocRef);
              
              if (previewSnap.exists()) {
                const previewData = previewSnap.data();
                if (previewData.image && previewData.image.trim() !== '') {
                  thumbnails.push({
                    url: previewData.image,
                    title: link.title || previewData.title || 'Untitled',
                    linkUrl: link.url
                  });
                }
              }
            } catch (error) {
              console.log('Error fetching preview for', link.url, error);
            }
          }
        }
        
        console.log('Found', thumbnails.length, 'thumbnails');
        
        setLoadingThumbnails(false);
        
        if (thumbnails.length === 0) {
          showAppDialog('No Thumbnails', 'This collection doesn\'t have any link thumbnails available.');
          return;
        }
        
        setCollectionThumbnails(thumbnails);
        setShowThumbnailSelector(true);
      } catch (error) {
        console.error('Error loading thumbnails:', error);
        setLoadingThumbnails(false);
        showAppDialog('Error', 'Failed to load thumbnails. Please try again.');
      }
    } else {
      showAppDialog('Empty Collection', 'This collection has no links to choose thumbnails from.');
    }
  };

  // Select thumbnail as collection image
  const selectThumbnailAsImage = async (thumbnailUrl) => {
    try {
      setUpdatingImage(true);
      const collectionToUpdate = collectionForImageSource || selectedCollection;
      
      if (!collectionToUpdate) {
        showSuccessMessage('No collection selected');
        setUpdatingImage(false);
        return;
      }
      
      // Update Firebase with the thumbnail URL
      const docRef = doc(db, 'albums', collectionToUpdate.id);
      await updateDoc(docRef, {
        imageLink: thumbnailUrl,
        lastModified: new Date().toISOString()
      });
      
      // Update local state
      setCollections(prevCollections => 
        prevCollections.map(col => 
          col.id === collectionToUpdate.id 
            ? { ...col, imageLink: thumbnailUrl }
            : col
        )
      );
      setOriginalCollections(prevOriginalCollections => 
        prevOriginalCollections.map(col => 
          col.id === collectionToUpdate.id 
            ? { ...col, imageLink: thumbnailUrl }
            : col
        )
      );
      
      setShowThumbnailSelector(false);
      setCollectionForImageSource(null);
      setUpdatingImage(false);
      
      // Update image cache
      if (currentUser) {
        updateImageInCache(currentUser.uid, collectionToUpdate.id, thumbnailUrl);
      }
      
      // Invalidate cache when collection image is changed (affects lastModified)
      invalidateSortCache();
      
      showSuccessMessage('Collection image updated from link thumbnail!');
    } catch (error) {
      console.error('Error updating image from thumbnail:', error);
      setUpdatingImage(false);
      showSuccessMessage('Failed to update image. Please try again.');
    }
  };

  // מחיקת תמונת האוסף
  const handleDeleteImage = async () => {
    try {
      if (selectedCollection) {
        const docRef = doc(db, 'albums', selectedCollection.id);
        await updateDoc(docRef, {
          imageLink: null,
          lastModified: new Date().toISOString()
        });
        
        // עדכון המצב המקומי
        setCollections(prevCollections => 
          prevCollections.map(col => 
            col.id === selectedCollection.id 
              ? { ...col, imageLink: null }
              : col
          )
        );
        
        // Update image cache (remove image)
        if (currentUser) {
          updateImageInCache(currentUser.uid, selectedCollection.id, null);
        }
        
        hideDropdown();
        
        // Invalidate cache when collection image is deleted (affects lastModified)
        invalidateSortCache();
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Failed to delete image');
    }
  };

        // Soft delete collection (mark as deleted instead of actually deleting)
  const handleDeleteCollection = async () => {
    if (!selectedCollection || !currentUser || !db) {
      showSuccessMessage('Cannot delete collection. Please try again.');
      return;
    }

    const primaryChoice = await showInfoDialog(
      'Move to Trash',
      `Are you sure you want to move "${selectedCollection.title}" to trash? You can restore it within 30 days.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Move to Trash', style: 'destructive' },
      ]
    );

    if (primaryChoice !== 'Move to Trash') {
      return;
    }

    try {
      console.log('Starting soft deletion process...');
      const docRef = doc(db, 'albums', selectedCollection.id);
      await updateDoc(docRef, {
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: currentUser.uid
      });
      console.log('Collection marked as deleted');

      setCollections(prev => prev.filter(col => col.id !== selectedCollection.id));
      setOriginalCollections(prev => prev.filter(col => col.id !== selectedCollection.id));

      invalidateSortCache();

      hideDropdown();
      setSelectedCollection(null);

      console.log('Soft deletion completed successfully');

      const restoreChoice = await showInfoDialog(
        'Collection Moved to Trash',
        `"${selectedCollection.title}" has been moved to trash. You can restore it within 30 days.`,
        [
          {
            text: 'OK',
            style: 'default',
          },
          {
            text: 'Restore Now',
            style: 'default',
          },
        ]
      );

      if (restoreChoice === 'Restore Now') {
        restoreCollection(selectedCollection.id, selectedCollection.title);
      }
    } catch (error) {
      console.error('Error soft deleting collection:', error);
      showSuccessMessage('Failed to delete collection. Please try again.');
    }
  };

  // Restore deleted collection
  const restoreCollection = async (collectionId, collectionTitle) => {
    try {
      setIsRestoringCollection(true);
      console.log('Restoring collection:', collectionId);
      const docRef = doc(db, 'albums', collectionId);
      
      // Remove deleted flags
      await updateDoc(docRef, {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null
      });
      
      console.log('Collection restored successfully');
      
      // Invalidate cache when collection is restored
      invalidateSortCache();
      
      // Refresh collections to show the restored collection
      if (currentUser) {
        fetchCollections(currentUser.uid);
        fetchDeletedCollections(currentUser.uid); // Refresh trash view
      }
      
      showSuccessMessage(`"${collectionTitle}" has been restored successfully.`);
    } catch (error) {
      console.error('Error restoring collection:', error);
      showSuccessMessage('Failed to restore collection. Please try again.');
    } finally {
      setIsRestoringCollection(false);
    }
  };

  // Permanently delete collection (after 30 days or user choice)
  const permanentDeleteCollection = async (collectionToDelete) => {
    const result = await showInfoDialog(
      'Delete Forever',
      `Are you sure you want to permanently delete "${collectionToDelete.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Forever', style: 'destructive' },
      ]
    );

    if (result !== 'Delete Forever') {
      return;
    }

    try {
      console.log('Starting permanent deletion process...');

      const docRef = doc(db, 'albums', collectionToDelete.id);
      await deleteDoc(docRef);
      console.log('Collection permanently deleted');

      if (collectionToDelete.listLink && collectionToDelete.listLink.length > 0) {
        console.log(`Cleaning up ${collectionToDelete.listLink.length} link previews...`);

        const deletePromises = collectionToDelete.listLink.map(async (link) => {
          try {
            const normalizedUrl = link.url.trim();
            const safeDocId = encodeURIComponent(normalizedUrl).replace(/[^a-zA-Z0-9]/g, '_');
            const previewDocRef = doc(db, 'linkPreviews', safeDocId);
            await deleteDoc(previewDocRef);
            console.log(`Deleted preview for: ${link.url}`);
          } catch (previewError) {
            console.log(`Preview for ${link.url} not found or already deleted`);
          }
        });

        await Promise.all(deletePromises);
        console.log('All link previews cleaned up');
      }

      invalidateSortCache();
      
      // Refresh trash view after deletion
      if (currentUser) {
        await fetchDeletedCollections(currentUser.uid);
      }

      console.log('Permanent deletion completed successfully');
      showSuccessMessage('Collection permanently deleted.');
    } catch (error) {
      console.error('Error permanently deleting collection:', error);
      showSuccessMessage('Failed to permanently delete collection. Please try again.');
    }
  };

  // Auto purge helper: permanently delete collections that exceeded retention (no prompts)
  const autoPurgeOldDeletedCollections = async (collectionsToDelete) => {
    try {
      // Run deletions in parallel
      await Promise.all(
        collectionsToDelete.map(async (c) => {
          try {
            const albumRef = doc(db, 'albums', c.id);
            await deleteDoc(albumRef);
            if (c.listLink && c.listLink.length > 0) {
              await Promise.all(
                c.listLink.map(async (link) => {
                  try {
                    const normalizedUrl = link.url.trim();
                    const safeDocId = encodeURIComponent(normalizedUrl).replace(/[^a-zA-Z0-9]/g, '_');
                    const previewDocRef = doc(db, 'linkPreviews', safeDocId);
                    await deleteDoc(previewDocRef);
                  } catch {
                    // ignore preview cleanup failures
                  }
                })
              );
            }
          } catch (e) {
            console.log('Auto purge failed for collection:', c.id, e?.message || e);
          }
        })
      );
    } catch (e) {
      console.log('Auto purge batch encountered an error:', e?.message || e);
    }
  };

  // עדכון כותרת האוסף
  const handleUpdateTitle = async (collectionId) => {
    try {
      if (editingTitle.trim()) {
        const docRef = doc(db, 'albums', collectionId);
        await updateDoc(docRef, {
          title: editingTitle.trim(),
          lastModified: new Date().toISOString()
        });
        
        // עדכון המצב המקומי - עדכון גם collections וגם originalCollections
        const updatedTitle = editingTitle.trim();
        setCollections(prevCollections => 
          prevCollections.map(col => 
            col.id === collectionId 
              ? { ...col, title: updatedTitle }
              : col
          )
        );
        setOriginalCollections(prevOriginalCollections => 
          prevOriginalCollections.map(col => 
            col.id === collectionId 
              ? { ...col, title: updatedTitle }
              : col
          )
        );
        
        setEditingCollectionId(null);
        setEditingTitle('');
        
        // Invalidate cache when collection is edited
        invalidateSortCache();
        
        showSuccessMessage('Title updated successfully!');
      }
    } catch (error) {
      console.error('Error updating title:', error);
      showSuccessMessage('Failed to update title. Please try again.');
    }
  };

  // Toggle favorite status for collection
  const toggleFavorite = async (collection) => {
    try {
      if (!currentUser || !db) {
        showSuccessMessage('Cannot update favorite. Please try again.');
        return;
      }

      const collectionRef = doc(db, 'albums', collection.id);
      const newFavoriteStatus = !collection.isFavorite;
      
      await updateDoc(collectionRef, {
        isFavorite: newFavoriteStatus,
        lastModified: new Date().toISOString()
      });
      
      // Update local state
      setCollections(prev => 
        prev.map(col => 
          col.id === collection.id 
            ? { ...col, isFavorite: newFavoriteStatus, lastModified: new Date().toISOString() }
            : col
        )
      );
      
      // Invalidate cache when favorite status changes (affects favorites sort)
      invalidateSortCache();
      setOriginalCollections(prev => 
        prev.map(col => 
          col.id === collection.id 
            ? { ...col, isFavorite: newFavoriteStatus, lastModified: new Date().toISOString() }
            : col
        )
      );
      
      console.log(`Collection ${collection.title} ${newFavoriteStatus ? 'favorited' : 'unfavorited'} successfully`);
      showSuccessMessage(newFavoriteStatus ? 'Added to favorites!' : 'Removed from favorites!');
    } catch (error) {
      console.error('Error toggling favorite:', error);
      showSuccessMessage('Failed to update favorite. Please try again.');
    }
  };

  // פתיחת עריכת כותרת
  const startEditingTitle = (collection) => {
    setEditingCollectionId(collection.id);
    setEditingTitle(collection.title);
    hideDropdown();
  };

  // Smart sorting functions
  const smartSortName = (a, b, order) => {
    const cleanA = a.title.replace(/^(the|a|an)\s+/i, '').toLowerCase();
    const cleanB = b.title.replace(/^(the|a|an)\s+/i, '').toLowerCase();
    return order === 'asc' ? cleanA.localeCompare(cleanB) : cleanB.localeCompare(cleanA);
  };

  const sortCollections = (collections, sortBy, sortOrder) => {
    const sorted = [...collections];
    
    switch (sortBy) {
      case 'nameAZ':
        // Use sortOrder parameter to allow ascending/descending toggle
        return sorted.sort((a, b) => smartSortName(a, b, sortOrder));
      
      case 'nameZA':
        // nameZA is reverse of nameAZ, so invert the sortOrder
        return sorted.sort((a, b) => smartSortName(a, b, sortOrder === 'asc' ? 'desc' : 'asc'));
      
      case 'dateCreated':
        const dateSorted = sorted.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
        return dateSorted;
      
      case 'newestFirst':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
      
      case 'oldestFirst':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
      
      case 'lastModified':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.lastModified || a.createdAt || 0);
          const dateB = new Date(b.lastModified || b.createdAt || 0);
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
      
      case 'activity':
        // Most Active = Collections with recent changes (lastModified)
        return sorted.sort((a, b) => {
          const dateA = new Date(a.lastModified || a.createdAt || 0);
          const dateB = new Date(b.lastModified || b.createdAt || 0);
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
      
      case 'leastActive':
        return sorted.sort((a, b) => {
          const countA = a.listLink ? a.listLink.length : 0;
          const countB = b.listLink ? b.listLink.length : 0;
          return sortOrder === 'asc' ? countA - countB : countB - countA;
        });
      
      case 'largest':
        return sorted.sort((a, b) => {
          const countA = a.listLink ? a.listLink.length : 0;
          const countB = b.listLink ? b.listLink.length : 0;
          return sortOrder === 'asc' ? countA - countB : countB - countA;
        });
      
      case 'smallest':
        return sorted.sort((a, b) => {
          const countA = a.listLink ? a.listLink.length : 0;
          const countB = b.listLink ? b.listLink.length : 0;
          return sortOrder === 'asc' ? countA - countB : countB - countA;
        });
      
      case 'favorites':
        return sorted.sort((a, b) => {
          const favoriteA = a.isFavorite ? 1 : 0;
          const favoriteB = b.isFavorite ? 1 : 0;
          return sortOrder === 'asc' ? favoriteA - favoriteB : favoriteB - favoriteA;
        });
      
      default:
        console.log('Using default sorting (no sort applied)');
        return sorted;
    }
  };

  // Clear cache when collections are modified (add/edit/delete/favorite change)
  const invalidateSortCache = useCallback(() => {
    collectionsCacheRef.current = {
      ids: '',
      sortBy: null,
      sortOrder: null,
      viewMode: null,
      sortedOrder: null,
      timestamp: null
    };
    // Also clear from AsyncStorage
    if (currentUser) {
      AsyncStorage.removeItem(`collections_sort_cache_${currentUser.uid}`).catch(() => {});
    }
    console.log('Sort cache invalidated');
  }, [currentUser]);

  // Handle sorting changes
  const handleSortChange = (newSortBy, newSortOrder) => {
    console.log('🔄 handleSortChange called:', { 
      currentSortBy: sortBy, 
      newSortBy, 
      currentSortOrder: sortOrder, 
      newSortOrder,
      sortOrderChanged: sortOrder !== newSortOrder,
      sortByChanged: sortBy !== newSortBy
    });
    
    // CRITICAL: Clear cache FIRST before state update, so useMemo detects the change
    invalidateSortCache();
    
    // Then update state - this will trigger useMemo to re-run and detect cache is invalid
    // Use functional updates to ensure we're using the latest state
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    
    // Save sort preference to AsyncStorage
    if (currentUser) {
      saveSortPreference(currentUser.uid, newSortBy, newSortOrder);
    }
    
    console.log('✅ State updated, useMemo should re-run and detect cache is invalid');
  };





  const handleLongPress = (collection, index) => {
    console.log('Long press detected on collection:', collection.title, 'at index:', index);
    
    // Enter selection mode
    setIsSelectionMode(true);
    setSelectedCollections([collection.id]);
    
    console.log('Selection mode activated, selected collections:', [collection.id]);
    
    // Show visual feedback
    showInfoDialog('Selection Mode', `Long pressed "${collection.title}". Now tap other collections to select them.`);
    
    // Start pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };



  const handleCollectionPress = (collection, index) => {
    // Safety check: close any open menus first
    if (isMenuOpen || dropdownVisible || showSortMenu) {
      closeMenu();
      setDropdownVisible(false);
      setShowSortMenu(false);
      setSelectedCollection(null);
      return; // Don't process the press if menus were open
    }
    
    if (isSelectionMode) {
      // Toggle selection
      setSelectedCollections(prev => 
        prev.includes(collection.id) 
          ? prev.filter(id => id !== collection.id)
          : [...prev, collection.id]
      );
      
      // If this was the last selected collection, exit selection mode
      if (selectedCollections.length === 1 && selectedCollections.includes(collection.id)) {
        exitSelectionMode();
      }
    } else {
      // Navigate instantly without transition
      restoreOnFocusRef.current = true;
      const currentOffset = scrollOffsetRef.current || 0;
      lastCollectionsScrollOffset = currentOffset;
      navigation.navigate('CollectionFormat', { collection });
    }
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedCollections([]);
    
    // Stop pulse animation
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };
  
  const handleMultipleSelection = () => {
    if (selectedCollections.length > 1) {
      // If multiple collections are selected, show options
      showInfoDialog(
         'Multiple Collections Selected',
         `You have ${selectedCollections.length} collections selected. What would you like to do?`,
         [
           {
             text: 'Cancel',
             style: 'cancel'
           },
           {
             text: 'Move to Top',
             onPress: () => {
               // Move selected collections to the top
               const selectedIds = new Set(selectedCollections);
               const selected = originalCollections.filter(c => selectedIds.has(c.id));
               const unselected = originalCollections.filter(c => !selectedIds.has(c.id));
               const newOrder = [...selected, ...unselected];
               setCollections(newOrder);
               exitSelectionMode();
             }
           },
           {
             text: 'Move to Bottom',
             onPress: () => {
               // Move selected collections to the bottom
               const selectedIds = new Set(selectedCollections);
               const selected = originalCollections.filter(c => selectedIds.has(c.id));
               const unselected = originalCollections.filter(c => !selectedIds.has(c.id));
               const newOrder = [...unselected, ...selected];
               setCollections(newOrder);
               exitSelectionMode();
             }
           }
         ]
       );
    }
  };

  // Get filtered and sorted collections (regular or trash view)
  // Memoized to prevent unnecessary recalculations when unrelated state changes (like isSearchOpen)
  const displayCollections = useMemo(() => {
    // Choose data source based on view mode
    const dataSource = showTrashView ? deletedCollections : originalCollections;
    
    // Early return if no data
    if (dataSource.length === 0) {
      return [];
    }
    
    // Check if we can skip sorting (cache optimization) - check BEFORE filtering
    const allCollectionIds = dataSource.map(c => c.id).sort().join(',');
    const cached = collectionsCacheRef.current;
    
    // Check if cache is valid and matches current state
    const cacheExists = cached && cached.sortedOrder && cached.sortedOrder.length > 0;
    const collectionsMatch = cacheExists && cached.ids === allCollectionIds;
    // Check if sort settings match - this is critical for detecting sort order changes
    const sortMatches = cacheExists && cached.sortBy === sortBy && cached.sortOrder === sortOrder;
    
    // Quiet mode: avoid verbose comparison logs during normal navigation
    // Normalize viewMode: null/undefined means regular view (false), ensure boolean comparison
    const cachedViewMode = Boolean(cached?.viewMode ?? false);
    const currentViewMode = Boolean(showTrashView);
    const viewModeMatches = cacheExists && (cachedViewMode === currentViewMode);
    
    // Cache is valid ONLY if cache exists AND all conditions match
    // If sortBy or sortOrder changed, sortMatches will be false, so cacheIsValid will be false
    const cacheIsValid = cacheExists && collectionsMatch && sortMatches && viewModeMatches;
    
    let sortedAll;
    
    if (cacheIsValid) {
      // Use cached order - NO SORTING NEEDED!
      console.log('✅ Using cached sort order - skipping sort (all checks passed)');
      // Create a map for quick lookup
      const collectionMap = new Map(dataSource.map(c => [c.id, c]));
      
      // Reorder ALL collections based on cached sorted order
      sortedAll = cached.sortedOrder
        .map(id => collectionMap.get(id))
        .filter(Boolean); // Remove any that don't exist (safety check)
      
      // Add any collections that weren't in cache (shouldn't happen if cache is valid)
      dataSource.forEach(c => {
        if (!sortedAll.find(s => s.id === c.id)) {
          sortedAll.push(c);
        }
      });
    } else {
      // Cache is invalid or doesn't exist - need to sort
      // Apply sorting to ALL collections (quiet)
      sortedAll = sortCollections(dataSource, sortBy, sortOrder);
      
      // Update cache with sorted order of ALL collections
      collectionsCacheRef.current = {
        ids: allCollectionIds,
        sortBy,
        sortOrder,
        viewMode: Boolean(showTrashView), // Ensure boolean, never null
        sortedOrder: sortedAll.map(c => c.id), // Store just the IDs in sorted order
        timestamp: Date.now()
      };
      
      // Save to AsyncStorage if user is logged in
      if (currentUser) {
        saveCachedSortOrder(currentUser.uid);
      }
    }
    
    // Now apply search filter to the already-sorted collections
    if (searchQuery.trim()) {
      return sortedAll.filter(collection => 
        collection.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return sortedAll;
  }, [originalCollections, deletedCollections, showTrashView, searchQuery, sortBy, sortOrder, currentUser]);

  useLayoutEffect(() => {
    if (!loading && restoreOnFocusRef.current && scrollViewRef.current) {
      const targetOffset = Math.max(lastCollectionsScrollOffset, 0);
      scrollViewRef.current.scrollTo({ x: 0, y: targetOffset, animated: false });
      scrollOffsetRef.current = targetOffset;
      restoreOnFocusRef.current = false;
    }
  }, [loading, displayCollections.length, showTrashView]);

  // Keep the function for backward compatibility but use memoized value
  const getDisplayCollections = () => displayCollections;

  // Force refresh collections
  const refreshCollections = async () => {
    console.log('=== REFRESH COLLECTIONS DEBUG ===');
    console.log('Current user:', currentUser?.uid);
    console.log('Firebase db:', !!db);
    
    if (currentUser && db) {
      console.log('Force refreshing collections...');
      try {
        await fetchCollections(currentUser.uid);
        console.log('Collections refreshed successfully');
      } catch (error) {
        console.error('Error refreshing collections:', error);
      }
    } else {
      console.error('Cannot refresh collections - missing user or db');
    }
  };

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

  // Handle hamburger menu toggle
  const toggleMenu = () => {
    if (isMenuOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  // Handle search toggle - show/hide animated search bar (optimized for instant response)
  const toggleSearch = useCallback(() => {
    // Prevent rapid toggling that could cause lag
    if (isTogglingSearch.current) return;
    
    if (isSearchOpen) {
      // Closing search - set isSearchOpen to false immediately so header buttons appear instantly
      isTogglingSearch.current = true;
      setIsSearchFocused(false);
      Keyboard.dismiss();
      setIsKeyboardVisible(false); // Clear keyboard visible state immediately (matches MainScreen and MyLinks)
      setIsSearchOpen(false); // Set immediately so header switches to fadeAnim and buttons appear
      setSearchQuery(''); // Clear immediately to match MainScreen and MyLinks
      
      // Animate out in background (non-blocking)
      Animated.timing(searchAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        // Reset toggle lock after animation completes
        isTogglingSearch.current = false;
      });
    } else {
      // Opening search - show immediately
      isTogglingSearch.current = true;
      setIsSearchOpen(true);
      // Start animation in next frame to not block UI thread
      requestAnimationFrame(() => {
        Animated.spring(searchAnim, {
          toValue: 1,
          duration: 300,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }).start(() => {
          isTogglingSearch.current = false;
        });
      });
    }
  }, [isSearchOpen, searchAnim]);

  // Handle menu item selection
  const handleMenuAction = useCallback((action) => {
    closeMenu(async () => {
      try {
        switch (action) {
          case 'rate': {
            const storeUrl = Platform.OS === 'ios'
              ? 'https://apps.apple.com'
              : 'https://play.google.com/store';
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
          case 'trash': {
            const nextValue = !showTrashView;
            if (nextValue && currentUser) {
              await fetchDeletedCollections(currentUser.uid);
            } else if (!nextValue && currentUser) {
              await fetchCollections(currentUser.uid);
            }
            setShowTrashView(nextValue);
            break;
          }
          default:
            break;
        }
      } catch (error) {
        console.error('Menu action error:', error);
        showInfoDialog('Action unavailable', 'Please try again in a moment.');
      }
    });
  }, [closeMenu, currentUser, navigation, shareMessage, showTrashView, supportEmail, privacyUrl, termsUrl, fetchDeletedCollections, fetchCollections]);

  // הצגת מסך טעינה
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: getBackgroundColor() }]}>
        <Text style={[styles.loadingText, { color: isDarkMode ? '#cccccc' : '#666' }]}>Loading...</Text>
      </View>
    );
  }

  const showInfoDialog = (title, message, buttons = [{ text: 'OK' }], options = {}) =>
    showAppDialog(title, message, buttons, options);

  const handleCollectionLongPress = (collection) => {
     if (!isSelectionMode) {
       setIsSelectionMode(true);
       setSelectedCollections([collection.id]);
       showInfoDialog('Selection Mode', `Long pressed "${collection.title}". Now tap other collections to select them.`);
     } else {
       toggleCollectionSelection(collection.id);
     }
   };

  return (
    <View style={[styles.container, { backgroundColor: getBackgroundColor() }]}>
      {/* Status Bar */}
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={getBackgroundColor()}
        translucent={false}
      />
      
             {/* Selection Mode Header */}
       {isSelectionMode && (
         <Animated.View style={[styles.selectionHeader, { opacity: fadeAnim }]}>
           <TouchableOpacity onPress={exitSelectionMode} style={styles.cancelButton}>
             <Text style={[styles.cancelButtonText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Cancel</Text>
           </TouchableOpacity>
           <Text style={[styles.selectionTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
             Select Collections
           </Text>
                       <View style={styles.selectionInfo}>
              <Text style={[styles.selectionCount, { color: isDarkMode ? '#cccccc' : '#666' }]}>
                {selectedCollections.length} selected
              </Text>
              {selectedCollections.length > 1 && (
                <TouchableOpacity 
                  style={[styles.selectAllButton, { marginRight: 8 }]}
                  onPress={handleMultipleSelection}
                >
                  <Text style={[styles.selectAllText, { color: '#FFC107' }]}>Actions</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={styles.selectAllButton}
                onPress={() => {
                  if (selectedCollections.length === getDisplayCollections().length) {
                    // If all are selected, deselect all
                    setSelectedCollections([]);
                  } else {
                    // Select all
                    setSelectedCollections(getDisplayCollections().map(c => c.id));
                  }
                }}
              >
                <Text style={[styles.selectAllText, { color: '#4A90E2' }]}>
                  {selectedCollections.length === getDisplayCollections().length ? 'None' : 'All'}
                </Text>
              </TouchableOpacity>
            </View>
         </Animated.View>
       )}
       
       {/* כותרת המסך עם אנימציה - fades in/out with search */}
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
       <View style={[styles.topRightControls, showTrashView && styles.trashTopRightControls]}>
          <Text style={[styles.pageTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
            {showTrashView ? 'Trash' : 'Collections'}
          </Text>
          {!showTrashView ? (
            <TouchableOpacity 
              style={[styles.addCollectionButton, { 
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' 
              }]}
              onPress={openCreateCollection}
            >
              <MaterialIcons name="add" size={24} color={isDarkMode ? '#ffffff' : '#333'} />
            </TouchableOpacity>
          ) : null}
        </View>

        
        {/* Share Test Button moved to menu */}
           
            
          

            

             
           
                      
            
                        
             
             
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
              onPress={toggleSearch}
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
              placeholder="Search Collections..."
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

      {/* רשימת האוספים */}
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={true}
        ref={scrollViewRef}
        onScroll={(event) => {
          const offsetY = event.nativeEvent.contentOffset.y;
          scrollOffsetRef.current = offsetY;
          lastCollectionsScrollOffset = offsetY;
        }}
        scrollEventThrottle={16}
      >
        {/* Page Description - Trash View */}
        {showTrashView && (
          <View style={styles.pageDescriptionSection}>
            <Text style={[styles.pageDescriptionText, { color: isDarkMode ? '#999' : '#999' }]}>
              Collections here will be deleted automatically after 30 days • You can restore any collection within 30 days
            </Text>
          </View>
        )}
        
        {/* Sorting Header */}
        <Animated.View style={[
          styles.sortingHeader, 
          { 
            opacity: fadeAnim
          }
        ]}>

           
                       {/* Selection Mode Indicator */}
            {isSelectionMode && (
              <View style={[styles.selectionModeIndicator, { 
                backgroundColor: isDarkMode ? 'rgba(255, 193, 7, 0.2)' : 'rgba(255, 193, 7, 0.1)',
                borderColor: '#FFC107'
              }]}>
                <MaterialIcons name="touch-app" size={20} color="#FFC107" />
                <Text style={[styles.selectionModeText, { color: '#FFC107' }]}>
                  Selection Mode: Tap collections to select
                </Text>
              </View>
            )}
          
          
          <View style={styles.sortingControls}>
            {/* Design Button - Left side, no card background */}
            <TouchableOpacity 
              style={styles.designButton}
              onPress={() => {
                const newMode = viewMode === 'grid' ? 'list' : 'grid';
                setViewMode(newMode);
                if (currentUser) {
                  saveViewMode(currentUser.uid, newMode);
                }
              }}
            >
              <MaterialIcons 
                name={viewMode === 'grid' ? 'view-list' : 'grid-view'} 
                size={24} 
                color={isDarkMode ? '#ffffff' : '#333'} 
              />
            </TouchableOpacity>
            
            {/* Sort Options - Right side, no card background */}
            <View style={styles.sortOptionsContainer}>
              <TouchableOpacity 
                style={styles.sortButton}
                onPress={() => setShowSortMenu(!showSortMenu)}
              >
                <MaterialIcons name="sort" size={20} color={isDarkMode ? '#ffffff' : '#333'} />
                <Text style={[styles.sortButtonText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                  {sortBy === 'dateCreated' ? 'Date Created' : sortBy === 'newestFirst' ? 'Newest First' : sortBy === 'oldestFirst' ? 'Oldest First' : sortBy === 'lastModified' ? 'Last Modified' : sortBy === 'nameAZ' ? 'Name A-Z' : sortBy === 'nameZA' ? 'Name Z-A' : sortBy === 'activity' ? 'Most Active' : sortBy === 'leastActive' ? 'Least Active' : sortBy === 'recentlyUpdated' ? 'Recently Updated' : sortBy === 'largest' ? 'Largest' : sortBy === 'smallest' ? 'Smallest' : sortBy === 'favorites' ? 'Favorites' : 'Custom Order'}
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
                  backgroundColor: sortBy === 'dateCreated' ? (isDarkMode ? '#3a3a3a' : '#f0f5ff') : 'transparent',
                  borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }]}
                onPress={() => {
                  handleSortChange('dateCreated', sortOrder);
                  setShowSortMenu(false);
                }}
              >
                <MaterialIcons name="schedule" size={18} color={isDarkMode ? '#ffffff' : '#333'} />
                <Text style={[styles.sortMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Date Created</Text>
              </TouchableOpacity>
              
              
              
              <TouchableOpacity 
                style={[styles.sortMenuItem, { 
                  backgroundColor: sortBy === 'lastModified' ? (isDarkMode ? '#3a3a3a' : '#f0f5ff') : 'transparent',
                  borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }]}
                onPress={() => {
                  handleSortChange('lastModified', sortOrder);
                  setShowSortMenu(false);
                }}
              >
                <MaterialIcons name="update" size={18} color={isDarkMode ? '#ffffff' : '#333'} />
                <Text style={[styles.sortMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Last Modified</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.sortMenuItem, { 
                  backgroundColor: sortBy === 'nameAZ' ? (isDarkMode ? '#3a3a3a' : '#f0f5ff') : 'transparent',
                  borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }]}
                onPress={() => {
                  handleSortChange('nameAZ', 'asc');
                  setShowSortMenu(false);
                }}
              >
                <MaterialIcons name="sort-by-alpha" size={18} color={isDarkMode ? '#ffffff' : '#333'} />
                <Text style={[styles.sortMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Name A-Z</Text>
              </TouchableOpacity>
              
              
              <TouchableOpacity 
                style={[styles.sortMenuItem, { 
                  backgroundColor: sortBy === 'activity' ? (isDarkMode ? '#3a3a3a' : '#f0f5ff') : 'transparent',
                  borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }]}
                onPress={() => {
                  handleSortChange('activity', sortOrder);
                  setShowSortMenu(false);
                }}
              >
                <MaterialIcons name="trending-up" size={18} color={isDarkMode ? '#ffffff' : '#333'} />
                <Text style={[styles.sortMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Most Active</Text>
              </TouchableOpacity>
              
              
              
              <TouchableOpacity 
                style={[styles.sortMenuItem, { 
                  backgroundColor: sortBy === 'largest' ? (isDarkMode ? '#3a3a3a' : '#f0f5ff') : 'transparent',
                  borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }]}
                onPress={() => {
                  handleSortChange('largest', sortOrder);
                  setShowSortMenu(false);
                }}
              >
                <MaterialIcons name="expand-less" size={18} color={isDarkMode ? '#ffffff' : '#333'} />
                <Text style={[styles.sortMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Largest</Text>
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
              
              

            </View>
          )}
        </Animated.View>
        
        <Animated.View style={[
          viewMode === 'grid' ? styles.collectionsGrid : styles.collectionsList, 
          { opacity: fadeAnim }
        ]}>
          {displayCollections.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <View style={[styles.welcomeBubble, { 
                backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              }]}>
                <MaterialIcons name="collections" size={50} color="#4A90E2" style={styles.welcomeIcon} />
                <Text style={[styles.welcomeTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                  {searchQuery.trim() ? 'No collections found' : 'Welcome to Collections!'}
                </Text>
                <Text style={[styles.welcomeText, { color: isDarkMode ? '#cccccc' : '#666' }]}>
                  {searchQuery.trim() 
                    ? `No collections match "${searchQuery}". Try a different search term or create a new collection.`
                    : 'Collections help you organize and store your social media links in one place. Create your first collection by tapping the + button below!'
                  }
                </Text>
                <TouchableOpacity
                  style={[
                    styles.emptyStateAddButton,
                    {
                      backgroundColor: '#4A90E2',
                      shadowColor: isDarkMode ? '#000000' : '#4A90E2',
                    },
                  ]}
                  onPress={openCreateCollection}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Create your first collection"
                >
                  <MaterialIcons name="add" size={30} color="#ffffff" />
                </TouchableOpacity>
                <Text
                  style={[
                    styles.emptyStateInfoText,
                    { color: isDarkMode ? '#bbbbbb' : '#666666' },
                  ]}
                >
                  For your first time, use this button to create a collection. Afterwards, use the plus button in the top right of this screen.
                </Text>
              </View>
            </View>
          ) : (
            displayCollections.map((collection, index) => (
                  <Animated.View
                key={collection.id}
                  style={[
                    viewMode === 'grid' ? styles.collectionCard : styles.collectionCardList, 
                    { 
                      zIndex: 1,
                    }
                  ]}
              >
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onLongPress={() => handleCollectionLongPress(collection)}
                  onPress={() => handleCollectionPress(collection, index)}
                  activeOpacity={0.8}
                >
                  {viewMode === 'grid' ? (
                    // Grid view - image on top, text below
                    <>
                      <TouchableOpacity
                        style={[
                          styles.imageContainer,
                          { 
                            backgroundColor: isDarkMode ? '#3a3a3a' : '#f0f0f0',
                            borderWidth: 1,
                            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          }
                        ]}
                        onPress={() => navigation.navigate('CollectionFormat', { collection })}
                        activeOpacity={0.8}
                      >
                        <Image 
                          source={{ uri: collection.imageLink }} 
                          style={styles.collectionImage}
                          resizeMode="cover"
                          key={`grid-${collection.id}-${collection.imageLink}`}
                        />
                        <View style={styles.imageOverlay}>
                          {/* Selection indicator */}
                          {isSelectionMode && (
                            <Animated.View 
                              style={[
                                styles.selectionIndicator,
                                selectedCollections.includes(collection.id) && styles.selectionIndicatorSelected,
                                {
                                  transform: selectedCollections.includes(collection.id) ? [{ scale: pulseAnim }] : []
                                }
                              ]}
                            >
                              {selectedCollections.includes(collection.id) && (
                                <MaterialIcons name="check" size={16} color="#ffffff" />
                              )}
                            </Animated.View>
                          )}
                          
                          {/* Three dots menu - positioned top-left */}
                          <TouchableOpacity
                            style={[styles.imageOptionsButton, { 
                              backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.9)' 
                            }]}
                            onPress={(e) => {
                              e.stopPropagation();
                              showDropdown(e, collection);
                            }}
                          >
                            <MaterialIcons 
                              name="more-vert" 
                              size={18} 
                              color={isDarkMode ? '#ffffff' : '#333'} 
                            />
                          </TouchableOpacity>

                          {/* Star/Favorite button - positioned top-right */}
                          <TouchableOpacity
                            style={[styles.starButton, { 
                              backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.9)' 
                            }]}
                            onPress={(e) => {
                              e.stopPropagation();
                              toggleFavorite(collection);
                            }}
                          >
                            <MaterialIcons 
                              name={collection.isFavorite ? "star" : "star-border"} 
                              size={20} 
                              color={collection.isFavorite ? "#FFD700" : (isDarkMode ? '#ffffff' : '#333')} 
                            />
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                      
                      <View style={styles.cardContent}>
                        {editingCollectionId === collection.id ? (
                          <View style={styles.titleEditContainer}>
                            <TextInput
                              style={[styles.titleInput, { 
                                backgroundColor: isDarkMode ? '#3a3a3a' : '#f8f9fa',
                                color: isDarkMode ? '#ffffff' : '#333',
                                borderColor: '#4A90E2'
                              }]}
                              value={editingTitle}
                              onChangeText={setEditingTitle}
                              onBlur={() => handleUpdateTitle(collection.id)}
                              onSubmitEditing={() => handleUpdateTitle(collection.id)}
                              autoFocus
                            />
                          </View>
                        ) : (
                          <Text style={[styles.collectionName, { color: isDarkMode ? '#ffffff' : '#333' }]} numberOfLines={2}>
                            {collection.title}
                          </Text>
                        )}
                        
                        <Text style={[styles.collectionCount, { color: isDarkMode ? '#cccccc' : '#666' }]}>
                          {Array.isArray(collection.listLink) ? collection.listLink.length : 0} links
                        </Text>
                        
                        {/* Trash-specific info for grid view */}
                        {showTrashView && (
                          <View style={styles.trashInfoContainer}>
                            <Text style={[styles.trashDateText, { color: isDarkMode ? '#cccccc' : '#666' }]}>
                              Deleted: {new Date(collection.deletedAt).toLocaleDateString()}
                            </Text>
                          </View>
                        )}
                      </View>
                    </>
                  ) : (
                    // List view - image and text side by side
                    <View style={styles.cardContentList}>
                      <TouchableOpacity
                        style={[
                          styles.imageContainerList,
                          { 
                            backgroundColor: isDarkMode ? '#3a3a3a' : '#f0f0f0',
                            borderWidth: 1,
                            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          }
                        ]}
                        onPress={() => navigation.navigate('CollectionFormat', { collection })}
                        activeOpacity={0.8}
                      >
                        <Image 
                          source={{ uri: collection.imageLink }} 
                          style={styles.collectionImage}
                          resizeMode="cover"
                          key={`list-${collection.id}-${collection.imageLink}`}
                        />
                        <View style={styles.imageOverlay}>
                          {/* Selection indicator */}
                          {isSelectionMode && (
                            <Animated.View 
                              style={[
                                styles.selectionIndicator,
                                selectedCollections.includes(collection.id) && styles.selectionIndicatorSelected,
                                {
                                  transform: selectedCollections.includes(collection.id) ? [{ scale: pulseAnim }] : []
                                }
                              ]}
                            >
                              {selectedCollections.includes(collection.id) && (
                                <MaterialIcons name="check" size={16} color="#ffffff" />
                              )}
                            </Animated.View>
                          )}

                          {/* Star/Favorite button - positioned top-right */}
                          <TouchableOpacity
                            style={[styles.starButton, { 
                              backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.9)' 
                            }]}
                            onPress={(e) => {
                              e.stopPropagation();
                              toggleFavorite(collection);
                            }}
                          >
                            <MaterialIcons 
                              name={collection.isFavorite ? "star" : "star-border"} 
                              size={20} 
                              color={collection.isFavorite ? "#FFD700" : (isDarkMode ? '#ffffff' : '#333')} 
                            />
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                      
                      <View style={styles.titleSection}>
                        {editingCollectionId === collection.id ? (
                          <View style={styles.titleEditContainer}>
                            <TextInput
                              style={[styles.titleInput, { 
                                backgroundColor: isDarkMode ? '#3a3a3a' : '#f8f9fa',
                                color: isDarkMode ? '#ffffff' : '#333',
                                borderColor: '#4A90E2'
                              }]}
                              value={editingTitle}
                              onChangeText={setEditingTitle}
                              onBlur={() => handleUpdateTitle(collection.id)}
                              onSubmitEditing={() => handleUpdateTitle(collection.id)}
                              autoFocus
                            />
                          </View>
                        ) : (
                          <>
                            <Text style={[styles.collectionNameList, { color: isDarkMode ? '#ffffff' : '#333' }]} numberOfLines={2}>
                              {collection.title}
                            </Text>
                            
                            {/* Collection count for list view */}
                            <Text style={[styles.collectionCount, { color: isDarkMode ? '#cccccc' : '#666' }]}>
                              {Array.isArray(collection.listLink) ? collection.listLink.length : 0} links
                            </Text>
                          </>
                        )}
                        
                        {/* Trash-specific info */}
                        {showTrashView && (
                          <View style={styles.trashInfoContainer}>
                            <Text style={[styles.trashDateText, { color: isDarkMode ? '#cccccc' : '#666' }]}>
                              Deleted: {new Date(collection.deletedAt).toLocaleDateString()}
                            </Text>
                          </View>
                        )}
                      </View>
                      
                      {/* Three dots menu for list view */}
                      <View style={styles.cardActions}>
                        <TouchableOpacity
                          style={[styles.optionsButton, { 
                            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' 
                          }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            showDropdown(e, collection);
                          }}
                        >
                          <MaterialIcons 
                            name="more-vert" 
                            size={24} 
                            color={isDarkMode ? '#cccccc' : '#666'} 
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            ))
          )}
        </Animated.View>
      </ScrollView>

      {/* תפריט האפשרויות */}
      {dropdownVisible && (
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          activeOpacity={1}
          onPress={hideDropdown}
        >
          <Animated.View 
            style={[
              styles.dropdownContent,
              {
                top: dropdownPosition.y,
                left: dropdownPosition.x,
                backgroundColor: isDarkMode ? '#2c2c2c' : '#ffffff',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'
              }
            ]}
            onStartShouldSetResponder={() => true}
            onResponderGrant={() => {}}
          >
            {/* Regular view options - only show when NOT in trash */}
            {!showTrashView && (
              <>
                {/* כפתור שינוי תמונה */}
                <TouchableOpacity 
                  style={styles.dropdownItem} 
                  onPress={() => {
                    setCollectionForImageSource(selectedCollection);
                    hideDropdown();
                    setShowImageSourceModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="photo-library" size={20} color={isDarkMode ? '#ffffff' : '#333'} />
                  <Text style={[styles.dropdownText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Change Image</Text>
                  <MaterialIcons name="chevron-right" size={18} color={isDarkMode ? '#666' : '#ccc'} style={styles.dropdownChevron} />
                </TouchableOpacity>
                
                {/* כפתור מחיקת תמונה */}
                <TouchableOpacity 
                  style={styles.dropdownItem} 
                  onPress={() => {
                    hideDropdown();
                    handleDeleteImage();
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="delete" size={20} color={isDarkMode ? '#ffffff' : '#333'} />
                  <Text style={[styles.dropdownText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Delete Image</Text>
                  <MaterialIcons name="chevron-right" size={18} color={isDarkMode ? '#666' : '#ccc'} style={styles.dropdownChevron} />
                </TouchableOpacity>
                
                {/* כפתור שינוי כותרת */}
                <TouchableOpacity 
                  style={styles.dropdownItem} 
                  onPress={() => startEditingTitle(selectedCollection)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="edit" size={20} color={isDarkMode ? '#ffffff' : '#333'} />
                  <Text style={[styles.dropdownText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Change Title</Text>
                  <MaterialIcons name="chevron-right" size={18} color={isDarkMode ? '#666' : '#ccc'} style={styles.dropdownChevron} />
                </TouchableOpacity>
                
                {/* Divider */}
                <View style={[styles.dropdownDivider, {
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'
                }]} />
              </>
            )}
            
            {/* Conditional options based on view mode */}
            {showTrashView ? (
              // Trash view options
              <>
                {/* Restore Collection */}
                <TouchableOpacity 
                  style={styles.dropdownItem} 
                  onPress={async () => {
                    if (selectedCollection && !isRestoringCollection) {
                      await restoreCollection(selectedCollection.id, selectedCollection.title);
                      hideDropdown();
                      setSelectedCollection(null);
                    }
                  }}
                  disabled={isRestoringCollection}
                  activeOpacity={0.7}
                >
                  {isRestoringCollection ? (
                    <>
                      <ActivityIndicator size="small" color={isDarkMode ? '#ffffff' : '#333'} />
                      <Animated.Text style={[styles.dropdownText, { color: isDarkMode ? '#ffffff' : '#333', marginLeft: 12, flex: 1, opacity: pulseAnim }]}>
                        Restoring...
                      </Animated.Text>
                    </>
                  ) : (
                    <>
                      <MaterialIcons name="restore" size={20} color={isDarkMode ? '#ffffff' : '#333'} />
                      <Text style={[styles.dropdownText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Restore Collection</Text>
                      <MaterialIcons name="chevron-right" size={18} color={isDarkMode ? '#666' : '#ccc'} style={styles.dropdownChevron} />
                    </>
                  )}
                </TouchableOpacity>
                
                {/* Divider */}
                <View style={[styles.dropdownDivider, {
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'
                }]} />
                
                {/* Permanently Delete */}
                <TouchableOpacity 
                  style={[styles.dropdownItem, isRestoringCollection && { opacity: 0.5 }]} 
                  onPress={async () => {
                    if (selectedCollection && !isRestoringCollection) {
                      await permanentDeleteCollection(selectedCollection);
                      hideDropdown();
                      setSelectedCollection(null);
                    }
                  }}
                  disabled={isRestoringCollection}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="delete-forever" size={20} color="#FF4444" />
                  <Text style={[styles.dropdownText, { color: '#FF4444' }]}>Delete Forever</Text>
                  <MaterialIcons name="chevron-right" size={18} color="#FF4444" style={styles.dropdownChevron} />
                </TouchableOpacity>
              </>
            ) : (
              // Regular view options
              <TouchableOpacity 
                style={styles.dropdownItem} 
                onPress={async () => {
                  console.log('=== DELETE BUTTON CLICKED ===');
                  console.log('Delete collection button pressed for:', selectedCollection?.title);
                  console.log('Selected collection data:', selectedCollection);
                  console.log('Current user:', currentUser?.uid);
                  console.log('Firebase db:', !!db);
                  
                  if (!selectedCollection) {
                    console.error('No selectedCollection found');
                    alert('No collection selected for deletion');
                    return;
                  }
                  
                  if (!currentUser) {
                    console.error('No current user found');
                    alert('You must be logged in to delete collections');
                    return;
                  }
                  
                  if (!db) {
                    console.error('Firebase database not initialized');
                    alert('Database connection error. Please try again.');
                    return;
                  }

                  console.log('All checks passed, showing custom confirmation modal...');
                  
                  // Set the collection to delete and show the custom modal
                  setCollectionToDelete(selectedCollection);
                  setDeleteConfirmModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <MaterialIcons name="delete-forever" size={20} color="#FF4444" />
                <Text style={[styles.dropdownText, { color: '#FF4444' }]}>Move to Trash</Text>
                <MaterialIcons name="chevron-right" size={18} color="#FF4444" style={styles.dropdownChevron} />
              </TouchableOpacity>
            )}
          </Animated.View>
        </TouchableOpacity>
      )}



      {/* Delete Confirmation Modal */}
      <Modal
        transparent={true}
        visible={deleteConfirmModalVisible}
        animationType="fade"
        statusBarTranslucent={true}
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
            <Text style={[styles.deleteModalText, { color: isDarkMode ? '#cccccc' : '#666' }]}>
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
                  hideDropdown();
                }}
              >
                <Text style={[styles.deleteModalButtonText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.deleteModalButton, styles.confirmDeleteButton]}
                onPress={async () => {
                  try {
                    console.log('User confirmed soft deletion, starting process...');
                    const docRef = doc(db, 'albums', collectionToDelete.id);
                    
                    // Mark as deleted with timestamp instead of actually deleting
                    await updateDoc(docRef, {
                      isDeleted: true,
                      deletedAt: new Date().toISOString(),
                      deletedBy: currentUser.uid
                    });
                    
                    console.log('Collection marked as deleted successfully');
                    
                    // Update local state - remove from active collections
                    setCollections(prev => prev.filter(col => col.id !== collectionToDelete.id));
                    setOriginalCollections(prev => prev.filter(col => col.id !== collectionToDelete.id));
                    
                    console.log('Local state updated, hiding modal...');
                    setDeleteConfirmModalVisible(false);
                    setCollectionToDelete(null);
                    hideDropdown();
                    setSelectedCollection(null);
                    
                    console.log('Showing success message...');
                    showSuccessMessage('Collection moved to trash successfully');
                    
                    console.log('Soft deletion process completed successfully');
                  } catch (error) {
                    console.error('=== SOFT DELETE ERROR ===');
                    console.error('Error soft deleting collection:', error);
                    console.error('Error code:', error.code);
                    console.error('Error message:', error.message);
                    console.error('Error details:', error);
                    
                    let errorMessage = 'Failed to delete collection';
                    if (error.code === 'permission-denied') {
                      errorMessage = 'Permission denied. You may not have access to delete this collection.';
                    } else if (error.code === 'not-found') {
                      errorMessage = 'Collection not found. It may have been already deleted.';
                    } else if (error.code === 'unavailable') {
                      errorMessage = 'Database is currently unavailable. Please try again later.';
                    } else if (error.code === 'unauthenticated') {
                      errorMessage = 'You are not authenticated. Please log in again.';
                    }
                    
                    showSuccessMessage(errorMessage);
                  }
                }}
              >
                <Text style={styles.confirmDeleteButtonText}>
                  Move to Trash
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Hamburger Menu Modal */}
      <CollectionsHamburgerMenu
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

      {!(isKeyboardVisible || isSearchOpen || isSearchFocused) && <Footer />}

      
      {/* Success Message Toast */}
      <ToastMessage
        visible={showSuccess}
        message={successMessage}
        variant={toastVariant}
        topOffset={Platform.OS === 'ios' ? 70 : 50}
      />

      {/* Image Source Selection Modal */}
      <Modal
        transparent={true}
        visible={showImageSourceModal}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => {
          setShowImageSourceModal(false);
          setCollectionForImageSource(null);
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
                  setCollectionForImageSource(null);
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
                onPress={async () => {
                  setShowImageSourceModal(false);
                  await handleChangeImage();
                }}
                activeOpacity={0.7}
              >
                <MaterialIcons name="photo-library" size={32} color="#4A90E2" />
                <Text style={[styles.imageSourceOptionText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                  Gallery
                </Text>
                <Text style={[styles.imageSourceOptionSubtext, { color: isDarkMode ? '#cccccc' : '#666' }]}>
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
                  if (collectionForImageSource) {
                    await openThumbnailSelector(collectionForImageSource);
                  } else {
                    setCollectionForImageSource(null);
                  }
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
                <Text style={[styles.imageSourceOptionSubtext, { color: isDarkMode ? '#cccccc' : '#666' }]}>
                  Use thumbnails from links in this collection
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Loading Thumbnails Modal */}
      {loadingThumbnails && (
        <Modal
          transparent={true}
          visible={loadingThumbnails}
          animationType="fade"
          statusBarTranslucent={true}
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

      {/* Updating Image Modal */}
      {updatingImage && (
        <Modal
          transparent={true}
          visible={updatingImage}
          animationType="fade"
          statusBarTranslucent={true}
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

      {/* Thumbnail Selector Modal */}
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
    </View>
  );
}

// הגדרות העיצוב החדשות של המסך
const styles = StyleSheet.create({
  // מיכל ראשי
  container: {
    flex: 1,
  },
  // כותרת המסך
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
  trashTopRightControls: {
    top: Platform.OS === 'ios' ? 25 : 15,
  },
  addCollectionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cleanupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  cleanupButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },


  // טקסט הכותרת
  headerText: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  // כותרת משנה
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    opacity: 0.8,
  },
  // תוכן המסך
  content: {
    flex: 1,
  },
  // ScrollView content container
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 0,
    paddingBottom: 80, // Further reduced space for absolutely positioned footer
  },
  // רשת האוספים
  collectionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: 2,
    paddingHorizontal: 0,
    width: '100%',
  },
  // רשימת האוספים
  collectionsList: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  // כרטיס אוסף
  collectionCard: {
    width: '48%',
    borderRadius: 12,
    marginBottom: 2,
    overflow: 'hidden',
    borderWidth: 0,
    backgroundColor: 'transparent',
    flexShrink: 0,
  },
  // כרטיס אוסף ברשימה
  collectionCardList: {
    width: '100%',
    marginBottom: 2,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  // מיכל התמונה
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  // מיכל התמונה ברשימה
  imageContainerList: {
    width: 80,
    height: 80,
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  // תמונת האוסף
  collectionImage: {
    width: '100%',
    height: '100%',
  },
  // שכבת כיסוי על התמונה
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 12,
  },
  // כפתור אפשרויות על התמונה - positioned top-left
  imageOptionsButton: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  // כפתור הכוכב/מועדף - positioned top-right
  starButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  // תג מספר פריטים
  itemCountBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  // טקסט מספר פריטים
  itemCountText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  // תוכן הכרטיס
  cardContent: {
    padding: 6,
    paddingTop: 2,
    paddingBottom: 10,
    minHeight: 0,
    justifyContent: 'flex-start',
  },
  // תוכן הכרטיס ברשימה
  cardContentList: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 0,
  },
  // אזור הכותרת
  titleSection: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginLeft: 0,
  },
  // שם האוסף
  collectionName: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'left',
    lineHeight: 18,
    letterSpacing: 0.1,
    marginTop: 2,
  },
  // שם האוסף ברשימה
  collectionNameList: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'left',
    lineHeight: 20,
    marginBottom: 4,
  },
  // מספר פריטים ברשימה
  collectionCount: {
    fontSize: 13,
    color: '#666',
    marginTop: -2,
  },
  // פעולות הכרטיס
  cardActions: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 12,
  },
  // כפתור האפשרויות
  optionsButton: {
    padding: 8,
    borderRadius: 20,
  },
  // מיכל טעינה
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // טקסט טעינה
  loadingText: {
    fontSize: 18,
  },
  // שדה קלט כותרת
  titleInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginVertical: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  // שכבת כיסוי תפריט נפתח
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  // תוכן תפריט נפתח - Clean & Minimal
  dropdownContent: {
    position: 'absolute',
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 0,
    width: 200,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    zIndex: 1000,
    overflow: 'hidden',
  },
  // פריט תפריט נפתח - Clean Layout
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  // טקסט פריט תפריט נפתח - Simple
  dropdownText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '400',
    flex: 1,
  },
  // Chevron on the right
  dropdownChevron: {
    marginLeft: 'auto',
    opacity: 0.4,
  },
  // Simple Divider
  dropdownDivider: {
    height: 1,
    marginVertical: 4,
    marginHorizontal: 12,
  },
  emptyStateContainer: {
    width: '100%',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeBubble: {
    borderRadius: 24,
    padding: 32,
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
  welcomeIcon: {
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  emptyStateInfoText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 16,
    paddingHorizontal: 12,
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
  titleEditContainer: {
    width: '100%',
  },
  restoreDropdownItem: {
    // Removed - using clean unified style
  },
  trashInfoContainer: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  trashDateText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  // Sorting Header Styles
  sortingHeader: {
    marginBottom: 2,
    paddingHorizontal: 20,
    marginTop: -15,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  sortingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
    paddingHorizontal: 0,
  },
  designButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -24,
    marginTop: 31,
  },
  sortOptionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: -24,
    marginTop: 32,
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
  sortMenu: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 8,
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

  // Selection Mode Styles
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 20 : 10,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 100,
  },
  selectionModeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  selectionModeText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  cancelButton: {
    padding: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  selectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionCount: {
    fontSize: 14,
    marginRight: 12,
  },
  selectAllButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Special styling for delete dropdown item
  deleteDropdownItem: {
    // Removed - using clean unified style
  },
  selectionIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: '#ffffff',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
     selectionIndicatorSelected: {
     backgroundColor: '#4A90E2',
     borderColor: '#4A90E2',
     transform: [{ scale: 1.1 }],
     shadowColor: '#4A90E2',
     shadowOffset: { width: 0, height: 0 },
     shadowOpacity: 0.8,
     shadowRadius: 8,
     elevation: 8,
   },
   
   // Delete Confirmation Modal Styles
   deleteModalOverlay: {
     flex: 1,
     backgroundColor: 'rgba(0, 0, 0, 0.7)',
     justifyContent: 'center',
     alignItems: 'center',
     paddingTop: 0,
     marginTop: 0,
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
  
  // Mini Search Bar Styles
  miniSearchContainer: {
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 24,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  miniSearchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  miniSearchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  miniSearchClose: {
    padding: 4,
  },
  // WhatsApp-style Animated Search Bar Styles
  animatedSearchContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 95 : 85,
    zIndex: 9999,
    paddingTop: Platform.OS === 'ios' ? 45 : 35,
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
  
  // Thumbnail Selector Modal Styles
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
  
  // Image Source Selection Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
    marginTop: 0,
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
  
  // Loading Thumbnails Modal Styles
  loadingThumbnailsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
    marginTop: 0,
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
  
  // Updating Image Modal Styles
  updatingImageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
    marginTop: 0,
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
  
  // Page Description Styles
  pageDescriptionSection: {
    marginBottom: 0,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  pageDescriptionText: {
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});

