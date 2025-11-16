import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ImageBackground, TouchableOpacity, Animated, StatusBar, useWindowDimensions, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../services/firebase/Config';
import { showAppDialog } from '../context/DialogContext';
import { doc, setDoc, getDoc } from 'firebase/firestore';

// ייבוא תמונות
const backgroundImage = require('../assets/LinksVaultBackground.png');
const googleIcon = require('../assets/GoogleIcon.png');

const Welcome = ({ navigation }) => {
    // הגדרת משתני ניווט
    const nav = useNavigation();
    const [isLoading, setIsLoading] = useState(false);
    const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
    
    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const logoRotation = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const orbitalAnim = useRef(new Animated.Value(0)).current;
    
    // Initialize Google Sign-In for both platforms
    useEffect(() => {
        GoogleSignin.configure({
            webClientId: '929613087809-ikkratjtck01qme47a4ilc6eqs867jt8.apps.googleusercontent.com',
            // iosClientId not needed for Android development - add when testing iOS
            scopes: ['profile', 'email'],
            offlineAccess: true,
        });
        
        // Entrance animations
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 50,
                friction: 7,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 800,
                useNativeDriver: true,
            }),
        ]).start();
        
        // Continuous pulse animation for logo
        const pulseAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.1,
                    duration: 2000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                }),
            ])
        );
        pulseAnimation.start();
        
        // Orbital rotation animation
        const orbitalAnimation = Animated.loop(
            Animated.timing(orbitalAnim, {
                toValue: 1,
                duration: 20000,
                useNativeDriver: true,
            })
        );
        orbitalAnimation.start();
    }, []);

    // Handle successful Google authentication
    const handleGoogleAuthSuccess = async (firebaseUser, googleUserInfo) => {
        try {
            console.log('=== HANDLING GOOGLE AUTH SUCCESS ===');
            console.log('Firebase user:', firebaseUser);
            console.log('Google user info:', googleUserInfo);
            
            const user = firebaseUser;
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (!userDoc.exists()) {
                // Create new user document
                await setDoc(userDocRef, {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || googleUserInfo.user.name,
                    photoURL: user.photoURL || googleUserInfo.user.photo,
                    provider: 'google',
                    createdAt: new Date(),
                    lastLoginAt: new Date(),
                });
                console.log('✅ New user document created');
            } else {
                // Update last login time
                await setDoc(userDocRef, {
                    lastLoginAt: new Date(),
                }, { merge: true });
                console.log('✅ User document updated');
            }
            
            console.log('✅ Google Auth flow completed successfully');
            setIsLoading(false);
            
            // Navigate to main screen
            navigation.navigate('MainScreen');
            
        } catch (error) {
            console.error('❌ Error in handleGoogleAuthSuccess:', error);
            setIsLoading(false);
            showAppDialog('Error', 'Failed to complete Google authentication');
        }
    };

    const handleOpenTerms = () => {
        navigation.navigate('TermsAndConditions');
    };

    const handleOpenPrivacy = () => {
        navigation.navigate('PrivacyPolicy');
    };

    // Google Sign-In function
    const handleGoogleSignIn = async () => {
        try {
            setIsLoading(true);
            console.log('=== NATIVE GOOGLE SIGN-IN DEBUG ===');
            console.log('🔵 Starting Native Google Sign-In...');
            
            // Check if your device supports Google Play
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
            
            // Sign in
            const userInfo = await GoogleSignin.signIn();
            console.log('🔵 Sign-in successful:', userInfo);
            
            // Create a Google credential with the token
            const googleCredential = GoogleAuthProvider.credential(userInfo.data.idToken);
            
            // Sign-in the user with the credential
            const userCredential = await signInWithCredential(auth, googleCredential);
            console.log('✅ Firebase sign-in successful:', userCredential.user);
            
            // Handle user data
            await handleGoogleAuthSuccess(userCredential.user, userInfo);
            
        } catch (error) {
            console.error('❌ Error with native Google Sign-In:', error);
            console.error('❌ Error details:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });
            setIsLoading(false);
            
            if (error.code === 'SIGN_IN_CANCELLED') {
                console.log('❌ User cancelled Google Sign-In');
            } else {
                showAppDialog('Error', `Failed to sign in with Google: ${error.message}`);
            }
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




    // Orbital rotation interpolation
    const orbitalRotation = orbitalAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });
    
    // Create orbital dots (animated circles)
    const renderOrbitalDots = () => {
        const dots = [];
        for (let i = 0; i < 8; i++) {
            const initialAngle = (i * 45) * (Math.PI / 180);
            const radius = 90;
            const opacity = 0.5 + (i % 2) * 0.5;
            
            dots.push(
                <Animated.View
                    key={i}
                    style={[
                        styles.orbitalDot,
                        {
                            transform: [
                                {
                                    translateX: orbitalAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [
                                            Math.cos(initialAngle) * radius,
                                            Math.cos(initialAngle + Math.PI * 2) * radius
                                        ],
                                    }),
                                },
                                {
                                    translateY: orbitalAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [
                                            Math.sin(initialAngle) * radius,
                                            Math.sin(initialAngle + Math.PI * 2) * radius
                                        ],
                                    }),
                                },
                            ],
                            opacity: opacity,
                        },
                    ]}
                />
            );
        }
        return dots;
    };

    return (
        <>
            <StatusBar 
                barStyle="light-content" 
                translucent={true} 
                backgroundColor="transparent" 
            />
            <View style={styles.container}>
                {/* תמונת רקע למסך */}
                <ImageBackground 
                    source={backgroundImage}
                    style={styles.background}
                    resizeMode="cover"
                    imageStyle={styles.backgroundImage}
                >
                {/* שכבת כיסוי מעודן */}
                <View style={styles.overlay}>
                <Animated.View 
                    style={[
                        styles.content,
                        {
                            opacity: fadeAnim,
                            transform: [
                                { scale: scaleAnim },
                                { translateY: slideAnim },
                            ],
                        },
                    ]}
                >
                    {/* Logo/Icon Area with Pulse Animation and Orbital Elements */}
                    <View style={styles.logoWithOrbitContainer}>
                        {/* Animated Orbital Elements - centered around logo */}
                        <View style={styles.orbitalContainer}>
                            {renderOrbitalDots()}
                            <Animated.View 
                                style={[
                                    styles.orbitalRing,
                                    {
                                        transform: [{ rotate: orbitalRotation }],
                                    }
                                ]} 
                            />
                        </View>
                        
                        {/* Logo with Pulse Animation */}
                        <Animated.View 
                            style={[
                                styles.logoContainer,
                                {
                                    transform: [{ scale: pulseAnim }],
                                    zIndex: 2,
                                }
                            ]}
                        >
                        <View style={styles.logoSafe}>
                            <View style={styles.safeBody}>
                                <View style={styles.safeDial}>
                                    <View style={styles.dialCenter} />
                                    {[...Array(8)].map((_, i) => (
                                        <View 
                                            key={i}
                                            style={[
                                                styles.dialDot,
                                                {
                                                    transform: [
                                                        { rotate: `${i * 45}deg` },
                                                        { translateY: -8 }
                                                    ]
                                                }
                                            ]} 
                                        />
                                    ))}
                                </View>
                            </View>
                        </View>
                    </Animated.View>
                    </View>
                    
                    {/* טקסטים ראשיים */}
                    <Animated.Text 
                        style={[
                            styles.welcomeText,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: slideAnim }],
                            }
                        ]}
                    >
                        Welcome to
                    </Animated.Text>
                    <Animated.Text 
                        style={[
                            styles.appName,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: slideAnim }],
                            }
                        ]}
                    >
                        LinksVault
                    </Animated.Text>
                    <Animated.Text 
                        style={[
                            styles.subtitle,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: slideAnim }],
                            }
                        ]}
                    >
                        Your Personal Links Manager
                    </Animated.Text>
                    
                    {/* מיכל הכפתורים */}
                    <Animated.View 
                        style={[
                            styles.buttonContainer,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: slideAnim }],
                            }
                        ]}
                    >
                        {/* כפתור הרשמה */}
                        <TouchableOpacity 
                            style={[styles.button, styles.signUpButton]}
                            onPress={() => navigation.navigate('SignUp')}
                            activeOpacity={0.8}
                        >
                            <MaterialIcons name="person-add" size={24} color="white" />
                            <Text style={styles.buttonText}>Sign Up</Text>
                        </TouchableOpacity>

                        {/* כפתור התחברות */}
                        <TouchableOpacity 
                            style={[styles.button, styles.loginButton]}
                            onPress={() => navigation.navigate('LogIn')}
                            activeOpacity={0.8}
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
                            style={[styles.button, styles.googleButton, isLoading && styles.buttonDisabled]} 
                            onPress={handleGoogleSignIn}
                            disabled={isLoading}
                            activeOpacity={0.8}
                        >
                            <View style={styles.googleIconContainer}>
                                <Image source={googleIcon} style={styles.googleIconImage} />
                            </View>
                            <Text style={styles.googleButtonText}>Continue With Google</Text>
                        </TouchableOpacity>
                    </Animated.View>
                    <Animated.View
                        style={[
                            styles.termsContainer,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: slideAnim }],
                            }
                        ]}
                    >
                        <Text style={styles.termsText}>
                            By continuing you agree to our
                            <Text style={styles.termsLink} onPress={handleOpenTerms}> Terms &amp; Conditions</Text>
                            <Text> and</Text>
                            <Text style={styles.termsLink} onPress={handleOpenPrivacy}> Privacy Policy</Text>
                        </Text>
                    </Animated.View>
                </Animated.View>
                </View>
                </ImageBackground>
            </View>
        </>
    );
};

// הגדרות העיצוב של המסך
const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    // עיצוב תמונת הרקע
    background: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    backgroundImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    // שכבת הכיסוי המעודן
    overlay: {
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(26, 35, 50, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: StatusBar.currentHeight || 0,
    },
    // Logo with Orbit Container - wraps both logo and orbital elements
    logoWithOrbitContainer: {
        width: 200,
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
        position: 'relative',
    },
    // Orbital Container - centered within logoWithOrbitContainer
    orbitalContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 200,
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    orbitalRing: {
        position: 'absolute',
        width: 180,
        height: 180,
        borderRadius: 90,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderStyle: 'dashed',
    },
    orbitalDot: {
        position: 'absolute',
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
    },
    // Logo Container - centered within logoWithOrbitContainer
    logoContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    logoSafe: {
        width: 120,
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
    },
    safeBody: {
        width: 100,
        height: 100,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    safeDial: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#1A3A5C',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    dialCenter: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
    },
    dialDot: {
        position: 'absolute',
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
    },
    // מיכל התוכן הראשי
    content: {
        width: '85%',
        maxWidth: 400,
        alignItems: 'center',
        zIndex: 10,
    },
    // עיצוב טקסט הברוכים הבאים
    welcomeText: {
        color: '#ffffff',
        fontSize: 28,
        fontWeight: '300',
        marginBottom: 8,
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
        letterSpacing: 1,
    },
    // עיצוב שם האפליקציה
    appName: {
        color: '#ffffff',
        fontSize: 52,
        fontWeight: 'bold',
        marginBottom: 12,
        textShadowColor: 'rgba(74, 144, 226, 0.5)',
        textShadowOffset: { width: 0, height: 3 },
        textShadowRadius: 8,
        letterSpacing: 2,
    },
    // עיצוב כותרת המשנה
    subtitle: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 16,
        marginBottom: 30,
        textAlign: 'center',
        fontWeight: '400',
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
        lineHeight: 22,
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
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    // עיצוב כפתור ההתחברות
    loginButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.35)',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.7)',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
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
        borderWidth: 1,
        borderColor: '#ddd',
    },
    googleIconContainer: {
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
    },
    googleIconImage: {
        width: 60,
        height: 60,
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
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
    dividerText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 14,
        marginHorizontal: 20,
        fontWeight: '500',
        letterSpacing: 1,
    },
    // Disabled Button Style
    buttonDisabled: {
        opacity: 0.6,
    },
    termsContainer: {
        marginTop: 15,
        paddingHorizontal: 10,
    },
    termsText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
    },
    termsLink: {
        color: '#4A90E2',
        fontWeight: '600',
    },
});

export default Welcome;
