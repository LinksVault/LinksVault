# 🔧 Google Auth Debugging Guide

## 🎯 **Current Status: Debugging Google Auth in Development**

### **Current Configuration:**
```javascript
// screens/Welcome.js
const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: '929613087809-ikkratjtck01qme47a4ilc6eqs867jt8.apps.googleusercontent.com',
    androidClientId: '929613087809-5nn229sqjoh9rqj0eou1l49pbr4a94pk.apps.googleusercontent.com',
    expoClientId: '929613087809-ikkratjtck01qme47a4ilc6eqs867jt8.apps.googleusercontent.com',
});
```

---

## 📋 **Debugging Checklist**

### **Step 1: Test Current Setup**
1. **Open app in Expo Go**
2. **Click "Continue With Google"**
3. **Note the exact error message**
4. **Check console logs**

### **Step 2: Verify Google Cloud Console Configuration**

#### **A. Check OAuth Clients**
Go to: [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)

**Web Client ID**: `929613087809-ikkratjtck01qme47a4ilc6eqs867jt8.apps.googleusercontent.com`
- ✅ Should exist
- ✅ Should have proper redirect URIs

**Android Client ID**: `929613087809-5nn229sqjoh9rqj0eou1l49pbr4a94pk.apps.googleusercontent.com`
- ✅ Should exist
- ✅ Should have correct package name: `com.yonatancarmeli.socialvault`

#### **B. Required Redirect URIs for Web Client**
Add these redirect URIs to your **Web Client ID**:
```
https://auth.expo.io/@yonatan_carmeli/socialvault-app
http://localhost:19006/
socialvault://
```

#### **C. Verify Firebase Authentication**
Go to: [Firebase Console - Authentication](https://console.firebase.google.com/project/social-vault/authentication/providers)
- ✅ Google provider should be **ENABLED**
- ✅ Project support email should be set

---

## 🐛 **Common Error Solutions**

### **Error: "invalid_request"**
**Cause**: Missing or incorrect redirect URIs
**Solution**: Add redirect URIs to Web Client ID in Google Cloud Console

### **Error: "DEVELOPER_ERROR"**
**Cause**: Android client configuration issue
**Solution**: Verify package name and SHA-1 fingerprint

### **Error: "access_denied"**
**Cause**: User cancelled or OAuth consent screen issue
**Solution**: Check OAuth consent screen configuration

### **Error: "redirect_uri_mismatch"**
**Cause**: Redirect URI not in authorized list
**Solution**: Add exact redirect URI to Google Cloud Console

---

## 🧪 **Testing Steps**

### **1. Basic Test**
```bash
# Start development server
npx expo start --clear

# Open in Expo Go
# Click "Continue With Google"
# Note any error messages
```

### **2. Console Debugging**
Add this to `screens/Welcome.js` for better debugging:
```javascript
useEffect(() => {
    console.log('=== GOOGLE AUTH DEBUG ===');
    console.log('Request:', request);
    console.log('Response:', response);
    console.log('Prompt function:', !!promptAsync);
}, [request, response, promptAsync]);
```

### **3. Test Different Scenarios**
- Test on Android device
- Test on iOS device (if available)
- Test in web browser
- Test with different Google accounts

---

## 🔧 **Quick Fixes to Try**

### **Fix 1: Add Missing Redirect URI**
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Click on Web Client ID: `929613087809-ikkratjtck01qme47a4ilc6eqs867jt8.apps.googleusercontent.com`
3. Add redirect URI: `https://auth.expo.io/@yonatan_carmeli/socialvault-app`
4. Save and test

### **Fix 2: Verify Package Name**
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Click on Android Client ID: `929613087809-5nn229sqjoh9rqj0eou1l49pbr4a94pk.apps.googleusercontent.com`
3. Verify package name is: `com.yonatancarmeli.socialvault`

### **Fix 3: Enable Firebase Google Auth**
1. Go to [Firebase Console](https://console.firebase.google.com/project/social-vault/authentication/providers)
2. Click "Google" provider
3. Toggle "Enable"
4. Set project support email
5. Save

---

## 📊 **Expected Behavior**

### **✅ Success Flow:**
1. Click "Continue With Google"
2. Browser opens with Google OAuth page
3. User selects Google account
4. User grants permissions
5. Redirects back to app
6. Firebase authentication succeeds
7. User navigates to MainScreen

### **❌ Failure Points:**
1. **Button doesn't respond** → Configuration issue
2. **Browser doesn't open** → Client ID issue
3. **OAuth page shows error** → Redirect URI issue
4. **Authentication fails** → Firebase configuration issue

---

## 🎯 **Next Steps**

1. **Test current setup** and note exact error
2. **Apply quick fixes** based on error message
3. **Test again** after each fix
4. **Document working configuration** once fixed
5. **Apply same configuration** to production build

---

## 📞 **If Still Not Working**

If Google Auth still doesn't work after trying these fixes:
1. **Check console logs** for detailed error messages
2. **Verify all client IDs** are correct
3. **Test with minimal configuration** (just webClientId)
4. **Consider alternative approach** (different OAuth library)

---

**Status**: 🔧 **DEBUGGING IN PROGRESS**  
**Next**: Test current setup and note error messages  
**Goal**: Get Google Auth working in development first
