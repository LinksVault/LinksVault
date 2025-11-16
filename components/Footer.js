// ייבוא הספריות והרכיבים הנדרשים
import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';

// רכיב תפריט הניווט התחתון
const Footer = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { isDarkMode } = useTheme();
  const [pressedButton, setPressedButton] = useState(null);

  // בדיקה האם הנתיב הנוכחי פעיל
  const isActive = (routeName) => {
    return route.name === routeName;
  };

  // אנימציה ללחיצה
  const handlePressIn = (buttonName) => {
    setPressedButton(buttonName);
  };

  const handlePressOut = () => {
    setPressedButton(null);
  };

  const borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(74, 144, 226, 0.15)';
  const glassColor = isDarkMode ? 'rgba(24, 24, 24, 0.8)' : 'rgba(255, 255, 255, 0.85)';
  const highlightColor = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.6)';

  return (
    <View style={styles.footerContainer}>
      <View style={[styles.glassCard, { borderColor, backgroundColor: glassColor }]}>
        <View style={[styles.topHighlight, { backgroundColor: highlightColor }]} />
        <View style={styles.footer}>
      {/* כפתור קישורים כללים */}
      <TouchableOpacity 
        style={[
          styles.button, 
          isActive('MyLinks') && styles.activeButton,
          pressedButton === 'MyLinks' && styles.pressedButton
        ]}
        onPress={() => navigation.navigate('MyLinks')}
        onPressIn={() => handlePressIn('MyLinks')}
        onPressOut={handlePressOut}
        activeOpacity={0.7}
      >
        <View style={[
          styles.iconContainer,
          isActive('MyLinks') && styles.activeIconContainer
        ]}>
           <MaterialIcons 
             name="link" 
             size={22} 
             color={isActive('MyLinks') ? '#ffffff' : (isDarkMode ? '#b0b0b0' : '#4A90E2')} 
           />
        </View>
        <Text style={[
          styles.buttonText, 
          { color: isActive('MyLinks') ? '#ffffff' : (isDarkMode ? '#b0b0b0' : '#4A90E2') },
          isActive('MyLinks') && styles.activeText
        ]}>
          Links
        </Text>
         {isActive('MyLinks') && (
           <View style={styles.activeIndicator}>
             <View style={{
               width: 20,
               height: 2,
               backgroundColor: '#ffffff',
               borderRadius: 1,
             }} />
           </View>
         )}
      </TouchableOpacity>

      {/* כפתור אוספים */}
      <TouchableOpacity 
        style={[
          styles.button, 
          isActive('Collections') && styles.activeButton,
          pressedButton === 'Collections' && styles.pressedButton
        ]}
        onPress={() => navigation.navigate('Collections', { resetTrashView: true })}
        onPressIn={() => handlePressIn('Collections')}
        onPressOut={handlePressOut}
        activeOpacity={0.7}
      >
        <View style={[
          styles.iconContainer,
          isActive('Collections') && styles.activeIconContainer
        ]}>
           <MaterialIcons 
             name="folder-copy" 
             size={22} 
             color={isActive('Collections') ? '#ffffff' : (isDarkMode ? '#b0b0b0' : '#4A90E2')} 
           />
        </View>
        <Text style={[
          styles.buttonText, 
          { color: isActive('Collections') ? '#ffffff' : (isDarkMode ? '#b0b0b0' : '#4A90E2') },
          isActive('Collections') && styles.activeText
        ]}>
          Collections
        </Text>
         {isActive('Collections') && (
           <View style={styles.activeIndicator}>
             <View style={{
               width: 20,
               height: 2,
               backgroundColor: '#ffffff',
               borderRadius: 1,
             }} />
           </View>
         )}
      </TouchableOpacity>

      {/* כפתור רשתות חברתיות */}
      <TouchableOpacity 
        style={[
          styles.button, 
          isActive('MainScreen') && styles.activeButton,
          pressedButton === 'MainScreen' && styles.pressedButton
        ]}
        onPress={() => navigation.navigate('MainScreen')}
        onPressIn={() => handlePressIn('MainScreen')}
        onPressOut={handlePressOut}
        activeOpacity={0.7}
      >
        <View style={[
          styles.iconContainer,
          isActive('MainScreen') && styles.activeIconContainer
        ]}>
           <MaterialIcons 
             name="video-library" 
             size={22} 
             color={isActive('MainScreen') ? '#ffffff' : (isDarkMode ? '#b0b0b0' : '#4A90E2')} 
           />
        </View>
        <Text style={[
          styles.buttonText, 
          { color: isActive('MainScreen') ? '#ffffff' : (isDarkMode ? '#b0b0b0' : '#4A90E2') },
          isActive('MainScreen') && styles.activeText
        ]}>
          Media
        </Text>
         {isActive('MainScreen') && (
           <View style={styles.activeIndicator}>
             <View style={{
               width: 20,
               height: 2,
               backgroundColor: '#ffffff',
               borderRadius: 1,
             }} />
           </View>
         )}
      </TouchableOpacity>

      {/* כפתור פרופיל/הגדרות */}
      <TouchableOpacity 
        style={[
          styles.button, 
          isActive('Profile') && styles.activeButton,
          pressedButton === 'Profile' && styles.pressedButton
        ]}
        onPress={() => navigation.navigate('Profile')}
        onPressIn={() => handlePressIn('Profile')}
        onPressOut={handlePressOut}
        activeOpacity={0.7}
      >
        <View style={[
          styles.iconContainer,
          isActive('Profile') && styles.activeIconContainer
        ]}>
           <MaterialIcons 
             name="person" 
             size={22} 
             color={isActive('Profile') ? '#ffffff' : (isDarkMode ? '#b0b0b0' : '#4A90E2')} 
           />
        </View>
        <Text style={[
          styles.buttonText, 
          { color: isActive('Profile') ? '#ffffff' : (isDarkMode ? '#b0b0b0' : '#4A90E2') },
          isActive('Profile') && styles.activeText
        ]}>
          Profile
        </Text>
         {isActive('Profile') && (
           <View style={styles.activeIndicator}>
             <View style={{
               width: 20,
               height: 2,
               backgroundColor: '#ffffff',
               borderRadius: 1,
             }} />
           </View>
         )}
      </TouchableOpacity>
      </View>
    </View>
    </View>
  );
};

// הגדרות העיצוב של התפריט התחתון
const styles = StyleSheet.create({
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  glassCard: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    paddingBottom: 12, // Extra padding for safe area
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    minWidth: 60,
    height: 55,
    position: 'relative',
    transform: [{ scale: 1 }],
  },
  activeButton: {
    backgroundColor: '#4A90E2',
    shadowColor: '#4A90E2',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    transform: [{ scale: 1.05 }],
  },
  pressedButton: {
    transform: [{ scale: 0.95 }],
    opacity: 0.8,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    backgroundColor: 'transparent',
  },
  activeIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  buttonText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  activeText: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 2,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Footer; 