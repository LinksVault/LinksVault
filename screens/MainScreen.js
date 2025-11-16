import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Linking, Animated, Platform, StatusBar, TextInput, Keyboard, Share, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Footer from '../components/Footer';
import HamburgerMenu from '../components/HamburgerMenu';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';
import { showAppDialog } from '../context/DialogContext';
import { auth } from '../services/firebase/Config';
import { onAuthStateChanged } from 'firebase/auth';
import Constants from 'expo-constants';

// Global image cache to persist across screen transitions
let globalImageCache = {
  loaded: false,
  loading: false,
  promise: null
};

export default function MainScreen() {
  const navigation = useNavigation();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const searchAnim = React.useRef(new Animated.Value(0)).current;
  const { isDarkMode, getBackgroundColor } = useTheme();
  const { width: screenWidth } = useWindowDimensions();

  const [imagesLoaded, setImagesLoaded] = React.useState(false);
  const [isScreenFocused, setIsScreenFocused] = React.useState(false);
  const [instagramLoaded, setInstagramLoaded] = React.useState(false);
  const appVersion = React.useMemo(() => {
    return Constants?.expoConfig?.version ?? Constants?.manifest?.version ?? '—';
  }, []);
const supportEmail = 'help.linksvault.app@gmail.com';
  const privacyUrl = 'https://linksvault.app/privacy-policy';
  const termsUrl = 'https://linksvault.app/terms-and-conditions';
  const shareMessage = 'Check out LinksVault – the easiest way to save and organize every link you love. Download it now!';
  const accentColor = '#2F6BFF';
  const statusBarHeight = React.useMemo(() => {
    const expoStatusBar = Constants?.statusBarHeight ?? 0;
    if (Platform.OS === 'android') {
      return StatusBar.currentHeight ?? expoStatusBar;
    }
    return expoStatusBar;
  }, []);
  const menuAnim = React.useRef(new Animated.Value(0)).current;
  const menuTranslateX = React.useMemo(
    () => menuAnim.interpolate({ inputRange: [0, 1], outputRange: [-340, 0] }),
    [menuAnim]
  );

  // Current user state
  const [currentUser, setCurrentUser] = React.useState(null);

  // Hamburger menu state
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  // Search functionality state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [filteredPlatforms, setFilteredPlatforms] = React.useState([]);
  const [isKeyboardVisible, setIsKeyboardVisible] = React.useState(false);
  const [isSearchFocused, setIsSearchFocused] = React.useState(false);

  // Search filter function
  const filterPlatforms = (query) => {
    if (!query.trim()) {
      setFilteredPlatforms(socialIcons);
      return;
    }

    const filtered = socialIcons.filter(platform =>
      platform.name.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredPlatforms(filtered);
  };

  // Handle search input change
  const handleSearchChange = (text) => {
    setSearchQuery(text);
    filterPlatforms(text);
  };

  // Toggle search mode - WhatsApp style animation
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

  // Initialize filteredPlatforms with socialIcons on mount
  React.useEffect(() => {
    setFilteredPlatforms(socialIcons);
  }, []);

  // Get current user
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Hide footer when keyboard is open (no flicker): use "will" events with did fallback
  React.useEffect(() => {
    const willShow = Keyboard.addListener('keyboardWillShow', () => setIsKeyboardVisible(true));
    const willHide = Keyboard.addListener('keyboardWillHide', () => setIsKeyboardVisible(false));
    const didShow = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const didHide = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => { willShow.remove(); willHide.remove(); didShow.remove(); didHide.remove(); };
  }, []);

  // Preload images whenever screen becomes focused (non-blocking)
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setIsScreenFocused(true);
      // Start animation immediately, don't wait for preload
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();

      // Preload in background without blocking
      preloadImages();
    });

    const unsubscribeBlur = navigation.addListener('blur', () => {
      setIsScreenFocused(false);
    });

    return () => {
      unsubscribe();
      unsubscribeBlur();
    };
  }, [navigation]);

  React.useEffect(() => {
    // הסרת הכותרת העליונה ומניעת חזרה אחורה
    navigation.setOptions({
      headerShown: false,
      gestureEnabled: false,
    });

    // Start animation immediately on mount
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Preload in background without blocking
    preloadImages();

    // Also preload Instagram specifically for extra reliability (non-blocking, mobile only)
    if (Platform.OS !== 'web') {
      Image.prefetch(Image.resolveAssetSource(require('../assets/InstagramIcon.png')).uri)
        .then(() => {
          console.log('Instagram specifically preloaded');
          setInstagramLoaded(true);
        })
        .catch((error) => {
          console.warn('Instagram preload failed:', error);
          setInstagramLoaded(true);
        });
    } else {
      // On web, just mark as loaded
      setInstagramLoaded(true);
    }
  }, []);

  // Preload all images to prevent loading delays with global caching (non-blocking)
  const preloadImages = () => {
    // If already loaded globally, just set state
    if (globalImageCache.loaded) {
      console.log('Images already cached globally');
      setImagesLoaded(true);
      return;
    }

    // If currently loading globally, don't start another
    if (globalImageCache.loading) {
      console.log('Images currently loading globally');
      return;
    }

    // Start new global preload in background
    console.log('Starting background image preload for MainScreen...');
    globalImageCache.loading = true;

    // Skip image preloading on web - not needed and resolveAssetSource doesn't work
    if (Platform.OS === 'web') {
      console.log('Skipping image preload on web platform');
      globalImageCache.loaded = true;
      globalImageCache.loading = false;
      setImagesLoaded(true);
      return;
    }

    const imagePromises = [
      Image.prefetch(Image.resolveAssetSource(require('../assets/YoutubeIcon.png')).uri),
      Image.prefetch(Image.resolveAssetSource(require('../assets/InstagramIcon.png')).uri),
      Image.prefetch(Image.resolveAssetSource(require('../assets/FacebookIcon.png')).uri),
      Image.prefetch(Image.resolveAssetSource(require('../assets/TikTokIcon.png')).uri),
      Image.prefetch(Image.resolveAssetSource(require('../assets/XIcon.png')).uri),
      Image.prefetch(Image.resolveAssetSource(require('../assets/SnapchatIcon.png')).uri),
    ];

    globalImageCache.promise = Promise.all(imagePromises);

    // Don't await - let it run in background
    globalImageCache.promise.then(() => {
      console.log('All images preloaded successfully globally');
      globalImageCache.loaded = true;
      globalImageCache.loading = false;
      setImagesLoaded(true);
    }).catch((error) => {
      console.warn('Some images failed to preload:', error);
      globalImageCache.loading = false;
      setImagesLoaded(true); // Continue anyway
    });
  };

  // Removed blocking animation effect - animations now start immediately

  // פונקציה לטיפול בלחיצה על אייקון רשת חברתית
  const handleSocialPress = (url) => {
    Linking.openURL(url)
      .catch(err => console.error('An error occurred', err));
  };

  // Handle hamburger menu toggle
  const openMenu = React.useCallback(() => {
    if (isMenuOpen) return;
    setIsMenuOpen(true);
    Animated.timing(menuAnim, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [isMenuOpen, menuAnim]);

  const closeMenu = React.useCallback((callback) => {
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

  const toggleMenu = React.useCallback(() => {
    if (isMenuOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }, [isMenuOpen, openMenu, closeMenu]);

  // Handle menu item selection
  const handleMenuAction = React.useCallback((action) => {
    closeMenu(async () => {
      switch (action) {
        case 'rate': {
          const storeUrl = Platform.OS === 'ios'
            ? 'https://apps.apple.com'
            : 'https://play.google.com/store';
          try {
            await Linking.openURL(storeUrl);
          } catch (error) {
            showAppDialog('Rate Us', 'Unable to open the store right now. Please try again later.');
          }
          break;
        }
        case 'share': {
          try {
            await Share.share({
              message: 'Check out LinksVault - the best way to organize your links!'
            });
          } catch (error) {
            showAppDialog('Share LinksVault', 'Unable to open the share sheet.');
          }
          break;
        }
        case 'support': {
          try {
            await Linking.openURL(`mailto:${supportEmail}`);
          } catch (error) {
            showAppDialog('Support', `Contact us at ${supportEmail}`);
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
          showAppDialog('Plans', 'Plans feature coming soon!');
          break;
        default:
          break;
      }
    });
  }, [closeMenu, navigation, showAppDialog, supportEmail, privacyUrl, termsUrl]);

  const menuSections = React.useMemo(() => [
    {
      title: 'Stay Connected',
      items: [
        {
          key: 'rate',
          title: 'Rate Us',
          subtitle: 'Love LinksVault? Support us with 5 stars.',
          icon: 'star-rate',
          iconColor: accentColor,
          action: 'rate',
        },
        {
          key: 'share',
          title: 'Share',
          subtitle: 'Invite friends to organize their links.',
          icon: 'share',
          iconColor: accentColor,
          action: 'share',
        },
        {
          key: 'support',
          title: 'Support',
          subtitle: 'Need help? Reach out to our team.',
          icon: 'support-agent',
          iconColor: accentColor,
          action: 'support',
        },
      ],
    },
    {
      title: 'Company',
      items: [
        {
          key: 'privacy',
          title: 'Privacy Policy',
          subtitle: 'Understand how we protect your data.',
          icon: 'privacy-tip',
          iconColor: accentColor,
          action: 'privacy',
        },
        {
          key: 'terms',
          title: 'Terms & Conditions',
          subtitle: 'Review the rules of using LinksVault.',
          icon: 'gavel',
          iconColor: accentColor,
          action: 'terms',
        },
        {
          key: 'about',
          title: 'About',
          subtitle: 'Discover the story behind LinksVault.',
          icon: 'info-outline',
          iconColor: accentColor,
          action: 'about',
        },
      ],
    },
    {
      title: 'Product',
      items: [
        {
          key: 'help',
          title: 'Help & Tutorials',
          subtitle: 'Guided answers to common questions.',
          icon: 'help-outline',
          iconColor: accentColor,
          action: 'help',
        },
        {
          key: 'statistics',
          title: 'Statistics',
          subtitle: 'See how your content performs.',
          icon: 'insights',
          iconColor: accentColor,
          action: 'statistics',
        },
        {
          key: 'plans',
          title: 'Plans',
          subtitle: 'Upgrade for more power features.',
          icon: 'card-membership',
          iconColor: accentColor,
          action: 'plans',
        },
      ],
    },
  ], [accentColor]);

  const socialIcons = [
    {
      name: 'YouTube',
      icon: require('../assets/YoutubeIcon.png'),
      url: 'https://www.youtube.com/',
      color: '#FF0000',
    },
    {
      name: 'Instagram',
      icon: require('../assets/InstagramIcon.png'),
      url: 'https://www.instagram.com/',
      color: '#E1306C',
    },
    {
      name: 'Facebook',
      icon: require('../assets/FacebookIcon.png'),
      url: 'https://www.facebook.com/',
      color: '#4267B2',
    },
    {
      name: 'TikTok',
      icon: require('../assets/TikTokIcon.png'),
      url: 'https://www.tiktok.com/',
      color: '#000000',
    },
    {
      name: 'Twitter',
      icon: require('../assets/XIcon.png'),
      url: 'https://twitter.com/',
      color: '#1DA1F2',
    },
    {
      name: 'Snapchat',
      icon: require('../assets/SnapchatIcon.png'),
      url: 'https://www.snapchat.com/',
      color: '#FFFC00',
    },
    {
      name: 'Reddit',
      icon: require('../assets/RedditIcon.jpg'),
      url: 'https://www.reddit.com/',
      color: '#FF4500',
    },
    {
      name: 'Pinterest',
      icon: require('../assets/PinterestIcon.png'),
      url: 'https://www.pinterest.com/',
      color: '#E60023',
    },
    {
      name: 'LinkedIn',
      icon: require('../assets/LinkedInIcon.png'),
      url: 'https://www.linkedin.com/',
      color: '#0077B5',
    },
    {
      name: 'Twitch',
      icon: require('../assets/TwitchIcon.png'),
      url: 'https://www.twitch.tv/',
      color: '#9146FF',
    },
  ];

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
            Media Platforms
          </Text>
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
              onPress={() => { Keyboard.dismiss(); setIsKeyboardVisible(false); setIsSearchOpen(false); setSearchQuery(''); setIsSearchFocused(false); }}
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
              placeholder="Search platforms..."
              placeholderTextColor={isDarkMode ? '#cccccc' : '#666'}
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoFocus={true}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
            />
          </View>
        </Animated.View>
      )}

      {/* רשימת הרשתות החברתיות */}
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Page Description */}
        <View style={styles.pageDescriptionSection}>
          <Text style={[styles.pageDescriptionText, { color: isDarkMode ? '#999' : '#999' }]}>
            The app is able to save links across wide variety of platforms - not just these platforms
          </Text>
        </View>

        <Animated.View style={[styles.grid, { opacity: fadeAnim }]}>
          {/* הצגת כל אייקון רשת חברתית */}
          {(isSearchOpen ? (filteredPlatforms || []) : (socialIcons || [])).map((social, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.square, {
                backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
                borderColor: social.color + '30', // Brand color border (30% opacity)
                borderWidth: 2,
              }]}
              onPress={() => handleSocialPress(social.url)}
              activeOpacity={0.7}
            >
              {/* מיכל האייקון ללא רקע צבעוני */}
              <View style={styles.iconContainer}>
                <Image
                  source={social.icon}
                  style={[
                    styles.image,
                    // Individual icon size adjustments for visual consistency
                    social.name === 'Instagram' && { width: 48, height: 48 }, // Instagram glyph - standardized size
                    social.name === 'TikTok' && { width: 52, height: 52 }, // TikTok note - make it bigger
                    social.name === 'Facebook' && { width: 48, height: 48 }, // Facebook 'f' - make it bigger
                    social.name === 'Twitter' && { width: 40, height: 40 }, // Twitter 'X' - make it smaller
                    social.name === 'Snapchat' && { width: 46, height: 46 }, // Snapchat ghost - make it bigger
                    social.name === 'YouTube' && { width: 70, height: 70 }, // YouTube play button - make it bigger to fill container
                    social.name === 'Reddit' && { width: 50, height: 50 }, // Reddit alien - balanced size
                    social.name === 'Pinterest' && { width: 48, height: 48 }, // Pinterest P - standardized size
                    social.name === 'LinkedIn' && { width: 50, height: 50 }, // LinkedIn in - balanced size
                    social.name === 'Twitch' && { width: 52, height: 52 }, // Twitch logo - slightly larger for visibility
                  ]}
                  resizeMode="contain"
                  onLoad={() => {
                    // Ensure consistent rendering timing for all icons
                    if (social.name === 'Instagram') {
                      console.log('Instagram icon loaded successfully');
                      setInstagramLoaded(true);
                    }
                  }}
                  onError={(error) => {
                    console.warn(`${social.name} icon failed to load:`, error);
                    if (social.name === 'Instagram') {
                      setInstagramLoaded(true); // Still mark as loaded to prevent blocking
                    }
                  }}
                  onLoadStart={() => {
                    if (social.name === 'Instagram') {
                      console.log('Instagram icon started loading');
                    }
                  }}
                />
              </View>

              {/* Brand color accent bar at bottom of card */}
              <View style={[styles.brandAccentBar, { backgroundColor: social.color }]} />
              {/* שם הרשת החברתית */}
              <Text style={[styles.socialName, { color: isDarkMode ? '#ffffff' : '#333' }]}>{social.name}</Text>
              {/* אייקון חץ */}
              <MaterialIcons
                name="arrow-forward"
                size={24}
                color={social.color}
                style={styles.arrowIcon}
              />
            </TouchableOpacity>
          ))}
        </Animated.View>
      </ScrollView>

      {/* כותרת תחתונה */}
      {!(isKeyboardVisible || isSearchOpen || isSearchFocused) && <Footer />}

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
        headerSubtitle="Here’s everything you can do today"
        sections={menuSections}
        onSelectAction={handleMenuAction}
        footerTitle="LinksVault"
        versionLabel={`Version ${appVersion}`}
        footerIconName="shield"
      />
    </View>
  );
}

// הגדרות העיצוב של המסך
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 10,
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
  pageDescriptionSection: {
    marginBottom: 0,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageDescriptionText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.3,
    lineHeight: 16,
    opacity: 0.8,
  },
  content: {
    flex: 1,
  },
  // ScrollView content container
  scrollContent: {
    padding: 15,
    paddingBottom: 80, // Further reduced space for absolutely positioned footer
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 10,
  },
  square: {
    width: '48%',
    height: 160,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginBottom: 15,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    // Removed shadow and border for consistent background
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    // Brand compliance: Clear space padding
    padding: 15,
  },
  image: {
    width: 50,
    height: 50,
    // Brand compliance: All icons meet minimum size requirements
    // Instagram: 29x29px ✅ (50px > 29px)
    // TikTok: 16px ✅ (50px > 16px)
    // Twitter: 32px ✅ (50px > 32px)
    // Snapchat: 18px ✅ (50px > 18px)
    // Facebook: Equal size ✅
  },
  socialName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 5,
  },
  arrowIcon: {
    position: 'absolute',
    right: 15,
    bottom: 15,
  },
  // Brand color accent bar at bottom of each card
  brandAccentBar: {
    position: 'absolute',
    bottom: 0,
    left: 20, // Shorter length - starts 20px from left
    right: 20, // Shorter length - ends 20px from right
    height: 2, // Thinner accent bar
    borderRadius: 1, // Rounded ends
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
}); 