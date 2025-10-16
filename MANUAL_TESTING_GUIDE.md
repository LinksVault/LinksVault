# Manual Testing Guide ✅

## 📋 **Complete Testing Checklist for SocialVault**

Use this guide to thoroughly test your app before launching.

---

## 🎯 **Testing Goals:**
1. Ensure all features work correctly
2. Find and fix any bugs
3. Verify security rules are working
4. Test error handling
5. Confirm good user experience

---

## 📱 **Test Environment Setup:**

### **Before You Start:**
- [ ] Have 2 test email accounts ready
- [ ] Have stable internet connection
- [ ] Clear app cache/data
- [ ] Fresh install of the app

### **Test on Multiple Devices:**
- [ ] Android phone (if possible)
- [ ] iOS device (if possible)
- [ ] Different screen sizes

---

## 1️⃣ **AUTHENTICATION TESTS** (15 minutes)

### **Test 1.1: Sign Up Flow**
- [ ] Open app → Click "Sign Up"
- [ ] Enter email, full name, password
- [ ] Submit form
- [ ] **Expected:** Verification code sent to email
- [ ] Check email inbox (may take 1-2 minutes)
- [ ] Enter 6-digit code
- [ ] **Expected:** Account created, logged in automatically

**✅ Pass Criteria:**
- Email received within 2 minutes
- Code works on first try
- Redirected to main screen after verification

**❌ Common Issues:**
- Email in spam folder
- Rate limit triggered (wait 15 min)
- Invalid email format

---

### **Test 1.2: Login Flow**
- [ ] Logout from app
- [ ] Click "Login"
- [ ] Enter email and password
- [ ] Submit
- [ ] **Expected:** Logged in successfully

**✅ Pass Criteria:**
- Login successful
- Collections screen appears
- No errors

**❌ Common Issues:**
- Wrong credentials
- Network error
- Firebase connection issue

---

### **Test 1.3: Password Reset Flow**
- [ ] Logout
- [ ] Click "Forgot Password?"
- [ ] Enter email
- [ ] **Expected:** Reset code sent to email
- [ ] Check email (1-2 minutes)
- [ ] Enter 6-digit code
- [ ] **Expected:** New password modal appears
- [ ] Set new password (min 6 chars)
- [ ] **Expected:** Password changed successfully
- [ ] Login with new password
- [ ] **Expected:** Login successful

**✅ Pass Criteria:**
- Reset email received
- Code accepted
- New password works
- Old password doesn't work

**❌ Common Issues:**
- Rate limit (max 5 attempts in 15 min)
- Expired code (10 min expiration)
- Password too short

---

### **Test 1.4: Error Handling**
- [ ] Try login with wrong password
- [ ] **Expected:** "Invalid email or password" error
- [ ] Try signup with existing email
- [ ] **Expected:** Error message shown
- [ ] Try weak password (< 6 chars)
- [ ] **Expected:** Password validation error

---

## 2️⃣ **COLLECTION TESTS** (10 minutes)

### **Test 2.1: Create Collection**
- [ ] Login
- [ ] Click "Create Collection" (+)
- [ ] Enter collection name: "Test Collection 1"
- [ ] Enter description (optional)
- [ ] Select image from gallery
- [ ] Submit
- [ ] **Expected:** Collection created and appears in list

**✅ Pass Criteria:**
- Collection appears immediately
- Image uploaded successfully
- Can click to open collection

**❌ Common Issues:**
- Image permission denied
- Image too large
- Network timeout

---

### **Test 2.2: Edit Collection**
- [ ] Open collection
- [ ] Click edit icon
- [ ] Change name to "Updated Collection"
- [ ] Change description
- [ ] Save
- [ ] **Expected:** Changes saved successfully
- [ ] Go back to collections list
- [ ] **Expected:** Updated name shown

**✅ Pass Criteria:**
- Changes persist after refresh
- No data loss

---

### **Test 2.3: Delete Collection**
- [ ] Long press on collection (or click delete)
- [ ] Confirm deletion
- [ ] **Expected:** Collection removed from list
- [ ] **Expected:** Collection data deleted from Firebase

**✅ Pass Criteria:**
- Collection disappears immediately
- Cannot be recovered

---

### **Test 2.4: Multiple Collections**
- [ ] Create 5 different collections
- [ ] **Expected:** All appear in list
- [ ] Test scrolling
- [ ] **Expected:** Smooth scrolling

---

## 3️⃣ **LINK TESTS** (20 minutes)

### **Test 3.1: Add Instagram Link**
- [ ] Open a collection
- [ ] Paste Instagram post URL
- [ ] Examples to try:
  - https://www.instagram.com/p/ABC123/
  - https://instagram.com/reel/XYZ789/
- [ ] Click Add
- [ ] **Expected:** Link added, preview loading
- [ ] Wait 5-10 seconds
- [ ] **Expected:** Preview shows image, title

**✅ Pass Criteria:**
- Link preview loads
- Image displays correctly
- Title is meaningful (not "Instagram Post")

---

### **Test 3.2: Add YouTube Link**
- [ ] Paste YouTube video URL
- [ ] Examples to try:
  - https://www.youtube.com/watch?v=dQw4w9WgXcQ
  - https://youtu.be/dQw4w9WgXcQ
- [ ] **Expected:** Preview shows video thumbnail
- [ ] **Expected:** Title is video title

**✅ Pass Criteria:**
- Thumbnail displays
- Video title correct
- Can click to open in YouTube

---

### **Test 3.3: Add Facebook Link**
- [ ] Paste Facebook post URL
- [ ] **Expected:** Preview loads

---

### **Test 3.4: Add TikTok Link**
- [ ] Paste TikTok video URL
- [ ] **Expected:** Preview loads

---

### **Test 3.5: Add X/Twitter Link**
- [ ] Paste X/Twitter post URL
- [ ] **Expected:** Preview loads

---

### **Test 3.6: Add Generic Link**
- [ ] Paste any website URL (e.g., https://www.google.com)
- [ ] **Expected:** Preview loads with site info

---

### **Test 3.7: Edit Link Title**
- [ ] Click edit icon on a link
- [ ] Change title to "Custom Title"
- [ ] Save
- [ ] **Expected:** New title shown
- [ ] Refresh screen
- [ ] **Expected:** Custom title persists

---

### **Test 3.8: Delete Link**
- [ ] Click delete icon on a link
- [ ] **Expected:** Link removed immediately
- [ ] **Expected:** Other links still visible

---

### **Test 3.9: Open Link**
- [ ] Click on a link card
- [ ] **Expected:** Link opens in browser/app

---

### **Test 3.10: Share Link**
- [ ] Click share icon on a link
- [ ] **Expected:** Share sheet appears
- [ ] Share to any app (optional)

---

### **Test 3.11: Multiple Links**
- [ ] Add 10+ links to one collection
- [ ] **Expected:** All load correctly
- [ ] Test scrolling
- [ ] **Expected:** Smooth performance

---

### **Test 3.12: Link Preview Caching**
- [ ] Add a link
- [ ] Wait for preview to load
- [ ] Delete the link
- [ ] Add the same link again
- [ ] **Expected:** Preview loads instantly (from cache)

**✅ Pass Criteria:**
- Second load is instant
- Preview is identical

---

## 4️⃣ **SORTING & FILTERING TESTS** (5 minutes)

### **Test 4.1: Sort Links**
- [ ] Click sort icon
- [ ] Try each sort option:
  - [ ] Newest first
  - [ ] Oldest first
  - [ ] Alphabetical
  - [ ] Reverse alphabetical
- [ ] **Expected:** Order changes correctly

---

### **Test 4.2: Search Links**
- [ ] Enter search term in search box
- [ ] **Expected:** Matching links shown
- [ ] Clear search
- [ ] **Expected:** All links visible again

---

### **Test 4.3: Design Layouts**
- [ ] Click design/layout icon
- [ ] Try each layout:
  - [ ] Modern (default)
  - [ ] Classic (horizontal)
  - [ ] Minimal
  - [ ] Grid (2 columns)
- [ ] **Expected:** Layout changes smoothly
- [ ] Go back to collections
- [ ] Return to collection
- [ ] **Expected:** Layout preference saved

---

## 5️⃣ **ERROR HANDLING TESTS** (10 minutes)

### **Test 5.1: Invalid URL**
- [ ] Try to add invalid URL: "not-a-url"
- [ ] **Expected:** Error message or handled gracefully

---

### **Test 5.2: Duplicate Link**
- [ ] Add a link
- [ ] Try to add same link again
- [ ] **Expected:** Warning message shown
- [ ] **Expected:** Duplicate not added

---

### **Test 5.3: Network Issues**
- [ ] Turn off WiFi/Data
- [ ] Try to add a link
- [ ] **Expected:** Error message shown
- [ ] Turn network back on
- [ ] Try again
- [ ] **Expected:** Works normally

---

### **Test 5.4: Rate Limiting**
- [ ] Logout
- [ ] Try password reset 6 times quickly
- [ ] **Expected:** After 5 attempts, rate limit error
- [ ] Wait 15 minutes
- [ ] Try again
- [ ] **Expected:** Works again

---

### **Test 5.5: Session Expiry**
- [ ] Login
- [ ] Wait 1 hour (or force token expiry in Firebase Console)
- [ ] Try to create collection
- [ ] **Expected:** Redirected to login OR automatic refresh

---

## 6️⃣ **SECURITY TESTS** (5 minutes)

### **Test 6.1: User Isolation**
- [ ] Create account A (test1@example.com)
- [ ] Create 2 collections with account A
- [ ] Logout
- [ ] Create account B (test2@example.com)
- [ ] **Expected:** Cannot see account A's collections
- [ ] Try to access account A's collection by URL manipulation
- [ ] **Expected:** Access denied

---

### **Test 6.2: Unauthorized Access**
- [ ] Logout
- [ ] Try to access collections screen directly
- [ ] **Expected:** Redirected to login

---

## 7️⃣ **PERFORMANCE TESTS** (5 minutes)

### **Test 7.1: Load Time**
- [ ] Open app from fresh start
- [ ] Measure time to login screen
- [ ] **Expected:** < 3 seconds

---

### **Test 7.2: Collection Load**
- [ ] Open collections screen
- [ ] Measure load time
- [ ] **Expected:** < 2 seconds

---

### **Test 7.3: Link Preview Speed**
- [ ] Add 5 links simultaneously
- [ ] Measure time until all previews loaded
- [ ] **Expected:** All loaded within 10-15 seconds

**✅ Pass Criteria:**
- Links load in parallel (not one by one)
- No artificial delays

---

### **Test 7.4: Image Upload**
- [ ] Upload large image (> 5MB) to collection
- [ ] Measure upload time
- [ ] **Expected:** < 30 seconds
- [ ] **Expected:** Image compressed appropriately

---

## 8️⃣ **UI/UX TESTS** (10 minutes)

### **Test 8.1: Navigation**
- [ ] Test back button on each screen
- [ ] **Expected:** Returns to previous screen
- [ ] **Expected:** No unexpected navigation

---

### **Test 8.2: Keyboard Handling**
- [ ] Type in input field
- [ ] **Expected:** Keyboard doesn't cover input
- [ ] Dismiss keyboard
- [ ] **Expected:** UI adjusts correctly

---

### **Test 8.3: Loading States**
- [ ] Check loading indicators on all async operations:
  - [ ] Login
  - [ ] Create collection
  - [ ] Add link
  - [ ] Upload image
- [ ] **Expected:** Clear loading indicator shown

---

### **Test 8.4: Error Messages**
- [ ] Trigger various errors
- [ ] **Expected:** User-friendly messages
- [ ] **Expected:** No technical jargon
- [ ] **Expected:** Clear call-to-action

---

### **Test 8.5: Responsive Layout**
- [ ] Rotate device (portrait ↔ landscape)
- [ ] **Expected:** Layout adapts smoothly
- [ ] Test on different screen sizes
- [ ] **Expected:** Content fits properly

---

### **Test 8.6: Touch Targets**
- [ ] Test all buttons and icons
- [ ] **Expected:** Easy to tap (min 44×44 points)
- [ ] **Expected:** No accidental taps

---

## 9️⃣ **EDGE CASES** (10 minutes)

### **Test 9.1: Empty States**
- [ ] New account with no collections
- [ ] **Expected:** Helpful empty state message
- [ ] Collection with no links
- [ ] **Expected:** Helpful empty state message

---

### **Test 9.2: Long Content**
- [ ] Create collection with very long name (100+ chars)
- [ ] **Expected:** Text truncates or wraps properly
- [ ] Add link with very long URL
- [ ] **Expected:** Handled gracefully

---

### **Test 9.3: Special Characters**
- [ ] Collection name with emojis: "😀 My Collection"
- [ ] **Expected:** Displays correctly
- [ ] Link with special chars
- [ ] **Expected:** Works normally

---

### **Test 9.4: Rapid Actions**
- [ ] Click add button 10 times rapidly
- [ ] **Expected:** No duplicate entries
- [ ] **Expected:** No crashes

---

### **Test 9.5: Memory/Storage**
- [ ] Create 50+ collections
- [ ] Add 100+ links total
- [ ] **Expected:** App remains responsive
- [ ] **Expected:** No memory leaks

---

## 🔟 **CROSS-PLATFORM TESTS** (if applicable)

### **Test 10.1: Android Specific**
- [ ] Back button behavior
- [ ] Navigation gestures
- [ ] Share functionality
- [ ] Notifications (if implemented)

---

### **Test 10.2: iOS Specific**
- [ ] Swipe gestures
- [ ] Safe area handling
- [ ] Share sheet
- [ ] Notifications (if implemented)

---

## 📊 **TEST RESULTS TRACKING:**

### **Summary:**
- Total Tests: ~100
- Tests Passed: ___
- Tests Failed: ___
- Tests Skipped: ___

### **Critical Issues Found:**
1. _______________________
2. _______________________
3. _______________________

### **Minor Issues Found:**
1. _______________________
2. _______________________
3. _______________________

---

## ✅ **READY FOR LAUNCH CRITERIA:**

Your app is ready to launch when:

- [ ] **0 critical bugs** (blocking features)
- [ ] **< 5 minor bugs** (cosmetic/UX issues)
- [ ] **90%+ tests passing**
- [ ] **All security tests passing**
- [ ] **Performance acceptable** (< 3s load times)
- [ ] **Works on both platforms** (iOS & Android)

---

## 🎯 **TESTING PRIORITIES:**

### **MUST Test (Critical):**
1. Authentication (signup, login, password reset)
2. Create/edit/delete collections
3. Add/edit/delete links
4. Security (user isolation)
5. Error handling

### **SHOULD Test (High Priority):**
6. Link previews for all platforms
7. Sorting and filtering
8. Performance
9. UI/UX
10. Edge cases

### **NICE TO Test (Medium Priority):**
11. Different layouts
12. Cross-platform consistency
13. Memory/storage limits

---

## 💡 **TESTING TIPS:**

1. **Test Like a User:** Don't try to break it, use it naturally
2. **Fresh Eyes:** Have someone else test it
3. **Real Devices:** Emulators miss real-world issues
4. **Different Networks:** Test on WiFi, 4G, slow connections
5. **Take Notes:** Document everything you find
6. **Screenshot Bugs:** Visual evidence helps debugging
7. **Test Daily:** Catch regressions early

---

## 🆘 **FOUND A BUG?**

### **How to Report:**
1. **Describe the bug:** What went wrong?
2. **Steps to reproduce:** How to trigger it?
3. **Expected behavior:** What should happen?
4. **Actual behavior:** What actually happened?
5. **Screenshots:** Visual evidence
6. **Device info:** OS, version, model
7. **Console logs:** Any error messages

### **Example Bug Report:**
```
Title: Link preview not loading for Instagram Reels

Description: When adding an Instagram Reel URL, the preview shows 
"Loading..." indefinitely and never displays content.

Steps to Reproduce:
1. Open collection
2. Add Instagram Reel URL: https://instagram.com/reel/ABC123
3. Wait 30 seconds
4. Preview still shows "Loading..."

Expected: Preview loads with Reel thumbnail and title
Actual: Stuck on "Loading..." state

Device: iPhone 12, iOS 16.5
Screenshot: [attached]
Console: "Error fetching Instagram preview: 403 Forbidden"
```

---

**Happy Testing!** 🧪✅

**Remember:** Every bug you find now is one less bug your users will encounter! 🎉

