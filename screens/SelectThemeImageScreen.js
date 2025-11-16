import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import { showAppDialog } from '../context/DialogContext';
import { db, auth } from '../services/firebase/Config';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { fetchLinkPreview } from '../fetchers';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SelectThemeImageScreen() {
  const navigation = useNavigation();
  const { isDarkMode, getBackgroundColor } = useTheme();
  const [links, setLinks] = useState([]);
  const [selectedLinks, setSelectedLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPreviews, setLoadingPreviews] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [linkPreviews, setLinkPreviews] = useState({});
  const [failedImages, setFailedImages] = useState(new Set());
  const [cacheLoaded, setCacheLoaded] = useState(false);

  // Get current user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        loadGeneralLinks(user.uid);
      } else {
        setCurrentUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load general links from Firebase
  const loadGeneralLinks = async (userId) => {
    try {
      setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  // Load previews using three-tier caching: AsyncStorage -> Firebase -> Web
  useEffect(() => {
    const loadPreviews = async () => {
      if (links.length === 0) {
        setCacheLoaded(true); // Mark as loaded even if no links
        return;
      }

      // Reset cache loaded state when links change
      setCacheLoaded(false);

      // Don't show loading spinner - load instantly from cache
      const instantPreviews = {};

      // STEP 1: Load from AsyncStorage FIRST (instant, no network)
      const localCacheKey = 'linkPreviewsCache';
      try {
        const localCacheStr = await AsyncStorage.getItem(localCacheKey);
        
        if (localCacheStr) {
          const localCache = JSON.parse(localCacheStr);
          
          links.forEach(link => {
            if (link.url && localCache[link.url]) {
              instantPreviews[link.url] = localCache[link.url];
            }
          });
          
          // Show cached previews IMMEDIATELY (no loading spinner!)
          if (Object.keys(instantPreviews).length > 0) {
            setLinkPreviews(instantPreviews);
            console.log(`✅ Loaded ${Object.keys(instantPreviews).length} previews from AsyncStorage cache`);
          }
        }
      } catch (e) {
        console.error('Error loading AsyncStorage cache:', e);
      }
      
      // Mark cache as loaded (even if empty) to prevent flash
      setCacheLoaded(true);

      // STEP 2: Load from Firebase only for links NOT in AsyncStorage
      const linksNeedingFirestore = links.filter(link => link.url && !instantPreviews[link.url]);
      
      if (linksNeedingFirestore.length > 0) {
        setLoadingPreviews(true);
        console.log(`Loading ${linksNeedingFirestore.length} previews from Firebase...`);
        
        const firebasePreviews = { ...instantPreviews };
        const previewPromises = linksNeedingFirestore.map(async (link) => {
          try {
            const safeDocId = encodeURIComponent(link.url.trim()).replace(/[^a-zA-Z0-9]/g, '_');
            const docRef = doc(db, 'linkPreviews', safeDocId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
              const previewData = docSnap.data();
              if (previewData.title && previewData.title !== 'Loading preview...') {
                return { url: link.url, preview: previewData };
              }
            }
          } catch (error) {
            console.log('Error loading Firebase cache for', link.url);
          }
          return null;
        });

        const loadedPreviews = await Promise.all(previewPromises);
        loadedPreviews.forEach((p) => {
          if (p) {
            firebasePreviews[p.url] = p.preview;
          }
        });

        // Update state with Firebase data
        if (Object.keys(firebasePreviews).length > Object.keys(instantPreviews).length) {
          setLinkPreviews(firebasePreviews);
          
          // Update AsyncStorage cache with new Firebase data
          try {
            const existingCacheStr = await AsyncStorage.getItem(localCacheKey);
            const existingCache = existingCacheStr ? JSON.parse(existingCacheStr) : {};
            Object.assign(existingCache, firebasePreviews);
            await AsyncStorage.setItem(localCacheKey, JSON.stringify(existingCache));
            console.log('✅ Updated AsyncStorage cache with Firebase data');
          } catch (error) {
            console.error('Error updating AsyncStorage cache:', error);
          }
        }

        setLoadingPreviews(false);
      }

      // Note: We don't fetch from web here since MyLinks.js already handles that
      // and saves to both Firebase and AsyncStorage caches
    };

    loadPreviews();
  }, [links]);

  const handleLinkPress = async (link) => {
    const preview = linkPreviews[link.url];
    
    if (!preview?.image) {
      showAppDialog('No Preview', 'This link does not have a preview image yet. Please select another link.');
      return;
    }

    try {
      // Download the image to local storage
      const fileName = `theme_image_${Date.now()}.jpg`;
      const downloadResult = await FileSystem.downloadAsync(
        preview.image,
        FileSystem.cacheDirectory + fileName
      );

      if (downloadResult.status === 200) {
        // Use the downloaded image
        navigation.navigate('CreateCollection', {
          selectedThemeImage: downloadResult.uri
        });
      } else {
        // If download fails, use the original URL
        navigation.navigate('CreateCollection', {
          selectedThemeImage: preview.image
        });
      }
    } catch (error) {
      console.error('Error downloading image:', error);
      // Fall back to using the original URL
      navigation.navigate('CreateCollection', {
        selectedThemeImage: preview.image
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: getBackgroundColor() }]}>
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={getBackgroundColor()}
        translucent={false}
      />

      {/* Header */}
      <View style={[styles.header, { 
        backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
        borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
      }]}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('CreateCollection')}
          style={[styles.backButton, { 
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' 
          }]}
        >
          <MaterialIcons name="arrow-back" size={24} color={isDarkMode ? '#ffffff' : '#333'} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
            Choose Theme Image
          </Text>
          <Text style={[styles.headerSubtitle, { color: isDarkMode ? '#999' : '#666' }]}>
            Select a thumbnail from your links
          </Text>
        </View>

        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      {loading || !cacheLoaded ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={[styles.loadingText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
            {loading ? 'Loading links...' : 'Loading previews...'}
          </Text>
        </View>
      ) : links.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="image-not-supported" size={64} color={isDarkMode ? '#666' : '#ccc'} />
          <Text style={[styles.emptyText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
            No links with thumbnails
          </Text>
          <Text style={[styles.emptySubtext, { color: isDarkMode ? '#999' : '#666' }]}>
            Add links in My Links first
          </Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.content} 
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
        >
          {links.map((link) => {
            const preview = linkPreviews[link.url];
            // Check if image exists and is a valid non-empty URL
            const hasImageUrl = preview?.image && preview.image.trim().length > 0;
            // Check if this image has failed to load
            const hasImage = hasImageUrl && !failedImages.has(preview.image);
            
            return (
              <TouchableOpacity
                key={link.id}
                style={[
                  styles.imageCard,
                  { 
                    backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                  }
                ]}
                onPress={() => handleLinkPress(link)}
                activeOpacity={0.8}
                disabled={!hasImage}
              >
                {hasImage ? (
                  <Image 
                    source={{ uri: preview.image }} 
                    style={styles.linkImage}
                    resizeMode="cover"
                    onError={() => {
                      // Mark this image as failed
                      setFailedImages(prev => new Set([...prev, preview.image]));
                    }}
                  />
                ) : (
                  <View style={[styles.noImageContainer, { backgroundColor: isDarkMode ? '#3a3a3a' : '#f5f5f5' }]}>
                    <MaterialIcons name="image-not-supported" size={32} color={isDarkMode ? '#666' : '#ccc'} />
                    <Text style={[styles.noImageText, { color: isDarkMode ? '#999' : '#999' }]}>
                      No thumbnail
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    marginTop: 24,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 16,
  },
  imageCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    position: 'relative',
  },
  linkImage: {
    width: '100%',
    height: '100%',
  },
  noImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  noImageText: {
    fontSize: 10,
    marginTop: 8,
    textAlign: 'center',
  },
});
