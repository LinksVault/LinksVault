import { getFunctions } from 'firebase/functions';
import { auth } from '../services/firebase/Config';

// Initialize Firebase Functions
const functions = getFunctions();

// Get the function URLs (Cloud Run URLs from v2 functions)
const functionUrls = {
  sendVerificationEmail: 'https://sendverificationemail-57eyovomeq-uc.a.run.app',
  sendPasswordResetEmail: 'https://sendpasswordresetemail-57eyovomeq-uc.a.run.app',
  verifyCode: 'https://verifycode-57eyovomeq-uc.a.run.app',
  resetPassword: 'https://us-central1-social-vault.cloudfunctions.net/resetPassword',
  deleteUserAccount: 'https://us-central1-social-vault.cloudfunctions.net/deleteUserAccount'
};

/**
 * Send verification email with 6-digit code via Firebase Cloud Functions
 * @param {string} userEmail - The user's email address
 * @param {string} verificationCode - The 6-digit verification code (not used, generated on server)
 * @param {string} userName - The user's full name
 * @returns {Promise} - Email sending result
 */
export const sendVerificationEmail = async (userEmail, verificationCode, userName) => {
  try {
    // Call the Firebase Cloud Function via HTTP
    const response = await fetch(functionUrls.sendVerificationEmail, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userEmail,
        userName: userName
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('Verification email sent successfully via Cloud Function');
      return { 
        success: true, 
        message: 'Verification email sent successfully' 
      };
    } else {
      throw new Error(result.error || 'Failed to send verification email');
    }
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return { success: false, message: 'Failed to send verification email' };
  }
};

/**
 * Send password reset email via Firebase Cloud Functions
 * @param {string} userEmail - The user's email address
 * @param {string} resetCode - The password reset code (not used, generated on server)
 * @param {string} userName - The user's full name
 * @returns {Promise} - Email sending result
 */
export const sendPasswordResetEmail = async (userEmail, resetCode, userName) => {
  try {
    // Call the Firebase Cloud Function via HTTP
    const response = await fetch(functionUrls.sendPasswordResetEmail, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userEmail,
        userName: userName
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('Password reset email sent successfully via Cloud Function');
      return { 
        success: true, 
        message: 'Password reset email sent successfully' 
      };
    } else {
      throw new Error(result.error || 'Failed to send password reset email');
    }
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return { success: false, message: 'Failed to send password reset email' };
  }
};

/**
 * Verify the entered code via Firebase Cloud Functions
 * @param {string} userEmail - The user's email address
 * @param {string} code - The verification code entered by the user
 * @returns {Promise} - Verification result
 */
export const verifyCode = async (userEmail, code) => {
  try {
    // Call the Firebase Cloud Function via HTTP
    const response = await fetch(functionUrls.verifyCode, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userEmail,
        code: code
      })
    });
    
    const result = await response.json();
    
    console.log('Code verification result:', result);
    return result;
  } catch (error) {
    console.error('Failed to verify code:', error);
    return { success: false, message: 'Failed to verify code' };
  }
};

/**
 * Reset password with verified code via Firebase Cloud Functions
 * @param {string} userEmail - The user's email address
 * @param {string} code - The verified reset code
 * @param {string} newPassword - The new password
 * @returns {Promise} - Password reset result
 */
export const resetPasswordWithCode = async (userEmail, code, newPassword) => {
  try {
    // Call the Firebase Cloud Function via HTTP
    const response = await fetch(functionUrls.resetPassword, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userEmail,
        code: code,
        newPassword: newPassword
      })
    });
    
    const result = await response.json();
    
    console.log('Password reset result:', result);
    return result;
  } catch (error) {
    console.error('Failed to reset password:', error);
    return { success: false, message: 'Failed to reset password' };
  }
};

/**
 * Delete user account and all associated data via Firebase Cloud Functions
 * This is required for GDPR/CCPA compliance
 * @param {string} userId - The user's ID
 * @param {string} idToken - The user's ID token for authentication
 * @returns {Promise} - Account deletion result
 */
export const deleteUserAccount = async (userId, idToken) => {
  try {
    console.log('🗑️ Initiating account deletion for userId:', userId);
    
    // Call the Firebase Cloud Function via HTTP
    const response = await fetch(functionUrls.deleteUserAccount, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId,
        idToken: idToken
      })
    });
    
    const result = await response.json();
    
    console.log('Account deletion result:', result);
    
    if (response.ok && result.success) {
      return {
        success: true,
        message: result.message || 'Account deleted successfully',
        deletionSummary: result.deletionSummary
      };
    } else {
      throw new Error(result.message || 'Failed to delete account');
    }
  } catch (error) {
    console.error('Failed to delete account:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to delete account. Please try again.' 
    };
  }
};