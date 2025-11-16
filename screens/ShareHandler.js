import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import { db, auth } from '../services/firebase/Config.js';
import { collection, getDocs, query, where, updateDoc, doc, arrayUnion, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { fetchLinkPreview as fetchLinkPreviewNew } from '../fetchers';
import { showAppDialog } from '../context/DialogContext';

export default function ShareHandler() {
  const navigation = useNavigation();
  const route = useRoute();
  const { isDarkMode, getBackgroundColor } = useTheme();
  
  const [sharedContent, setSharedContent] = useState(null);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [selectedGeneralLinks, setSelectedGeneralLinks] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [linkPreview, setLinkPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fetchError, setFetchError] = useState(null);

  // Get shared content from route params and fetch preview
  useEffect(() => {
    if (route.params?.sharedContent) {
      setSharedContent(route.params.sharedContent);
      fetchLinkPreview(route.params.sharedContent.url);
    }
  }, [route.params]);

  // Fetch link preview data
  const fetchLinkPreview = async (url) => {
    if (!url) return;
    
    setLoadingPreview(true);
    try {
      const result = await fetchLinkPreviewNew(url);
      if (result && result.success !== false) {
        setLinkPreview({
          title: result.title || 'Untitled',
          description: result.description || '',
          image: result.image || null,
          siteName: result.siteName || detectPlatform(url),
          url: url
        });
      } else {
        // Fallback to basic info
        setLinkPreview({
          title: sharedContent?.title || 'Shared Link',
          description: sharedContent?.description || '',
          image: null,
          siteName: detectPlatform(url),
          url: url
        });
      }
    } catch (error) {
      console.error('Error fetching link preview:', error);
      // Fallback to basic info
      setLinkPreview({
        title: sharedContent?.title || 'Shared Link',
        description: sharedContent?.description || '',
        image: null,
        siteName: detectPlatform(url),
        url: url
      });
    } finally {
      setLoadingPreview(false);
    }
  };

  // Get current user and collections
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        fetchCollections(user.uid);
      } else {
        setCurrentUser(null);
        setCollections([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch user's collections (excluding those in trash)
  const fetchCollections = async (userId) => {
    setFetchError(null); // Clear any previous errors
    try {
      const collectionsRef = collection(db, 'albums');
      // First try with the isDeleted filter
      let q = query(
        collectionsRef, 
        where('userId', '==', userId),
        where('isDeleted', '!=', true)
      );
      
      let snapshot;
      try {
        snapshot = await getDocs(q);
      } catch (filterError) {
        console.log('Filtered query failed, trying without isDeleted filter:', filterError);
        // If the isDeleted filter fails, try without it
        q = query(collectionsRef, where('userId', '==', userId));
        snapshot = await getDocs(q);
      }
      
      const collectionsData = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(collection => 
          // Only filter out if explicitly marked as deleted
          collection.isDeleted !== true && 
          collection.status !== 'trash' && 
          collection.status !== 'deleted'
        );
      
      console.log('Fetched collections:', collectionsData.length);
      setCollections(collectionsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching collections:', error);
      setFetchError(error.message);
      // Try a fallback query without any filters
      try {
        console.log('Trying fallback query...');
        const collectionsRef = collection(db, 'albums');
        const q = query(collectionsRef, where('userId', '==', userId));
        const snapshot = await getDocs(q);
        const collectionsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log('Fallback query successful, found:', collectionsData.length, 'collections');
        setCollections(collectionsData);
        setFetchError(null); // Clear error if fallback succeeds
      } catch (fallbackError) {
        console.error('Fallback query also failed:', fallbackError);
        setCollections([]);
        setFetchError(fallbackError.message);
      }
      setLoading(false);
    }
  };

  // Add to general links
  const addToGeneralLinks = async () => {
    if (!sharedContent || !currentUser) return;

    setProcessing(true);
    try {
      const linkData = {
        url: sharedContent.url,
        title: sharedContent.title || 'Shared Link',
        userId: currentUser.uid,
        createdAt: new Date().toISOString(),
        platform: detectPlatform(sharedContent.url),
        description: sharedContent.description || '',
        originalApp: sharedContent.sourceApp || 'Unknown'
      };

      await addDoc(collection(db, 'generalLinks'), linkData);

      showAppDialog(
        'Link Saved!',
        'The link has been added to your general links successfully.',
        [{ text: 'Go to My Links', onPress: () => navigation.navigate('MyLinks') }]
      );
    } catch (error) {
      console.error('Error adding link to general links:', error);
      showAppDialog('Error', 'Failed to add link to general links. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Process shared content and add to collection
  const addToCollection = async () => {
    if (!selectedCollection || !sharedContent) return;

    setProcessing(true);
    try {
      const docRef = doc(db, 'albums', selectedCollection.id);
      
      // Create link object with metadata
      const linkData = {
        url: sharedContent.url,
        title: sharedContent.title || 'Shared Link',
        description: sharedContent.description || '',
        platform: detectPlatform(sharedContent.url),
        sharedAt: new Date().toISOString(),
        originalApp: sharedContent.sourceApp || 'Unknown'
      };

      await updateDoc(docRef, {
        listLink: arrayUnion(linkData)
      });

      showAppDialog(
        'Link Added to Collection',
        `The link has been added to "${selectedCollection.title}" successfully.`,
        [
          { text: 'OK' },
          { text: 'View Collection', onPress: () => navigation.navigate('CollectionFormat', { collection: selectedCollection }) }
        ]
      );
    } catch (error) {
      console.error('Error adding link to collection:', error);
      showAppDialog('Error', 'Failed to add link to collection. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Handle save action - either to collection or general links
  const handleSave = async () => {
    if (selectedGeneralLinks) {
      await addToGeneralLinks();
    } else if (selectedCollection) {
      await addToCollection();
    }
  };

  // Filter collections based on search query
  const filteredCollections = collections.filter(collection => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      collection.title.toLowerCase().includes(query) ||
      (collection.description && collection.description.toLowerCase().includes(query))
    );
  });

  // Detect social media platform from URL
  const detectPlatform = (url) => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('instagram.com')) return 'Instagram';
    if (lowerUrl.includes('facebook.com')) return 'Facebook';
    if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return 'X (Twitter)';
    if (lowerUrl.includes('youtube.com')) return 'YouTube';
    if (lowerUrl.includes('tiktok.com')) return 'TikTok';
    if (lowerUrl.includes('reddit.com')) return 'Reddit';
    if (lowerUrl.includes('snapchat.com')) return 'Snapchat';
    if (lowerUrl.includes('linkedin.com')) return 'LinkedIn';
    if (lowerUrl.includes('pinterest.com')) return 'Pinterest';
    return 'Other';
  };

  // Get platform icon
  const getPlatformIcon = (platform) => {
    switch (platform) {
      case 'Instagram': return 'camera-alt';
      case 'Facebook': return 'facebook';
      case 'X (Twitter)': return 'flutter-dash';
      case 'YouTube': return 'play-circle-outline';
      case 'TikTok': return 'music-note';
      case 'Reddit': return 'forum';
      case 'Snapchat': return 'camera';
      case 'LinkedIn': return 'business';
      case 'Pinterest': return 'photo';
      default: return 'link';
    }
  };

  // Get platform color
  const getPlatformColor = (platform) => {
    switch (platform) {
      case 'Instagram': return '#E4405F';
      case 'Facebook': return '#1877F2';
      case 'X (Twitter)': return '#000000';
      case 'YouTube': return '#FF0000';
      case 'TikTok': return '#000000';
      case 'Reddit': return '#FF4500';
      case 'Snapchat': return '#FFFC00';
      case 'LinkedIn': return '#0A66C2';
      case 'Pinterest': return '#BD081C';
      default: return '#4A90E2';
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: getBackgroundColor() }]}>
        <View style={styles.loadingContainer}>
          <MaterialIcons name="hourglass-empty" size={50} color="#4A90E2" />
          <Text style={[styles.loadingText, { color: isDarkMode ? '#cccccc' : '#666' }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!currentUser) {
    return (
      <View style={[styles.container, { backgroundColor: getBackgroundColor() }]}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error" size={50} color="#FF4444" />
          <Text style={[styles.errorText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Please log in to use this feature</Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => navigation.navigate('LogIn')}
          >
            <Text style={styles.loginButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!sharedContent) {
    return (
      <View style={[styles.container, { backgroundColor: getBackgroundColor() }]}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="share" size={50} color="#4A90E2" />
          <Text style={[styles.errorText, { color: isDarkMode ? '#ffffff' : '#333' }]}>No content to share</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (collections.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: getBackgroundColor() }]}>
        <View style={styles.noCollectionsContainer}>
          <MaterialIcons name="collections" size={80} color="#4A90E2" />
          <Text style={[styles.noCollectionsTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
            No Collections Found
          </Text>
          <Text style={[styles.noCollectionsText, { color: isDarkMode ? '#cccccc' : '#666' }]}>
            You need to create a collection first before you can save shared links.
          </Text>
          <TouchableOpacity 
            style={styles.createCollectionButton}
            onPress={() => navigation.navigate('Collections')}
          >
            <MaterialIcons name="add" size={24} color="white" />
            <Text style={styles.createCollectionButtonText}>Create Your First Collection</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const platform = detectPlatform(sharedContent.url);
  const platformIcon = getPlatformIcon(platform);
  const platformColor = getPlatformColor(platform);

  return (
    <View style={[styles.container, { backgroundColor: getBackgroundColor() }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={isDarkMode ? '#ffffff' : '#333'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
          Save to Collection
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Shared Content Preview */}
      <View style={[styles.contentPreview, { 
        backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
      }]}>
        {loadingPreview ? (
          <View style={styles.previewLoading}>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={[styles.loadingText, { color: isDarkMode ? '#cccccc' : '#666' }]}>
              Loading preview...
            </Text>
          </View>
        ) : linkPreview ? (
          <View style={styles.previewContent}>
            {/* Left side - Image and Platform */}
            <View style={styles.previewLeft}>
              {/* Preview Image */}
              {linkPreview.image && (
                <Image 
                  source={{ uri: linkPreview.image }} 
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              )}
              
              {/* Platform Icon */}
              <View style={[styles.platformIcon, { backgroundColor: platformColor }]}>
                <MaterialIcons name={platformIcon} size={20} color="white" />
              </View>
            </View>
            
            {/* Right side - Content */}
            <View style={styles.previewRight}>
              <Text style={[styles.platformName, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                {linkPreview.siteName}
              </Text>
              
              {linkPreview.title && (
                <Text style={[styles.contentTitle, { color: isDarkMode ? '#ffffff' : '#333' }]} numberOfLines={2}>
                  {linkPreview.title}
                </Text>
              )}
              
              <Text style={[styles.platformUrl, { color: isDarkMode ? '#cccccc' : '#666' }]} numberOfLines={1}>
                {linkPreview.url}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.previewError}>
            <MaterialIcons name="error" size={24} color="#FF4444" />
            <Text style={[styles.errorText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
              Unable to load preview
            </Text>
          </View>
        )}
      </View>

      {/* Collection Selection */}
      <View style={styles.selectionSection}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
          Choose Destination
        </Text>
        <Text style={[styles.sectionSubtitle, { color: isDarkMode ? '#cccccc' : '#666' }]}>
          Select where you want to save this link
        </Text>
        
        {/* Search Bar */}
        <View style={[styles.searchContainer, { 
          backgroundColor: isDarkMode ? '#1a1a1a' : '#f8f9fa',
          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        }]}>
          <MaterialIcons name="search" size={20} color={isDarkMode ? '#cccccc' : '#666'} />
          <TextInput
            style={[styles.searchInput, { color: isDarkMode ? '#ffffff' : '#333' }]}
            placeholder="Search collections..."
            placeholderTextColor={isDarkMode ? '#999' : '#666'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="close" size={20} color={isDarkMode ? '#cccccc' : '#666'} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView style={styles.collectionsList} showsVerticalScrollIndicator={false}>
        {/* General Links Option */}
        <TouchableOpacity
          style={[
            styles.collectionItem,
            { 
              backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
              borderColor: selectedGeneralLinks ? '#4A90E2' : (isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
              borderWidth: selectedGeneralLinks ? 2 : 1
            }
          ]}
          onPress={() => {
            setSelectedGeneralLinks(true);
            setSelectedCollection(null);
          }}
        >
          <View style={[styles.generalLinksIcon, { backgroundColor: '#4A90E2' }]}>
            <MaterialIcons name="link" size={24} color="white" />
          </View>
          <View style={styles.collectionInfo}>
            <Text style={[styles.collectionTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
              General Links
            </Text>
            <Text style={[styles.collectionCount, { color: isDarkMode ? '#cccccc' : '#666' }]}>
              Links that don't belong to any collection yet
            </Text>
          </View>
          {selectedGeneralLinks && (
            <View style={styles.selectedIndicator}>
              <MaterialIcons name="check-circle" size={24} color="#4A90E2" />
            </View>
          )}
        </TouchableOpacity>

        {/* Error Message */}
        {fetchError && (
          <View style={styles.errorContainer}>
            <MaterialIcons name="error" size={24} color="#FF4444" />
            <Text style={[styles.errorText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
              Error loading collections: {fetchError}
            </Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => currentUser && fetchCollections(currentUser.uid)}
            >
              <MaterialIcons name="refresh" size={20} color="#4A90E2" />
              <Text style={[styles.retryText, { color: '#4A90E2' }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Collections */}
        {filteredCollections.map((collection) => (
          <TouchableOpacity
            key={collection.id}
            style={[
              styles.collectionItem,
              { 
                backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
                borderColor: selectedCollection?.id === collection.id ? '#4A90E2' : (isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                borderWidth: selectedCollection?.id === collection.id ? 2 : 1
              }
            ]}
            onPress={() => {
              setSelectedCollection(collection);
              setSelectedGeneralLinks(false);
            }}
          >
            <Image 
              source={{ uri: collection.imageLink }} 
              style={styles.collectionThumbnail}
              resizeMode="cover"
            />
            <View style={styles.collectionInfo}>
              <Text style={[styles.collectionTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                {collection.title}
              </Text>
              <Text style={[styles.collectionCount, { color: isDarkMode ? '#cccccc' : '#666' }]}>
                {collection.listLink ? collection.listLink.length : 0} links
              </Text>
            </View>
            {selectedCollection?.id === collection.id && (
              <View style={styles.selectedIndicator}>
                <MaterialIcons name="check-circle" size={24} color="#4A90E2" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Action Button */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[
            styles.saveButton,
            (!selectedCollection && !selectedGeneralLinks || processing) && styles.saveButtonDisabled
          ]}
          onPress={handleSave}
          disabled={(!selectedCollection && !selectedGeneralLinks) || processing}
        >
          {processing ? (
            <MaterialIcons name="hourglass-empty" size={24} color="white" />
          ) : (
            <MaterialIcons name="save" size={24} color="white" />
          )}
          <Text style={styles.saveButtonText}>
            {processing ? 'Saving...' : (selectedGeneralLinks ? 'Save to General Links' : 'Save to Collection')}
          </Text>
        </TouchableOpacity>
      </View>
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
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  contentPreview: {
    margin: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    maxHeight: 180,
  },
  previewContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  previewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  previewRight: {
    flex: 1,
    justifyContent: 'center',
  },
  platformInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  platformIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  platformDetails: {
    flex: 1,
  },
  platformName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  platformUrl: {
    fontSize: 12,
    opacity: 0.8,
  },
  contentTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 18,
  },
  contentDescription: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.8,
  },
  selectionSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    opacity: 0.8,
  },
  collectionsList: {
    flex: 1,
    paddingHorizontal: 20,
    maxHeight: '40%',
    minHeight: 200,
  },
  collectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  collectionThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 16,
  },
  generalLinksIcon: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  collectionInfo: {
    flex: 1,
  },
  collectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  collectionCount: {
    fontSize: 14,
    opacity: 0.8,
  },
  selectedIndicator: {
    marginLeft: 16,
  },
  actionContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90E2',
    padding: 18,
    borderRadius: 28,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  noCollectionsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noCollectionsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  noCollectionsText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    opacity: 0.8,
  },
  createCollectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 28,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  createCollectionButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  previewImage: {
    width: 80,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  previewLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  previewError: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
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
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE6E6',
    padding: 16,
    borderRadius: 12,
    margin: 16,
    borderWidth: 1,
    borderColor: '#FF4444',
  },
  errorText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#FF4444',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F3FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  retryText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
  },
});
