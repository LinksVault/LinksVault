// ייבוא הספריות והרכיבים הנדרשים
import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Image, Platform, I18nManager } from 'react-native';

// Force LTR layout globally
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);
import SignUp from './screens/SignUp';
import LogIn from './screens/LogIn';
import Welcome from './screens/Welcome';
import MainScreen from './screens/MainScreen';
import Collections from './screens/Collections';
import CreateCollection from './screens/CreateCollection';
import SelectLinksScreen from './screens/SelectLinksScreen';
import SelectThemeImageScreen from './screens/SelectThemeImageScreen';
import CollectionFormat from './screens/CollectionFormat';
import CollectionScreen from './screens/CollectionScreen';
import ShareHandler from './screens/ShareHandler';
import Profile from './screens/Profile';
import MyLinks from './screens/MyLinks';
import HelpSupport from './screens/Help&Support';
import About from './screens/About';
import Statistics from './screens/Statistics';
import TermsAndConditions from './screens/TermsAndConditions';
import PrivacyPolicy from './screens/PrivacyPolicy';
import { auth } from './services/firebase/Config';
import { onAuthStateChanged } from 'firebase/auth';
import { ThemeProvider } from './ThemeContext';
import ShareIntentListener from './utils/ShareIntentListener';
import { DialogProvider } from './context/DialogContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';


// יצירת ניווט מסוג Stack
const Stack = createNativeStackNavigator();

// רכיב האפליקציה הראשי
export default function App() {
  // משתני מצב לניהול המשתמש והאתחול
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [sharedContent, setSharedContent] = useState(null);
  const [isVerificationInProgress, setIsVerificationInProgress] = useState(false);
  const [isSwitchingAccounts, setIsSwitchingAccounts] = useState(false);
  const navigationRef = useRef(null);

  // Global image preloading for better performance (non-blocking)
  useEffect(() => {
    const preloadAppImages = async () => {
      // Skip on web - Image.resolveAssetSource doesn't work there
      if (Platform.OS === 'web') {
        console.log('Skipping image preload on web platform');
        return;
      }
      
      console.log('Starting global image preload...');
      try {
        // Don't await - let it run in background
        Promise.all([
          Image.prefetch(Image.resolveAssetSource(require('./assets/YoutubeIcon.png')).uri),
          Image.prefetch(Image.resolveAssetSource(require('./assets/InstagramIcon.png')).uri),
          Image.prefetch(Image.resolveAssetSource(require('./assets/FacebookIcon.png')).uri),
          Image.prefetch(Image.resolveAssetSource(require('./assets/TikTokIcon.png')).uri),
          Image.prefetch(Image.resolveAssetSource(require('./assets/XIcon.png')).uri),
          Image.prefetch(Image.resolveAssetSource(require('./assets/SnapchatIcon.png')).uri),
        ]).then(() => {
          console.log('Global image preload completed successfully');
        }).catch((error) => {
          console.warn('Global image preload failed:', error);
        });
      } catch (error) {
        console.warn('Global image preload failed:', error);
      }
    };

    // Preload images immediately but non-blocking
    preloadAppImages();
  }, []);

  // Safe navigation helper function
  const safeNavigate = (screenName, params = {}) => {
    if (navigationRef.current && navigationRef.current.isReady()) {
      try {
        navigationRef.current.navigate(screenName, params);
        return true;
      } catch (error) {
        console.error('Navigation error:', error);
        return false;
      }
    } else {
      console.warn('Navigation not ready, cannot navigate to:', screenName);
      return false;
    }
  };

  // מעקב אחר מצב האימות של המשתמש
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (newUser) => {
      console.log('🔄 Auth state changed:', newUser ? 'User logged in' : 'User logged out');
      console.log('🔍 Current isVerificationInProgress:', isVerificationInProgress);
      console.log('🔍 Navigation key will be:', user && !isVerificationInProgress ? 'authenticated' : 'unauthenticated');
      
      // Detect account switching
      if (user && newUser && user.uid !== newUser.uid) {
        console.log('Account switch detected');
        setIsSwitchingAccounts(true);
        // Reset switching state after a short delay
        setTimeout(() => setIsSwitchingAccounts(false), 1000);
      }
      
      setUser(newUser);
      if (initializing) setInitializing(false);
    });

    return () => unsubscribe();
  }, [user, initializing, isVerificationInProgress]);

  // Handle share intents
  useEffect(() => {
    if (!user) return; // Only listen when user is logged in

    const removeListener = ShareIntentListener.addListener((content) => {
      console.log('Received shared content:', content);
      setSharedContent(content);
      
      // Navigate to ShareHandler screen
      safeNavigate('ShareHandler', { sharedContent: content });
    });

    return () => {
      removeListener();
      ShareIntentListener.stopListening();
    };
  }, [user]);

  // Start listening for share intents
  useEffect(() => {
    if (user) {
      ShareIntentListener.setupAndroidListener();
    }
  }, [user]);

  // הצגת מסך ריק בזמן אתחול או החלפת חשבון
  if (initializing || isSwitchingAccounts) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <DialogProvider>
          <NavigationContainer 
            ref={navigationRef}
            // Removed navigation state logging - was causing excessive console output
          >
          <Stack.Navigator 
            key={user && !isVerificationInProgress ? 'authenticated' : 'unauthenticated'}
            initialRouteName={user && !isVerificationInProgress ? "MainScreen" : "Welcome"}
            screenOptions={{
              headerShown: false,
              animation: 'fade_from_bottom',
              animationDuration: 180,
              gestureEnabled: true,
            }}
          >
            {!user || isVerificationInProgress ? (
              // מסכי אימות - מוצגים כאשר המשתמש לא מחובר או כאשר תהליך האימות מתבצע
              <>
                <Stack.Screen name="Welcome" component={Welcome} />
                <Stack.Screen name="SignUp" component={SignUp} initialParams={{ setIsVerificationInProgress }} />
                <Stack.Screen name="LogIn" component={LogIn} />
              </>
            ) : (
              // מסכי האפליקציה - מוצגים כאשר המשתמש מחובר
              <>
                <Stack.Screen name="MainScreen" component={MainScreen} />
                <Stack.Screen 
                  name="Collections" 
                  component={Collections} 
                  options={{ 
                    headerShown: false
                  }} 
                />
                <Stack.Screen name="CreateCollection" component={CreateCollection} options={{ headerShown: false }} />
                <Stack.Screen name="SelectLinksScreen" component={SelectLinksScreen} options={{ headerShown: false }} />
                <Stack.Screen name="SelectThemeImageScreen" component={SelectThemeImageScreen} options={{ headerShown: false }} />
                <Stack.Screen name="CollectionFormat" component={CollectionFormat} options={{ headerShown: false }} />
                <Stack.Screen name="ShareHandler" component={ShareHandler} options={{ headerShown: false }} />
                <Stack.Screen name="Profile" component={Profile} options={{ headerShown: false }} />
                <Stack.Screen name="MyLinks" component={MyLinks} options={{ headerShown: false }} />
                <Stack.Screen name="HelpSupport" component={HelpSupport} options={{ headerShown: false }} />
                <Stack.Screen name="About" component={About} options={{ headerShown: false }} />
                <Stack.Screen name="Statistics" component={Statistics} options={{ headerShown: false }} />
                <Stack.Screen 
                  name="CollectionScreen" 
                  component={CollectionScreen}
                  options={{
                    headerShown: true,
                    title: 'Image Collection',
                    headerStyle: {
                      backgroundColor: '#4a90e2',
                    },
                    headerTintColor: '#fff',
                  }}
                />
              </>
            )}
            <Stack.Screen
              name="TermsAndConditions"
              component={TermsAndConditions}
              options={{
                headerShown: true,
                title: 'Terms & Conditions',
                headerStyle: {
                  backgroundColor: '#0F172A',
                },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="PrivacyPolicy"
              component={PrivacyPolicy}
              options={{
                headerShown: true,
                title: 'Privacy Policy',
                headerStyle: {
                  backgroundColor: '#0F172A',
                },
                headerTintColor: '#fff',
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </DialogProvider>
    </ThemeProvider>
    </SafeAreaProvider>
  );
}
