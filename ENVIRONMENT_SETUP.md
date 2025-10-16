# Environment Variables Setup 🔐

## 🚨 **CRITICAL SECURITY FIX**

Your Firebase API keys are currently hardcoded in the source code. This is a **major security risk**!

---

## 📋 **Steps to Fix:**

### 1. **Create `.env` File**

Create a `.env` file in your project root with these variables:

```bash
# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyDtahOHmldcTlF18moICNtonwzVJbQOW7k
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=social-vault.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=social-vault
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=social-vault.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=929613087809
EXPO_PUBLIC_FIREBASE_APP_ID=1:929613087809:web:e3604efab7634a71bc32c0
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=G-4MEYTEPLQJ

# Cloudinary Configuration (if needed)
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
EXPO_PUBLIC_CLOUDINARY_API_KEY=your_cloudinary_api_key
# Note: Cloudinary API Secret should NOT be in client-side code
```

### 2. **Update Firebase Config**

Update `services/firebase/Config.js` to use environment variables:

```javascript
// ייבוא הפונקציות הנדרשות מ-Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { initializeAuth, getReactNativePersistence, GoogleAuthProvider } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// הגדרות התצורה של Firebase - using environment variables for security
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Rest of the config remains the same...
```

### 3. **Verify `.env` is Ignored**

Check that your `.gitignore` includes:
```
.env
.env.local
.env.development
.env.production
```

### 4. **Test the Configuration**

After making changes:
```bash
# Restart your development server
expo start --clear

# Test that the app still works
# Check that Firebase connection is successful
```

---

## 🔒 **Additional Security Steps:**

### 5. **Set Up Firebase App Restrictions**

Go to Firebase Console:
1. Project Settings → General
2. Your apps → Web app
3. Click settings icon (gear)
4. Add app restrictions:
   - **iOS Bundle ID**: `com.yourcompany.socialvault`
   - **Android Package Name**: `com.yourcompany.socialvault`
   - **Website domains**: `your-domain.com` (if you have one)

### 6. **Regenerate API Key (Recommended)**

Since the key was exposed in git history:
1. Firebase Console → Project Settings → General
2. Your apps → Web app → Settings
3. Regenerate API key
4. Update your `.env` file with the new key

---

## ⚠️ **Important Notes:**

- **NEVER** commit `.env` files to git
- **ALWAYS** use `EXPO_PUBLIC_` prefix for client-side variables
- **Server-side secrets** (like Cloudinary API secret) should be in Cloud Functions only
- **Test thoroughly** after making changes

---

## 🎯 **After Completing This:**

1. ✅ API keys are secure
2. ✅ No sensitive data in git
3. ✅ App restrictions are active
4. ✅ Ready for production deployment

---

**Priority**: 🔴 **CRITICAL - Do this immediately!**
