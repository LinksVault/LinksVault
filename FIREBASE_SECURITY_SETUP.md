# Firebase Security Setup 🔐

## 🎯 **Critical: Secure Your Firebase Project**

Your Firebase project **`social-vault`** needs additional security configuration before publishing.

---

## ✅ **STEP 1: Set Up Firebase App Restrictions**

### **Why This Matters:**
Without restrictions, anyone can use your Firebase API key from any app or website, potentially abusing your quotas and causing costs.

### **Your Bundle IDs:**
```
iOS Bundle ID: com.socialvault.app
Android Package Name: com.yonatancarmeli.socialvault
```

### **How to Configure:**

#### **Option A: API Key Restrictions (Recommended)**

1. **Go to Google Cloud Console:**
   - Visit: https://console.cloud.google.com/apis/credentials?project=social-vault

2. **Find Your API Key:**
   - Look for key named "Browser key (auto created by Firebase)"
   - Click on it to edit

3. **Set Application Restrictions:**
   - Select **"iOS apps"** and add:
     ```
     com.socialvault.app
     ```
   - Select **"Android apps"** and add:
     ```
     Package name: com.yonatancarmeli.socialvault
     SHA-1 certificate fingerprint: (You'll add this when building)
     ```
   - Select **"HTTP referrers"** and add:
     ```
     localhost/*
     127.0.0.1/*
     *.firebaseapp.com/*
     ```

4. **Set API Restrictions:**
   - Select "Restrict key"
   - Enable only these APIs:
     - ✅ Firebase Installations API
     - ✅ Cloud Firestore API
     - ✅ Firebase Storage API
     - ✅ Identity Toolkit API (for Auth)
     - ✅ Token Service API

5. **Save Changes**

#### **Option B: App Check (Advanced - Optional)**

1. **Go to Firebase Console:**
   - Visit: https://console.firebase.google.com/project/social-vault/appcheck

2. **Register Your Apps:**
   - Click "Register" for iOS app
   - Click "Register" for Android app

3. **Configure Enforcement:**
   - Enable App Check for:
     - ✅ Firestore
     - ✅ Storage
     - ✅ Cloud Functions

**Note:** App Check requires additional client-side code. Do this only if you need extra security.

---

## ✅ **STEP 2: Enable Firebase Automatic Backups**

### **Why This Matters:**
Protects your data from accidental deletion, corruption, or security incidents.

### **How to Enable:**

1. **Go to Firestore Console:**
   - Visit: https://console.firebase.google.com/project/social-vault/firestore

2. **Open Settings:**
   - Click the gear icon (⚙️) in the top bar
   - Select "Settings"

3. **Enable Automated Backups:**
   - Scroll to "Backups" section
   - Click "Create schedule"
   - Configure:
     ```
     Frequency: Daily
     Time: 2:00 AM (your timezone)
     Retention: 7 days (free tier limit)
     ```

4. **Save Schedule**

### **Alternative: Manual Exports (Free)**

If automated backups are paid-only in your region:

1. **Set up periodic exports via Cloud Scheduler:**
   ```bash
   # You can do this later via Firebase CLI
   gcloud firestore export gs://social-vault-backups
   ```

2. **Or use Cloud Functions:**
   - Schedule a daily function to export Firestore data
   - Store in Cloud Storage bucket

---

## ✅ **STEP 3: Review Security Rules**

### **Current Status:**
✅ Your security rules are already configured and deployed!

### **Verify They're Active:**

1. **Go to Firestore Rules:**
   - Visit: https://console.firebase.google.com/project/social-vault/firestore/rules

2. **Check Active Rules:**
   - Should show your deployed rules from `config/firestore.rules`
   - Look for "Published" date (should be recent)

3. **Go to Storage Rules:**
   - Visit: https://console.firebase.google.com/project/social-vault/storage/rules

4. **Verify Rules Are Active:**
   - Should show your deployed rules from `config/storage.rules`

---

## ✅ **STEP 4: Configure Authentication Settings**

### **Email Verification:**

1. **Go to Authentication Settings:**
   - Visit: https://console.firebase.google.com/project/social-vault/authentication/settings

2. **Configure Email Verification:**
   - Enable "Email verification"
   - Set "From" name: **SocialVault**
   - Set "From" email: **noreply@social-vault.firebaseapp.com**

3. **Customize Email Templates:**
   - Click "Templates" tab
   - Edit "Verify email" template to match your brand

### **Password Reset:**

1. **Review Password Reset Template:**
   - Should already be configured via your Cloud Functions
   - No action needed (using Cloud Functions)

### **OAuth Providers:**

1. **Review Google Sign-In:**
   - Should already be configured
   - Verify it shows your OAuth client ID

---

## ✅ **STEP 5: Set Usage Quotas and Alerts**

### **Why This Matters:**
Prevents unexpected costs and alerts you to unusual activity.

### **Set Up Budget Alerts:**

1. **Go to Firebase Console:**
   - Visit: https://console.firebase.google.com/project/social-vault/usage

2. **Set Budget:**
   - Click "Set budget alerts"
   - Set alerts at:
     - 50% of expected usage
     - 75% of expected usage
     - 90% of expected usage

3. **Configure Email Alerts:**
   - Add your email
   - Enable daily digest

### **Review Current Usage:**

Check current quotas:
- **Firestore:** Free tier = 50K reads, 20K writes, 20K deletes per day
- **Storage:** Free tier = 5GB stored, 1GB downloaded per day
- **Authentication:** Free tier = unlimited
- **Cloud Functions:** Free tier = 2M invocations per month

---

## 🎯 **VERIFICATION CHECKLIST**

After completing all steps, verify:

- [ ] API key has application restrictions
- [ ] Firestore backups are scheduled
- [ ] Security rules are active and recent
- [ ] Email templates are customized
- [ ] Budget alerts are configured
- [ ] Usage monitoring is set up

---

## 🚨 **Security Best Practices**

### **Do:**
- ✅ Keep `.env` file out of git (already done)
- ✅ Use security rules to restrict access (already done)
- ✅ Enable rate limiting for Cloud Functions (already done)
- ✅ Monitor usage regularly
- ✅ Review security rules before major releases

### **Don't:**
- ❌ Share your Firebase config publicly
- ❌ Disable security rules for testing
- ❌ Ignore usage spikes
- ❌ Skip backup verification
- ❌ Use admin SDK in client code

---

## 📞 **Next Steps:**

After completing these security setups:

1. ✅ Test password reset flow end-to-end
2. ✅ Complete manual testing guide
3. ✅ Create app store assets
4. ✅ Build production versions

---

## 🎉 **Summary:**

Once you complete these 5 steps, your Firebase project will be:
- 🔐 Secured against unauthorized access
- 💾 Protected with automatic backups
- 📊 Monitored for unusual activity
- ⚠️ Alerting you to potential issues
- 🚀 Ready for production traffic!

---

**Estimated Time: 20-30 minutes**

**Let me know when you've completed these steps!** 🎯

