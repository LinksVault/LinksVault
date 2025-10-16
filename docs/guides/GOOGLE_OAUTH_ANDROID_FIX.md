# 🔧 Fix for Google OAuth Android Error

## ❌ **The Problem**
You're seeing this error in Hebrew:
```
Custom scheme URIs are not allowed for 'WEB' client type
שגיאה 400: invalid_request
```

This happens because the app is using a **WEB OAuth Client ID** for mobile authentication, but Google doesn't allow web clients to use custom scheme URIs (like `socialvault://`) that are needed for mobile apps.

---

## ✅ **The Solution**

You need **separate OAuth 2.0 Client IDs** for each platform:
- ✅ Web Client ID (already have)
- ⚠️ Android Client ID (need to create)
- ⚠️ iOS Client ID (need to create)

---

## 📋 **Step-by-Step Fix**

### **Step 1: Get Your SHA-1 Fingerprint**

For **Debug/Development builds**, run this command in PowerShell:

```powershell
# For debug keystore (development builds)
keytool -list -v -keystore C:\Users\$env:USERNAME\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android | Select-String "SHA1"
```

For **Production/EAS builds**, get the SHA-1 from EAS:

```bash
eas credentials
```

Then select:
1. Android
2. production
3. Keystore: Manage everything needed to build your project
4. View the keystore
5. Copy the **SHA-1 Fingerprint**

---

### **Step 2: Create Android OAuth Client ID**

1. **Go to Google Cloud Console**: https://console.cloud.google.com/apis/credentials?project=social-vault

2. **Click "Create Credentials"** → **"OAuth 2.0 Client ID"**

3. **Select "Android"** as Application type

4. **Fill in the details**:
   - **Name**: `SocialVault Android`
   - **Package name**: `com.yonatancarmeli.socialvault`
   - **SHA-1 certificate fingerprint**: Paste the SHA-1 from Step 1

5. **Click "Create"**

6. **Copy the Client ID** - it will look like:
   ```
   929613087809-XXXXXXXXXXXXXXXXXXXXXXXX.apps.googleusercontent.com
   ```

---

### **Step 3: Create iOS OAuth Client ID**

1. **In Google Cloud Console**, click **"Create Credentials"** → **"OAuth 2.0 Client ID"**

2. **Select "iOS"** as Application type

3. **Fill in the details**:
   - **Name**: `SocialVault iOS`
   - **Bundle ID**: `com.socialvault.app`

4. **Click "Create"**

5. **Copy the Client ID**

---

### **Step 4: Update Your Code**

Open `screens/Welcome.js` and replace the placeholder client IDs (lines 27-28) with your actual Android and iOS Client IDs:

```javascript
const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: '929613087809-37vvlrbbgmuguqcivh7n2dpgq0eljj3p.apps.googleusercontent.com',
    androidClientId: '929613087809-YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com', // Paste Android Client ID here
    iosClientId: '929613087809-YOUR_IOS_CLIENT_ID.apps.googleusercontent.com', // Paste iOS Client ID here
});
```

---

### **Step 5: Rebuild Your App**

After updating the client IDs, rebuild your development APK:

```bash
eas build --profile development --platform android
```

Or if using Expo Go:
```bash
npx expo start
```

---

## 🎯 **How to Verify It Works**

1. **Install the new build** on your Android device
2. **Tap "Continue With Google"**
3. **You should see**:
   - ✅ Google sign-in page loads (in browser or webview)
   - ✅ You can select your Google account
   - ✅ You can grant permissions
   - ✅ You return to the app and are signed in

**No more error messages!** 🎉

---

## 🔍 **Important Notes**

### **For Debug vs Production Builds:**
- **Debug builds** use the debug keystore SHA-1
- **Production builds** use the production keystore SHA-1 (from EAS)
- You may need to create **two separate Android OAuth clients**:
  - One for debug (using debug keystore SHA-1)
  - One for production (using production/EAS keystore SHA-1)

### **Both Client IDs in the Same Project:**
You can have multiple OAuth client IDs in the same Google Cloud project. Just create both and use the appropriate one.

---

## 📱 **Testing Checklist**

- [ ] Created Android OAuth Client ID with correct package name
- [ ] Added correct SHA-1 fingerprint to Android OAuth client
- [ ] Created iOS OAuth Client ID with correct bundle ID
- [ ] Updated `screens/Welcome.js` with both client IDs
- [ ] Rebuilt the app
- [ ] Tested Google Sign-In on Android device
- [ ] No more "Custom scheme URIs" error

---

## 🆘 **Still Having Issues?**

### **Error: "Sign in with Google temporarily disabled for this app"**
- Make sure the Android package name matches: `com.yonatancarmeli.socialvault`
- Verify the SHA-1 fingerprint is correct
- Wait a few minutes for Google to propagate the changes

### **Error: "redirect_uri_mismatch"**
- Check that your app.json has the correct scheme: `"scheme": "socialvault"`
- Ensure the bundle ID/package name matches exactly

### **OAuth page doesn't open**
- Make sure you're using the latest version of `expo-auth-session`
- Check that `WebBrowser.maybeCompleteAuthSession()` is called at the top level

---

**🎉 Once you complete these steps, Google Sign-In will work perfectly on your Android app!**

