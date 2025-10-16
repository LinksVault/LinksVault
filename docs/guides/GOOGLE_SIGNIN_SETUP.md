# 🔧 Google Sign-In Setup Guide

## 🚨 **IMPORTANT: Get Your Web Client ID**

The Google Sign-In is now properly configured for React Native, but you need to get your **Web Client ID** from Firebase Console.

### **Step 1: Get Web Client ID from Firebase Console**

1. **Go to [Firebase Console](https://console.firebase.google.com/project/social-vault/settings/general)**
2. **Click on Project Settings** (gear icon)
3. **Go to "General" tab**
4. **Scroll down to "Your apps" section**
5. **Find your Web app** (or create one if you don't have it)
6. **Copy the "Web client ID"** - it looks like: `929613087809-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`

### **Step 2: Update the Code**

Replace this line in `screens/Welcome.js`:
```javascript
webClientId: '929613087809-YOUR_WEB_CLIENT_ID.apps.googleusercontent.com', // You need to get this from Firebase Console
```

With your actual Web Client ID:
```javascript
webClientId: '929613087809-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com',
```

### **Step 3: Enable Google Authentication**

1. **Go to [Firebase Console](https://console.firebase.google.com/project/social-vault/authentication/providers)**
2. **Click on Authentication** → **Sign-in method**
3. **Enable Google** provider
4. **Set Project support email**
5. **Save**

### **Step 4: Test**

After updating the Web Client ID, the Google Sign-In button should work properly!

---

## **What Was Fixed:**

✅ **Replaced `signInWithPopup`** (web-only) with `GoogleSignin.signIn()` (React Native)  
✅ **Added proper Google Sign-In configuration**  
✅ **Updated error handling** for React Native  
✅ **Added Google Play Services check**  
✅ **Proper credential handling** with Firebase Auth  

The button should now work correctly once you add your Web Client ID!
