# Quick Manual Testing Guide ⚡

## 🎯 **Test These Core Features Before Publishing**

Run through these tests to ensure your app is working correctly.

---

## ✅ **TEST 1: Authentication Flow (5 minutes)**

### **Sign Up:**
1. Open app → Click "Sign Up"
2. Enter valid email and password
3. **Expected:** Account created, verification email sent
4. **Check:** Can you access the app after signup?

### **Email Verification:**
1. Check your email inbox
2. Find verification email from SocialVault
3. **Expected:** Email has 6-digit code
4. **Check:** Does the email look professional?

### **Login:**
1. Logout from app
2. Try to login with your credentials
3. **Expected:** Successfully logged in
4. **Check:** Profile data loads correctly?

### **Password Reset:**
1. Click "Forgot Password"
2. Enter your email
3. **Expected:** Reset code email arrives
4. Enter the 6-digit code
5. Set new password
6. **Expected:** Can login with new password
7. **Check:** No "insufficient permissions" errors?

### **Google Sign-In:**
1. Click "Sign in with Google"
2. Select your Google account
3. **Expected:** Account created/logged in
4. **Check:** Profile info populated from Google?

---

## ✅ **TEST 2: Collections (5 minutes)**

### **Create Collection:**
1. Click "+" to create new collection
2. Enter collection name
3. Choose icon/image
4. **Expected:** Collection appears in list
5. **Check:** Image uploads correctly?

### **Edit Collection:**
1. Long press on a collection
2. Edit name or image
3. **Expected:** Changes save immediately
4. **Check:** Changes persist after app restart?

### **Delete Collection:**
1. Swipe or long-press to delete
2. Confirm deletion
3. **Expected:** Collection removed from list
4. **Check:** Deleted from Firebase too?

---

## ✅ **TEST 3: Adding Links (10 minutes)**

### **Add Single Link:**
1. Open a collection
2. Paste a link (try Instagram, YouTube, Twitter)
3. **Expected:** Link preview loads quickly (<5 seconds)
4. **Check:** Title, image, description all correct?

### **Add Multiple Links:**
1. Add 5-6 links in quick succession
2. **Expected:** All load in parallel (not one-by-one)
3. **Check:** Total time <10 seconds for 6 links?

### **Test Different Platforms:**
- **Instagram:** `https://www.instagram.com/p/[any-post-id]/`
- **YouTube:** `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- **Twitter:** `https://twitter.com/[user]/status/[id]`
- **Regular Website:** `https://github.com`

**Check:** Do all platforms show proper previews?

### **Edit Link:**
1. Click on a saved link
2. Edit title or add custom image
3. **Expected:** Changes save
4. **Check:** Custom title preserved?

### **Delete Link:**
1. Swipe or long-press to delete
2. **Expected:** Link removed instantly
3. **Check:** Deleted from Firebase?

---

## ✅ **TEST 4: Performance (3 minutes)**

### **Cold Start:**
1. Force close app
2. Reopen app
3. **Measure:** How long until you see your collections?
4. **Expected:** <3 seconds

### **Link Loading:**
1. Open a collection with 10+ links
2. **Measure:** How long until all previews load?
3. **Expected:** <5 seconds (most from cache)

### **Navigation:**
1. Navigate between screens (Welcome → Login → Collections → Links)
2. **Expected:** Smooth transitions, no lag
3. **Check:** Any screens freeze or crash?

---

## ✅ **TEST 5: Edge Cases (5 minutes)**

### **Invalid Links:**
1. Try adding invalid URLs:
   - `not-a-url`
   - `htps://broken-link.com`
   - `https://this-site-does-not-exist-12345.com`
2. **Expected:** Error message shown, no crash
3. **Check:** App handles gracefully?

### **Network Issues:**
1. Turn off WiFi/data
2. Try to add a link
3. **Expected:** Proper error message
4. Turn network back on
5. **Expected:** App recovers automatically

### **Empty States:**
1. Delete all collections
2. **Expected:** Shows "Create your first collection" message
3. Create collection with no links
4. **Expected:** Shows "Add your first link" message

### **Long Content:**
1. Add link with very long title
2. **Expected:** Text truncates properly, no overflow
3. Try collection name with 50+ characters
4. **Expected:** Handled gracefully

---

## ✅ **TEST 6: Security Rules (3 minutes)**

### **Can't Access Other Users' Data:**
1. Login as User A
2. Create a collection
3. Note the collection ID (you can see in Firebase)
4. Logout and login as User B
5. Try to access User A's collection (via direct Firebase query)
6. **Expected:** Access denied

**Note:** This is just verification - your rules already prevent this!

### **Unauthenticated Access:**
1. Logout completely
2. Try to access any Firebase data
3. **Expected:** Only password reset flow works
4. **Expected:** No collection/album data accessible

---

## 🎯 **TEST SUMMARY CHECKLIST**

Mark these as you test:

### **Authentication:**
- [ ] Sign up works
- [ ] Email verification sent
- [ ] Login works
- [ ] Password reset works (no errors!)
- [ ] Google Sign-In works

### **Collections:**
- [ ] Create collection works
- [ ] Edit collection works
- [ ] Delete collection works
- [ ] Image upload works

### **Links:**
- [ ] Add single link (<5s)
- [ ] Add multiple links (<10s for 6 links)
- [ ] Instagram links work
- [ ] YouTube links work
- [ ] Twitter links work
- [ ] Edit link works
- [ ] Delete link works

### **Performance:**
- [ ] Cold start <3 seconds
- [ ] Link loading <5 seconds
- [ ] Smooth navigation

### **Edge Cases:**
- [ ] Invalid URLs handled
- [ ] Network issues handled
- [ ] Empty states show properly
- [ ] Long content handled

### **Security:**
- [ ] Can't access other users' data
- [ ] Unauthenticated access blocked properly

---

## 🚨 **CRITICAL ISSUES TO WATCH FOR:**

If you encounter any of these, **STOP and report:**

1. ❌ App crashes
2. ❌ "Insufficient permissions" errors
3. ❌ Data from one user visible to another
4. ❌ Links not loading at all
5. ❌ Unable to login after signup
6. ❌ Password reset not working

---

## 🎉 **When You're Done:**

If **ALL** tests pass:
- ✅ Your app is ready for the next stage!
- ✅ Core functionality is solid!
- ✅ Security is working!

If **ANY** tests fail:
- 🔴 Let me know which test failed
- 🔴 Describe what happened vs. what was expected
- 🔴 We'll fix it before moving forward!

---

**Estimated Time: 30 minutes**

**Start testing and let me know the results!** 🚀

