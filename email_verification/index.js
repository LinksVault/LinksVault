/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onCall, onRequest} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const cors = require("cors")({origin: true});

// Initialize Firebase Admin
admin.initializeApp();

// Create email transporter (you'll configure this with your email service)
const transporter = nodemailer.createTransport({
  service: "gmail", // You can change this to 'outlook', 'yahoo', etc.
  auth: {
    user: "noreply.socialvault.app@gmail.com", // Replace with your actual email
    pass: "ezbs pzli uqnc iymt", // Replace with your Gmail app password
  },
});

/**
 * Rate limiting function using Firestore
 * Limits requests per email address to prevent abuse
 */
async function checkRateLimit(email, limitType) {
  const db = admin.firestore();
  const rateLimitRef = db.collection("rateLimits").doc(`${limitType}_${email}`);
  
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = limitType === 'verification' ? 3 : 5; // 3 for verification, 5 for password reset
  
  try {
    const doc = await rateLimitRef.get();
    
    if (doc.exists) {
      const data = doc.data();
      const resetTime = data.resetTime;
      
      // Check if window has expired
      if (now > resetTime) {
        // Reset the counter
        await rateLimitRef.set({
          count: 1,
          resetTime: now + windowMs,
          lastRequest: now
        });
        return { allowed: true, remainingRequests: maxRequests - 1 };
      }
      
      // Window still active, check count
      if (data.count >= maxRequests) {
        const waitTime = Math.ceil((resetTime - now) / 1000 / 60); // minutes
        return { 
          allowed: false, 
          message: `Too many requests. Please try again in ${waitTime} minutes.`,
          remainingRequests: 0
        };
      }
      
      // Increment counter
      await rateLimitRef.update({
        count: admin.firestore.FieldValue.increment(1),
        lastRequest: now
      });
      
      return { allowed: true, remainingRequests: maxRequests - (data.count + 1) };
    } else {
      // First request
      await rateLimitRef.set({
        count: 1,
        resetTime: now + windowMs,
        lastRequest: now
      });
      return { allowed: true, remainingRequests: maxRequests - 1 };
    }
  } catch (error) {
    console.error("Rate limit check error:", error);
    // On error, allow the request (fail open)
    return { allowed: true, remainingRequests: maxRequests };
  }
}

/**
 * Cloud Function to send verification email
 */
exports.sendVerificationEmail = onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.status(200).send();
        return;
      }

      const {email, userName} = req.body;

      // Validate input
      if (!email || !userName) {
        res.status(400).json({ error: "Email and userName are required" });
        return;
      }

      // Rate limiting check
      const rateLimit = await checkRateLimit(email, 'verification');
      if (!rateLimit.allowed) {
        console.log(`⚠️ Rate limit exceeded for ${email}`);
        res.status(429).json({ 
          error: rateLimit.message,
          retryAfter: 900 // 15 minutes in seconds
        });
        return;
      }
      console.log(`✅ Rate limit OK for ${email}, remaining: ${rateLimit.remainingRequests}`);

      // Generate 6-digit verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Create simple email content
      const mailOptions = {
        from: "noreply.socialvault.app@gmail.com", // Replace with your actual email
        to: email,
        subject: "Verify Your LinksVault Account",
        html: "<h1>Hello " + userName + "!</h1><p>Your verification code is: <strong>" + verificationCode + "</strong></p><p>This code will expire in 10 minutes.</p>",
      };

      // Send the email
      await transporter.sendMail(mailOptions);

      // Store verification code securely in Firestore
      const db = admin.firestore();
      const verificationData = {
        email: email,
        code: verificationCode,
        userName: userName,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + 10 * 60 * 1000),
        ), // 10 minutes
        used: false,
      };

      // Store in a separate collection for verification codes
      await db.collection("verificationCodes").add(verificationData);

      console.log(`Verification email sent successfully to ${email}`);

      res.status(200).json({
        success: true,
        message: "Verification email sent successfully",
      });
    } catch (error) {
      console.error("Failed to send verification email:", error);
      res.status(500).json({ error: "Failed to send verification email" });
    }
  });
});

/**
 * Cloud Function to verify the entered code
 */
exports.verifyCode = onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.status(200).send();
        return;
      }

      const {email, code} = req.body;

      console.log('🔍 Verifying code for email:', email);
      console.log('🔑 Code received:', code);

      // Validate input
      if (!email || !code) {
        res.status(400).json({ error: "Email and code are required" });
        return;
      }

      const db = admin.firestore();

      // Find the verification code for this email (for signup)
      const verificationQuery = await db.collection("verificationCodes")
          .where("email", "==", email)
          .where("code", "==", code)
          .where("used", "==", false)
          .where("expiresAt", ">", admin.firestore.Timestamp.now())
          .limit(1)
          .get();

      if (!verificationQuery.empty) {
        const verificationDoc = verificationQuery.docs[0];
        // Mark the code as used
        await verificationDoc.ref.update({used: true});
        console.log(`✅ Email verification code verified successfully for ${email}`);
        res.status(200).json({
          success: true,
          message: "Code verified successfully",
        });
        return;
      }

      // Find the reset code for this email (for password reset)
      console.log(`🔍 Searching resetCodes collection for email: ${email}, code: ${code}`);
      
      const resetQuery = await db.collection("resetCodes")
          .where("email", "==", email)
          .where("used", "==", false)
          .limit(5) // Get more results to debug
          .get();

      console.log(`📊 Found ${resetQuery.size} reset codes for email ${email}`);
      
      if (!resetQuery.empty) {
        // Check each document to see what we have
        resetQuery.forEach(doc => {
          const data = doc.data();
          console.log(`📄 Reset code document:`, {
            id: doc.id,
            email: data.email,
            code: data.code,
            codeType: typeof data.code,
            used: data.used,
            expiresAt: data.expiresAt?.toDate(),
            currentTime: new Date(),
            isExpired: data.expiresAt?.toDate() < new Date()
          });
        });
        
        // Now try the full query
        const validResetQuery = await db.collection("resetCodes")
            .where("email", "==", email)
            .where("code", "==", code)
            .where("used", "==", false)
            .where("expiresAt", ">", admin.firestore.Timestamp.now())
            .limit(1)
            .get();

        if (!validResetQuery.empty) {
          console.log(`✅ Password reset code verified successfully for ${email}`);
          res.status(200).json({
            success: true,
            message: "Password reset code verified successfully",
          });
          return;
        } else {
          console.log(`❌ No valid reset code found with full query for ${email}`);
        }
      } else {
        console.log(`❌ No reset codes found at all for ${email}`);
      }

      console.log(`❌ No valid code found for ${email}`);
      res.status(200).json({
        success: false,
        message: "Invalid or expired verification code",
      });
    } catch (error) {
      console.error("Error verifying code:", error);
      res.status(500).json({ error: "Failed to verify code" });
    }
  });
});

/**
 * Cloud Function to send password reset email
 */
exports.sendPasswordResetEmail = onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.status(200).send();
        return;
      }

      const {email, userName} = req.body;

      // Validate input - email is required, userName is optional
      if (!email) {
        res.status(400).json({ error: "Email is required" });
        return;
      }

      // Rate limiting check
      const rateLimit = await checkRateLimit(email, 'password_reset');
      if (!rateLimit.allowed) {
        console.log(`⚠️ Rate limit exceeded for ${email}`);
        res.status(429).json({ 
          error: rateLimit.message,
          retryAfter: 900 // 15 minutes in seconds
        });
        return;
      }
      console.log(`✅ Rate limit OK for ${email}, remaining: ${rateLimit.remainingRequests}`);

      // If userName not provided, try to fetch from Firestore
      let finalUserName = userName;
      if (!finalUserName) {
        try {
          const db = admin.firestore();
          const usersQuery = await db.collection("users")
              .where("email", "==", email)
              .limit(1)
              .get();

          if (!usersQuery.empty) {
            const userData = usersQuery.docs[0].data();
            finalUserName = userData.fullName || "there";
            console.log(`✅ Fetched userName from Firestore: ${finalUserName}`);
          } else {
            finalUserName = "there"; // Fallback greeting
            console.log(`⚠️ No user found for ${email}, using generic greeting`);
          }
        } catch (fetchError) {
          console.error("Error fetching userName:", fetchError);
          finalUserName = "there"; // Fallback on error
        }
      }

      // Generate 6-digit reset code
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Create simple email content
      const mailOptions = {
        from: "noreply.socialvault.app@gmail.com", // Replace with your actual email
        to: email,
        subject: "Reset Your LinksVault Password",
        html: "<h1>Hello " + finalUserName + "!</h1><p>Your password reset code is: <strong>" + resetCode + "</strong></p><p>This code will expire in 10 minutes.</p>",
      };

      // Send the email
      await transporter.sendMail(mailOptions);

      // Store reset code securely in Firestore
      const db = admin.firestore();
      const resetData = {
        email: email,
        code: resetCode,
        userName: finalUserName,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + 10 * 60 * 1000),
        ), // 10 minutes
        used: false,
        type: "password_reset",
      };

      await db.collection("resetCodes").add(resetData);

      console.log(`Password reset email sent successfully to ${email}`);

      res.status(200).json({
        success: true,
        message: "Password reset email sent successfully",
      });
    } catch (error) {
      console.error("Failed to send password reset email:", error);
      res.status(500).json({ error: "Failed to send password reset email" });
    }
  });
});

/**
 * Cloud Function to reset password with verified code
 */
exports.resetPassword = onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.status(200).send();
        return;
      }

      const {email, code, newPassword} = req.body;

      console.log('🔐 Resetting password for email:', email);

      // Validate input
      if (!email || !code || !newPassword) {
        res.status(400).json({
          success: false,
          message: "Email, code, and new password are required",
        });
        return;
      }

      const db = admin.firestore();

      // Find the reset code for this email
      const resetQuery = await db.collection("resetCodes")
          .where("email", "==", email)
          .where("code", "==", code)
          .where("used", "==", false)
          .where("expiresAt", ">", admin.firestore.Timestamp.now())
          .limit(1)
          .get();

      if (resetQuery.empty) {
        console.log(`❌ No valid reset code found for ${email}`);
        res.status(200).json({
          success: false,
          message: "Invalid or expired reset code",
        });
        return;
      }

      const resetDoc = resetQuery.docs[0];

      // Get the user by email and update password
      try {
        const userRecord = await admin.auth().getUserByEmail(email);

        // Update the user's password
        await admin.auth().updateUser(userRecord.uid, {
          password: newPassword,
        });

        // Mark the reset code as used
        await resetDoc.ref.update({used: true});

        console.log(`✅ Password reset successfully for ${email}`);

        res.status(200).json({
          success: true,
          message: "Password reset successfully",
        });
      } catch (authError) {
        console.error("Error updating password:", authError);
        res.status(500).json({
          success: false,
          message: "Failed to update password",
        });
      }
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reset password",
      });
    }
  });
});

/**
 * Automatic cleanup function - runs daily to permanently delete collections
 * that have been in trash for 30+ days
 */
exports.cleanupOldDeletedCollections = onSchedule("0 2 * * *", async (event) => {
  console.log("Starting daily cleanup of old deleted collections...");
  
  try {
    const db = admin.firestore();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Find collections that have been deleted for 30+ days
    const oldDeletedCollections = await db.collection('albums')
      .where('isDeleted', '==', true)
      .where('deletedAt', '<', thirtyDaysAgo.toISOString())
      .get();
    
    console.log(`Found ${oldDeletedCollections.size} collections to permanently delete`);
    
    const deletePromises = [];
    const deletedCollectionIds = [];
    
    oldDeletedCollections.forEach(doc => {
      const collectionData = doc.data();
      deletedCollectionIds.push({
        id: doc.id,
        title: collectionData.title,
        deletedAt: collectionData.deletedAt,
        userId: collectionData.userId
      });
      
      // Delete the collection document
      deletePromises.push(doc.ref.delete());
      
      // Also clean up associated link previews if they exist
      if (collectionData.listLink && collectionData.listLink.length > 0) {
        collectionData.listLink.forEach(link => {
          try {
            const normalizedUrl = link.url.trim();
            const safeDocId = encodeURIComponent(normalizedUrl).replace(/[^a-zA-Z0-9]/g, '_');
            deletePromises.push(
              db.collection('linkPreviews').doc(safeDocId).delete()
            );
          } catch (error) {
            console.log(`Could not clean up preview for ${link.url}:`, error.message);
          }
        });
      }
    });
    
    // Execute all deletions
    await Promise.allSettled(deletePromises);
    
    console.log(`Successfully cleaned up ${deletedCollectionIds.length} old collections:`, 
      deletedCollectionIds.map(c => c.title));
    
    return {
      success: true,
      deletedCount: deletedCollectionIds.length,
      deletedCollections: deletedCollectionIds
    };
    
  } catch (error) {
    console.error("Error during cleanup:", error);
    throw error;
  }
});

/**
 * Cloud Function to delete user account and all associated data
 * This is required for GDPR/CCPA compliance
 */
exports.deleteUserAccount = onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.status(200).send();
        return;
      }

      const { userId, idToken } = req.body;

      console.log(`🗑️ Account deletion requested for userId: ${userId}`);

      // Validate input
      if (!userId || !idToken) {
        res.status(400).json({
          success: false,
          message: "User ID and ID token are required",
        });
        return;
      }

      // Verify the ID token to ensure the user is authenticated
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
        if (decodedToken.uid !== userId) {
          console.log(`❌ Token mismatch: ${decodedToken.uid} !== ${userId}`);
          res.status(403).json({
            success: false,
            message: "Unauthorized: Token does not match user ID",
          });
          return;
        }
      } catch (tokenError) {
        console.error("Error verifying token:", tokenError);
        res.status(401).json({
          success: false,
          message: "Invalid or expired authentication token",
        });
        return;
      }

      const db = admin.firestore();
      const storage = admin.storage();
      const bucket = storage.bucket();

      console.log(`✅ Token verified for user: ${userId}`);

      // Track deletion progress
      const deletionLog = {
        albums: 0,
        generalLinks: 0,
        collections: 0,
        linkPreviews: 0,
        storageFiles: 0,
        verificationCodes: 0,
        resetCodes: 0,
        rateLimits: 0,
      };

      // 1. Delete all user's albums/collections
      console.log(`📦 Deleting albums for user: ${userId}`);
      const albumsSnapshot = await db.collection('albums')
        .where('userId', '==', userId)
        .get();
      
      const albumDeletePromises = [];
      albumsSnapshot.forEach(doc => {
        albumDeletePromises.push(doc.ref.delete());
        deletionLog.albums++;
      });
      await Promise.allSettled(albumDeletePromises);
      console.log(`✅ Deleted ${deletionLog.albums} albums`);

      // 2. Delete all user's general links
      console.log(`🔗 Deleting general links for user: ${userId}`);
      const linksSnapshot = await db.collection('generalLinks')
        .where('userId', '==', userId)
        .get();
      
      const linkDeletePromises = [];
      linksSnapshot.forEach(doc => {
        linkDeletePromises.push(doc.ref.delete());
        deletionLog.generalLinks++;
      });
      await Promise.allSettled(linkDeletePromises);
      console.log(`✅ Deleted ${deletionLog.generalLinks} general links`);

      // 3. Delete all user's collections (if different from albums)
      console.log(`📚 Deleting collections for user: ${userId}`);
      const collectionsSnapshot = await db.collection('collections')
        .where('userId', '==', userId)
        .get();
      
      const collectionDeletePromises = [];
      collectionsSnapshot.forEach(doc => {
        collectionDeletePromises.push(doc.ref.delete());
        deletionLog.collections++;
      });
      await Promise.allSettled(collectionDeletePromises);
      console.log(`✅ Deleted ${deletionLog.collections} collections`);

      // 4. Get user data to find email for cleanup
      let userEmail = null;
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          userEmail = userDoc.data().email;
        }
      } catch (error) {
        console.error("Error fetching user email:", error);
      }

      // 5. Delete verification codes for this user's email
      if (userEmail) {
        console.log(`🔑 Deleting verification codes for: ${userEmail}`);
        const verificationCodesSnapshot = await db.collection('verificationCodes')
          .where('email', '==', userEmail)
          .get();
        
        const verificationDeletePromises = [];
        verificationCodesSnapshot.forEach(doc => {
          verificationDeletePromises.push(doc.ref.delete());
          deletionLog.verificationCodes++;
        });
        await Promise.allSettled(verificationDeletePromises);
        console.log(`✅ Deleted ${deletionLog.verificationCodes} verification codes`);

        // 6. Delete reset codes for this user's email
        console.log(`🔐 Deleting reset codes for: ${userEmail}`);
        const resetCodesSnapshot = await db.collection('resetCodes')
          .where('email', '==', userEmail)
          .get();
        
        const resetDeletePromises = [];
        resetCodesSnapshot.forEach(doc => {
          resetDeletePromises.push(doc.ref.delete());
          deletionLog.resetCodes++;
        });
        await Promise.allSettled(resetDeletePromises);
        console.log(`✅ Deleted ${deletionLog.resetCodes} reset codes`);

        // 7. Delete rate limits for this user's email
        console.log(`⏱️ Deleting rate limits for: ${userEmail}`);
        const rateLimitPatterns = ['verification', 'password_reset'];
        const rateLimitDeletePromises = [];
        for (const pattern of rateLimitPatterns) {
          try {
            const rateLimitDoc = db.collection('rateLimits').doc(`${pattern}_${userEmail}`);
            rateLimitDeletePromises.push(rateLimitDoc.delete());
            deletionLog.rateLimits++;
          } catch (error) {
            console.log(`Could not delete rate limit for ${pattern}:`, error.message);
          }
        }
        await Promise.allSettled(rateLimitDeletePromises);
        console.log(`✅ Deleted ${deletionLog.rateLimits} rate limit entries`);
      }

      // 8. Delete all user's storage files
      console.log(`🖼️ Deleting storage files for user: ${userId}`);
      try {
        // Delete profile images
        const [profileFiles] = await bucket.getFiles({
          prefix: `users/${userId}/profile/`,
        });
        
        const profileDeletePromises = profileFiles.map(file => {
          deletionLog.storageFiles++;
          return file.delete().catch(error => {
            console.log(`Could not delete file ${file.name}:`, error.message);
          });
        });
        await Promise.allSettled(profileDeletePromises);

        // Delete album images
        const [albumFiles] = await bucket.getFiles({
          prefix: `albums/${userId}/`,
        });
        
        const albumFileDeletePromises = albumFiles.map(file => {
          deletionLog.storageFiles++;
          return file.delete().catch(error => {
            console.log(`Could not delete file ${file.name}:`, error.message);
          });
        });
        await Promise.allSettled(albumFileDeletePromises);
        
        console.log(`✅ Deleted ${deletionLog.storageFiles} storage files`);
      } catch (storageError) {
        console.error("Error deleting storage files:", storageError);
        // Continue with deletion even if storage cleanup fails
      }

      // 9. Delete user document from Firestore
      console.log(`👤 Deleting user document: ${userId}`);
      try {
        await db.collection('users').doc(userId).delete();
        console.log(`✅ Deleted user document`);
      } catch (error) {
        console.error("Error deleting user document:", error);
      }

      // 10. Delete Firebase Authentication account
      console.log(`🔥 Deleting Firebase Auth account: ${userId}`);
      try {
        await admin.auth().deleteUser(userId);
        console.log(`✅ Deleted Firebase Auth account`);
      } catch (authError) {
        console.error("Error deleting auth account:", authError);
        res.status(500).json({
          success: false,
          message: "Failed to delete authentication account",
        });
        return;
      }

      console.log(`🎉 Account deletion completed successfully for ${userId}`);
      console.log(`📊 Deletion summary:`, deletionLog);

      res.status(200).json({
        success: true,
        message: "Account deleted successfully",
        deletionSummary: deletionLog,
      });
    } catch (error) {
      console.error("Error deleting user account:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete account. Please try again.",
        error: error.message,
      });
    }
  });
});

/**
 * One-time cleanup function to remove orphaned user documents
 * (Users in Firestore without corresponding Firebase Auth accounts)
 * 
 * This is a maintenance function to clean up users that were deleted
 * before the proper account deletion system was implemented.
 * 
 * IMPORTANT: This should only be called by administrators
 */
exports.cleanupOrphanedUsers = onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.status(200).send();
        return;
      }

      // SECURITY: Require an admin secret key
      const { adminSecret } = req.body;
      
      // You should set this as an environment variable in Firebase
      // Run: firebase functions:config:set admin.secret="your-secret-key-here"
      const expectedSecret = process.env.ADMIN_SECRET || "your-secure-secret-key-here";
      
      if (adminSecret !== expectedSecret) {
        console.log('❌ Unauthorized cleanup attempt');
        res.status(403).json({
          success: false,
          message: "Unauthorized: Invalid admin secret",
        });
        return;
      }

      console.log('🧹 Starting orphaned users cleanup...');

      const db = admin.firestore();
      const cleanupLog = {
        totalUsersChecked: 0,
        orphanedUsersFound: 0,
        orphanedUsersDeleted: 0,
        orphanedUserData: [],
        errors: [],
      };

      // Get all user documents from Firestore
      const usersSnapshot = await db.collection('users').get();
      cleanupLog.totalUsersChecked = usersSnapshot.size;

      console.log(`📊 Found ${usersSnapshot.size} user documents in Firestore`);

      // Check each user document
      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();

        try {
          // Try to get the Firebase Auth user
          await admin.auth().getUser(userId);
          // User exists in Auth, skip
          console.log(`✅ User ${userId} has Auth account - OK`);
        } catch (error) {
          // User doesn't exist in Auth (orphaned)
          if (error.code === 'auth/user-not-found') {
            console.log(`🗑️ Found orphaned user: ${userId} (${userData.email || 'no email'})`);
            
            cleanupLog.orphanedUsersFound++;
            cleanupLog.orphanedUserData.push({
              userId: userId,
              email: userData.email || 'unknown',
              fullName: userData.fullName || 'unknown',
              createdAt: userData.createdAt || 'unknown',
            });

            // Delete the orphaned user document
            try {
              await userDoc.ref.delete();
              cleanupLog.orphanedUsersDeleted++;
              console.log(`✅ Deleted orphaned user document: ${userId}`);
              
              // Also clean up their data (albums, links, etc.)
              await cleanupOrphanedUserData(db, userId, userData.email);
              
            } catch (deleteError) {
              console.error(`❌ Failed to delete user ${userId}:`, deleteError);
              cleanupLog.errors.push({
                userId: userId,
                error: deleteError.message,
              });
            }
          } else {
            console.error(`❌ Error checking user ${userId}:`, error);
            cleanupLog.errors.push({
              userId: userId,
              error: error.message,
            });
          }
        }
      }

      console.log('🎉 Orphaned users cleanup completed');
      console.log('📊 Summary:', cleanupLog);

      res.status(200).json({
        success: true,
        message: "Orphaned users cleanup completed",
        summary: cleanupLog,
      });
    } catch (error) {
      console.error("Error during orphaned users cleanup:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cleanup orphaned users",
        error: error.message,
      });
    }
  });
});

/**
 * Helper function to clean up data for an orphaned user
 */
async function cleanupOrphanedUserData(db, userId, userEmail) {
  console.log(`🧹 Cleaning up data for orphaned user: ${userId}`);
  
  const cleanupPromises = [];

  // Delete albums
  const albumsSnapshot = await db.collection('albums')
    .where('userId', '==', userId)
    .get();
  
  albumsSnapshot.forEach(doc => {
    cleanupPromises.push(doc.ref.delete());
  });
  console.log(`  📦 Found ${albumsSnapshot.size} albums to delete`);

  // Delete general links
  const linksSnapshot = await db.collection('generalLinks')
    .where('userId', '==', userId)
    .get();
  
  linksSnapshot.forEach(doc => {
    cleanupPromises.push(doc.ref.delete());
  });
  console.log(`  🔗 Found ${linksSnapshot.size} links to delete`);

  // Delete collections
  const collectionsSnapshot = await db.collection('collections')
    .where('userId', '==', userId)
    .get();
  
  collectionsSnapshot.forEach(doc => {
    cleanupPromises.push(doc.ref.delete());
  });
  console.log(`  📚 Found ${collectionsSnapshot.size} collections to delete`);

  // Delete verification/reset codes if email exists
  if (userEmail) {
    const verificationCodesSnapshot = await db.collection('verificationCodes')
      .where('email', '==', userEmail)
      .get();
    
    verificationCodesSnapshot.forEach(doc => {
      cleanupPromises.push(doc.ref.delete());
    });

    const resetCodesSnapshot = await db.collection('resetCodes')
      .where('email', '==', userEmail)
      .get();
    
    resetCodesSnapshot.forEach(doc => {
      cleanupPromises.push(doc.ref.delete());
    });

    // Delete rate limits
    const rateLimitPatterns = ['verification', 'password_reset'];
    for (const pattern of rateLimitPatterns) {
      try {
        cleanupPromises.push(
          db.collection('rateLimits').doc(`${pattern}_${userEmail}`).delete()
        );
      } catch (error) {
        // Ignore if doesn't exist
      }
    }
  }

  // Execute all deletions
  await Promise.allSettled(cleanupPromises);
  console.log(`  ✅ Cleaned up ${cleanupPromises.length} items for user ${userId}`);
}

/**
 * Cleanup expired and used temporary data
 * Removes old verification codes, reset codes, and rate limits
 * 
 * This should be run periodically to clean up accumulated temporary data
 */
exports.cleanupExpiredCodes = onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.status(200).send();
        return;
      }

      // SECURITY: Require an admin secret key
      const { adminSecret } = req.body;
      
      const expectedSecret = process.env.ADMIN_SECRET || "your-secure-secret-key-here";
      
      if (adminSecret !== expectedSecret) {
        console.log('❌ Unauthorized cleanup attempt');
        res.status(403).json({
          success: false,
          message: "Unauthorized: Invalid admin secret",
        });
        return;
      }

      console.log('🧹 Starting cleanup of expired codes...');

      const db = admin.firestore();
      const now = admin.firestore.Timestamp.now();
      
      const cleanupLog = {
        verificationCodes: {
          expired: 0,
          used: 0,
        },
        resetCodes: {
          expired: 0,
          used: 0,
        },
        rateLimits: {
          old: 0,
        },
        errors: [],
      };

      // 1. Clean up expired and used verification codes
      console.log('🔑 Cleaning up verification codes...');
      
      // Get used verification codes
      const usedVerificationCodes = await db.collection('verificationCodes')
        .where('used', '==', true)
        .get();
      
      const verificationDeletePromises = [];
      usedVerificationCodes.forEach(doc => {
        verificationDeletePromises.push(doc.ref.delete());
        cleanupLog.verificationCodes.used++;
      });
      
      // Get expired verification codes
      const expiredVerificationCodes = await db.collection('verificationCodes')
        .where('expiresAt', '<', now)
        .get();
      
      expiredVerificationCodes.forEach(doc => {
        verificationDeletePromises.push(doc.ref.delete());
        cleanupLog.verificationCodes.expired++;
      });
      
      await Promise.allSettled(verificationDeletePromises);
      console.log(`✅ Deleted ${cleanupLog.verificationCodes.used} used and ${cleanupLog.verificationCodes.expired} expired verification codes`);

      // 2. Clean up expired and used reset codes
      console.log('🔐 Cleaning up reset codes...');
      
      // Get used reset codes
      const usedResetCodes = await db.collection('resetCodes')
        .where('used', '==', true)
        .get();
      
      const resetDeletePromises = [];
      usedResetCodes.forEach(doc => {
        resetDeletePromises.push(doc.ref.delete());
        cleanupLog.resetCodes.used++;
      });
      
      // Get expired reset codes
      const expiredResetCodes = await db.collection('resetCodes')
        .where('expiresAt', '<', now)
        .get();
      
      expiredResetCodes.forEach(doc => {
        resetDeletePromises.push(doc.ref.delete());
        cleanupLog.resetCodes.expired++;
      });
      
      await Promise.allSettled(resetDeletePromises);
      console.log(`✅ Deleted ${cleanupLog.resetCodes.used} used and ${cleanupLog.resetCodes.expired} expired reset codes`);

      // 3. Clean up old rate limits (older than 24 hours)
      console.log('⏱️ Cleaning up old rate limits...');
      
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      const rateLimitsSnapshot = await db.collection('rateLimits').get();
      
      const rateLimitDeletePromises = [];
      rateLimitsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.lastRequest && data.lastRequest < oneDayAgo) {
          rateLimitDeletePromises.push(doc.ref.delete());
          cleanupLog.rateLimits.old++;
        }
      });
      
      await Promise.allSettled(rateLimitDeletePromises);
      console.log(`✅ Deleted ${cleanupLog.rateLimits.old} old rate limits`);

      console.log('🎉 Expired codes cleanup completed');
      console.log('📊 Summary:', cleanupLog);

      res.status(200).json({
        success: true,
        message: "Expired codes cleanup completed",
        summary: cleanupLog,
      });
    } catch (error) {
      console.error("Error during expired codes cleanup:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cleanup expired codes",
        error: error.message,
      });
    }
  });
});
