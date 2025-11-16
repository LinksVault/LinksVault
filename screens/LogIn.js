import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ImageBackground, KeyboardAvoidingView, Platform, Keyboard, Modal, ActivityIndicator, StatusBar } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase/Config';
import { showAppDialog } from '../context/DialogContext';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { sendPasswordResetEmail, verifyCode, resetPasswordWithCode } from '../utils/emailService';

const backgroundImage = require('../assets/LinksVaultBackground.png');

const LogIn = ({ navigation }) => {
  const nav = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Password Reset States
  const [showResetCodeModal, setShowResetCodeModal] = useState(false);
  const [showNewPasswordModal, setShowNewPasswordModal] = useState(false);
  const [resetCode, setResetCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const codeInputRefs = useRef([]);

  React.useEffect(() => {
    nav.setOptions({
      headerShown: false,
      header: () => null,
      gestureEnabled: false,
    });
  }, []);

  // פונקציה לטיפול בתהליך ההתחברות
  const handleLogin = async () => {
    // בדיקה שכל השדות מלאים
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    try {
      // ניסיון להתחבר עם Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
        
      
      console.log('User logged in successfully:', user.email);
      // Navigation will happen automatically due to conditional rendering in App.js
      // No manual navigation needed - the user state change will trigger the navigation stack switch
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Failed to log in. Please try again.';
      
      // טיפול בשגיאות ספציפיות
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email. Please sign up first.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/invalid-login-credentials' || error.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password. Please check your credentials and try again, or sign up if you don\'t have an account yet.';
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        errorMessage = 'This email is already registered with Google Sign-In. Please use "Continue with Google" or link email/password in your profile settings.';
      }
      
      setError(errorMessage);
    }
  };

  // פונקציה לטיפול באיפוס סיסמה - שלב 1: שליחת קוד
  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      // Send password reset email via Cloud Function
      // userName will be fetched server-side with admin access
      const result = await sendPasswordResetEmail(email, null, null);
      
      if (result.success) {
        console.log('✅ Password reset code sent successfully');
        
        // Store the email for later use
        setResetEmail(email);
        
        // Show the code verification modal
        setShowResetCodeModal(true);
        setResetMessage('');
        setError('');
      } else {
        setError('Failed to send reset email. Please try again.');
        setResetMessage('');
      }
    } catch (error) {
      console.error('Password reset error:', error);
      setError('Failed to send reset email. Please try again.');
      setResetMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  // פונקציה לאימות קוד האיפוס - שלב 2
  const handleVerifyResetCode = async () => {
    const codeString = resetCode.join('');
    if (codeString.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      const result = await verifyCode(resetEmail, codeString);
      
      if (result.success) {
        console.log('✅ Reset code verified successfully');
        
        // Close code modal and open new password modal
        setShowResetCodeModal(false);
        setShowNewPasswordModal(true);
        setError('');
      } else {
        setError(result.message || 'Invalid code. Please try again.');
      }
    } catch (error) {
      console.error('Error verifying reset code:', error);
      setError('Failed to verify code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // פונקציה לעדכון סיסמה חדשה - שלב 3
  const handleResetPassword = async () => {
    // Validation
    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password should be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      const codeString = resetCode.join('');
      const result = await resetPasswordWithCode(resetEmail, codeString, newPassword);
      
      if (result.success) {
        console.log('✅ Password reset successfully');
        
        // Close modal and show success message
        setShowNewPasswordModal(false);
        
        showAppDialog(
          'Password Reset Successful! ✅',
          'Your password has been changed successfully. You can now log in with your new password.',
          [
            {
              text: 'OK',
              onPress: () => {
                setResetCode(['', '', '', '', '', '']);
                setNewPassword('');
                setConfirmPassword('');
                setResetEmail('');
                setError('');
                setResetMessage('Password reset successful! You can now log in with your new password.');
              }
            }
          ]
        );
      } else {
        setError(result.message || 'Failed to reset password. Please try again.');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      setError('Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // פונקציה לשליחה מחדש של קוד האיפוס
  const handleResendResetCode = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      // Send password reset email via Cloud Function
      // userName will be fetched server-side with admin access
      const result = await sendPasswordResetEmail(resetEmail, null, null);
      
      if (result.success) {
        showAppDialog('Code Resent', 'A new 6-digit code has been sent to your email.');
        setResetCode(['', '', '', '', '', '']);
      } else {
        setError('Failed to resend code. Please try again.');
      }
    } catch (error) {
      console.error('Error resending code:', error);
      setError('Failed to resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };




  return (
    <>
      <StatusBar 
        barStyle="light-content" 
        translucent={true} 
        backgroundColor="transparent" 
      />
      <View style={{ flex: 1 }}>
        {/* תמונת רקע למסך */}
        <ImageBackground 
          source={backgroundImage}
          style={styles.background}
          resizeMode="cover"
          imageStyle={styles.backgroundImage}
        >
          <View style={styles.overlay}>
        {/* Back Arrow Button */}
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.navigate('Welcome')}
        >
          <MaterialIcons name="arrow-back" size={28} color="white" />
        </TouchableOpacity>

        {/* התאמת המסך למקלדת */}
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <View style={styles.content}>
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>

            {/* שדה קלט לאימייל */}
            <View style={styles.inputContainer}>
              <MaterialIcons name="email" size={24} color="#4A90E2" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                maxLength={100}
              />
              {email ? (
                <TouchableOpacity 
                  onPress={() => { 
                    setEmail(''); 
                    setTimeout(() => Keyboard.dismiss(), 150);
                  }}
                  style={styles.clearButton}
                >
                  <MaterialIcons name="close" size={20} color="#999" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* שדה קלט לסיסמה */}
            <View style={styles.inputContainer}>
              <MaterialIcons name="lock" size={24} color="#4A90E2" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!isPasswordVisible}
                maxLength={128}
              />
              {password ? (
                <TouchableOpacity 
                  onPress={() => { 
                    setPassword(''); 
                    setTimeout(() => Keyboard.dismiss(), 150);
                  }}
                  style={styles.clearButton}
                >
                  <MaterialIcons name="close" size={20} color="#999" />
                </TouchableOpacity>
              ) : null}
              {/* כפתור להצגת/הסתרת סיסמה */}
              <TouchableOpacity 
                onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                style={styles.eyeIcon}
              >
                <MaterialIcons 
                  name={isPasswordVisible ? "visibility-off" : "visibility"} 
                  size={24} 
                  color="#4A90E2" 
                />
              </TouchableOpacity>
            </View>

            {/* הצגת הודעת שגיאה אם קיימת */}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {resetMessage ? <Text style={styles.successText}>{resetMessage}</Text> : null}



            {/* כפתור התחברות */}
            <TouchableOpacity 
              style={styles.button} 
              onPress={handleLogin}
            >
              <MaterialIcons name="login" size={24} color="white" />
              <Text style={styles.buttonText}>Login</Text>
            </TouchableOpacity>

            {/* כפתור איפוס סיסמה */}
            <TouchableOpacity 
              style={[
                styles.forgotPasswordButton,
                isLoading && styles.forgotPasswordButtonLoading
              ]} 
              onPress={handleForgotPassword}
              disabled={isLoading}
            >
              {isLoading ? (
                <View style={styles.forgotPasswordLoadingContainer}>
                  <ActivityIndicator size="small" color="#4A90E2" />
                  <Text style={[styles.forgotPasswordText, styles.forgotPasswordTextLoading]}>
                    Sending Code...
                  </Text>
                </View>
              ) : (
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              )}
            </TouchableOpacity>

            {/* קישור להרשמה */}
            <TouchableOpacity 
              style={styles.signupLink} 
              onPress={() => {
                Keyboard.dismiss();
                setTimeout(() => {
                  navigation.navigate('SignUp');
                }, 100);
              }}
            >
              <Text style={styles.signupLinkText}>
                Don't have an account? <Text style={styles.signupLinkTextBold}>Sign up!</Text>
              </Text>
            </TouchableOpacity>

            {/* Account linking info */}
            <View style={styles.accountLinkingInfo}>
              <MaterialIcons name="info" size={16} color="#4A90E2" />
              <Text style={styles.accountLinkingText}>
                Signed up with Google? Link email/password in your profile for more flexibility.
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>

      {/* Reset Code Verification Modal */}
      <Modal
        visible={showResetCodeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowResetCodeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <MaterialIcons name="lock-reset" size={28} color="#4A90E2" />
              <Text style={styles.modalTitle}>Verify Reset Code</Text>
            </View>
            
            <Text style={styles.modalSubtitle}>
              We've sent a 6-digit code to:
            </Text>
            <Text style={styles.modalEmail}>{resetEmail}</Text>
            
            <Text style={styles.modalInstruction}>
              Please enter the code to continue
            </Text>
            
            {/* Code Input */}
            <View style={styles.modalCodeInputContainer}>
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (codeInputRefs.current[index] = ref)}
                  style={styles.modalCodeInput}
                  value={resetCode[index]}
                  onChangeText={(text) => {
                    if (text.length <= 1 && /^[0-9]*$/.test(text)) {
                      const newCode = [...resetCode];
                      newCode[index] = text;
                      setResetCode(newCode);
                      
                      if (text && index < 5) {
                        setTimeout(() => {
                          codeInputRefs.current[index + 1]?.focus();
                        }, 50);
                      }
                      
                      if (!text && index > 0) {
                        setTimeout(() => {
                          codeInputRefs.current[index - 1]?.focus();
                        }, 50);
                      }
                    }
                  }}
                  onKeyPress={({ nativeEvent }) => {
                    if (nativeEvent.key === 'Backspace' && !resetCode[index] && index > 0) {
                      setTimeout(() => {
                        codeInputRefs.current[index - 1]?.focus();
                      }, 50);
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={1}
                  textAlign="center"
                  autoFocus={index === 0}
                />
              ))}
            </View>
            
            {error ? <Text style={styles.modalErrorText}>{error}</Text> : null}
            
            <TouchableOpacity 
              style={[
                styles.modalVerifyButton,
                resetCode.join('').length === 6 && styles.modalVerifyButtonActive
              ]} 
              onPress={handleVerifyResetCode}
              disabled={resetCode.join('').length !== 6 || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <MaterialIcons name="check-circle" size={24} color="white" />
              )}
              <Text style={styles.modalVerifyButtonText}>
                {isLoading ? 'VERIFYING...' : 'VERIFY CODE'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.modalResendButton}
              onPress={handleResendResetCode}
              disabled={isLoading}
            >
              <Text style={styles.modalResendButtonText}>Resend Code</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => {
                setShowResetCodeModal(false);
                setResetCode(['', '', '', '', '', '']);
                setError('');
              }}
            >
              <MaterialIcons name="close" size={24} color="#999" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* New Password Modal */}
      <Modal
        visible={showNewPasswordModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNewPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <MaterialIcons name="vpn-key" size={28} color="#4A90E2" />
              <Text style={styles.modalTitle}>New Password</Text>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Enter your new password
            </Text>
            
            {/* New Password Input */}
            <View style={styles.passwordInputContainer}>
              <MaterialIcons name="lock" size={24} color="#4A90E2" style={styles.inputIcon} />
              <TextInput
                style={styles.passwordInput}
                placeholder="New Password"
                placeholderTextColor="#999"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!isNewPasswordVisible}
                autoCapitalize="none"
                maxLength={128}
              />
              <TouchableOpacity 
                onPress={() => setIsNewPasswordVisible(!isNewPasswordVisible)}
                style={styles.eyeIconModal}
              >
                <MaterialIcons 
                  name={isNewPasswordVisible ? "visibility-off" : "visibility"} 
                  size={24} 
                  color="#4A90E2" 
                />
              </TouchableOpacity>
            </View>

            {/* Confirm Password Input */}
            <View style={styles.passwordInputContainer}>
              <MaterialIcons name="lock-outline" size={24} color="#4A90E2" style={styles.inputIcon} />
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm Password"
                placeholderTextColor="#999"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!isConfirmPasswordVisible}
                autoCapitalize="none"
                maxLength={128}
              />
              <TouchableOpacity 
                onPress={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)}
                style={styles.eyeIconModal}
              >
                <MaterialIcons 
                  name={isConfirmPasswordVisible ? "visibility-off" : "visibility"} 
                  size={24} 
                  color="#4A90E2" 
                />
              </TouchableOpacity>
            </View>
            
            {error ? <Text style={styles.modalErrorText}>{error}</Text> : null}
            
            <TouchableOpacity 
              style={[
                styles.modalVerifyButton,
                newPassword && confirmPassword && styles.modalVerifyButtonActive
              ]} 
              onPress={handleResetPassword}
              disabled={!newPassword || !confirmPassword || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <MaterialIcons name="check-circle" size={24} color="white" />
              )}
              <Text style={styles.modalVerifyButtonText}>
                {isLoading ? 'RESETTING...' : 'RESET PASSWORD'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => {
                setShowNewPasswordModal(false);
                setNewPassword('');
                setConfirmPassword('');
                setError('');
              }}
            >
              <MaterialIcons name="close" size={24} color="#999" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </ImageBackground>
      </View>
    </>
  );
};

// הגדרות העיצוב של המסך
const styles = StyleSheet.create({
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 35, 50, 0.3)',
    paddingTop: StatusBar.currentHeight || 0,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    width: '80%',
    alignSelf: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 1,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 25,
    marginBottom: 15,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#333',
    fontSize: 16,
  },
  eyeIcon: {
    padding: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90E2',
    padding: 15,
    borderRadius: 25,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  signupLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  signupLinkText: {
    color: '#fff',
    fontSize: 14,
  },
  signupLinkTextBold: {
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  errorText: {
    color: '#ff6b6b',
    textAlign: 'center',
    marginBottom: 10,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: 10,
    borderRadius: 10,
  },
  successText: {
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 10,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    padding: 10,
    borderRadius: 10,
  },
  forgotPasswordButton: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(74, 144, 226, 0.3)',
  },
  forgotPasswordButtonLoading: {
    backgroundColor: 'rgba(74, 144, 226, 0.15)',
    borderWidth: 2,
    borderColor: '#4A90E2',
  },
  forgotPasswordText: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: '600',
  },
  forgotPasswordTextLoading: {
    marginLeft: 8,
  },
  forgotPasswordLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButton: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    margin: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 5,
  },
  modalEmail: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4A90E2',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalInstruction: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 25,
  },
  modalCodeInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 25,
  },
  modalCodeInput: {
    width: 45,
    height: 45,
    borderWidth: 2,
    borderColor: '#4A90E2',
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    backgroundColor: '#ffffff',
  },
  modalErrorText: {
    color: '#e74c3c',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  modalVerifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90E2',
    padding: 15,
    borderRadius: 25,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalVerifyButtonActive: {
    backgroundColor: '#28a745',
  },
  modalVerifyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  modalResendButton: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4A90E2',
    backgroundColor: 'transparent',
  },
  modalResendButtonText: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: '600',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    padding: 5,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 144, 226, 0.05)',
    borderRadius: 15,
    marginBottom: 15,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  passwordInput: {
    flex: 1,
    height: 50,
    color: '#333',
    fontSize: 16,
  },
  eyeIconModal: {
    padding: 10,
  },
  accountLinkingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    paddingHorizontal: 10,
  },
  accountLinkingText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },

});

export default LogIn;

