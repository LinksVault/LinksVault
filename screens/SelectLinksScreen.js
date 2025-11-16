import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import { db, auth } from '../services/firebase/Config';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SelectLinksScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { isDarkMode, getBackgroundColor } = useTheme();
  const [links, setLinks] = useState([]);
  const [selectedLinks, setSelectedLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [linkPreviews, setLinkPreviews] = useState({});
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const currentSelectedLinks = route.params?.currentSelectedLinks || [];

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

  // Initialize selected links from params
  useEffect(() => {
    if (currentSelectedLinks && currentSelectedLinks.length > 0) {
      const ids = currentSelectedLinks.map(link => {
        // If it's already an ID string, use it. Otherwise get the id property
        return typeof link === 'string' ? link : link.id;
      });
      setSelectedLinks(ids);
    }
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

  // Load previews ONLY from AsyncStorage (no network fetching)
  useEffect(() => {
    const loadPreviewsFromAsyncStorage = async () => {
      try {
        if (links.length === 0) {
          setLinkPreviews({});
          setCacheLoaded(true);
          return;
        }

        // Reset cache loaded state when links change
        setCacheLoaded(false);

        const localCacheKey = 'linkPreviewsCache';
        const localCacheStr = await AsyncStorage.getItem(localCacheKey);
        const localCache = localCacheStr ? JSON.parse(localCacheStr) : {};
        const previews = {};
        
        links.forEach(link => {
          if (link.url && localCache[link.url]) {
            previews[link.url] = localCache[link.url];
          }
        });
        
        setLinkPreviews(previews);
        console.log(`✅ Loaded ${Object.keys(previews).length} previews from AsyncStorage cache`);
      } catch (e) {
        console.error('Error loading AsyncStorage cache:', e);
        // If cache is corrupted or unavailable, just skip previews
        setLinkPreviews({});
      } finally {
        // Mark cache as loaded even if empty to prevent flash
        setCacheLoaded(true);
      }
    };

    loadPreviewsFromAsyncStorage();
  }, [links]);

  const toggleLinkSelection = (linkId) => {
    setSelectedLinks(prev => 
      prev.includes(linkId) 
        ? prev.filter(id => id !== linkId)
        : [...prev, linkId]
    );
  };

  const handleConfirm = () => {
    // Get the links that are currently selected in the screen
    const newlySelected = links.filter(link => selectedLinks.includes(link.id));
    
    // Also get the ones that were previously selected (from currentSelectedLinks)
    // that are still selected (still in selectedLinks array)
    const stillSelectedFromPrevious = currentSelectedLinks.filter(prev => 
      selectedLinks.includes(prev.id)
    );
    
    // Combine them, removing duplicates
    const allSelected = [...stillSelectedFromPrevious, ...newlySelected];
    const uniqueSelected = allSelected.filter((link, index, self) => 
      index === self.findIndex(l => l.id === link.id)
    );
    
    // Check if we came from CreateCollection or CollectionFormat
    const sourceScreen = route.params?.sourceScreen;
    
    if (sourceScreen === 'CollectionFormat') {
      // Get the collection parameter that was originally passed
      // This comes from when we navigated from CollectionFormat to SelectLinksScreen
      const originalCollection = route.params?.originalCollection;
      
      // Navigate back to CollectionFormat with the selected links and collection
      navigation.navigate('CollectionFormat', {
        collection: originalCollection,
        selectedLinksFromMyLinks: uniqueSelected
      });
    } else {
      // Default to CreateCollection
      navigation.navigate('CreateCollection', { 
        newSelectedLinks: uniqueSelected,
        preserveFormState: true
      });
    }
  };

  // Handle back button - go back without saving
  const handleBack = () => {
    // Simply navigate back without saving changes
    navigation.goBack();
  };

  const selectionCount = selectedLinks.length;

  return (
    <View style={[styles.container, { backgroundColor: getBackgroundColor() }]}>
      {/* Status Bar */}
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
          onPress={handleBack}
          style={[styles.backButton, { 
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' 
          }]}
        >
          <MaterialIcons name="arrow-back" size={24} color={isDarkMode ? '#ffffff' : '#333'} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
            Add from My Links
          </Text>
          {selectionCount > 0 && (
            <Text style={[styles.selectionCount, { color: '#4A90E2' }]}>
              {selectionCount} selected
            </Text>
          )}
        </View>

        <TouchableOpacity 
          onPress={handleConfirm}
          style={[styles.confirmButton, { 
            backgroundColor: selectionCount > 0 ? '#4A90E2' : (isDarkMode ? '#3a3a3a' : '#e0e0e0'),
            opacity: selectionCount > 0 ? 1 : 0.5
          }]}
          disabled={selectionCount === 0}
        >
          <Text style={[styles.confirmButtonText, { 
            color: selectionCount > 0 ? '#ffffff' : (isDarkMode ? '#666' : '#999')
          }]}>
            Add ({selectionCount})
          </Text>
        </TouchableOpacity>
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
          <MaterialIcons name="link-off" size={64} color={isDarkMode ? '#666' : '#ccc'} />
          <Text style={[styles.emptyText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
            No links available
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
            const isSelected = selectedLinks.includes(link.id);
            
            return (
              <TouchableOpacity
                key={link.id}
                style={[
                  styles.linkCard,
                  isSelected && styles.linkCardSelected,
                  { 
                    backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
                    borderColor: isSelected ? '#4A90E2' : (isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)')
                  }
                ]}
                onPress={() => toggleLinkSelection(link.id)}
                activeOpacity={0.8}
              >
                {/* Selection Checkbox */}
                <View style={[
                  styles.checkbox,
                  isSelected && styles.checkboxSelected
                ]}>
                  {isSelected && <MaterialIcons name="check" size={16} color="#ffffff" />}
                </View>

                {/* Link Image */}
                <View style={styles.imageContainer}>
                  {preview?.image ? (
                    <Image 
                      source={{ uri: preview.image }} 
                      style={styles.linkImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.imagePlaceholder, {
                      backgroundColor: isDarkMode ? '#3a3a3a' : '#f5f5f5'
                    }]}>
                      <MaterialIcons name="link" size={32} color={isDarkMode ? '#666' : '#ccc'} />
                    </View>
                  )}
                </View>

                {/* Site Name Badge */}
                {preview?.siteName && (
                  <View style={styles.siteNameBadge}>
                    <Text style={styles.siteNameText}>
                      {preview.siteName}
                    </Text>
                  </View>
                )}

                {/* Link Info */}
                <View style={styles.linkInfo}>
                  <Text 
                    style={[styles.linkTitle, { color: isDarkMode ? '#ffffff' : '#333' }]} 
                    numberOfLines={2}
                  >
                    {preview?.title || link.title || link.url}
                  </Text>
                  <Text 
                    style={[styles.linkUrl, { color: isDarkMode ? '#999' : '#666' }]} 
                    numberOfLines={1}
                  >
                    {link.url}
                  </Text>
                </View>
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
  selectionCount: {
    fontSize: 12,
    marginTop: 2,
  },
  confirmButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    minWidth: 80,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
    padding: 16,
    paddingBottom: 80,
  },
  linkCard: {
    width: '48%',
    borderRadius: 12,
    marginHorizontal: '1%',
    marginBottom: 16,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  linkCardSelected: {
    borderWidth: 2,
    transform: [{ scale: 0.98 }],
  },
  checkbox: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  checkboxSelected: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
  },
  linkImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  siteNameBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 5,
  },
  siteNameText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  linkInfo: {
    padding: 12,
  },
  linkTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  linkUrl: {
    fontSize: 11,
  },
});

