import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Platform, Animated, ActivityIndicator, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import { db, auth } from '../services/firebase/Config.js';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import Footer from '../components/Footer';

export default function Statistics() {
  const navigation = useNavigation();
  const { isDarkMode, getBackgroundColor } = useTheme();
  const [currentUser, setCurrentUser] = useState(null);
  const [stats, setStats] = useState({
    totalCollections: 0,
    totalLinks: 0,
    favoriteCollections: 0,
    recentActivity: 0,
    platformBreakdown: {},
    monthlyActivity: []
  });
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setCurrentUser(auth.currentUser);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (currentUser) {
        loadStatistics();
        // Start fade animation
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }).start();
      }
      return () => {
        fadeAnim.setValue(0);
      };
    }, [currentUser])
  );

  const loadStatistics = async () => {
    if (!currentUser?.uid) return;
    
    try {
      setLoading(true);
      
      // Get all collections for the current user
      const collectionsRef = collection(db, 'albums');
      const collectionsQuery = query(
        collectionsRef, 
        where('userId', '==', currentUser.uid)
      );
      const collectionsSnapshot = await getDocs(collectionsQuery);
      
      let totalLinks = 0;
      let favoriteCollections = 0;
      const platformBreakdown = {};
      const monthlyActivity = [];
      
      // Process each collection (filter out deleted ones)
      collectionsSnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Skip deleted collections
        if (data.isDeleted === true) {
          return;
        }
        
        const links = data.links || [];
        totalLinks += links.length;
        
        if (data.isFavorite) {
          favoriteCollections++;
        }
        
        // Count links by platform
        links.forEach(link => {
          const platform = getPlatformFromUrl(link.url);
          platformBreakdown[platform] = (platformBreakdown[platform] || 0) + 1;
        });
        
        // Track monthly activity (simplified - using creation date)
        const createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        const monthKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
        const existingMonth = monthlyActivity.find(item => item.month === monthKey);
        if (existingMonth) {
          existingMonth.count += 1;
        } else {
          monthlyActivity.push({ month: monthKey, count: 1 });
        }
      });
      
      // Sort monthly activity by month
      monthlyActivity.sort((a, b) => a.month.localeCompare(b.month));
      
      setStats({
        totalCollections: collectionsSnapshot.size,
        totalLinks,
        favoriteCollections,
        recentActivity: collectionsSnapshot.size, // Simplified
        platformBreakdown,
        monthlyActivity: monthlyActivity.slice(-6) // Last 6 months
      });
      
    } catch (error) {
      console.error('Error loading statistics:', error);
      
      // Set default stats on error
      setStats({
        totalCollections: 0,
        totalLinks: 0,
        favoriteCollections: 0,
        recentActivity: 0,
        platformBreakdown: {},
        monthlyActivity: []
      });
    } finally {
      setLoading(false);
    }
  };

  const getPlatformFromUrl = (url) => {
    if (!url) return 'Other';
    
    const urlLower = url.toLowerCase();
    if (urlLower.includes('instagram.com')) return 'Instagram';
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'YouTube';
    if (urlLower.includes('tiktok.com')) return 'TikTok';
    if (urlLower.includes('facebook.com')) return 'Facebook';
    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'X (Twitter)';
    if (urlLower.includes('reddit.com')) return 'Reddit';
    if (urlLower.includes('snapchat.com')) return 'Snapchat';
    return 'Other';
  };

  const formatMonth = (monthKey) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  const StatCard = ({ icon, title, value, subtitle, color = '#4A90E2' }) => (
    <View style={[styles.statCard, { 
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
    }]}>
      <View style={[styles.statIconContainer, { backgroundColor: `${color}20` }]}>
        <MaterialIcons name={icon} size={24} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={[styles.statValue, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
          {value}
        </Text>
        <Text style={[styles.statTitle, { color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(26, 26, 26, 0.7)' }]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.statSubtitle, { color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(26, 26, 26, 0.5)' }]}>
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );

  const PlatformItem = ({ platform, count, percentage }) => (
    <View style={styles.platformItem}>
      <View style={styles.platformInfo}>
        <Text style={[styles.platformName, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
          {platform}
        </Text>
        <Text style={[styles.platformCount, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
          {count} links
        </Text>
      </View>
      <View style={[styles.progressBar, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
        <View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: '#4A90E2' }]} />
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: getBackgroundColor() }]}>
        <StatusBar 
          barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
          backgroundColor={getBackgroundColor()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={[styles.loadingText, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
            Loading statistics...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { 
      backgroundColor: isDarkMode ? '#0a0a0a' : '#f8fafc',
      opacity: fadeAnim 
    }]}>
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
        backgroundColor={isDarkMode ? '#000000' : '#ffffff'}
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
            Statistics
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Overview Stats */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
            Overview
          </Text>
          <View style={styles.statsGrid}>
            <StatCard
              icon="folder"
              title="Collections"
              value={stats.totalCollections}
              subtitle="Total collections"
              color="#4A90E2"
            />
            <StatCard
              icon="link"
              title="Links Saved"
              value={stats.totalLinks}
              subtitle="Total links"
              color="#00B894"
            />
            <StatCard
              icon="star"
              title="Favorites"
              value={stats.favoriteCollections}
              subtitle="Starred collections"
              color="#FFD93D"
            />
            <StatCard
              icon="trending-up"
              title="Activity"
              value={stats.recentActivity}
              subtitle="Recent activity"
              color="#6C5CE7"
            />
          </View>
        </View>

        {/* Platform Breakdown */}
        {Object.keys(stats.platformBreakdown).length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
              Platform Breakdown
            </Text>
            <View style={[styles.platformContainer, { 
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
            }]}>
              {Object.entries(stats.platformBreakdown)
                .sort(([,a], [,b]) => b - a)
                .map(([platform, count]) => {
                  const percentage = stats.totalLinks > 0 ? (count / stats.totalLinks) * 100 : 0;
                  return (
                    <PlatformItem
                      key={platform}
                      platform={platform}
                      count={count}
                      percentage={percentage}
                    />
                  );
                })}
            </View>
          </View>
        )}

        {/* Monthly Activity */}
        {stats.monthlyActivity.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
              Recent Activity
            </Text>
            <View style={[styles.activityContainer, { 
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
            }]}>
              {stats.monthlyActivity.map((item, index) => (
                <View key={index} style={styles.activityItem}>
                  <Text style={[styles.activityMonth, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                    {formatMonth(item.month)}
                  </Text>
                  <Text style={[styles.activityCount, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                    {item.count} collections
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Empty State */}
        {stats.totalCollections === 0 && (
          <View style={styles.emptyState}>
            <MaterialIcons name="analytics" size={64} color={isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'} />
            <Text style={[styles.emptyTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
              No Data Yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(26, 26, 26, 0.6)' }]}>
              Start creating collections to see your statistics here
            </Text>
          </View>
        )}
      </ScrollView>

      <Footer />
    </Animated.View>
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
    paddingTop: 24,
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  statSubtitle: {
    fontSize: 12,
    fontWeight: '400',
  },
  platformContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  platformItem: {
    marginBottom: 16,
  },
  platformInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  platformName: {
    fontSize: 16,
    fontWeight: '500',
  },
  platformCount: {
    fontSize: 14,
    fontWeight: '400',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  activityContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  activityMonth: {
    fontSize: 16,
    fontWeight: '500',
  },
  activityCount: {
    fontSize: 14,
    fontWeight: '400',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
});
