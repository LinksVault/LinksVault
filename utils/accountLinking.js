import { auth, db } from '../services/firebase/Config';
import { EmailAuthProvider, linkWithCredential, GoogleAuthProvider, fetchSignInMethodsForEmail, updatePassword, reauthenticateWithCredential } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

/**
 * Link email/password to an existing Google account
 * @param {string} email - User's email
 * @param {string} password - Password to link
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const linkEmailPassword = async (email, password) => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, message: 'No user is currently signed in' };
    }
    
    // Check if email/password is already linked
    const signInMethods = await fetchSignInMethodsForEmail(auth, email);
    if (signInMethods.includes('password')) {
      return { success: false, message: 'Email/password is already linked to this account' };
    }
    
    // Create email credential
    const credential = EmailAuthProvider.credential(email, password);
    
    // Link the credential
    await linkWithCredential(user, credential);
    
    // Update Firestore to track the new provider
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const providers = userData.authProviders || [];
      
      if (!providers.includes('password')) {
        await setDoc(userDocRef, {
          ...userData,
          authProviders: [...providers, 'password'],
        }, { merge: true });
      }
    }
    
    return { success: true, message: 'Email/password successfully linked to your account!' };
  } catch (error) {
    console.error('Error linking email/password:', error);
    
    let errorMessage = 'Failed to link email/password';
    if (error.code === 'auth/weak-password') {
      errorMessage = 'Password should be at least 6 characters';
    } else if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'This email is already in use by another account';
    } else if (error.code === 'auth/provider-already-linked') {
      errorMessage = 'Email/password is already linked';
    }
    
    return { success: false, message: errorMessage };
  }
};

/**
 * Update password for an existing email/password account
 * @param {string} password - New password
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const updateEmailPassword = async (password) => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, message: 'No user is currently signed in' };
    }
    
    // For Google-authenticated users, we can't directly update password
    // Instead, we'll create a new credential and link it
    // This will replace the old password if it exists
    const credential = EmailAuthProvider.credential(user.email, password);
    
    try {
      // Try to link the new credential
      await linkWithCredential(user, credential);
      return { success: true, message: 'Password updated successfully!' };
    } catch (linkError) {
      if (linkError.code === 'auth/provider-already-linked') {
        // The provider is already linked, which means we can't update the password
        // from a Google-authenticated session. We need to inform the user about this limitation.
        return { 
          success: false, 
          message: 'Password update requires email/password sign-in. Please sign out, then sign in using your email and current password, and try updating your password again.' 
        };
      }
      throw linkError;
    }
  } catch (error) {
    console.error('Error updating password:', error);
    
    let errorMessage = 'Failed to update password';
    if (error.code === 'auth/weak-password') {
      errorMessage = 'Password should be at least 6 characters';
    } else if (error.code === 'auth/requires-recent-login') {
      errorMessage = 'Please sign in again before updating your password';
    } else if (error.code === 'auth/provider-already-linked') {
      errorMessage = 'Password update requires email/password sign-in. Please sign out, then sign in using your email and current password, and try updating your password again.';
    }
    
    return { success: false, message: errorMessage };
  }
};

/**
 * Check which auth providers are linked to current user
 * @returns {Promise<Array<string>>} Array of provider IDs
 */
export const getLinkedProviders = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return [];
    
    // Get providers from Firestore
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.authProviders || [];
    }
    
    return [];
  } catch (error) {
    console.error('Error getting linked providers:', error);
    return [];
  }
};

/**
 * Check if a specific provider is linked
 * @param {string} provider - Provider to check ('google', 'password', etc.)
 * @returns {Promise<boolean>}
 */
export const isProviderLinked = async (provider) => {
  const providers = await getLinkedProviders();
  return providers.includes(provider);
};

