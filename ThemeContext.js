import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, InteractionManager } from 'react-native';

let NavigationBar;
if (Platform.OS === 'android') {
  try {
    // Dynamically require to avoid crashing in Expo Go where the native module is unavailable
    NavigationBar = require('expo-navigation-bar');
  } catch (error) {
    console.warn('expo-navigation-bar module is not available; Android system navigation bar theming disabled.', error);
  }
}

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [themeMode, setThemeMode] = useState('light'); // 'light', 'gray', 'black'
  const [isLoading, setIsLoading] = useState(true);

  // Load theme preference from AsyncStorage on app start
  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('userThemePreference');
      if (savedTheme !== null) {
        setThemeMode(savedTheme);
        console.log('Loaded theme preference:', savedTheme);
      } else {
        // Default to light mode if no preference saved
        setThemeMode('light');
        console.log('No theme preference found, using default light mode');
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
      // Fallback to light mode on error
      setThemeMode('light');
    } finally {
      setIsLoading(false);
    }
  };

  const setTheme = useCallback((newTheme) => {
    setThemeMode(newTheme);

    const persistTheme = async () => {
      try {
        await AsyncStorage.setItem('userThemePreference', newTheme);
        console.log('Theme preference saved:', newTheme);
      } catch (error) {
        console.error('Error saving theme preference:', error);
      }
    };

    if (InteractionManager?.runAfterInteractions) {
      InteractionManager.runAfterInteractions(persistTheme);
    } else {
      persistTheme();
    }
  }, []);

  // Legacy support for existing toggleTheme function
  const toggleTheme = async () => {
    const newTheme = themeMode === 'light' ? 'gray' : 'light';
    setTheme(newTheme);
  };

  // Helper functions for theme properties
  const isDarkMode = themeMode !== 'light';
  const getBackgroundColor = () => {
    switch (themeMode) {
      case 'light': return '#f5f5f5';
      case 'gray': return '#1a1a1a';
      case 'black': return '#000000';
      default: return '#f5f5f5';
    }
  };
  const backgroundColor = getBackgroundColor();

  useEffect(() => {
    if (isLoading || Platform.OS !== 'android' || !NavigationBar?.setBackgroundColorAsync) {
      return;
    }

    const applyNavigationBarTheme = async () => {
      try {
        await NavigationBar.setBackgroundColorAsync(backgroundColor);
        await NavigationBar.setButtonStyleAsync(isDarkMode ? 'light' : 'dark');
      } catch (error) {
        console.warn('Failed to update Android navigation bar theme:', error);
      }
    };

    applyNavigationBarTheme();
  }, [backgroundColor, isDarkMode, isLoading]);

  // Don't render children until theme is loaded to prevent flash
  if (isLoading) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ 
      isDarkMode, 
      toggleTheme, 
      themeMode, 
      setTheme, 
      getBackgroundColor 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
