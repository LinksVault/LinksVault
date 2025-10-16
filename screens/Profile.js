import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch, StatusBar, Platform, Modal, FlatList } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import { auth, db } from '../services/firebase/Config.js';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import Footer from '../components/Footer';

export default function Profile() {
  const navigation = useNavigation();
  const { isDarkMode, toggleTheme } = useTheme();
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const scrollViewRef = useRef(null);

  // Function to open modal
  const openLegalModal = () => {
    setLegalModalVisible(true);
  };

  // Function to close modal
  const closeLegalModal = () => {
    setLegalModalVisible(false);
  };

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
    setCurrentUser(auth.currentUser);
  }, []);

  // Fetch additional user data from Firestore
  useEffect(() => {
    if (!currentUser?.uid) return;
    
    const fetchUserData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserData(userData);
        } else {
          // User document doesn't exist, create it
          try {
            await setDoc(doc(db, 'users', currentUser.uid), {
              createdAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString()
            });
          } catch (error) {
            console.error('Error creating user document:', error);
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, [currentUser?.uid]);

  // Helper function for cross-platform alerts
  const showAlert = (title, message, buttons = [{ text: 'OK' }]) => {
    if (Platform.OS === 'web') {
      if (buttons.length === 1) {
        window.alert(`${title}: ${message}`);
      } else {
        // For confirmations, use confirm dialog
        const confirmed = window.confirm(message);
        if (confirmed && buttons.length > 1) {
          // Find the non-cancel button and execute its onPress
          const confirmButton = buttons.find(btn => btn.text !== 'Cancel');
          if (confirmButton && confirmButton.onPress) {
            confirmButton.onPress();
          }
        }
      }
    } else {
      Alert.alert(title, message, buttons);
    }
  };

  const handleSignOut = async () => {
    showAlert(
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
          onPress: async () => {
            try {
              await signOut(auth);
              // Don't navigate manually - let the auth state change handle navigation
              // The App.js will automatically redirect to Welcome screen when user becomes null
            } catch (error) {
              console.error('Error signing out:', error);
              showAlert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    showAlert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            showAlert(
              'Confirm Deletion',
              'Are you absolutely sure? This action cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Yes, Delete My Account', 
                  style: 'destructive',
                  onPress: () => {
                    showAlert('Feature Coming Soon', 'Account deletion will be available in a future update.');
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };


  const ProfileSection = ({ title, children, icon, iconColor }) => (
    <View style={styles.modernSection}>
      <View style={styles.modernSectionHeader}>
        <View style={[styles.modernSectionIcon, { backgroundColor: iconColor + '15' }]}>
          <MaterialIcons name={icon} size={22} color={iconColor} />
        </View>
        <Text style={[styles.modernSectionTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );

  const ProfileItem = ({ icon, title, subtitle, onPress, rightComponent, showArrow = true, iconColor = '#4A90E2' }) => (
    <TouchableOpacity 
      style={[styles.modernProfileItem, { 
        backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'
      }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
    >
      <View style={styles.modernProfileItemLeft}>
        <View style={[styles.modernIconContainer, { backgroundColor: iconColor + '15' }]}>
          <MaterialIcons name={icon} size={26} color={iconColor} />
        </View>
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
            size={24} 
            color={isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(26, 26, 26, 0.3)'} 
          />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0a0a0a' : '#f8fafc' }]}>
      {/* Modern Status Bar */}
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="transparent"
        translucent={true}
      />
      
      {/* Modern Gradient Header */}
      <View style={styles.headerContainer}>
        <View style={[styles.header, { 
          backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
        }]}>
          {/* Header Background Pattern */}
          <View style={styles.headerBackground}>
            <View style={[styles.headerCircle1, { backgroundColor: isDarkMode ? '#4A90E2' : '#4A90E2' }]} />
            <View style={[styles.headerCircle2, { backgroundColor: isDarkMode ? '#6C5CE7' : '#6C5CE7' }]} />
            <View style={[styles.headerCircle3, { backgroundColor: isDarkMode ? '#00B894' : '#00B894' }]} />
          </View>
          
          {/* Header Content */}
          <View style={styles.headerContent}>
            <Text style={[styles.headerTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
              Profile & Settings
            </Text>
            <Text style={[styles.headerSubtitle, { color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(26, 26, 26, 0.7)' }]}>
              Manage your account and preferences
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Modern User Info Section */}
        <ProfileSection title="Account" icon="account-circle" iconColor="#4A90E2">
          <View style={[styles.modernUserCard, { 
            backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'
          }]}>
            <View style={styles.modernUserInfo}>
              <View style={[styles.modernAvatar, { 
                backgroundColor: isDarkMode ? '#4A90E2' : '#4A90E2',
                shadowColor: isDarkMode ? '#4A90E2' : '#4A90E2',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: isDarkMode ? 0.4 : 0.3,
                shadowRadius: 16,
                elevation: 12,
              }]}>
                <MaterialIcons name="person" size={48} color="white" />
              </View>
              <View style={styles.modernUserDetails}>
                <Text style={[styles.modernUserName, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  {(currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User').split(' ')[0]}
                </Text>
                <Text style={[styles.modernUserEmail, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                  {currentUser?.email || 'No email'}
                </Text>
                <View style={styles.userStatus}>
                  <View style={[styles.statusDot, { backgroundColor: '#00B894' }]} />
                  <Text style={[styles.statusText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(26, 26, 26, 0.5)' }]}>
                    Active Account
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ProfileSection>

        {/* Modern Personal Information Section */}
        {userData && (
          <ProfileSection title="Personal Information" icon="person" iconColor="#4A90E2">
            <View style={[styles.modernInfoCard, { 
              backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'
            }]}>
              <View style={styles.modernPersonalInfo}>
                {userData.birthMonth && userData.birthDay && userData.birthYear && (
                  <View style={styles.modernInfoRow}>
                    <View style={[styles.modernInfoIcon, { backgroundColor: '#FF6B6B' + '15' }]}>
                      <MaterialIcons name="cake" size={22} color="#FF6B6B" />
                    </View>
                    <Text style={[styles.modernInfoText, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                      Birthday: {userData.birthMonth}/{userData.birthDay}/{userData.birthYear}
                    </Text>
                  </View>
                )}
                {userData.gender && (
                  <View style={styles.modernInfoRow}>
                    <View style={[styles.modernInfoIcon, { backgroundColor: '#4ECDC4' + '15' }]}>
                      <MaterialIcons 
                        name={userData.gender === 'male' ? 'male' : 'female'} 
                        size={22} 
                        color="#4ECDC4" 
                      />
                    </View>
                    <Text style={[styles.modernInfoText, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                      Gender: {userData.gender.charAt(0).toUpperCase() + userData.gender.slice(1)}
                    </Text>
                  </View>
                )}
                {userData.createdAt && (
                  <View style={styles.modernInfoRow}>
                    <View style={[styles.modernInfoIcon, { backgroundColor: '#45B7D1' + '15' }]}>
                      <MaterialIcons name="schedule" size={22} color="#45B7D1" />
                    </View>
                    <Text style={[styles.modernInfoText, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                      Member since: {new Date(userData.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </ProfileSection>
        )}

        {/* Preferences Section */}
        <ProfileSection title="Preferences" icon="tune" iconColor="#4A90E2">
          <ProfileItem
            icon={isDarkMode ? "light-mode" : "dark-mode"}
            title="Dark Mode"
            subtitle="Toggle between light and dark themes"
            iconColor={isDarkMode ? "#FFD93D" : "#6C5CE7"}
            rightComponent={
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                trackColor={{ false: '#E0E0E0', true: '#4A90E2' }}
                thumbColor={isDarkMode ? '#ffffff' : '#ffffff'}
                ios_backgroundColor="#E0E0E0"
                style={styles.modernSwitch}
              />
            }
            showArrow={false}
          />
          
          <ProfileItem
            icon="notifications"
            title="Notifications"
            subtitle="Receive updates about your collections"
            iconColor="#FF6B6B"
            rightComponent={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#E0E0E0', true: '#4A90E2' }}
                thumbColor={notificationsEnabled ? '#ffffff' : '#ffffff'}
                ios_backgroundColor="#E0E0E0"
                style={styles.modernSwitch}
              />
            }
            showArrow={false}
          />

        </ProfileSection>

        {/* Support Section */}
        <ProfileSection title="Support" icon="support-agent" iconColor="#4A90E2">
          <ProfileItem
            icon="help"
            title="Help & FAQ"
            subtitle="Get help and find answers"
            iconColor="#FF8E53"
            onPress={() => showAlert('Coming Soon', 'Help section will be available soon!')}
          />
          
          <ProfileItem
            icon="feedback"
            title="Send Feedback"
            subtitle="Help us improve the app"
            iconColor="#9B59B6"
            onPress={() => showAlert('Coming Soon', 'Feedback system will be available soon!')}
          />
          
          <ProfileItem
            icon="star"
            title="Rate App"
            subtitle="Rate us on the Play Store"
            iconColor="#F1C40F"
            onPress={() => showAlert('Coming Soon', 'App rating will be available soon!')}
          />
        </ProfileSection>

        {/* Account Actions Section */}
        <ProfileSection title="Account" icon="security" iconColor="#4A90E2">
          <ProfileItem
            icon="logout"
            title="Sign Out"
            subtitle="Sign out of your account"
            iconColor="#E74C3C"
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

        {/* Terms of Service & App Features Section */}
        <ProfileSection title="Terms of Service & App Features" icon="description" iconColor="#4A90E2">
          <View style={[styles.modernInfoCard, { 
            backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'
          }]}>
            <View style={styles.termsContent}>
              <View style={styles.termsSection}>
                <View style={styles.termsHeader}>
                  <MaterialIcons name="link" size={24} color="#4A90E2" />
                  <Text style={[styles.termsTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                    Link Preview System
                  </Text>
                </View>
                <Text style={[styles.termsText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(26, 26, 26, 0.7)' }]}>
                  Our preview system fetches metadata from links to enhance your browsing experience. 
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
                    • Preview quality may vary from the actual content
                  </Text>
                </View>
                <Text style={[styles.termsNote, { color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(26, 26, 26, 0.5)' }]}>
                  We continuously work to improve preview accuracy and availability for the best user experience.
                </Text>
              </View>

              <View style={styles.termsSection}>
                <View style={styles.termsHeader}>
                  <MaterialIcons name="star" size={24} color="#FFD93D" />
                  <Text style={[styles.termsTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                    Unique App Features
                  </Text>
                </View>
                <View style={styles.featureList}>
                  <View style={styles.featureItem}>
                    <MaterialIcons name="edit" size={20} color="#4A90E2" />
                    <View style={styles.featureText}>
                      <Text style={[styles.featureTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                        Custom Link Titles
                      </Text>
                      <Text style={[styles.featureDescription, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                        Edit any link title to make it more descriptive and personal. Perfect when previews aren't available!
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.featureItem}>
                    <MaterialIcons name="dashboard" size={20} color="#00B894" />
                    <View style={styles.featureText}>
                      <Text style={[styles.featureTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                        Universal Social Media Hub
                      </Text>
                      <Text style={[styles.featureDescription, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                        Organize content from ALL social platforms in one beautifully designed, personal space.
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.featureItem}>
                    <MaterialIcons name="palette" size={20} color="#6C5CE7" />
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
                    <MaterialIcons name="security" size={20} color="#E74C3C" />
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
                  <MaterialIcons name="favorite" size={24} color="#FF6B6B" />
                  <Text style={[styles.termsTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                    Why SocialVault?
                  </Text>
                </View>
                <Text style={[styles.termsText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(26, 26, 26, 0.7)' }]}>
                  SocialVault is the only app that lets you organize ALL your social media content in one 
                  beautifully designed, personal space. Unlike other apps that focus on single platforms, 
                  we bring everything together with unique features like custom link titles, multiple design 
                  themes, and a privacy-first approach.
                </Text>
                <Text style={[styles.termsText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(26, 26, 26, 0.7)' }]}>
                  Whether you're saving Instagram posts, YouTube videos, TikTok content, or any other 
                  social media links, SocialVault provides a unified, organized, and personalized experience 
                  that no other app offers.
                </Text>
              </View>
              
              {/* Legal Terms Button */}
              <TouchableOpacity
                style={[styles.legalButton, { 
                  backgroundColor: isDarkMode ? '#4A90E2' : '#4A90E2',
                  borderColor: isDarkMode ? '#4A90E2' : '#4A90E2'
                }]}
                onPress={openLegalModal}
              >
                <MaterialIcons name="gavel" size={20} color="#ffffff" />
                <Text style={styles.legalButtonText}>
                  View Full Legal Terms & Privacy Policy
                </Text>
                <MaterialIcons name="arrow-forward" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        </ProfileSection>

        {/* App Info Section */}
        <ProfileSection title="App Information" icon="info" iconColor="#4A90E2">
          <ProfileItem
            icon="info"
            title="Version"
            subtitle="1.0.0"
            iconColor="#3498DB"
            showArrow={false}
          />
          
          <ProfileItem
            icon="code"
            title="Build"
            subtitle="2024.1.0"
            iconColor="#2ECC71"
            showArrow={false}
          />
        </ProfileSection>
      </ScrollView>

      {/* Legal Terms Modal */}
      <Modal
        visible={legalModalVisible}
        transparent={true}
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={closeLegalModal}
        onShow={handleModalShow}
        key={legalModalVisible ? 'modal-open' : 'modal-closed'}
      >
        <View style={styles.legalModalOverlay}>
          <View style={[styles.legalModalContainer, { backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff' }]}>
            {/* Modal Header */}
            <View style={[styles.legalModalHeader, { borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
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

            {/* Modal Content */}
            <ScrollView 
              ref={scrollViewRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 60 }}
              showsVerticalScrollIndicator={true}
              bounces={true}
              alwaysBounceVertical={false}
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
                  <Text style={{ fontWeight: '700' }}>SocialVault is an independent application</Text> and is not affiliated with, endorsed by, or sponsored by any of the social media platforms displayed within the app, including but not limited to Instagram, Facebook, YouTube, TikTok, Twitter/X, Reddit, Snapchat, or any other platforms.
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
                <Text style={[styles.legalSubtitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  Last Updated: {new Date().toLocaleDateString()}
                </Text>
                
                <Text style={[styles.legalHeading, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  1. Information We Collect
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  • <Text style={{ fontWeight: '600' }}>Account Information:</Text> Email address, name, profile picture, date of birth, and gender when you create an account.{'\n'}
                  • <Text style={{ fontWeight: '600' }}>Content You Save:</Text> Links, titles, and collections that you create and store in SocialVault.{'\n'}
                  • <Text style={{ fontWeight: '600' }}>Authentication Data:</Text> We use Firebase Authentication and Google Sign-In to manage your account securely.{'\n'}
                  • <Text style={{ fontWeight: '600' }}>Usage Data:</Text> Information about how you use the app, including features accessed and interactions.
                </Text>

                <Text style={[styles.legalHeading, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  2. How We Use Your Information
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  • To provide and maintain SocialVault services{'\n'}
                  • To authenticate your account and keep it secure{'\n'}
                  • To sync your collections across devices{'\n'}
                  • To improve app functionality and user experience{'\n'}
                  • To send important service-related notifications
                </Text>

                <Text style={[styles.legalHeading, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  3. Data Storage & Security
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  Your data is stored securely using <Text style={{ fontWeight: '600' }}>Firebase (Google Cloud Platform)</Text> and <Text style={{ fontWeight: '600' }}>Cloudinary</Text> for images. We implement industry-standard security measures including encrypted data transmission, secure authentication, and regular security audits.
                </Text>

                <Text style={[styles.legalHeading, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  4. Third-Party Services
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  SocialVault uses the following third-party services:{'\n'}
                  • <Text style={{ fontWeight: '600' }}>Firebase:</Text> Authentication, database, and analytics{'\n'}
                  • <Text style={{ fontWeight: '600' }}>Google Sign-In:</Text> Optional authentication method{'\n'}
                  • <Text style={{ fontWeight: '600' }}>Cloudinary:</Text> Secure image storage and delivery
                </Text>

                <Text style={[styles.legalHeading, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  5. Your Data Rights
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  You have the right to:{'\n'}
                  • Access your personal data at any time{'\n'}
                  • Update or correct your information{'\n'}
                  • Delete your account and all associated data{'\n'}
                  • Export your data (feature coming soon){'\n'}
                  • Withdraw consent for data processing
                </Text>

                <Text style={[styles.legalHeading, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  6. Data Retention
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  We retain your data as long as your account is active. If you delete your account, all your personal data will be permanently removed from our servers within 30 days.
                </Text>

                <Text style={[styles.legalHeading, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  7. Cookies & Analytics
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  We use Firebase Analytics to understand how users interact with SocialVault. This helps us improve the app and provide better features. Analytics data is anonymized and does not identify individual users. You can opt out of analytics in your device settings.
                </Text>
              </View>

              {/* Terms of Service */}
              <View style={styles.legalSection}>
                <View style={styles.legalSectionHeader}>
                  <MaterialIcons name="description" size={24} color="#6C5CE7" />
                  <Text style={[styles.legalSectionTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                    Terms of Service
                  </Text>
                </View>

                <Text style={[styles.legalHeading, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  1. Acceptance of Terms
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  By using SocialVault, you agree to these Terms of Service. If you do not agree, please do not use the app.
                </Text>

                <Text style={[styles.legalHeading, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  2. Service Description
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  SocialVault is a personal organization tool that allows you to save, organize, and manage links to content from various social media platforms. <Text style={{ fontWeight: '600' }}>We do not host, own, or control the content linked from external platforms.</Text>
                </Text>

                <Text style={[styles.legalHeading, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  3. User Responsibilities
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  You agree to:{'\n'}
                  • Provide accurate account information{'\n'}
                  • Keep your password secure and confidential{'\n'}
                  • Not upload or share illegal, harmful, or copyrighted content{'\n'}
                  • Not use the app for any unlawful purposes{'\n'}
                  • Respect the terms of service of the platforms you link content from{'\n'}
                  • Not attempt to hack, breach, or exploit the app's security
                </Text>

                <Text style={[styles.legalHeading, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  4. Intellectual Property
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  <Text style={{ fontWeight: '600' }}>SocialVault respects intellectual property rights.</Text> Users may not upload, store, or share copyrighted material without proper authorization from the copyright holder. Any content you save must comply with applicable copyright laws and platform terms of service.
                </Text>

                <Text style={[styles.legalHeading, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  5. Content Ownership
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  You retain ownership of the collections and organization structure you create in SocialVault. However, the actual content (videos, images, posts) linked from external platforms remains the property of those platforms and their original creators.
                </Text>

                <Text style={[styles.legalHeading, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  6. Limitation of Liability
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  SocialVault is provided "as is" without warranties of any kind. We are not responsible for:{'\n'}
                  • Broken links or unavailable content from external platforms{'\n'}
                  • Changes or removal of content by third-party platforms{'\n'}
                  • Quality or accuracy of previews and metadata{'\n'}
                  • Loss of data due to circumstances beyond our control{'\n'}
                  • Any damages resulting from use of the app
                </Text>

                <Text style={[styles.legalHeading, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  7. Service Modifications
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  We reserve the right to modify, suspend, or discontinue any part of SocialVault at any time with or without notice. We will make reasonable efforts to notify users of significant changes.
                </Text>

                <Text style={[styles.legalHeading, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  8. Account Termination
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  We reserve the right to suspend or terminate accounts that violate these terms, engage in abusive behavior, or misuse the service.
                </Text>

                <Text style={[styles.legalHeading, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  9. Changes to Terms
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  We may update these Terms of Service periodically. Continued use of the app after changes constitutes acceptance of the new terms.
                </Text>
              </View>

              {/* Copyright Notice */}
              <View style={styles.legalSection}>
                <View style={styles.legalSectionHeader}>
                  <MaterialIcons name="copyright" size={24} color="#00B894" />
                  <Text style={[styles.legalSectionTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                    Copyright Notice
                  </Text>
                </View>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  © {new Date().getFullYear()} SocialVault. All rights reserved.
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  The SocialVault name, logo, and app design are proprietary. All social media logos and trademarks displayed in the app are property of their respective owners and are used for identification purposes only.
                </Text>
              </View>

              {/* Contact Information */}
              <View style={styles.legalSection}>
                <View style={styles.legalSectionHeader}>
                  <MaterialIcons name="contact-support" size={24} color="#FF8E53" />
                  <Text style={[styles.legalSectionTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                    Contact Us
                  </Text>
                </View>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)' }]}>
                  If you have questions about these terms, your privacy, or need to report a concern, please contact us:
                </Text>
                <Text style={[styles.legalText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(26, 26, 26, 0.8)', fontWeight: '600' }]}>
                  Email: support@socialvault.app{'\n'}
                  Response Time: Within 48 hours
                </Text>
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>

          </View>
        </View>
      </Modal>

      <Footer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  header: {
    padding: 32,
    paddingTop: 60,
    alignItems: 'center',
    borderBottomWidth: 0,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 160,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  headerBackground: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
  },
  headerCircle1: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.1,
  },
  headerCircle2: {
    position: 'absolute',
    top: 60,
    right: 80,
    width: 60,
    height: 60,
    borderRadius: 30,
    opacity: 0.08,
  },
  headerCircle3: {
    position: 'absolute',
    top: 100,
    right: 40,
    width: 40,
    height: 40,
    borderRadius: 20,
    opacity: 0.06,
  },
  headerContent: {
    alignItems: 'center',
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '900',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -1,
    lineHeight: 42,
  },
  headerSubtitle: {
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.3,
    lineHeight: 24,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 24,
  },
  modernSection: {
    marginBottom: 32,
  },
  modernSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  modernSectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  modernSectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  modernUserCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  modernUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modernAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  modernUserDetails: {
    flex: 1,
  },
  modernUserName: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  modernUserEmail: {
    fontSize: 16,
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
    padding: 20,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  modernProfileItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modernIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 18,
  },
  modernProfileItemText: {
    flex: 1,
  },
  modernProfileItemTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  modernProfileItemSubtitle: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  modernProfileItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modernInfoCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  modernPersonalInfo: {
    padding: 8,
  },
  modernInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modernInfoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  modernInfoText: {
    fontSize: 16,
    flex: 1,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  modernSwitch: {
    transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
  },
  termsContent: {
    padding: 8,
  },
  termsSection: {
    marginBottom: 32,
  },
  termsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  termsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
    letterSpacing: -0.3,
  },
  termsText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  termsList: {
    marginLeft: 8,
    marginBottom: 16,
  },
  termsListItem: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  termsNote: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  featureList: {
    marginTop: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingRight: 8,
  },
  featureText: {
    flex: 1,
    marginLeft: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  
  // Legal Button Styles
  legalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  legalButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 10,
    marginRight: 10,
    letterSpacing: 0.2,
  },
  
  // Legal Modal Styles
  legalModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  legalModalContainer: {
    width: '100%',
    height: '95%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    elevation: 10,
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
});
