# Google Sign-In Setup Guide for SocialVault

## Current Status
Your Google Sign-In is now configured to use `expo-auth-session`, which is the recommended approach for Expo apps.

## Required Steps to Complete Setup

### 1. Install Missing Package
Run this command to install the required build properties package:
```bash
npm install expo-build-properties
```

### 2. Configure Google Cloud Console

#### A. Web Client (Already Created)
Your Web Client ID: `929613087809-ikkratjtck01qme47a4ilc6eqs867jt8.apps.googleusercontent.com`

**Add these Authorized Redirect URIs:**
1. `https://auth.expo.io/@yonatan_carmeli/socialvault-app`
2. `http://localhost:19006/`
3. `socialvault://`

#### B. Android Client (Already Created)
Your Android Client ID: `929613087809-5nn229sqjoh9rqj0eou1l49pbr4a94pk.apps.googleusercontent.com`

**Steps:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your project
3. Click on your Android OAuth client
4. **Make sure the Package Name is:** `com.yonatancarmeli.socialvault`
5. **Add SHA-1 Certificate Fingerprint:**
   - For development, run: `cd android && ./gradlew signingReport`
   - Copy the SHA-1 from the debug variant
   - Paste it in Google Console

#### C. iOS Client (Optional - Create if testing on iOS)
1. Go to Google Cloud Console → Credentials → Create OAuth Client ID
2. Choose "iOS"
3. **Bundle ID:** `com.socialvault.app` (from your app.json)
4. Copy the generated iOS Client ID
5. Replace the placeholder in `Welcome.js` line 26

### 3. Configure Authorized Redirect URIs

For your **Web Client ID**, add ALL of these redirect URIs in Google Cloud Console:

```
https://auth.expo.io/@yonatan_carmeli/socialvault-app
http://localhost:19006/
socialvault://
socialvault://oauth2redirect/google
```

**How to add:**
1. Go to [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
2. Click on your Web Client ID (ends with `867jt8.apps.googleusercontent.com`)
3. Under "Authorized redirect URIs", click "ADD URI"
4. Add each URI above
5. Click "SAVE"

### 4. Rebuild the App

After making configuration changes, you MUST rebuild:

```bash
# Clear cache and reinstall
npx expo prebuild --clean

# For Android
npx expo run:android

# For iOS
npx expo run:ios
```

### 5. Testing

1. Start your development server: `npm start`
2. Press the "Continue With Google" button
3. Check the console logs (look for 🔵 and ✅ messages)
4. If you see errors, check the console for specific error codes

## Common Issues & Solutions

### Issue 1: "DEVELOPER_ERROR"
**Problem:** Wrong OAuth client configuration or missing redirect URIs
**Solution:** 
- Verify your package name in Android matches: `com.yonatancarmeli.socialvault`
- Add ALL redirect URIs listed above to your Web Client in Google Console
- Wait 5-10 minutes after saving changes in Google Console

### Issue 2: "Sign-in was cancelled"
**Problem:** User cancelled or the OAuth screen didn't open properly
**Solution:**
- Make sure you have internet connection
- Try restarting the app
- Check if Google Play Services is updated (Android)

### Issue 3: "SIGN_IN_REQUIRED" or authentication fails
**Problem:** Firebase authentication issue
**Solution:**
- Make sure Firebase Authentication is enabled in your Firebase Console
- Enable Google Sign-In provider in Firebase Console: Authentication → Sign-in method → Google → Enable
- Verify your Web Client ID in Firebase matches the one in your code

### Issue 4: App crashes or doesn't open Google Sign-In
**Problem:** Missing native configuration
**Solution:**
- Run: `npx expo prebuild --clean`
- Rebuild the app completely
- Make sure expo-build-properties is installed

## Verification Checklist

- [ ] Installed expo-build-properties package
- [ ] Added all redirect URIs to Web Client in Google Cloud Console
- [ ] Verified Android package name matches: `com.yonatancarmeli.socialvault`
- [ ] Added SHA-1 fingerprint for Android client
- [ ] Enabled Google Sign-In in Firebase Authentication
- [ ] Rebuilt the app with `npx expo prebuild --clean`
- [ ] Tested the sign-in flow

## Debug Information

If Google Sign-In still doesn't work:

1. **Check Console Logs:** Look for messages starting with 🔵, ✅, or ❌
2. **Get SHA-1 for Android:**
   ```bash
   cd android
   ./gradlew signingReport
   ```
   Copy the SHA-1 under "Variant: debug" and add it to your Android OAuth client

3. **Verify OAuth Configuration:**
   ```bash
   npx expo config --type introspect
   ```
   Check that scheme is set to "socialvault"

4. **Test Redirect URI:**
   The redirect URI expo-auth-session uses is:
   `https://auth.expo.io/@yonatan_carmeli/socialvault-app`

## Support

If you continue to have issues:
1. Share the console logs (🔵 debug messages)
2. Confirm which redirect URIs are added in Google Cloud Console
3. Verify the error message you're seeing

