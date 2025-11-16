import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar, 
  Platform,
  Linking,
  Alert 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { showAppDialog } from '../context/DialogContext';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import Footer from '../components/Footer';

export default function About() {
  const navigation = useNavigation();
  const { isDarkMode, getBackgroundColor } = useTheme();

  const handleEmailPress = () => {
    const email = 'help.linksvault.app@gmail.com';
    const subject = 'SocialVault Feedback';
    
    const emailUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}`;
    
    Linking.canOpenURL(emailUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(emailUrl);
        } else {
          showAppDialog('Email not available', 'Please contact us at help.linksvault.app@gmail.com');
        }
      })
      .catch((error) => {
        console.error('Error opening email:', error);
        showAppDialog('Error', 'Unable to open email client. Please contact us at help.linksvault.app@gmail.com');
      });
  };

  const InfoCard = ({ icon, title, subtitle, onPress, iconColor }) => (
    <TouchableOpacity 
      style={[
        styles.infoCard, 
        { 
          backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        }
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.infoIcon, { backgroundColor: iconColor + '15' }]}>
        <MaterialIcons name={icon} size={24} color={iconColor} />
      </View>
      <View style={styles.infoContent}>
        <Text style={[styles.infoTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
          {title}
        </Text>
        <Text style={[styles.infoSubtitle, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
          {subtitle}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(26, 26, 26, 0.3)'} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: getBackgroundColor() }]}>
      {/* Status Bar */}
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
        backgroundColor={getBackgroundColor()}
        translucent={false}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.topLeftControls}>
          <TouchableOpacity 
            style={[styles.backButton, { 
              backgroundColor: isDarkMode ? 'rgba(74, 144, 226, 0.15)' : 'rgba(74, 144, 226, 0.1)' 
            }]}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#4A90E2" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.topRightControls}>
          <Text style={[styles.pageTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
            About LinksVault
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* App Introduction */}
        <View style={styles.section}>
          <View style={[styles.introCard, { 
            backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
          }]}>
            <View style={styles.appLogo}>
              <MaterialIcons name="dashboard" size={48} color="#4A90E2" />
            </View>
            <Text style={[styles.appName, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
              LinksVault
            </Text>
            <Text style={[styles.appVersion, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
              Version 1.0.0
            </Text>
            <Text style={[styles.appDescription, { color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(26, 26, 26, 0.7)' }]}>
              The best app for saving, organizing, and beautifully polishing all your links—across social media, apps, and the web—in one place. Keep your entire media life tidy in a single app instead of dumping links into WhatsApp chats and self-made groups. For years there wasn’t a modern, great‑looking tool built for this; LinksVault is the fresh, elegant solution designed for today.
            </Text>
          </View>
        </View>

        {/* Terms of Service & App Features (aligned with Profile.js content) */}
        <View style={styles.section}>
          {/* Link Preview System */}
          <View style={styles.termsSection}>
            <View style={styles.termsHeader}>
              <MaterialIcons name="link" size={20} color="#4A90E2" />
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

          {/* Unique App Features */}
          <View style={styles.termsSection}>
            <View style={styles.termsHeader}>
              <MaterialIcons name="star" size={20} color="#FFD93D" />
              <Text style={[styles.termsTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                Unique App Features
              </Text>
            </View>
            <View style={styles.featureList}>
              <View style={styles.featureItemRow}>
                <MaterialIcons name="edit" size={18} color="#4A90E2" />
                <View style={styles.featureTextGroup}>
                  <Text style={[styles.featureTitleRow, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                    Custom Link Titles & Previews
                  </Text>
                  <Text style={[styles.featureDescriptionRow, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                    Edit link titles and preview metadata to keep everything on-brand. Perfect when automatic previews aren't available!
                  </Text>
                </View>
              </View>

              <View style={styles.featureItemRow}>
                <MaterialIcons name="dashboard" size={18} color="#00B894" />
                <View style={styles.featureTextGroup}>
                  <Text style={[styles.featureTitleRow, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                    Universal Platform Hub
                  </Text>
                  <Text style={[styles.featureDescriptionRow, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                    Organize links from ALL your favorite services—social, streaming, productivity, shopping, learning, and more—in one beautifully designed, personal space.
                  </Text>
                </View>
              </View>

              <View style={styles.featureItemRow}>
                <MaterialIcons name="palette" size={18} color="#6C5CE7" />
                <View style={styles.featureTextGroup}>
                  <Text style={[styles.featureTitleRow, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                    Multiple Design Themes
                  </Text>
                  <Text style={[styles.featureDescriptionRow, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                    Choose from Modern, Classic, Minimal, and Grid layouts to match your style.
                  </Text>
                </View>
              </View>

              <View style={styles.featureItemRow}>
                <MaterialIcons name="brush" size={18} color="#FF8C00" />
                <View style={styles.featureTextGroup}>
                  <Text style={[styles.featureTitleRow, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                    Polished, Professional Aesthetic
                  </Text>
                  <Text style={[styles.featureDescriptionRow, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                    LinksVault delivers a modern, professional look that makes every saved item feel curated instead of chaotic.
                  </Text>
                </View>
              </View>

              <View style={styles.featureItemRow}>
                <MaterialIcons name="security" size={18} color="#E74C3C" />
                <View style={styles.featureTextGroup}>
                  <Text style={[styles.featureTitleRow, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                    Privacy-First Approach
                  </Text>
                  <Text style={[styles.featureDescriptionRow, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                    Your data is protected with secure cloud storage and privacy-first design.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Why LinksVault */}
          <View style={styles.termsSection}>
            <View style={styles.termsHeader}>
              <MaterialIcons name="favorite" size={20} color="#FF6B6B" />
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
        </View>

        {/* App Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="info" size={24} color="#4A90E2" />
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
              App Information
            </Text>
          </View>
          
          <InfoCard
            icon="build"
            title="Build Version"
            subtitle="2024.1.0"
            iconColor="#2ECC71"
            onPress={() => showAppDialog('Build Info', 'Build: 2024.1.0\nRelease Date: October 2024')}
          />
          
          <InfoCard
            icon="developer-mode"
            title="Developer"
            subtitle="LinksVault Team"
            iconColor="#9B59B6"
            onPress={() => showAppDialog('Developer Info', 'Developed with ❤️ by the LinksVault Team\nFor social media enthusiasts worldwide')}
          />
          
          <InfoCard
            icon="copyright"
            title="Copyright"
            subtitle="© 2024 LinksVault. All rights reserved."
            iconColor="#E67E22"
            onPress={() => showAppDialog('Copyright', '© 2024 LinksVault. All rights reserved.\n\nThis app is proprietary software.')}
          />
        </View>

        {/* Contact & Support */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="contact-support" size={24} color="#FF6B6B" />
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
              Get In Touch
            </Text>
          </View>
          
          <InfoCard
            icon="email"
            title="Support Email"
            subtitle="help.linksvault.app@gmail.com"
            iconColor="#4A90E2"
            onPress={handleEmailPress}
          />
          
          <InfoCard
            icon="feedback"
            title="Send Feedback"
            subtitle="Help us improve the app"
            iconColor="#FF9800"
            onPress={handleEmailPress}
          />
          
          <InfoCard
            icon="rate-review"
            title="Rate Our App"
            subtitle="Share your experience"
            iconColor="#F1C40F"
            onPress={() => showAppDialog('Rate LinksVault', 'Thank you for using LinksVault! Please consider rating us on the App Store to help other users discover our app.')}
          />
        </View>

        {/* Mission Statement */}
        <View style={styles.section}>
          <View style={[styles.missionCard, { 
            backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
          }]}>
            <MaterialIcons name="favorite" size={32} color="#E91E63" />
            <Text style={[styles.missionTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
              Our Mission
            </Text>
            <Text style={[styles.missionText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(26, 26, 26, 0.7)' }]}>
              To provide a beautiful, intuitive, and secure way for users to organize and access their favorite social media content from all platforms in one unified experience.
            </Text>
          </View>
        </View>
      </ScrollView>

      <Footer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  topLeftControls: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 20 : 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
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
  scrollContent: {
    padding: 20,
    paddingBottom: 80,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  sectionDescription: {
    fontSize: 16,
    marginBottom: 20,
    lineHeight: 22,
  },
  introCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  appLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4A90E2' + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  appVersion: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
  },
  appDescription: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoSubtitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  missionCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  missionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  missionText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  // Terms/App Features styles (aligned with Profile.js)
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
  featureItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingRight: 8,
  },
  featureTextGroup: {
    flex: 1,
    marginLeft: 12,
  },
  featureTitleRow: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 3,
    letterSpacing: -0.1,
  },
  featureDescriptionRow: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.1,
  },
});
