# 🔧 Google Sign-In Fix for LinksVault

## ✅ Current Status

After renaming from SocialVault to LinksVault, Google Sign-In needs these updates:

### What's Already Correct:
- ✅ Package name: `com.yonatancarmeli.linksvault` (updated everywhere)
- ✅ Android Client 1 SHA-1 matches your debug keystore
- ✅ Web Client ID is configured

### What Needs Fixing:

---

## 🔧 Step-by-Step Fix

### **Step 1: Update Web Client Redirect URIs**

Your Web Client ID: `929613087809-ikkratjtck01qme47a4ilc6eqs867jt8.apps.googleusercontent.com`

**Current redirect URIs in your screenshot:**
1. `https://auth.expo.io/@yonatan_carmeli/linksvault-app` ✅
2. `https://auth.expo.io/+` ✅  
3. `http://localhost:19006/` ✅

These look correct for Expo AuthSession, but you're using the NATIVE library `@react-native-google-signin/google-signin`, which doesn't need these URIs.

**Keep these URIs as they are** - they won't hurt anything.

---

### **Step 2: Verify Android OAuth Clients**

You have **2 Android OAuth clients**:

#### **Client 1: LinksVault Android Development**
- Client ID: `929613087809-5nn229sqjoh9rqj0eou1l49pbr4a94pk.apps.googleusercontent.com`
- Package: `com.yonatancarmeli.linksvault` ✅
- SHA-1: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` ✅

**This one is PERFECT!**

#### **Client 2: LinksVault Android**  
- Client ID: `929613087809-isk2btvdv0p05pvr13vvd3812o2licup.apps.googleusercontent.com`
- Package: `com.yonatancarmeli.linksvault` ✅
- SHA-1: `AE:59:F0:77:FF:77:D4:B6:FF:5A:67:45:AA:BD:82:BD:83:00:6C:17` ❌

**This one has a different SHA-1** (probably from an old build or production keystore).

---

### **Step 3: Update Your Code**

Since you're using the NATIVE `@react-native-google-signin/google-signin` library, you DON'T need iOS Client ID for development. Update `screens/Welcome.js`:

**Current code (lines 31-36):**
```javascript
GoogleSignin.configure({
    webClientId: '929613087809-ikkratjtck01qme47a4ilc6eqs867jt8.apps.googleusercontent.com',
    iosClientId: '929613087809-YOUR_IOS_CLIENT_ID.apps.googleusercontent.com', // ❌ Placeholder
    scopes: ['profile', 'email'],
    offlineAccess: true,
});
```

**Updated code:**
```javascript
GoogleSignin.configure({
    webClientId: '929613087809-ikkratjtck01qme47a4ilc6eqs867jt8.apps.googleusercontent.com',
    // Remove iosClientId for now - not needed for Android testing
    scopes: ['profile', 'email'],
    offlineAccess: true,
});
```

---

### **Step 4: Enable Google Sign-In in Firebase**

1. Go to [Firebase Console - Authentication](https://console.firebase.google.com/project/social-vault/authentication/providers)
2. Click "Google" provider
3. Make sure it's **ENABLED** ✅
4. Verify your **Web Client ID** is: `929613087809-ikkratjtck01qme47a4ilc6eqs867jt8.apps.googleusercontent.com`
5. Set your **Support Email**
6. **Save**

---

### **Step 5: Build and Test**

Since you're using a native library, you CANNOT test in Expo Go. You need a development build:

```bash
# Option 1: Local development build
npx expo run:android

# Option 2: EAS development build
eas build --profile development --platform android
```

Then test the Google Sign-In button!

---

## 🐛 If It Still Doesn't Work

### **Common Issue: Wrong Client ID in Code**

Make sure you're using the **Web Client ID**, NOT the Android Client ID!

**Correct:** `929613087809-ikkratjtck01qme47a4ilc6eqs867jt8.apps.googleusercontent.com`
**Wrong:** `929613087809-5nn229sqjoh9rqj0eou1l49pbr4a94pk.apps.googleusercontent.com`

### **Check Console Logs**

Look for these debug messages in your console:
- 🔵 "Starting Native Google Sign-In..."
- 🔵 "Sign-in successful"
- ✅ "Firebase sign-in successful"

### **Error: "DEVELOPER_ERROR"**

This means SHA-1 or package name mismatch. Verify:
1. Package name in Google Console: `com.yonatancarmeli.linksvault`
2. SHA-1 matches: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`

### **Error: "SIGN_IN_REQUIRED"**

This means Firebase auth issue. Check:
1. Google provider is enabled in Firebase
2. Web Client ID is correct in Firebase settings

---

## 📋 Final Checklist

- [x] Package name updated to `com.yonatancarmeli.linksvault`
- [x] Android OAuth client has correct SHA-1
- [x] Web Client ID in code
- [ ] Remove iOS Client ID placeholder (or add real one)
- [ ] Google provider enabled in Firebase
- [ ] Build development APK (not Expo Go)
- [ ] Test on real Android device

---

## 🎯 Expected Result

After these fixes:
1. Click "Continue With Google" ✅
2. Google account picker opens ✅
3. Select account ✅
4. Return to app ✅
5. Logged in successfully ✅

---

## 📊 Your Current OAuth Clients Summary

| Client Type | Client ID | Package Name | SHA-1 | Status |
|-------------|-----------|--------------|-------|--------|
| Web | `...867jt8` | N/A | N/A | ✅ Correct |
| Android (Dev) | `...4a94pk` | `com.yonatancarmeli.linksvault` | `5E:8F:16...` | ✅ Perfect |
| Android (Prod?) | `...2licup` | `com.yonatancarmeli.linksvault` | `AE:59:F0...` | ⚠️ Different SHA-1 |

**For development, use Android Client 1 (Dev)** - it's already correctly configured!

---

**Next Step:** Update the code to remove the iOS Client ID placeholder, then build and test!

