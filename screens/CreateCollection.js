import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, Animated, ActivityIndicator, Platform, StatusBar, KeyboardAvoidingView, ScrollView, Dimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { doc, collection, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../services/firebase/Config.js';
import { uploadImageAsync } from '../services/cloudinary/imageUpload.js';
import { useTheme } from '../ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ToastMessage from '../components/ToastMessage';

const { width } = Dimensions.get('window');

// Store form data outside component to persist across navigations
const persistentFormData = {
  collectionName: '',
  frame2Text: '',
  selectedImage: null,
  selectedLinks: [],  // Store selected links to persist across navigations
  isActive: false  // Track if form is being actively used
};

function CreateCollection() {
  const navigation = useNavigation();
  const route = useRoute();
  
  // Check if we should restore from persistent storage or start fresh
  // Restore if active (user was on this screen and navigated away)
  const shouldRestore = persistentFormData.isActive && 
                        (persistentFormData.collectionName || persistentFormData.frame2Text || persistentFormData.selectedImage || persistentFormData.selectedLinks.length > 0);
  
  // Initialize from persistent storage only if there's active data
  const [collectionName, setCollectionName] = useState(shouldRestore ? persistentFormData.collectionName : '');
  const [frame2Text, setFrame2Text] = useState(shouldRestore ? persistentFormData.frame2Text : '');
  const [selectedImage, setSelectedImage] = useState(shouldRestore ? persistentFormData.selectedImage : null);
  const [selectedLinks, setSelectedLinks] = useState(shouldRestore ? persistentFormData.selectedLinks : []);
  const [currentUser, setCurrentUser] = useState(null);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Toast message state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVariant, setToastVariant] = useState('error');
  const toastTimerRef = useRef(null);

  const { isDarkMode, getBackgroundColor } = useTheme();

  // Toast message helper
  const showToastMessage = (message, variant = 'error', duration = 3000) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    
    setToastMessage(message);
    setToastVariant(variant);
    setShowToast(true);
    
    toastTimerRef.current = setTimeout(() => {
      setShowToast(false);
      toastTimerRef.current = null;
      setTimeout(() => setToastMessage(''), 200);
    }, duration);
  };

  // Cleanup toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Mark as active when component mounts
  useEffect(() => {
    persistentFormData.isActive = true;
    return () => {
      // Don't clear on unmount, keep the data for potential return
    };
  }, []);

  // Sync state changes to persistent storage
  useEffect(() => {
    persistentFormData.collectionName = collectionName;
    persistentFormData.frame2Text = frame2Text;
    persistentFormData.selectedImage = selectedImage;
    persistentFormData.selectedLinks = selectedLinks;
  }, [collectionName, frame2Text, selectedImage, selectedLinks]);

  // Update selected links when returning from SelectLinksScreen
  useEffect(() => {
    if (route.params?.newSelectedLinks) {
      console.log('Updating selected links from params:', route.params.newSelectedLinks);
      // Update both state and persistent storage
      persistentFormData.selectedLinks = route.params.newSelectedLinks;
      setSelectedLinks(route.params.newSelectedLinks);
      // Clear the param to avoid re-applying
      navigation.setParams({ newSelectedLinks: undefined });
    }
  }, [route.params?.newSelectedLinks]);

  // Update theme image when returning from SelectThemeImageScreen
  useEffect(() => {
    if (route.params?.selectedThemeImage) {
      console.log('Updating theme image from params:', route.params.selectedThemeImage);
      // Update both state and persistent storage
      persistentFormData.selectedImage = route.params.selectedThemeImage;
      setSelectedImage(route.params.selectedThemeImage);
      // Clear the param to avoid re-applying
      navigation.setParams({ selectedThemeImage: undefined });
    }
  }, [route.params?.selectedThemeImage]);


  // Get current user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Pulse animation for loading text
  useEffect(() => {
    if (isCreatingCollection) {
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
  }, [isCreatingCollection]);

  // בחירת תמונה מהגלריה
  const chooseImage = async () => {
    try {
      console.log('=== IMAGE PICKER DEBUG ===');
      console.log('Requesting media library permissions...');
      
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('Permission result:', permissionResult);
      
      if (!permissionResult.granted) {
        showToastMessage('Permission to access camera roll is required!');
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
        console.log('Selected image URI:', result.assets[0].uri);
        
        setSelectedImage(result.assets[0].uri);
        
        console.log('Image state updated successfully');
      } else {
        console.log('Image selection was cancelled');
      }
    } catch (error) {
      console.error('=== IMAGE PICKER ERROR ===');
      console.error('Error in chooseImage:', error);
      
      let errorMessage = 'Error selecting image. Please try again.';
      
      if (error.message.includes('Permission')) {
        errorMessage = 'Camera roll permission denied. Please enable it in settings.';
      } else if (error.message.includes('Network')) {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      showToastMessage(errorMessage);
    }
  };

  // Open SelectLinksScreen to choose links from MyLinks  
  const openSelectLinks = () => {
    navigation.navigate('SelectLinksScreen', {
      currentSelectedLinks: selectedLinks
    });
  };

  // Open SelectThemeImageScreen to choose theme image from MyLinks
  const openSelectThemeImage = () => {
    navigation.navigate('SelectThemeImageScreen');
  };

  // Clear all form data
  const clearAll = () => {
    // Clear state
    setCollectionName('');
    setFrame2Text('');
    setSelectedImage(null);
    setSelectedLinks([]);
    
    // Clear persistent form data
    persistentFormData.collectionName = '';
    persistentFormData.frame2Text = '';
    persistentFormData.selectedImage = null;
    persistentFormData.selectedLinks = [];
    persistentFormData.isActive = false;
  };

  // יצירת אוסף חדש בדאטהבייס
  const createCollection = async () => {
    if (!currentUser) {
      showToastMessage('Please log in to create a collection');
      return;
    }

    if (!collectionName || !selectedImage) {
      showToastMessage('Please select a theme image and enter a collection name');
      return;
    }

    // Set loading state
    setIsCreatingCollection(true);

    try {
      // בדיקת אתחול Firebase
      if (!db) {
        throw new Error('Firebase is not properly initialized');
      }

      console.log('Starting collection creation...');
      console.log('Collection data:', {
        title: collectionName,
        description: frame2Text,
        imageLink: selectedImage,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userName: currentUser.displayName || currentUser.email.split('@')[0]
      });

      // Upload image to Cloudinary first
      console.log('Uploading image to Cloudinary...');
      const imageLink = await uploadImageAsync(selectedImage);
      console.log('Image uploaded successfully:', imageLink);

      // Convert selected links to the format expected by collections
      const linkData = selectedLinks.map(link => ({
        url: link.url,
        title: link.title,
        createdAt: link.createdAt,
        platform: link.platform
      }));

      // יצירת מסמך חדש עם מזהה ספציפי
      const newDocRef = doc(collection(db, 'albums'));
      await setDoc(newDocRef, {
        title: collectionName,
        description: frame2Text,
        imageLink,
        listLink: linkData,
        createdAt: new Date().toISOString(),
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userName: currentUser.displayName || currentUser.email.split('@')[0]
      });

      console.log('Document created with ID:', newDocRef.id);

      // Add image to cache immediately for instant display
      try {
        const imageCacheKey = `collections_image_cache_${currentUser.uid}`;
        const cached = await AsyncStorage.getItem(imageCacheKey);
        const imageCache = cached ? JSON.parse(cached) : {};
        imageCache[newDocRef.id] = imageLink;
        await AsyncStorage.setItem(imageCacheKey, JSON.stringify(imageCache));
        console.log('✅ Added new collection image to cache:', newDocRef.id);
      } catch (error) {
        console.error('Error adding image to cache:', error);
      }

      // Clear state immediately
      setCollectionName('');
      setFrame2Text('');
      setSelectedImage(null);
      setSelectedLinks([]);
      
      // Clear persistent form data
      persistentFormData.collectionName = '';
      persistentFormData.frame2Text = '';
      persistentFormData.selectedImage = null;
      persistentFormData.selectedLinks = [];
      persistentFormData.isActive = false;

      // Navigate back to Collections screen
      navigation.navigate('Collections');
      
    } catch (error) {
      console.error('=== COLLECTION CREATION ERROR ===');
      console.error('Detailed error creating collection:', {
        error: error.message,
        code: error.code,
        stack: error.stack,
        uri: selectedImage,
      });
      
      let errorMessage = 'Failed to create collection';
      
      if (error.message.includes('Upload failed') || error.message.includes('Failed to upload image')) {
        errorMessage = 'Failed to upload image. Please check your internet connection or try a different image.';
      } else if (error.message.includes('Network')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.message.includes('Firebase is not properly initialized')) {
        errorMessage = 'App initialization error. Please restart the app and try again.';
      } else if (error.message.includes('permission-denied')) {
        errorMessage = 'Permission denied. You may not have access to create collections.';
      }
      
      showToastMessage(errorMessage, 'error', 4000);
    } finally {
      // Reset loading state
      setIsCreatingCollection(false);
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

      {/* Header */}
      <View style={[styles.header, { 
        backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
        borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
      }]}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('Collections')}
          style={[styles.backButton, { 
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' 
          }]}
          disabled={isCreatingCollection}
        >
          <MaterialIcons name="arrow-back" size={24} color={isDarkMode ? '#ffffff' : '#333'} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
          Create New Collection
        </Text>

        <TouchableOpacity 
          onPress={clearAll}
          style={[styles.clearButton, { 
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' 
          }]}
          disabled={isCreatingCollection}
        >
          <MaterialIcons name="delete-outline" size={24} color={isDarkMode ? '#ffffff' : '#333'} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
      <View style={styles.content}>
        {/* Welcome Section */}
        <View style={[styles.welcomeSection, { 
          backgroundColor: isDarkMode ? 'rgba(74, 144, 226, 0.15)' : 'rgba(74, 144, 226, 0.08)',
        }]}>
          <MaterialIcons name="auto-awesome" size={28} color="#4A90E2" />
          <View style={styles.welcomeTextContainer}>
            <Text style={[styles.welcomeTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
              Create Your Collection
            </Text>
            <Text style={[styles.welcomeSubtitle, { color: isDarkMode ? '#b0b0b0' : '#666' }]}>
              Organize your favorite links into a beautiful collection
            </Text>
          </View>
        </View>

        {/* Step 1: Theme Image */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={[styles.stepBadge, { backgroundColor: '#4A90E2' }]}>
              <Text style={styles.stepBadgeText}>1</Text>
            </View>
            <View style={styles.sectionHeaderTextContainer}>
              <Text style={[styles.sectionTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                Choose a Theme Image
              </Text>
              <Text style={[styles.sectionSubtitle, { color: isDarkMode ? '#b0b0b0' : '#666' }]}>
                This will be the cover of your collection
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.imagePickerButton, { 
              backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
              borderColor: selectedImage ? '#4A90E2' : (isDarkMode ? '#404040' : '#e0e0e0'),
              opacity: isCreatingCollection ? 0.5 : 1,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isDarkMode ? 0.3 : 0.1,
              shadowRadius: 8,
              elevation: 5,
            }]}
            onPress={chooseImage}
            disabled={isCreatingCollection}
          >
            {selectedImage ? (
              <>
                <Image
                  source={{ uri: selectedImage }}
                  style={styles.selectedImage}
                  resizeMode="cover"
                />
                <View style={styles.imageOverlay}>
                  <View style={styles.changeImageButton}>
                    <MaterialIcons name="edit" size={20} color="white" />
                    <Text style={styles.changeImageText}>Change Image</Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.placeholderContainer}>
                <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? '#3a3a3a' : '#f0f8ff' }]}>
                  <MaterialIcons name="add-photo-alternate" size={40} color="#4A90E2" />
                </View>
                <Text style={[styles.placeholderText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                  Tap to Select Image
                </Text>
                <Text style={[styles.placeholderSubtext, { color: isDarkMode ? '#999' : '#999' }]}>
                  Choose from your gallery
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Choose from MyLinks Button */}
          <TouchableOpacity
            style={[styles.chooseFromMyLinksButton, { 
              backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
              borderColor: isDarkMode ? '#404040' : '#e0e0e0',
              opacity: isCreatingCollection ? 0.5 : 1,
            }]}
            onPress={openSelectThemeImage}
            disabled={isCreatingCollection}
          >
            <View style={[styles.alternativeIconContainer, { backgroundColor: isDarkMode ? '#3a3a3a' : '#f0f8ff' }]}>
              <MaterialIcons name="collections-bookmark" size={20} color="#4A90E2" />
            </View>
            <Text style={[styles.chooseFromMyLinksText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
              Or choose from My Links
            </Text>
            <MaterialIcons name="chevron-right" size={20} color={isDarkMode ? '#666' : '#999'} />
          </TouchableOpacity>
        </View>

        {/* Step 2: Collection Details */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={[styles.stepBadge, { backgroundColor: '#5FB3F6' }]}>
              <Text style={styles.stepBadgeText}>2</Text>
            </View>
            <View style={styles.sectionHeaderTextContainer}>
              <Text style={[styles.sectionTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                Collection Details
              </Text>
              <Text style={[styles.sectionSubtitle, { color: isDarkMode ? '#b0b0b0' : '#666' }]}>
                Give your collection a name and description
              </Text>
            </View>
          </View>

          {/* Collection Name Input */}
          <View style={[styles.inputCard, { 
            backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
            borderColor: collectionName ? '#4A90E2' : (isDarkMode ? '#404040' : '#e0e0e0'),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDarkMode ? 0.3 : 0.05,
            shadowRadius: 4,
            elevation: 2,
          }]}>
            <View style={[styles.inputIconContainer, { backgroundColor: isDarkMode ? '#3a3a3a' : '#f0f8ff' }]}>
              <MaterialIcons name="collections" size={20} color="#4A90E2" />
            </View>
            <View style={styles.inputWrapper}>
              <Text style={[styles.inputLabel, { color: isDarkMode ? '#b0b0b0' : '#666' }]}>
                Collection Name *
              </Text>
              <TextInput
                style={[styles.input, { color: isDarkMode ? '#ffffff' : '#333' }]}
                placeholder="e.g., My Favorite Recipes"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={collectionName}
                onChangeText={setCollectionName}
                editable={!isCreatingCollection}
                maxLength={100}
              />
            </View>
            <Text style={[styles.characterCount, { color: isDarkMode ? '#666' : '#999' }]}>
              {collectionName.length}/100
            </Text>
          </View>

          {/* Description Input */}
          <View style={[styles.inputCard, styles.textAreaCard, { 
            backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
            borderColor: frame2Text ? '#4A90E2' : (isDarkMode ? '#404040' : '#e0e0e0'),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDarkMode ? 0.3 : 0.05,
            shadowRadius: 4,
            elevation: 2,
          }]}>
            <View style={[styles.inputIconContainer, { backgroundColor: isDarkMode ? '#3a3a3a' : '#f0f8ff' }]}>
              <MaterialIcons name="description" size={20} color="#4A90E2" />
            </View>
            <View style={styles.inputWrapper}>
              <Text style={[styles.inputLabel, { color: isDarkMode ? '#b0b0b0' : '#666' }]}>
                Description (Optional)
              </Text>
              <TextInput
                style={[styles.input, styles.textAreaInput, { color: isDarkMode ? '#ffffff' : '#333' }]}
                placeholder="Add more detailed information..."
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={frame2Text}
                onChangeText={setFrame2Text}
                multiline
                editable={!isCreatingCollection}
                maxLength={1000}
                textAlignVertical="top"
              />
            </View>
            <Text style={[styles.characterCount, { color: isDarkMode ? '#666' : '#999' }]}>
              {frame2Text.length}/1000
            </Text>
          </View>
        </View>

        {/* Step 3: Add Links */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={[styles.stepBadge, { backgroundColor: '#74C0FC' }]}>
              <Text style={styles.stepBadgeText}>3</Text>
            </View>
            <View style={styles.sectionHeaderTextContainer}>
              <Text style={[styles.sectionTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                Add Your Links
              </Text>
              <Text style={[styles.sectionSubtitle, { color: isDarkMode ? '#b0b0b0' : '#666' }]}>
                Select links from your saved collection
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.addLinksCard, { 
              backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
              borderColor: selectedLinks.length > 0 ? '#4A90E2' : (isDarkMode ? '#404040' : '#e0e0e0'),
              opacity: isCreatingCollection ? 0.5 : 1,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isDarkMode ? 0.3 : 0.05,
              shadowRadius: 4,
              elevation: 2,
            }]}
            onPress={openSelectLinks}
            disabled={isCreatingCollection}
          >
            <View style={[styles.addLinksIconContainer, { 
              backgroundColor: selectedLinks.length > 0 
                ? 'rgba(74, 144, 226, 0.15)' 
                : (isDarkMode ? '#3a3a3a' : '#f0f8ff')
            }]}>
              <MaterialIcons 
                name={selectedLinks.length > 0 ? "check-circle" : "add-circle-outline"} 
                size={28} 
                color="#4A90E2" 
              />
            </View>
            <View style={styles.addLinksTextContainer}>
              <Text style={[styles.addLinksText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                {selectedLinks.length > 0 ? 'Links Added' : 'Select Links'}
              </Text>
              {selectedLinks.length > 0 ? (
                <Text style={[styles.selectedLinksCount, { color: '#4A90E2' }]}>
                  {selectedLinks.length} link{selectedLinks.length !== 1 ? 's' : ''} ready to add
                </Text>
              ) : (
                <Text style={[styles.addLinksSubtext, { color: isDarkMode ? '#999' : '#666' }]}>
                  Tap to browse your links
                </Text>
              )}
            </View>
            <MaterialIcons name="chevron-right" size={24} color={isDarkMode ? '#666' : '#999'} />
          </TouchableOpacity>
        </View>

        {/* Create Button */}
        <View style={styles.createButtonContainer}>
          <TouchableOpacity 
            style={[
              styles.createButton, 
              isCreatingCollection && styles.createButtonDisabled,
              {
                shadowColor: '#4A90E2',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
              }
            ]}
            onPress={createCollection}
            disabled={isCreatingCollection}
          >
            {isCreatingCollection ? (
              <>
                <ActivityIndicator size="small" color="white" style={{ marginRight: 10 }} />
                <Animated.Text style={[styles.createButtonText, { opacity: pulseAnim }]}>
                  Creating Your Collection...
                </Animated.Text>
              </>
            ) : (
              <>
                <MaterialIcons name="rocket-launch" size={24} color="white" />
                <Text style={styles.createButtonText}>Create Collection</Text>
              </>
            )}
          </TouchableOpacity>
          
          {/* Helper Text */}
          <View style={styles.helperTextContainer}>
            <MaterialIcons name="info-outline" size={16} color={isDarkMode ? '#666' : '#999'} />
            <Text style={[styles.helperText, { color: isDarkMode ? '#666' : '#999' }]}>
              Required: Theme image and collection name
            </Text>
          </View>
        </View>
      </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Toast Message */}
      <ToastMessage
        visible={showToast}
        message={toastMessage}
        variant={toastVariant}
        topOffset={Platform.OS === 'ios' ? 70 : 50}
      />
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
    paddingHorizontal: 20,
    paddingVertical: 16,
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  clearButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  
  // Welcome Section
  welcomeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  welcomeTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Section Containers
  sectionContainer: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepBadgeText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHeaderTextContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },

  // Image Picker
  imagePickerButton: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderStyle: 'solid',
  },
  selectedImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    opacity: 0,
  },
  changeImageText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  placeholderSubtext: {
    fontSize: 13,
  },

  // Alternative Options
  chooseFromMyLinksButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  alternativeIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chooseFromMyLinksText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },

  // Input Cards
  inputCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
    borderWidth: 2,
  },
  textAreaCard: {
    alignItems: 'flex-start',
  },
  inputIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 4,
  },
  inputWrapper: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    fontSize: 16,
    paddingVertical: 0,
    paddingRight: 60,
  },
  textAreaInput: {
    minHeight: 60,
    textAlignVertical: 'top',
    paddingRight: 60,
    paddingBottom: 20,
  },
  characterCount: {
    fontSize: 11,
    position: 'absolute',
    right: 16,
    bottom: 12,
    fontWeight: '500',
  },

  // Add Links Card
  addLinksCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
  },
  addLinksIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  addLinksTextContainer: {
    flex: 1,
  },
  addLinksText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  selectedLinksCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  addLinksSubtext: {
    fontSize: 13,
  },

  // Create Button
  createButtonContainer: {
    marginTop: 8,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90E2',
    borderRadius: 16,
    padding: 18,
    width: '100%',
  },
  createButtonDisabled: {
    backgroundColor: '#9E9E9E',
    opacity: 0.7,
  },
  createButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 10,
  },
  helperTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  helperText: {
    fontSize: 12,
    marginLeft: 6,
  },
});

// Export with React.memo to preserve form state across navigations
export default React.memo(CreateCollection);