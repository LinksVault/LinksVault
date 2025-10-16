# 🔧 Fix Google Sign-In 404 Error

## 🚨 **The Problem:**
You're getting a 404 error because the redirect URI `https://social-vault.firebaseapp.com/__/auth/handler` is not authorized in your Google Cloud Console.

## 🔧 **Solution: Configure Redirect URI**

### **Step 1: Go to Google Cloud Console**
1. **Go to [Google Cloud Console](https://console.cloud.google.com/)**
2. **Select your project**: `social-vault`
3. **Go to APIs & Services** → **Credentials**

### **Step 2: Find Your OAuth Client**
1. **Look for "OAuth 2.0 Client IDs"**
2. **Find the client with ID**: `929613087809-37vvlrbbgmuguqcivh7n2dpgq0eljj3p.apps.googleusercontent.com`
3. **Click on it to edit**

### **Step 3: Add Authorized Redirect URIs**
1. **In the "Authorized redirect URIs" section, click "Add URI"**
2. **Add these URIs**:
   ```
   https://social-vault.firebaseapp.com/__/auth/handler
   https://social-vault.firebaseapp.com
   ```
3. **Click "Save"**

### **Step 4: Alternative - Use Firebase Hosting**
If the above doesn't work, try this redirect URI:
```
https://social-vault.web.app/__/auth/handler
```

---

## 🎯 **Quick Fix - Try This First:**

**Update your code to use a simpler redirect URI:**

Replace this line in `screens/Welcome.js`:
```javascript
const firebaseAuthUrl = `https://social-vault.firebaseapp.com/__/auth/handler`;
```

With this:
```javascript
const firebaseAuthUrl = `https://social-vault.web.app/__/auth/handler`;
```

---

## 🔍 **Debug Steps:**

1. **Check the console logs** - you should see the full URL being opened
2. **Try the alternative redirect URI** above
3. **Make sure Google Authentication is enabled** in Firebase Console
4. **Verify the Web Client ID** is correct

---

## ✅ **After Fixing:**

1. **Save your changes**
2. **Test the Google button again**
3. **You should see the Google account picker** (like in your image)
4. **Complete the sign-in process**

The 404 error should be resolved once you add the authorized redirect URI! 🚀
