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
        subject: "Verify Your Social-Vault Account",
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
        subject: "Reset Your Social-Vault Password",
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
