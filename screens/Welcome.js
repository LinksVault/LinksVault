import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ImageBackground, TouchableOpacity, Animated, Alert, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../services/firebase/Config';
import { doc, setDoc, getDoc } from 'firebase/firestore';

// ייבוא תמונת הרקע
const backgroundImage = require('../assets/social-bg.jpg');
const googleIcon = require('../assets/GoogleIcon.png');

// This is required for expo-auth-session to work properly
WebBrowser.maybeCompleteAuthSession();

const Welcome = ({ navigation }) => {
    // הגדרת משתני ניווט
    const nav = useNavigation();
    const [isLoading, setIsLoading] = useState(false);
    
    // Configure Expo Google Auth (with Android client ID)
    const [request, response, promptAsync] = Google.useAuthRequest({
        webClientId: '929613087809-ikkratjtck01qme47a4ilc6eqs867jt8.apps.googleusercontent.com',
        expoClientId: '929613087809-ikkratjtck01qme47a4ilc6eqs867jt8.apps.googleusercontent.com',
        androidClientId: '929613087809-5nn229sqjoh9rqj0eou1l49pbr4a94pk.apps.googleusercontent.com',
    });
    
    // Enhanced debugging for Google Auth
    useEffect(() => {
        console.log('=== GOOGLE AUTH DEBUG ===');
        console.log('Request available:', !!request);
        console.log('Response:', response);
        console.log('Prompt function available:', !!promptAsync);
        console.log('Request config:', request);
        
        if (response?.type === 'success') {
            const { authentication } = response;
            console.log('✅ Google Auth success, authentication:', authentication);
            handleGoogleAuthSuccess(authentication);
        } else if (response?.type === 'error') {
            console.error('❌ Google Auth error:', response.error);
            console.error('Error code:', response.error?.code);
            console.error('Error message:', response.error?.message);
            console.error('Full error object:', response.error);
            console.error('Response object:', response);
            setIsLoading(false);
            Alert.alert('Authentication Error', response.error?.message || 'Failed to authenticate with Google');
        } else if (response?.type === 'cancel') {
            setIsLoading(false);
            console.log('❌ User cancelled Google Sign-In');
        }
    }, [response, request, promptAsync]);

    // Handle successful Google authentication
    const handleGoogleAuthSuccess = async (authentication) => {
        try {
            const { idToken, accessToken } = authentication;
            
            console.log('✅ Google authentication successful');
            
            // Create a Google credential with the token
            const googleCredential = GoogleAuthProvider.credential(idToken, accessToken);
            
            // Try to sign in to Firebase with the Google credential
            try {
                const userCredential = await signInWithCredential(auth, googleCredential);
                const user = userCredential.user;
                
                console.log('✅ Firebase sign-in successful:', user.uid);
                
                // Check if user exists in Firestore
                const userRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userRef);
                
                if (!userDoc.exists()) {
                    // Create new user document
                    await setDoc(userRef, {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName || '',
                        photoURL: user.photoURL || '',
                        createdAt: new Date().toISOString(),
                        authProviders: ['google'],
                        primaryProvider: 'google',
                    });
                    console.log('✅ New user created in Firestore');
                } else {
                    console.log('✅ User already exists in Firestore');
                }
                
                // Navigate to MainScreen
                navigation.navigate('MainScreen');
                
            } catch (firebaseError) {
                console.log('⚠️ Firebase sign-in failed, trying account linking...');
                
                // Check if it's an account linking error
                if (firebaseError.code === 'auth/account-exists-with-different-credential') {
                    console.log('🔄 Account exists with different credential, attempting to link...');
                    
                    // Show user-friendly message
                    Alert.alert(
                        'Account Already Exists',
                        'This email is already registered with a different sign-in method. Please sign in with your original method first, then you can link Google Sign-In in your profile settings.',
                        [
                            {
                                text: 'OK',
                                onPress: () => {
                                    // Navigate to login screen
                                    navigation.navigate('LogIn');
                                }
                            }
                        ]
                    );
                } else {
                    // Re-throw other Firebase errors
                    throw firebaseError;
                }
            }
            
        } catch (error) {
            console.error('❌ Firebase sign-in error:', error);
            Alert.alert(
                'Sign-In Error',
                error.message || 'Failed to sign in with Firebase. Please try again.'
            );
        } finally {
            setIsLoading(false);
        }
    };

    // Google Sign-In function
    const handleGoogleSignIn = async () => {
        try {
            setIsLoading(true);
            console.log('=== GOOGLE SIGN-IN DEBUG ===');
            console.log('🔵 Starting Google Sign-In...');
            console.log('🔵 Request config:', request);
            console.log('🔵 Prompt function available:', !!promptAsync);
            
            if (!promptAsync) {
                throw new Error('Prompt function not available - check Google Auth configuration');
            }
            
            const result = await promptAsync();
            console.log('🔵 Prompt result:', result);
            console.log('🔵 Result type:', result?.type);
            
        } catch (error) {
            console.error('❌ Error prompting Google Sign-In:', error);
            console.error('❌ Error details:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });
            setIsLoading(false);
            Alert.alert('Error', `Failed to open Google Sign-In: ${error.message}`);
        }
    };

    // הסרת הכותרת העליונה ומניעת חזרה אחורה
    React.useEffect(() => {
        nav.setOptions({
            headerShown: false,
            header: () => null,
            gestureEnabled: false,
        });
    }, []);




    return (
        // תמונת רקע למסך
        <ImageBackground 
            source={backgroundImage}
            style={styles.background}
            resizeMode="cover"
        >
            {/* שכבת כיסוי כהה */}
            <View style={styles.overlay}>
                <View style={styles.content}>
                    {/* טקסטים ראשיים */}
                    <Text style={styles.welcomeText}>Welcome to</Text>
                    <Text style={styles.appName}>SocialVault</Text>
                    <Text style={styles.subtitle}>Your Personal Social Media Manager</Text>
                    
                    {/* מיכל הכפתורים */}
                    <View style={styles.buttonContainer}>
                        {/* כפתור הרשמה */}
                        <TouchableOpacity 
                            style={[styles.button, styles.signUpButton]}
                            onPress={() => navigation.navigate('SignUp')}
                        >
                            <MaterialIcons name="person-add" size={24} color="white" />
                            <Text style={styles.buttonText}>Sign Up</Text>
                        </TouchableOpacity>

                        {/* כפתור התחברות */}
                        <TouchableOpacity 
                            style={[styles.button, styles.loginButton]}
                            onPress={() => navigation.navigate('LogIn')}
                        >
                            <MaterialIcons name="login" size={24} color="white" />
                            <Text style={styles.buttonText}>Log In</Text>
                        </TouchableOpacity>

                        {/* Divider */}
                        <View style={styles.dividerContainer}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>OR</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* Google Sign-In Button */}
                        <TouchableOpacity 
                            style={[styles.googleButton, isLoading && styles.buttonDisabled]} 
                            onPress={handleGoogleSignIn}
                            disabled={isLoading}
                        >
                            <View style={styles.googleButtonContent}>
                                <View style={styles.googleIconContainer}>
                                    <Image source={googleIcon} style={styles.googleIconImage} />
                                </View>
                                <Text style={styles.googleButtonText}>Continue With Google</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </ImageBackground>
    );
};

// הגדרות העיצוב של המסך
const styles = StyleSheet.create({
    // עיצוב תמונת הרקע
    background: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    // שכבת הכיסוי הכהה
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // מיכל התוכן הראשי
    content: {
        width: '80%',
        alignItems: 'center',
    },
    // עיצוב טקסט הברוכים הבאים
    welcomeText: {
        color: '#fff',
        fontSize: 32,
        fontWeight: '300',
        marginBottom: 5,
    },
    // עיצוב שם האפליקציה
    appName: {
        color: '#fff',
        fontSize: 48,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    // עיצוב כותרת המשנה
    subtitle: {
        color: '#fff',
        fontSize: 16,
        marginBottom: 40,
        textAlign: 'center',
    },
    // מיכל הכפתורים
    buttonContainer: {
        width: '100%',
        gap: 15,
    },
    // עיצוב בסיסי לכפתורים
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
        borderRadius: 25,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    // עיצוב כפתור ההרשמה
    signUpButton: {
        backgroundColor: '#4A90E2',
    },
    // עיצוב כפתור ההתחברות
    loginButton: {
        backgroundColor: '#2C3E50',
    },
    // עיצוב טקסט הכפתורים
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 10,
    },
    // Google Button Styles
    googleButton: {
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 25,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    googleButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    googleIconContainer: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.2,
        shadowRadius: 1,
        elevation: 2,
    },
    googleIconImage: {
        width: 24,
        height: 24,
        resizeMode: 'contain',
    },
    googleButtonText: {
        color: '#333',
        fontSize: 18,
        fontWeight: '600',
    },
    // Divider Styles
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 15,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    dividerText: {
        color: '#fff',
        fontSize: 16,
        marginHorizontal: 20,
        fontWeight: '500',
    },
    // Disabled Button Style
    buttonDisabled: {
        opacity: 0.6,
    },
});

export default Welcome;
