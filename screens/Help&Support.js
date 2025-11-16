import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar, 
  Platform 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { showAppDialog } from '../context/DialogContext';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import Footer from '../components/Footer';

export default function HelpSupport() {
  const navigation = useNavigation();
  const { isDarkMode, getBackgroundColor } = useTheme();
  const [expandedFAQ, setExpandedFAQ] = useState(null);

  const faqData = [
    {
      id: 1,
      question: "How do I create a new collection?",
      answer: "Tap the '+' button on the Collections screen and enter a name for your collection. You can then start adding links to organize your content."
    },
    {
      id: 2,
      question: "Can I edit link titles?",
      answer: "Yes! Long press any link in your collection and select 'Edit Title' to customize the display name. This is especially useful when previews aren't available."
    },
    {
      id: 3,
      question: "How do I change themes?",
      answer: "Go to Profile & Settings > Preferences to change between light and dark themes. We're working on adding more theme options!"
    },
    {
      id: 4,
      question: "Is my data secure?",
      answer: "Absolutely! We use Firebase with privacy-first design. Your data is encrypted and stored securely in the cloud."
    },
    {
      id: 5,
      question: "Can I restore deleted collections?",
      answer: "Yes! Use 'View Trash' in the hamburger menu to see deleted collections and restore them if needed."
    },
    {
      id: 6,
      question: "How do I share content to LinksVault?",
      answer: "When you find interesting content on social media, use your device's share button and select LinksVault. The content will be automatically added to your collections."
    },
    {
      id: 7,
      question: "What social platforms are supported?",
      answer: "LinksVault works with all major platforms including Instagram, YouTube, TikTok, Twitter/X, Facebook, Snapchat, Reddit, and any other platform with shareable links."
    },
    {
      id: 8,
      question: "Can I organize links into multiple collections?",
      answer: "Yes! Create unlimited collections to organize your content by topics, interests, or any way that makes sense to you."
    }
  ];

  const handleEmailPress = () => {
    const email = 'help.linksvault.app@gmail.com';
    const subject = 'LinksVault Support Request';
    const body = 'Hi LinksVault Team,\n\nI need help with:\n\nDevice: \nApp Version: 1.0.0\nIssue Description:\n\nThank you!';
    
    const emailUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
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

  const toggleFAQ = (id) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const FAQItem = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.faqItem, 
        { 
          backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        }
      ]}
      onPress={() => toggleFAQ(item.id)}
      activeOpacity={0.8}
    >
      <View style={styles.faqHeader}>
        <Text style={[styles.faqQuestion, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
          {item.question}
        </Text>
        <MaterialIcons 
          name={expandedFAQ === item.id ? "expand-less" : "expand-more"} 
          size={24} 
          color={isDarkMode ? '#ffffff' : '#1a1a1a'} 
        />
      </View>
      {expandedFAQ === item.id && (
        <Text style={[styles.faqAnswer, { color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(26, 26, 26, 0.7)' }]}>
          {item.answer}
        </Text>
      )}
    </TouchableOpacity>
  );

  const ContactCard = ({ icon, title, subtitle, onPress, iconColor }) => (
    <TouchableOpacity 
      style={[
        styles.contactCard, 
        { 
          backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        }
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.contactIcon, { backgroundColor: iconColor + '15' }]}>
        <MaterialIcons name={icon} size={28} color={iconColor} />
      </View>
      <View style={styles.contactContent}>
        <Text style={[styles.contactTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
          {title}
        </Text>
        <Text style={[styles.contactSubtitle, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
          {subtitle}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={24} color={isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(26, 26, 26, 0.3)'} />
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
            Help & Support
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Quick Help Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="lightbulb-outline" size={24} color="#FFD93D" />
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
              Quick Help
            </Text>
          </View>
          
          <ContactCard
            icon="email"
            title="Email Support"
            subtitle="Get help from our support team"
            iconColor="#4A90E2"
            onPress={handleEmailPress}
          />
          
          <ContactCard
            icon="schedule"
            title="Response Time"
            subtitle="We respond within 24 hours"
            iconColor="#00B894"
            onPress={() => showAppDialog('Response Time', 'Our support team typically responds within 24 hours during business days. For urgent issues, please mark your email as urgent.')}
          />
        </View>

        {/* FAQ Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="quiz" size={24} color="#6C5CE7" />
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
              Frequently Asked Questions
            </Text>
          </View>
          
          <Text style={[styles.sectionDescription, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
            Find quick answers to common questions
          </Text>
          
          {faqData.map((item) => (
            <FAQItem key={item.id} item={item} />
          ))}
        </View>

        {/* Tips Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="tips-and-updates" size={24} color="#FF6B6B" />
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
              Pro Tips
            </Text>
          </View>
          
          <View style={[
            styles.tipCard, 
            { 
              backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
            }
          ]}>
            <MaterialIcons name="star" size={20} color="#FFD93D" />
            <Text style={[styles.tipText, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
              Use descriptive collection names to easily find your content later
            </Text>
          </View>
          
          <View style={[
            styles.tipCard, 
            { 
              backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
            }
          ]}>
            <MaterialIcons name="star" size={20} color="#FFD93D" />
            <Text style={[styles.tipText, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
              Edit link titles to make them more personal and easier to identify
            </Text>
          </View>
          
          <View style={[
            styles.tipCard, 
            { 
              backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
            }
          ]}>
            <MaterialIcons name="star" size={20} color="#FFD93D" />
            <Text style={[styles.tipText, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
              Use the search feature to quickly find specific links in your collections
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
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contactIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  contactContent: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  contactSubtitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  faqItem: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  faqAnswer: {
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 15,
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },
});
