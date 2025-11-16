import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Switch, StatusBar, Platform, Modal, FlatList, TouchableWithoutFeedback, ActivityIndicator, Animated, Image, Keyboard, useWindowDimensions, Linking, Share, InteractionManager } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import { auth, db } from '../services/firebase/Config.js';
import { signOut, updateProfile, GoogleAuthProvider, linkWithCredential } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { linkEmailPassword, getLinkedProviders, isProviderLinked, updateEmailPassword } from '../utils/accountLinking';
import { deleteUserAccount } from '../utils/emailService';
import Footer from '../components/Footer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showAppDialog } from '../context/DialogContext';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageAsync } from '../services/cloudinary/imageUpload';
import { GoogleSignin, statusCodes as GoogleStatusCodes } from '@react-native-google-signin/google-signin';
import HamburgerMenu from '../components/HamburgerMenu';

const userProfileMemoryCache = {};
const userProfileBootstrapPromises = {};

const bootstrapUserProfileFromStorage = (uid) => {
  if (!uid) return;
  if (userProfileMemoryCache[uid]) return;
  if (userProfileBootstrapPromises[uid]) return;
  
  const promise = AsyncStorage.getItem(`user_profile_${uid}`)
    .then(stored => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          userProfileMemoryCache[uid] = parsed;
        } catch (error) {
          console.error('Error parsing cached personal information during bootstrap:', error);
        }
      }
    })
    .catch(error => {
      console.error('Error bootstrapping personal information from storage:', error);
    })
    .finally(() => {
      delete userProfileBootstrapPromises[uid];
    });

  userProfileBootstrapPromises[uid] = promise;
};

bootstrapUserProfileFromStorage(auth.currentUser?.uid);

export default function Profile() {
  const navigation = useNavigation();
  const { isDarkMode, toggleTheme, themeMode, setTheme, getBackgroundColor } = useTheme();
  const [currentUser, setCurrentUser] = useState(() => auth.currentUser);
  const { width: screenWidth } = useWindowDimensions();
  const [userData, setUserData] = useState(() => {
    const uid = auth.currentUser?.uid;
    if (uid && userProfileMemoryCache[uid]) {
      return userProfileMemoryCache[uid];
    }
    return null;
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isThemeUpdating, setIsThemeUpdating] = useState(false);
  const [isUploadingProfileImage, setIsUploadingProfileImage] = useState(false);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const profileCacheKey = useMemo(
    () => (currentUser?.uid ? `user_profile_${currentUser.uid}` : null),
    [currentUser?.uid]
  );
  const setAndPersistUserData = useCallback((data) => {
    setUserData(data);
    if (!currentUser?.uid || !profileCacheKey) {
      return;
    }
    if (data) {
      userProfileMemoryCache[currentUser.uid] = data;
      AsyncStorage.setItem(profileCacheKey, JSON.stringify(data)).catch((error) =>
        console.error('Error caching personal information:', error)
      );
    } else {
      delete userProfileMemoryCache[currentUser.uid];
      AsyncStorage.removeItem(profileCacheKey).catch((error) =>
        console.error('Error clearing cached personal information:', error)
      );
    }
  }, [currentUser?.uid, profileCacheKey]);
  const mergeAndPersistUserData = useCallback((updates) => {
    if (!updates || typeof updates !== 'object') return;
    setUserData((prev) => {
      const merged = { ...(prev || {}), ...updates };
      if (currentUser?.uid && profileCacheKey) {
        userProfileMemoryCache[currentUser.uid] = merged;
        AsyncStorage.setItem(profileCacheKey, JSON.stringify(merged)).catch((error) =>
          console.error('Error caching personal information:', error)
        );
      }
      return merged;
    });
  }, [currentUser?.uid, profileCacheKey]);
  const profileImageUrl = useMemo(() => {
    if (userData?.customProfileImageUrl) return userData.customProfileImageUrl;
    if (userData?.profileImageUrl) return userData.profileImageUrl;
    if (userData?.photoURL) return userData.photoURL;
    return currentUser?.photoURL || null;
  }, [userData?.customProfileImageUrl, userData?.profileImageUrl, userData?.photoURL, currentUser?.photoURL]);
  
  // Load notification preference from AsyncStorage
  useEffect(() => {
    loadNotificationPreference();
  }, []);

  const loadNotificationPreference = async () => {
    try {
      const savedNotificationPreference = await AsyncStorage.getItem('notificationsEnabled');
      if (savedNotificationPreference !== null) {
        setNotificationsEnabled(savedNotificationPreference === 'true');
        console.log('Loaded notification preference:', savedNotificationPreference);
      }
    } catch (error) {
      console.error('Error loading notification preference:', error);
    }
  };

  const saveNotificationPreference = async (enabled) => {
    try {
      await AsyncStorage.setItem('notificationsEnabled', enabled.toString());
      console.log('Notification preference saved:', enabled);
    } catch (error) {
      console.error('Error saving notification preference:', error);
    }
  };
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalModalContent, setLegalModalContent] = useState(null);
  const [legalModalTitle, setLegalModalTitle] = useState('');
  const [legalModalLoading, setLegalModalLoading] = useState(false);
  const legalScrollRef = useRef(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuAnim = useRef(new Animated.Value(0)).current;
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
  const [linkedProviders, setLinkedProviders] = useState([]);
  const [showLinkEmailModal, setShowLinkEmailModal] = useState(false);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [linkConfirmPassword, setLinkConfirmPassword] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [isLinkPasswordVisible, setIsLinkPasswordVisible] = useState(false);
  const [isLinkConfirmPasswordVisible, setIsLinkConfirmPasswordVisible] = useState(false);
  const scrollViewRef = useRef(null);
  
  // Search functionality state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const searchAnim = useRef(new Animated.Value(0)).current;
  
  // Theme selection modal state
  const [showThemeModal, setShowThemeModal] = useState(false);
  
  // Function to open modal
  const openLegalModal = () => {
    setLegalModalVisible(true);
  };

  // Function to close modal
  const closeLegalModal = () => {
    setLegalModalVisible(false);
  };

  // Theme selection functions
  const openThemeModal = () => {
    if (isThemeUpdating) return;
    setShowThemeModal(true);
  };

  const closeThemeModal = () => {
    if (isThemeUpdating) return;
    setShowThemeModal(false);
  };

  const selectTheme = (theme) => {
    if (isThemeUpdating) return;
    if (theme === themeMode) {
      setShowThemeModal(false);
      return;
    }

    // Start loading immediately
    setIsThemeUpdating(true);

    // Small delay to ensure the loading indicator is visible before closing modal
    setTimeout(() => {
      setShowThemeModal(false);

      try {
        setTheme(theme);
      } catch (error) {
        console.error('Error updating theme:', error);
        showInfoDialog('Theme Update Failed', 'We were unable to apply the selected theme. Please try again.');
        setIsThemeUpdating(false);
        return;
      }

      // Keep loading indicator visible for smooth transition
      const finishUpdate = () => setIsThemeUpdating(false);

      if (InteractionManager?.runAfterInteractions) {
        InteractionManager.runAfterInteractions(() => {
          setTimeout(finishUpdate, 300); // Brief delay for smooth visual feedback
        });
      } else {
        setTimeout(finishUpdate, 500);
      }
    }, 100);
  };

  const handleChangeProfileImage = useCallback(async () => {
    if (!currentUser?.uid) {
      showInfoDialog('Change Profile Image', 'You need to be signed in to update your profile image.');
      return;
    }

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showInfoDialog(
          'Permission Required',
          'Please allow access to your photo library to update your profile image.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled) {
        return;
      }

      const selectedAsset = result.assets?.[0];
      if (!selectedAsset?.uri) {
        throw new Error('No image selected. Please choose an image and try again.');
      }

      setIsUploadingProfileImage(true);

      const uploadedUrl = await uploadImageAsync(selectedAsset.uri);

      const updates = {
        customProfileImageUrl: uploadedUrl,
        profileImageUrl: uploadedUrl,
        photoURL: uploadedUrl,
        hasCustomProfileImage: true,
        lastUpdated: new Date().toISOString(),
        lastCustomProfileUpdate: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', currentUser.uid), updates, { merge: true });
      mergeAndPersistUserData(updates);

      if (auth.currentUser) {
        try {
          await updateProfile(auth.currentUser, { photoURL: uploadedUrl });
          setCurrentUser((prev) => (prev ? { ...prev, photoURL: uploadedUrl } : prev));
        } catch (profileError) {
          console.error('Error updating Firebase auth profile image:', profileError);
        }
      }

      showInfoDialog('Profile Image Updated', 'Your profile image has been updated successfully.', [
        { text: 'Great!' },
      ]);
    } catch (error) {
      console.error('Error updating profile image:', error);
      const message = error?.message || 'Unable to update profile image. Please try again.';
      showInfoDialog('Upload Failed', message);
    } finally {
      setIsUploadingProfileImage(false);
    }
  }, [currentUser?.uid, mergeAndPersistUserData, showInfoDialog]);

  const handleLinkGoogle = useCallback(async () => {
    if (!currentUser?.uid) {
      showInfoDialog('Add Google Sign-In', 'You need to be signed in to link Google sign-in.');
      return;
    }
    if (isLinkingGoogle) return;

    try {
      setIsLinkingGoogle(true);

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const userInfo = await GoogleSignin.signIn();

      if (!userInfo?.idToken) {
        throw new Error('Unable to retrieve Google authentication token.');
      }

      const credential = GoogleAuthProvider.credential(userInfo.idToken);
      const firebaseUser = auth.currentUser;

      if (!firebaseUser) {
        throw new Error('No authenticated user found. Please sign in again.');
      }

      await linkWithCredential(firebaseUser, credential);

      const googlePhoto =
        userInfo?.user?.photo ||
        firebaseUser.photoURL ||
        currentUser.photoURL ||
        null;

      const existingProviders = userData?.authProviders || linkedProviders || [];
      const newProviders = Array.from(new Set([...existingProviders, 'google']));

      const userRef = doc(db, 'users', currentUser.uid);
      const updates = {
        authProviders: newProviders,
        lastUpdated: new Date().toISOString(),
      };

      if (!userData?.hasCustomProfileImage && googlePhoto) {
        updates.profileImageUrl = googlePhoto;
        updates.photoURL = googlePhoto;
      }

      await setDoc(userRef, updates, { merge: true });
      mergeAndPersistUserData(updates);
      setLinkedProviders(newProviders);

      if (!userData?.hasCustomProfileImage && googlePhoto) {
        if (auth.currentUser && auth.currentUser.photoURL !== googlePhoto) {
          try {
            await updateProfile(auth.currentUser, { photoURL: googlePhoto });
          } catch (profileError) {
            console.error('Error updating Firebase auth profile image after Google link:', profileError);
          }
        }
        setCurrentUser((prev) => (prev ? { ...prev, photoURL: googlePhoto } : prev));
      } else {
        setCurrentUser(auth.currentUser);
      }

      showInfoDialog('Google Linked', 'Google sign-in has been added to your account.', [
        { text: 'Awesome!' },
      ]);
    } catch (error) {
      console.error('Error linking Google provider:', error);

      if (error?.code === GoogleStatusCodes?.SIGN_IN_CANCELLED) {
        // User cancelled the Google sign-in flow, no need to show an error
        return;
      }

      let message = 'Unable to add Google sign-in. Please try again.';

      if (error?.code === 'auth/credential-already-in-use') {
        message = 'This Google account is already linked to another user.';
      } else if (error?.code === 'auth/provider-already-linked') {
        message = 'Google sign-in is already linked to your account.';
      } else if (error?.message) {
        message = error.message;
      }

      showInfoDialog('Linking Failed', message);
    } finally {
      setIsLinkingGoogle(false);
    }
  }, [currentUser?.uid, currentUser.photoURL, isLinkingGoogle, linkedProviders, mergeAndPersistUserData, showInfoDialog, userData?.authProviders, userData?.hasCustomProfileImage]);

  const getThemeDisplayName = (theme) => {
    switch (theme) {
      case 'light': return 'Light';
      case 'gray': return 'Gray';
      case 'black': return 'Black';
      default: return 'Light';
    }
  };

  // Hide footer when keyboard is open
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
        setIsSearchFocused(false);
      });
    }
  };

  // Helper function to check if a section or item matches the search query
  const matchesSearch = (sectionTitle, items = []) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    
    // Check if section title matches
    if (sectionTitle.toLowerCase().includes(query)) return true;
    
    // Check if any item title or subtitle matches
    return items.some(item => {
      const titleMatch = item.title?.toLowerCase().includes(query) || false;
      const subtitleMatch = item.subtitle?.toLowerCase().includes(query) || false;
      return titleMatch || subtitleMatch;
    });
  };

  // Check if any content matches the search query
  const hasSearchResults = () => {
    if (!searchQuery.trim()) return true;
    
    return (
      matchesSearch('Account') ||
      matchesSearch('Sign-In Methods') ||
      matchesSearch('Sign In') ||
      matchesSearch('Google') ||
      matchesSearch('Email') ||
      matchesSearch('Personal Information') ||
      matchesSearch('Personal') ||
      matchesSearch('Birthday') ||
      matchesSearch('Gender') ||
      matchesSearch('Member') ||
      matchesSearch('Preferences', [{title: 'Theme'}, {title: 'Notifications'}]) ||
      matchesSearch('Support', [{title: 'Help & FAQ'}, {title: 'Send Feedback'}, {title: 'Rate App'}]) ||
      matchesSearch('Terms of Service') ||
      matchesSearch('App Features') ||
      matchesSearch('Link Preview') ||
      matchesSearch('Features') ||
      matchesSearch('Terms') ||
      matchesSearch('Privacy') ||
      matchesSearch('LinksVault') ||
      matchesSearch('Account', [{title: 'Sign Out'}, {title: 'Delete Account'}]) ||
      matchesSearch('App Information', [{title: 'Version'}, {title: 'Build'}])
    );
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

  // Reset ScrollView to top when modal opens
  useEffect(() => {
    if (legalModalVisible && scrollViewRef.current) {
      // Wait for slide animation to complete (300ms)
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [legalModalVisible]);

  // Handle modal show/hide events
  const handleModalShow = () => {
    // Force layout refresh when modal becomes visible
    setTimeout(() => {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: 0, animated: false });
      }
    }, 100);
  };

  useEffect(() => {
    const user = auth.currentUser;
    setCurrentUser(user);
    if (user?.uid && userProfileMemoryCache[user.uid] && !userData) {
      setUserData(userProfileMemoryCache[user.uid]);
    }
    
    // Immediately determine linked providers from Firebase Auth
    // This is available instantly without waiting for Firestore
    if (user?.providerData) {
      const providersFromAuth = [];
      user.providerData.forEach((providerInfo) => {
        const providerId = providerInfo.providerId;
        if (providerId === 'google.com') {
          providersFromAuth.push('google');
        } else if (providerId === 'password') {
          providersFromAuth.push('password');
        }
      });
      
      // Remove duplicates and set immediately
      const uniqueProviders = Array.from(new Set(providersFromAuth));
      if (uniqueProviders.length > 0) {
        setLinkedProviders(uniqueProviders);
        console.log('🔗 Linked providers from Auth:', uniqueProviders);
      }
    }
  }, []);

  // Fetch additional user data from Firestore
  useEffect(() => {
    let isMounted = true;

    const loadUserData = async () => {
      if (!currentUser?.uid) {
        if (isMounted) {
          setAndPersistUserData(null);
        }
        return;
      }

      if (profileCacheKey) {
        try {
          const cachedData = await AsyncStorage.getItem(profileCacheKey);
          if (cachedData && isMounted) {
            const parsedData = JSON.parse(cachedData);
            userProfileMemoryCache[currentUser.uid] = parsedData;
            setUserData(parsedData);
          }
        } catch (error) {
          console.error('Error loading cached personal information:', error);
        }
      }
      
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        if (!isMounted) return;

        if (userDoc.exists()) {
          const fetchedUserData = userDoc.data();
          setAndPersistUserData(fetchedUserData);
          
          if (fetchedUserData.authProviders && Array.isArray(fetchedUserData.authProviders)) {
            setLinkedProviders(prevProviders => {
              const merged = Array.from(new Set([...prevProviders, ...fetchedUserData.authProviders]));
              if (merged.length !== prevProviders.length || 
                  merged.some(p => !prevProviders.includes(p))) {
                console.log('🔗 Synced providers from Firestore:', merged);
                return merged;
              }
              return prevProviders;
            });
          }
        } else {
          try {
            const providersFromAuth = [];
            if (currentUser.providerData) {
              currentUser.providerData.forEach((providerInfo) => {
                const providerId = providerInfo.providerId;
                if (providerId === 'google.com') {
                  providersFromAuth.push('google');
                } else if (providerId === 'password') {
                  providersFromAuth.push('password');
                }
              });
            }
            
            const initialUserData = {
              createdAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
              authProviders: providersFromAuth.length > 0 ? providersFromAuth : ['google'],
              primaryProvider: providersFromAuth[0] || 'google',
              profileImageUrl: currentUser?.photoURL || null,
              photoURL: currentUser?.photoURL || null,
              hasCustomProfileImage: false
            };
            
            await setDoc(userRef, initialUserData);

            if (!isMounted) return;
            setAndPersistUserData(initialUserData);
          } catch (error) {
            console.error('Error creating user document:', error);
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    loadUserData();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.uid, profileCacheKey, setAndPersistUserData]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    if (!currentUser.photoURL) return;
    if (!userData) return;
    if (userData.hasCustomProfileImage) return;
    if (userData.profileImageUrl === currentUser.photoURL || userData.photoURL === currentUser.photoURL) return;

    let isCancelled = false;

    const syncGoogleProfileImage = async () => {
      const updates = {
        profileImageUrl: currentUser.photoURL,
        photoURL: currentUser.photoURL,
        lastUpdated: new Date().toISOString(),
      };

      try {
        await setDoc(doc(db, 'users', currentUser.uid), updates, { merge: true });
        if (!isCancelled) {
          mergeAndPersistUserData(updates);
        }
      } catch (error) {
        console.error('Error syncing Google profile image:', error);
      }
    };

    syncGoogleProfileImage();

    return () => {
      isCancelled = true;
    };
  }, [currentUser?.uid, currentUser?.photoURL, userData?.hasCustomProfileImage, userData?.profileImageUrl, userData?.photoURL, mergeAndPersistUserData]);

  // Fix incorrect authProviders data
  const fixAuthProvidersData = async () => {
    try {
      if (currentUser?.uid) {
        // Get actual providers from Firebase Auth
        const providersFromAuth = [];
        if (currentUser.providerData) {
          currentUser.providerData.forEach((providerInfo) => {
            const providerId = providerInfo.providerId;
            if (providerId === 'google.com') {
              providersFromAuth.push('google');
            } else if (providerId === 'password') {
              providersFromAuth.push('password');
            }
          });
        }
        
        const correctProviders = providersFromAuth.length > 0 ? providersFromAuth : ['google'];
        
        const userRef = doc(db, 'users', currentUser.uid);
        await setDoc(userRef, {
          authProviders: correctProviders,
          primaryProvider: correctProviders[0] || 'google'
        }, { merge: true });
        
        // Update state immediately to prevent reload flash
        setLinkedProviders(correctProviders);
        
        console.log('✅ Fixed authProviders data to:', correctProviders);
        
        // Refresh user data
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const updatedData = userDoc.data();
          setAndPersistUserData(updatedData);
        }
      }
    } catch (error) {
      console.error('Error fixing authProviders data:', error);
    }
  };

  // Account linking functions
  const handleCloseLinkEmailModal = useCallback(() => {
    setShowLinkEmailModal(false);
    setLinkEmail('');
    setLinkPassword('');
    setLinkConfirmPassword('');
    setLinkError('');
    setIsLinkPasswordVisible(false);
    setIsLinkConfirmPasswordVisible(false);
  }, []);

  const handleLinkEmailPassword = async () => {
    if (!linkPassword || !linkConfirmPassword) {
      setLinkError('Please fill in all fields');
      return;
    }

    if (linkPassword !== linkConfirmPassword) {
      setLinkError('Passwords do not match');
      return;
    }

    if (linkPassword.length < 6) {
      setLinkError('Password must be at least 6 characters');
      return;
    }

    // Use the current user's email since it's pre-filled and read-only
    const userEmail = currentUser?.email;
    if (!userEmail) {
      setLinkError('Unable to get user email. Please try again.');
      return;
    }

    try {
      setIsLinking(true);
      setLinkError('');

      // Check if this is an update or new link
      const isUpdate = linkedProviders.includes('password');
      
      let result;
      if (isUpdate) {
        // Update existing password
        result = await updateEmailPassword(linkPassword);
      } else {
        // Link new email/password
        result = await linkEmailPassword(userEmail, linkPassword);
      }
      
      if (result.success) {
        // Immediately update providers from Firebase Auth (available instantly)
        const updatedUser = auth.currentUser;
        if (updatedUser?.providerData) {
          const providersFromAuth = [];
          updatedUser.providerData.forEach((providerInfo) => {
            const providerId = providerInfo.providerId;
            if (providerId === 'google.com') {
              providersFromAuth.push('google');
            } else if (providerId === 'password') {
              providersFromAuth.push('password');
            }
          });
          const uniqueProviders = Array.from(new Set(providersFromAuth));
          if (uniqueProviders.length > 0) {
            setLinkedProviders(uniqueProviders);
          }
        }
        
        await openDialog(
          'Success! 🎉',
          isUpdate 
            ? 'A new email/password sign-in method has been added to your account! You can now log in with Google or the new email/password.'
            : 'Email/password has been linked to your account! You can now log in with either Google or email/password.',
          [{ text: 'Great!', style: 'primary' }]
        );

        handleCloseLinkEmailModal();
        // Refresh user data to show updated providers (for Personal Information section)
        if (currentUser?.uid) {
          getDoc(doc(db, 'users', currentUser.uid)).then((docSnapshot) => {
            if (docSnapshot.exists()) {
              const updatedData = docSnapshot.data();
              setAndPersistUserData(updatedData);
            }
          });
        }
      } else {
        setLinkError(result.message);
      }
    } catch (error) {
      console.error('Error linking email/password:', error);
      setLinkError('Failed to link email/password. Please try again.');
    } finally {
      setIsLinking(false);
    }
  };

  // Helper function for cross-platform alerts
  const openDialog = (title, message, buttons = [{ text: 'OK' }], options = {}) => {
    return showAppDialog(title, message, buttons, options);
  };

  const handleSignOut = async () => {
    const result = await openDialog(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
        },
      ]
    );

    if (result === 'Sign Out') {
      try {
        await signOut(auth);
      } catch (error) {
        console.error('Error signing out:', error);
        openDialog('Error', 'Failed to sign out. Please try again.', [{ text: 'OK' }]);
      }
    }
  };

  const handleDeleteAccount = async () => {
    const primaryChoice = await openDialog(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted including:\n\n• All your collections and albums\n• All saved links\n• Profile information\n• Uploaded images',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive' },
      ]
    );

    if (primaryChoice !== 'Delete') {
      return;
    }

    const confirmation = await openDialog(
      'Confirm Deletion',
      'Are you absolutely sure? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, Delete My Account', style: 'destructive' },
      ]
    );

    if (confirmation === 'Yes, Delete My Account') {
      try {
        console.log('🗑️ Starting account deletion process...');
        
        // Show loading dialog
        const loadingChoice = openDialog(
          'Deleting Account',
          'Please wait while we delete your account and all associated data...',
          []
        );

        // Get the current user's ID token for authentication
        if (!currentUser) {
          await openDialog('Error', 'No user is currently logged in.', [{ text: 'OK' }]);
          return;
        }

        const idToken = await currentUser.getIdToken();
        const userId = currentUser.uid;

        // Call the Cloud Function to delete the account
        const result = await deleteUserAccount(userId, idToken);

        if (result.success) {
          console.log('✅ Account deleted successfully');
          console.log('📊 Deletion summary:', result.deletionSummary);
          
          // Clear local storage
          await AsyncStorage.clear();
          
          // Show success message
          await openDialog(
            'Account Deleted',
            'Your account and all associated data have been permanently deleted.',
            [{ text: 'OK' }]
          );

          // Note: No need to sign out as the auth account is already deleted
          // The app will automatically redirect to the auth screen
        } else {
          console.error('❌ Account deletion failed:', result.message);
          await openDialog(
            'Deletion Failed',
            result.message || 'Failed to delete account. Please try again or contact support.',
            [{ text: 'OK' }]
          );
        }
      } catch (error) {
        console.error('Error during account deletion:', error);
        await openDialog(
          'Error',
          'An unexpected error occurred. Please try again or contact support.',
          [{ text: 'OK' }]
        );
      }
    }
  };


  const ProfileSection = ({ title, children, icon }) => (
    <View style={styles.modernSection}>
      <View style={styles.modernSectionHeader}>
        <View style={[styles.sectionIconContainer, { 
          backgroundColor: isDarkMode ? 'rgba(74, 144, 226, 0.15)' : 'rgba(74, 144, 226, 0.1)' 
        }]}>
          <MaterialIcons 
            name={icon} 
            size={18} 
            color="#4A90E2" 
          />
        </View>
        <Text style={[styles.modernSectionTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );

  const ProfileItem = ({ icon, title, subtitle, onPress, rightComponent, showArrow = true, iconColor }) => (
    <TouchableOpacity 
      style={[styles.modernProfileItem, { 
        backgroundColor: 'transparent',
      }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.6}
    >
      <View style={styles.modernProfileItemLeft}>
        <MaterialIcons 
          name={icon} 
          size={22} 
          color={iconColor || (isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)')} 
        />
        <View style={styles.modernProfileItemText}>
          <Text style={[styles.modernProfileItemTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.modernProfileItemSubtitle, { color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(26, 26, 26, 0.5)' }]}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.modernProfileItemRight}>
        {rightComponent}
        {showArrow && onPress && (
          <MaterialIcons 
            name="chevron-right" 
            size={20} 
            color={isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(26, 26, 26, 0.3)'} 
          />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: getBackgroundColor() }]}>
      {/* Modern Status Bar */}
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
        backgroundColor={getBackgroundColor()}
        translucent={false}
      />
      
      {/* Header Bar */}
      <View style={styles.header}>
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
            Profile & Settings
            </Text>
        </View>
      </View>

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
              placeholder="Search settings..."
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

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={true}>
        {/* Modern User Info Section */}
        {matchesSearch('Account') && (
          <ProfileSection title="Account" icon="account-circle">
            <View style={styles.modernUserInfo}>
              <TouchableOpacity
                style={[styles.modernAvatar, { 
                  backgroundColor: '#4A90E2',
                  shadowColor: '#4A90E2',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                }]}
                onPress={handleChangeProfileImage}
                activeOpacity={0.85}
                disabled={isUploadingProfileImage}
              >
                {profileImageUrl ? (
                  <Image
                    source={{ uri: profileImageUrl }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <MaterialIcons 
                    name="person" 
                    size={40} 
                    color="white" 
                  />
                )}
                {isUploadingProfileImage ? (
                  <View style={styles.avatarUploadingOverlay}>
                    <ActivityIndicator size="small" color="#ffffff" />
                  </View>
                ) : (
                  <View style={styles.avatarEditBadge}>
                    <MaterialIcons name="photo-camera" size={16} color="#ffffff" />
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.modernUserDetails}>
                <Text style={[styles.modernGreeting, { color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(26, 26, 26, 0.6)' }]}>
                  Hi,
                </Text>
                <Text style={[styles.modernUserName, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User'}
                </Text>
                <Text style={[styles.modernUserEmail, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                  {currentUser?.email || 'No email'}
                </Text>
                <Text style={[styles.avatarHint, { color: isDarkMode ? 'rgba(255, 255, 255, 0.55)' : 'rgba(26, 26, 26, 0.45)' }]}>
                  Tap photo to update
                </Text>
                <View style={styles.userStatus}>
                  <View style={[styles.statusDot, { backgroundColor: '#00B894' }]} />
                  <Text style={[styles.statusText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(26, 26, 26, 0.5)' }]}>
                    Active Account
                  </Text>
                </View>
              </View>
            </View>
        </ProfileSection>
        )}

        {/* Section Divider */}
        {matchesSearch('Account') && matchesSearch('Sign-In Methods') && (
          <View style={[styles.sectionDivider, { 
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)' 
          }]} />
        )}

        {/* Account Linking Section */}
        {(matchesSearch('Sign-In Methods') || matchesSearch('Sign In') || matchesSearch('Google') || matchesSearch('Email')) && (
          <ProfileSection title="Sign-In Methods" icon="link">
          <View style={styles.modernPersonalInfo}>
            {/* Show current linked providers */}
            <View style={styles.modernInfoRow}>
              <MaterialIcons 
                name="security" 
                size={20} 
                color="#4A90E2" 
              />
              <View style={styles.providerInfo}>
                <Text style={[styles.modernInfoText, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  Current Sign-In Methods:
                </Text>
                <View style={styles.providerList}>
                  {linkedProviders.map((provider, index) => (
                    <View key={index} style={[styles.providerTag, { 
                      backgroundColor: provider === 'google' ? 'rgba(66, 133, 244, 0.1)' : 'rgba(74, 144, 226, 0.1)',
                      borderColor: provider === 'google' ? 'rgba(66, 133, 244, 0.3)' : 'rgba(74, 144, 226, 0.3)'
                    }]}>
                      <MaterialIcons 
                        name={provider === 'google' ? 'account-circle' : 'email'} 
                        size={16} 
                        color={provider === 'google' ? '#4285F4' : '#4A90E2'} 
                      />
                      <Text style={[styles.providerText, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                        {provider === 'google' ? 'Google' : 'Email/Password'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Manual fix button for incorrect data */}
            {linkedProviders.includes('password') && !linkedProviders.includes('google') && (
              <TouchableOpacity
                style={[styles.fixButton, { 
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)',
                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
                }]}
                onPress={fixAuthProvidersData}
              >
                <MaterialIcons 
                  name="bug-report" 
                  size={20} 
                  color={isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)'} 
                />
                <Text style={[styles.fixButtonText, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  Fix: I Only Use Email/Password
                </Text>
              </TouchableOpacity>
            )}

             {/* Link email/password button */}
             <TouchableOpacity
               style={[styles.linkButton, { 
                 backgroundColor: 'rgba(74, 144, 226, 0.1)',
                 borderColor: '#4A90E2'
               }]}
               onPress={() => setShowLinkEmailModal(true)}
             >
               <MaterialIcons 
                 name="add" 
                 size={20} 
                 color="#4A90E2" 
               />
               <Text style={[styles.linkButtonText, { color: '#4A90E2' }]}>
                 {linkedProviders.includes('password') ? 'Add New Email/Password' : 'Add Email/Password Sign-In'}
               </Text>
             </TouchableOpacity>

            {!linkedProviders.includes('google') && (
              <TouchableOpacity
                style={[styles.linkButton, { 
                  backgroundColor: 'rgba(66, 133, 244, 0.12)',
                  borderColor: '#4285F4',
                  marginTop: 10,
                }]}
                onPress={handleLinkGoogle}
                disabled={isLinkingGoogle}
              >
                {isLinkingGoogle ? (
                  <ActivityIndicator size="small" color="#4285F4" />
                ) : (
                  <MaterialIcons 
                    name="link"
                    size={20} 
                    color="#4285F4" 
                  />
                )}
                <Text style={[styles.linkButtonText, { color: '#4285F4' }]}>
                  {isLinkingGoogle ? 'Linking Google...' : 'Add Google Sign-In'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Info text */}
            <Text style={[styles.linkInfoText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(26, 26, 26, 0.6)' }]}>
              Having multiple sign-in methods gives you more flexibility and security.
            </Text>
          </View>
        </ProfileSection>
        )}

        {/* Section Divider */}
        {(matchesSearch('Sign-In Methods') || matchesSearch('Sign In') || matchesSearch('Google') || matchesSearch('Email')) && matchesSearch('Personal Information') && (
          <View style={[styles.sectionDivider, { 
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)' 
          }]} />
        )}

        {/* Modern Personal Information Section (render header immediately to avoid layout shift) */}
        {(matchesSearch('Personal Information') || matchesSearch('Personal') || matchesSearch('Birthday') || matchesSearch('Gender') || matchesSearch('Member')) && (
          <ProfileSection title="Personal Information" icon="person">
            <View style={styles.modernPersonalInfo}>
              {userData && userData.birthMonth && userData.birthDay && userData.birthYear && (
                  <View style={styles.modernInfoRow}>
                  <MaterialIcons 
                    name="cake" 
                    size={20} 
                    color="#FF6B6B" 
                  />
                    <Text style={[styles.modernInfoText, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                      Birthday: {userData.birthMonth}/{userData.birthDay}/{userData.birthYear}
                    </Text>
                  </View>
                )}
              {userData && userData.gender && (
                  <View style={styles.modernInfoRow}>
                      <MaterialIcons 
                        name={userData.gender === 'male' ? 'male' : 'female'} 
                    size={20} 
                        color="#4ECDC4" 
                      />
                    <Text style={[styles.modernInfoText, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                      Gender: {userData.gender.charAt(0).toUpperCase() + userData.gender.slice(1)}
                    </Text>
                  </View>
                )}
              {userData && userData.createdAt && (
                  <View style={styles.modernInfoRow}>
                  <MaterialIcons 
                    name="schedule" 
                    size={20} 
                    color="#45B7D1" 
                  />
                    <Text style={[styles.modernInfoText, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                      Member since: {new Date(userData.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              {!userData && (
                <View style={{ height: 12 }} />
              )}
          </View>
        </ProfileSection>
        )}

        {/* Section Divider */}
        {(matchesSearch('Personal Information') || matchesSearch('Personal') || matchesSearch('Birthday') || matchesSearch('Gender') || matchesSearch('Member')) && matchesSearch('Preferences', [{title: 'Theme'}, {title: 'Notifications'}]) && (
          <View style={[styles.sectionDivider, { 
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)' 
          }]} />
        )}

        {/* Preferences Section */}
        {matchesSearch('Preferences', [{title: 'Theme', subtitle: `Current: ${getThemeDisplayName(themeMode)}`}, {title: 'Notifications', subtitle: 'Receive updates about your collections'}]) && (
          <ProfileSection title="Preferences" icon="tune">
            <ProfileItem
              icon="palette"
              title="Theme"
              subtitle={`Current: ${getThemeDisplayName(themeMode)}`}
              onPress={openThemeModal}
              showArrow={true}
            />
            
            <ProfileItem
              icon="notifications"
              title="Notifications"
              subtitle="Receive updates about your collections"
            rightComponent={
              <Switch
                value={notificationsEnabled}
                onValueChange={(value) => {
                  setNotificationsEnabled(value);
                  saveNotificationPreference(value);
                }}
                trackColor={{ false: '#E0E0E0', true: '#4A90E2' }}
                thumbColor={notificationsEnabled ? '#ffffff' : '#ffffff'}
                ios_backgroundColor="#E0E0E0"
                style={styles.modernSwitch}
              />
            }
            showArrow={false}
          />

          </ProfileSection>
        )}

        {/* Section Divider */}
        {matchesSearch('Preferences', [{title: 'Theme'}, {title: 'Notifications'}]) && matchesSearch('Support', [{title: 'Help & FAQ'}, {title: 'Send Feedback'}, {title: 'Rate App'}]) && (
          <View style={[styles.sectionDivider, { 
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)' 
          }]} />
        )}

        {/* Support Section */}
        {matchesSearch('Support', [{title: 'Help & FAQ', subtitle: 'Get help and find answers'}, {title: 'Send Feedback', subtitle: 'Help us improve the app'}, {title: 'Rate App', subtitle: 'Rate us on the Play Store'}]) && (
          <ProfileSection title="Support" icon="support-agent">
            <ProfileItem
              icon="help"
              title="Help & FAQ"
              subtitle="Get help and find answers"
              onPress={() => navigation.navigate('HelpSupport')}
            />
            
            <ProfileItem
              icon="feedback"
              title="Send Feedback"
              subtitle="Help us improve the app"
              onPress={() => openDialog('Coming Soon', 'Feedback system will be available soon!')}
            />
            
            <ProfileItem
              icon="star"
              title="Rate App"
              subtitle="Rate us on the Play Store"
              onPress={() => openDialog('Coming Soon', 'App rating will be available soon!')}
            />
          </ProfileSection>
        )}

        {/* Section Divider */}
        {matchesSearch('Support', [{title: 'Help & FAQ'}, {title: 'Send Feedback'}, {title: 'Rate App'}]) && (matchesSearch('Terms of Service') || matchesSearch('App Features') || matchesSearch('Link Preview') || matchesSearch('Features') || matchesSearch('Terms')) && (
          <View style={[styles.sectionDivider, { 
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)' 
          }]} />
        )}

        {/* Terms of Service & App Features Section */}
        {(matchesSearch('Terms of Service') || matchesSearch('App Features') || matchesSearch('Link Preview') || matchesSearch('Features') || matchesSearch('Terms') || matchesSearch('Privacy') || matchesSearch('LinksVault')) && (
          <ProfileSection title="Terms of Service & App Features" icon="description">
            <View style={styles.termsContent}>
              <View style={styles.termsSection}>
                <View style={styles.termsHeader}>
                <MaterialIcons 
                  name="link" 
                  size={20} 
                  color="#4A90E2" 
                />
                  <Text style={[styles.termsTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                    Link Preview System
                  </Text>
                </View>
                <Text style={[styles.termsText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(26, 26, 26, 0.7)' }]}>
                  Our preview system fetches metadata from links to enhance your browsing experience and you can always edit or refresh the details when something looks off. 
                  Please note that previews may sometimes be limited or unavailable due to:
                </Text>
                <View style={styles.termsList}>
                  <Text style={[styles.termsListItem, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                    • Website restrictions or privacy settings
                  </Text>
                  <Text style={[styles.termsListItem, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                    • Network connectivity issues
                  </Text>
                  <Text style={[styles.termsListItem, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                    • Some sites may only provide title and description
                  </Text>
                  <Text style={[styles.termsListItem, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                    • Manual edits you make to keep previews consistent with your brand
                  </Text>
                  <Text style={[styles.termsListItem, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                    • Preview quality may vary from the actual content
                  </Text>
                </View>
                <Text style={[styles.termsNote, { color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(26, 26, 26, 0.5)' }]}>
                  We continuously work to improve preview accuracy and availability for the best user experience.
                </Text>
              </View>

              <View style={styles.termsSection}>
                <View style={styles.termsHeader}>
                <MaterialIcons 
                  name="star" 
                  size={20} 
                  color="#FFD93D" 
                />
                  <Text style={[styles.termsTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                    Unique App Features
                  </Text>
                </View>
                <View style={styles.featureList}>
                  <View style={styles.featureItem}>
                  <MaterialIcons 
                    name="edit" 
                    size={18} 
                    color="#4A90E2" 
                  />
                    <View style={styles.featureText}>
                  <Text style={[styles.featureTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                        Custom Link Titles & Previews
                      </Text>
                      <Text style={[styles.featureDescription, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                        Edit link titles and preview metadata to keep everything on-brand. Perfect when automatic previews aren't available!
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.featureItem}>
                  <MaterialIcons 
                    name="dashboard" 
                    size={18} 
                    color="#00B894" 
                  />
                    <View style={styles.featureText}>
                      <Text style={[styles.featureTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                      Universal Platform Hub
                      </Text>
                      <Text style={[styles.featureDescription, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                      Organize links from ALL your favorite services—social, streaming, productivity, shopping, learning, and more—in one beautifully designed, personal space.
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.featureItem}>
                  <MaterialIcons 
                    name="palette" 
                    size={18} 
                    color="#6C5CE7" 
                  />
                    <View style={styles.featureText}>
                      <Text style={[styles.featureTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                        Multiple Design Themes
                      </Text>
                      <Text style={[styles.featureDescription, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                        Choose from Modern, Classic, Minimal, and Grid layouts to match your style.
                      </Text>
                    </View>
                  </View>
                
                <View style={styles.featureItem}>
                <MaterialIcons 
                  name="brush" 
                  size={18} 
                  color="#FF8C00" 
                />
                  <View style={styles.featureText}>
                    <Text style={[styles.featureTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                      Polished, Professional Aesthetic
                    </Text>
                    <Text style={[styles.featureDescription, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                      LinksVault delivers a modern, professional look that makes every saved item feel curated instead of chaotic.
                    </Text>
                  </View>
                </View>
                  
                  <View style={styles.featureItem}>
                  <MaterialIcons 
                    name="security" 
                    size={18} 
                    color="#E74C3C" 
                  />
                    <View style={styles.featureText}>
                      <Text style={[styles.featureTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                        Privacy-First Approach
                      </Text>
                      <Text style={[styles.featureDescription, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                        Your data is protected with secure cloud storage and privacy-first design.
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.termsSection}>
                <View style={styles.termsHeader}>
                <MaterialIcons 
                  name="favorite" 
                  size={20} 
                  color="#FF6B6B" 
                />
                  <Text style={[styles.termsTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  Why LinksVault?
                  </Text>
                </View>
                <Text style={[styles.termsText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(26, 26, 26, 0.7)' }]}>
                LinksVault is the only app that lets you organize ALL your social media content in one 
                  beautifully designed, personal space. Unlike other apps that focus on single platforms, 
                  we bring everything together with unique features like custom link titles, multiple design 
                  themes, and a privacy-first approach.
                </Text>
                <Text style={[styles.termsText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(26, 26, 26, 0.7)' }]}>
                  Whether you're saving Instagram posts, YouTube videos, TikTok content, shopping finds, newsletters, podcasts, articles, or any other links you rely on, LinksVault provides a unified, organized, and personalized experience 
                  that no other app offers. Stop dumping links into a messy WhatsApp chat with yourself—pin favorites, sort collections, search instantly, and keep everything structured and gorgeous.
                </Text>
              </View>
              
              {/* Legal Terms Button */}
              <TouchableOpacity
                style={[styles.legalButton, { 
                backgroundColor: 'rgba(74, 144, 226, 0.1)',
                borderColor: '#4A90E2'
                }]}
                onPress={openLegalModal}
              >
              <MaterialIcons 
                name="gavel" 
                size={20} 
                color="#4A90E2" 
              />
              <Text style={[styles.legalButtonText, { color: '#4A90E2' }]}>
                  View Full Legal Terms & Privacy Policy
                </Text>
              <MaterialIcons 
                name="arrow-forward" 
                size={20} 
                color="#4A90E2" 
              />
              </TouchableOpacity>
          </View>
        </ProfileSection>
        )}

        {/* Section Divider */}
        {(matchesSearch('Terms of Service') || matchesSearch('App Features') || matchesSearch('Link Preview') || matchesSearch('Features') || matchesSearch('Terms') || matchesSearch('Privacy') || matchesSearch('LinksVault')) && matchesSearch('Account', [{title: 'Sign Out'}, {title: 'Delete Account'}]) && (
          <View style={[styles.sectionDivider, { 
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)' 
          }]} />
        )}

        {/* Account Actions Section */}
        {matchesSearch('Account', [{title: 'Sign Out', subtitle: 'Sign out of your account'}, {title: 'Delete Account', subtitle: 'Permanently delete your account and data'}]) && (
          <ProfileSection title="Account" icon="security">
            <ProfileItem
              icon="logout"
              title="Sign Out"
              subtitle="Sign out of your account"
              iconColor="#FF6B6B"
              onPress={handleSignOut}
            />
            
            <ProfileItem
              icon="delete-forever"
              title="Delete Account"
              subtitle="Permanently delete your account and data"
              iconColor="#E74C3C"
              onPress={handleDeleteAccount}
            />
          </ProfileSection>
        )}

        {/* Section Divider */}
        {matchesSearch('Account', [{title: 'Sign Out'}, {title: 'Delete Account'}]) && matchesSearch('App Information', [{title: 'Version'}, {title: 'Build'}]) && (
          <View style={[styles.sectionDivider, { 
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)' 
          }]} />
        )}

        {/* App Info Section */}
        {matchesSearch('App Information', [{title: 'Version', subtitle: '1.0.0'}, {title: 'Build', subtitle: '2024.1.0'}]) && (
          <ProfileSection title="App Information" icon="info">
            <ProfileItem
              icon="info"
              title="Version"
              subtitle="1.0.0"
              showArrow={false}
            />
            
            <ProfileItem
              icon="code"
              title="Build"
              subtitle="2024.1.0"
              showArrow={false}
            />
          </ProfileSection>
        )}

        {/* No Results Message */}
        {searchQuery.trim() && !hasSearchResults() && (
          <View style={[styles.emptyStateContainer, { paddingVertical: 40 }]}>
            <MaterialIcons name="search-off" size={48} color={isDarkMode ? '#666' : '#ccc'} />
            <Text style={[styles.emptyStateText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
              No results found
            </Text>
            <Text style={[styles.emptyStateSubtext, { color: isDarkMode ? '#999' : '#666' }]}>
              Try different search terms
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Legal Terms Modal - Full Screen Overlay */}
      {legalModalVisible && (
        <View style={styles.fullScreenModal}>
          <View style={[styles.fullScreenModalContainer, { backgroundColor: getBackgroundColor() }]}>
            {/* Modal Header */}
            <View style={[styles.legalModalHeader, { 
              borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' 
            }]}>
              <View style={styles.legalModalTitleContainer}>
                <MaterialIcons name="gavel" size={28} color="#4A90E2" />
                <Text style={[styles.legalModalTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  Legal Terms & Privacy
                </Text>
              </View>
              <TouchableOpacity
                onPress={closeLegalModal}
                style={styles.legalModalClose}
              >
                <MaterialIcons name="close" size={28} color={isDarkMode ? '#ffffff' : '#1a1a1a'} />
              </TouchableOpacity>
            </View>

            {/* Modal Content - Simple ScrollView */}
            <ScrollView 
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 20 }}
              showsVerticalScrollIndicator={true}
              bounces={true}
            >
              {/* Disclaimer */}
              <View style={styles.legalSection}>
                <View style={styles.legalSectionHeader}>
                  <MaterialIcons name="warning" size={24} color="#FF6B6B" />
                  <Text style={[styles.legalSectionTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                    Important Disclaimer
                  </Text>
                </View>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  <Text style={{ fontWeight: '700' }}>LinksVault is an independent application</Text> and is not affiliated with, endorsed by, or sponsored by any of the social media platforms displayed within the app, including but not limited to Instagram, Facebook, YouTube, TikTok, Twitter/X, Reddit, Snapchat, or any other platforms.
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  All trademarks, service marks, logos, and brand names are the property of their respective owners. The use of these marks and logos is for identification and reference purposes only and does not imply any affiliation, endorsement, or sponsorship.
                </Text>
              </View>

              {/* Privacy Policy */}
              <View style={styles.legalSection}>
                <View style={styles.legalSectionHeader}>
                  <MaterialIcons name="privacy-tip" size={24} color="#4A90E2" />
                  <Text style={[styles.legalSectionTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                    Privacy Policy
                  </Text>
                </View>
                <Text style={[styles.legalSubtitle, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                  Last Updated: 17.10.2025
                </Text>
                
                <Text style={[styles.legalSubheading, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  1. Information We Collect
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  • Account Information: Email address, name, profile picture, date of birth, and gender when you create an account.
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  • Content You Save: Links, titles, and collections that you create and store in LinksVault.
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  • Authentication Data: We use Firebase Authentication and Google Sign-In to manage your account securely.
                </Text>

                <Text style={[styles.legalSubheading, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  2. How We Use Your Information
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  • To provide and maintain our service
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  • To notify you about changes to our service
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  • To provide customer support
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  • To gather analysis or valuable information so that we can improve our service
                </Text>
              </View>

              {/* Terms of Service */}
              <View style={styles.legalSection}>
                <View style={styles.legalSectionHeader}>
                  <MaterialIcons name="gavel" size={24} color="#FF9800" />
                  <Text style={[styles.legalSectionTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                    Terms of Service
                  </Text>
                </View>
                <Text style={[styles.legalSubtitle, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                  Last Updated: 17.10.2025
                </Text>

                <Text style={[styles.legalSubheading, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  1. Acceptance of Terms
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  By accessing and using LinksVault, you accept and agree to be bound by the terms and provision of this agreement.
                </Text>

                <Text style={[styles.legalSubheading, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  2. Use License
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  Permission is granted to temporarily download one copy of LinksVault per device for personal, non-commercial transitory viewing only.
                </Text>

                <Text style={[styles.legalSubheading, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  3. Disclaimer
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  The materials on LinksVault are provided on an 'as is' basis. LinksVault makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
                </Text>
              </View>

              {/* Contact Information */}
              <View style={styles.legalSection}>
                <View style={styles.legalSectionHeader}>
                  <MaterialIcons name="contact-support" size={24} color="#2ECC71" />
                  <Text style={[styles.legalSectionTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                    Contact Information
                  </Text>
                </View>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  If you have questions about these terms, your privacy, or need to report a concern, please contact us:
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)', fontWeight: '600' }]}>
                  Email: help.linksvault.app@gmail.com{'\n'}
                  Response Time: Within 48 hours
                </Text>
                <View style={{ height: 40 }} />
              </View>

            </ScrollView>
          </View>
        </View>
      )}

      {/* Email Linking Modal */}
      <Modal
        visible={showLinkEmailModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseLinkEmailModal}
      >
        <TouchableWithoutFeedback onPress={handleCloseLinkEmailModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.modalContent, { backgroundColor: getBackgroundColor() }]}>
            <View style={styles.modalHeader}>
              <MaterialIcons name="link" size={28} color="#4A90E2" />
              <Text style={[styles.modalTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                Link Email/Password
              </Text>
            </View>
            
             <Text style={[styles.modalSubtitle, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
               {linkedProviders.includes('password') 
                 ? 'Add a new email/password sign-in method to your account'
                 : 'Add email/password sign-in to your account for more flexibility'
               }
             </Text>
            
            {/* Email Input */}
            <View style={[styles.inputContainer, { 
              backgroundColor: isDarkMode ? '#2a2a2a' : '#f8f9fa',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
            }]}>
              <MaterialIcons name="email" size={24} color="#4A90E2" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}
                placeholder="Email"
                placeholderTextColor={isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(26, 26, 26, 0.5)'}
                value={linkEmail || currentUser?.email || ''}
                onChangeText={setLinkEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={false}
                scrollEnabled={true}
                multiline={true}
                numberOfLines={1}
                textAlignVertical="center"
              />
            </View>

            {/* Password Input */}
            <View style={[styles.inputContainer, { 
              backgroundColor: isDarkMode ? '#2a2a2a' : '#f8f9fa',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
            }]}>
              <MaterialIcons name="lock" size={24} color="#4A90E2" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}
                placeholder="Password"
                placeholderTextColor={isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(26, 26, 26, 0.5)'}
                value={linkPassword}
                onChangeText={setLinkPassword}
                secureTextEntry={!isLinkPasswordVisible}
                autoCapitalize="none"
              />
              {/* Password visibility toggle */}
              <TouchableOpacity 
                onPress={() => setIsLinkPasswordVisible(!isLinkPasswordVisible)}
                style={styles.eyeIconModal}
              >
                <MaterialIcons 
                  name={isLinkPasswordVisible ? "visibility-off" : "visibility"} 
                  size={24} 
                  color="#4A90E2" 
                />
              </TouchableOpacity>
            </View>

            {/* Confirm Password Input */}
            <View style={[styles.inputContainer, { 
              backgroundColor: isDarkMode ? '#2a2a2a' : '#f8f9fa',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
            }]}>
              <MaterialIcons name="lock-outline" size={24} color="#4A90E2" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}
                placeholder="Confirm Password"
                placeholderTextColor={isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(26, 26, 26, 0.5)'}
                value={linkConfirmPassword}
                onChangeText={setLinkConfirmPassword}
                secureTextEntry={!isLinkConfirmPasswordVisible}
                autoCapitalize="none"
              />
              {/* Confirm password visibility toggle */}
              <TouchableOpacity 
                onPress={() => setIsLinkConfirmPasswordVisible(!isLinkConfirmPasswordVisible)}
                style={styles.eyeIconModal}
              >
                <MaterialIcons 
                  name={isLinkConfirmPasswordVisible ? "visibility-off" : "visibility"} 
                  size={24} 
                  color="#4A90E2" 
                />
              </TouchableOpacity>
            </View>
            
            {linkError ? <Text style={styles.errorText}>{linkError}</Text> : null}
            
              <TouchableOpacity 
                style={[
                  styles.modalButton,
                  (!linkPassword || !linkConfirmPassword || isLinking) && styles.modalButtonDisabled
                ]} 
                onPress={handleLinkEmailPassword}
                disabled={!linkPassword || !linkConfirmPassword || isLinking}
              >
              {isLinking ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <MaterialIcons name="link" size={24} color="white" />
              )}
              <Text style={styles.modalButtonText}>
                {isLinking ? 'LINKING...' : 'LINK EMAIL/PASSWORD'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modalCloseButton, { 
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' 
              }]}
              onPress={handleCloseLinkEmailModal}
            >
              <MaterialIcons name="close" size={20} color={isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)'} />
            </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {!(isKeyboardVisible || isSearchOpen || isSearchFocused) && <Footer />}

      {/* Theme Selection Bottom Sheet Modal */}
      <Modal
        transparent={true}
        visible={showThemeModal}
        animationType="slide"
        onRequestClose={closeThemeModal}
      >
        <TouchableWithoutFeedback onPress={closeThemeModal}>
          <View style={styles.bottomSheetOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.bottomSheetContent, { 
                backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
                borderTopColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              }]}>
                {/* Handle bar */}
                <TouchableOpacity
                  onPress={closeThemeModal}
                  activeOpacity={0.6}
                  disabled={isThemeUpdating}
                >
                  <View style={[styles.bottomSheetHandle, { 
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' 
                  }]} />
                </TouchableOpacity>
            
                {/* Header */}
                <View style={styles.bottomSheetHeader}>
                  <Text style={[styles.bottomSheetTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                    Choose Theme
                  </Text>
                  <View style={styles.bottomSheetHeaderActions}>
                    <TouchableOpacity 
                      onPress={closeThemeModal}
                      style={[styles.bottomSheetCloseButton, { 
                        backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' 
                      }]}
                      disabled={isThemeUpdating}
                    >
                      <MaterialIcons name="close" size={24} color={isDarkMode ? '#ffffff' : '#333'} />
                    </TouchableOpacity>
                  </View>
                </View>
                
                {/* Theme Options */}
                <View style={styles.bottomSheetOptions}>
                  {['light', 'gray', 'black'].map((theme) => (
                    <TouchableOpacity
                      key={theme}
                      style={[
                        styles.bottomSheetOption,
                        { 
                          backgroundColor: themeMode === theme ? (isDarkMode ? '#3a3a3a' : '#f0f5ff') : 'transparent',
                          borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          opacity: isThemeUpdating && themeMode !== theme ? 0.5 : 1,
                        }
                      ]}
                      onPress={() => selectTheme(theme)}
                      disabled={isThemeUpdating}
                    >
                      <View style={styles.bottomSheetOptionLeft}>
                        <View style={[
                          styles.bottomSheetPreview,
                          { backgroundColor: theme === 'light' ? '#f5f5f5' : theme === 'gray' ? '#1a1a1a' : '#000000' }
                        ]} />
                        <View style={styles.bottomSheetOptionText}>
                          <Text style={[styles.bottomSheetOptionTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                            {getThemeDisplayName(theme)}
                          </Text>
                          <Text style={[styles.bottomSheetOptionSubtitle, { color: isDarkMode ? '#cccccc' : '#666' }]}>
                            {theme === 'light' ? 'Light gray background' : 
                             theme === 'gray' ? 'Dark gray background' : 
                             'Pure black background'}
                          </Text>
                        </View>
                      </View>
                      {themeMode === theme && !isThemeUpdating && (
                        <MaterialIcons name="check-circle" size={24} color="#4A90E2" />
                      )}
                      {themeMode === theme && isThemeUpdating && (
                        <ActivityIndicator size="small" color="#4A90E2" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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
        headerTitle={`Hello, ${currentUser?.displayName || currentUser?.email || 'Guest User'}`}
        headerSubtitle="Here's everything you can do today"
        sections={menuSections}
        onSelectAction={handleMenuAction}
        footerTitle="LinksVault"
        versionLabel={`Version ${appVersion}`}
        footerIconName="shield"
      />
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
  
  // Empty State Styles
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  
  // Top Right Controls
  topRightControls: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 23 : 13,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  content: {
    flex: 1,
  },
  // ScrollView content container
  scrollContent: {
    padding: 20,
    paddingTop: 24,
    paddingBottom: 80, // Further reduced space for absolutely positioned footer
  },
  modernSection: {
    marginBottom: 20,
  },
  sectionDivider: {
    height: 1,
    marginVertical: 12,
    marginHorizontal: 8,
  },
  modernSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 0,
  },
  sectionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modernSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  modernUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  modernAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  avatarUploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modernUserDetails: {
    flex: 1,
  },
  modernUserName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  modernGreeting: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
    letterSpacing: 0.15,
    textTransform: 'uppercase',
  },
  modernUserEmail: {
    fontSize: 15,
    fontWeight: '400',
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  avatarHint: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  userStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  modernProfileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 0,
    marginBottom: 0,
  },
  modernProfileItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modernProfileItemText: {
    flex: 1,
    marginLeft: 16,
  },
  modernProfileItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
    letterSpacing: -0.1,
  },
  modernProfileItemSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  modernProfileItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modernPersonalInfo: {
    paddingVertical: 8,
  },
  modernInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 4,
  },
  modernInfoText: {
    fontSize: 15,
    flex: 1,
    fontWeight: '400',
    letterSpacing: 0.1,
    marginLeft: 12,
  },
  modernSwitch: {
    transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
  },
  termsContent: {
    paddingVertical: 8,
  },
  termsSection: {
    marginBottom: 24,
  },
  termsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  termsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
    letterSpacing: -0.2,
  },
  termsText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  termsList: {
    marginLeft: 8,
    marginBottom: 12,
  },
  termsListItem: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
    letterSpacing: 0.1,
  },
  termsNote: {
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
    letterSpacing: 0.1,
  },
  featureList: {
    marginTop: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingRight: 8,
  },
  featureText: {
    flex: 1,
    marginLeft: 12,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 3,
    letterSpacing: -0.1,
  },
  featureDescription: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  
  // Legal Button Styles
  legalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
  },
  legalButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    marginRight: 8,
    letterSpacing: 0.1,
  },
  
  // Legal Modal Styles - Full Screen Overlay
  fullScreenModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  fullScreenModalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  legalModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    flexShrink: 0,
  },
  legalModalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legalModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginLeft: 12,
    letterSpacing: -0.5,
  },
  legalModalClose: {
    padding: 4,
  },
  legalSection: {
    marginBottom: 32,
  },
  legalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  legalSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 12,
    letterSpacing: -0.3,
  },
  legalSubtitle: {
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 16,
    opacity: 0.7,
  },
  legalSubheading: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  legalHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  legalText: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 12,
    letterSpacing: 0.2,
  },

  // Account Linking Styles
  providerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  providerList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  providerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  providerText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 6,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  linkButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  linkInfoText: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
  },
  fixButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  fixButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    margin: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  modalSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 15,
    marginBottom: 15,
    paddingHorizontal: 15,
    borderWidth: 1,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90E2',
    padding: 15,
    borderRadius: 25,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
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
  
  // Bottom Sheet Modal Styles
  bottomSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  bottomSheetContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingBottom: 34, // Safe area for iPhone
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  bottomSheetHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomSheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  bottomSheetCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeLoadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  themeLoadingText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '500',
  },
  themeUpdatingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    zIndex: 2000,
  },
  themeUpdatingIndicator: {
    width: 180,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 12,
  },
  themeUpdatingText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomSheetOptions: {
    paddingHorizontal: 24,
  },
  bottomSheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  bottomSheetOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bottomSheetPreview: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 16,
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  bottomSheetOptionText: {
    flex: 1,
  },
  bottomSheetOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  bottomSheetOptionSubtitle: {
    fontSize: 14,
    fontWeight: '400',
  },
});
