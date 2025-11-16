# Orphaned Users Cleanup Guide

## Overview

This guide explains how to clean up "orphaned" user documents from your Firebase Firestore database. Orphaned users are user documents that exist in Firestore but no longer have a corresponding Firebase Authentication account.

## What are Orphaned Users?

Orphaned users occur when:
- Firebase Authentication accounts are deleted (e.g., through Firebase Console)
- User deletion was performed before the proper `deleteUserAccount` function was implemented
- Manual cleanup of auth accounts without corresponding Firestore cleanup

## The Cleanup Function

The `cleanupOrphanedUsers` Cloud Function automatically:
1. ✅ Scans all user documents in Firestore
2. ✅ Checks if each user has a corresponding Firebase Auth account
3. ✅ Identifies orphaned users (no auth account)
4. ✅ Deletes orphaned user documents
5. ✅ Cleans up all associated data:
   - Albums/Collections
   - General Links
   - Verification codes
   - Reset codes
   - Rate limit entries

## Security

⚠️ **IMPORTANT**: This function requires an admin secret key to prevent unauthorized access.

### Setting the Admin Secret

You have two options:

#### Option 1: Environment Variable (Recommended for Production)

```bash
firebase functions:config:set admin.secret="YOUR-SECURE-SECRET-KEY-HERE"
firebase deploy --only functions
```

Replace `YOUR-SECURE-SECRET-KEY-HERE` with a strong, random secret key.

#### Option 2: Hardcoded (For Quick Testing Only)

Edit `email_verification/index.js` line 788 and replace:
```javascript
const expectedSecret = process.env.ADMIN_SECRET || "your-secure-secret-key-here";
```

With your chosen secret (but remember to deploy after):
```javascript
const expectedSecret = process.env.ADMIN_SECRET || "my-actual-secret-2024";
```

## How to Run the Cleanup

### Using curl (Command Line)

```bash
curl -X POST https://us-central1-social-vault.cloudfunctions.net/cleanupOrphanedUsers \
  -H "Content-Type: application/json" \
  -d '{
    "adminSecret": "YOUR-ADMIN-SECRET-HERE"
  }'
```

### Using Postman

1. **Method**: POST
2. **URL**: `https://us-central1-social-vault.cloudfunctions.net/cleanupOrphanedUsers`
3. **Headers**:
   - `Content-Type: application/json`
4. **Body** (raw JSON):
   ```json
   {
     "adminSecret": "YOUR-ADMIN-SECRET-HERE"
   }
   ```

### Using JavaScript/Node.js

```javascript
const response = await fetch('https://us-central1-social-vault.cloudfunctions.net/cleanupOrphanedUsers', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    adminSecret: 'YOUR-ADMIN-SECRET-HERE'
  })
});

const result = await response.json();
console.log('Cleanup result:', result);
```

## Expected Response

### Success Response

```json
{
  "success": true,
  "message": "Orphaned users cleanup completed",
  "summary": {
    "totalUsersChecked": 25,
    "orphanedUsersFound": 3,
    "orphanedUsersDeleted": 3,
    "orphanedUserData": [
      {
        "userId": "0LZ0SLr0m9dJMMBnTeSiINYZo6E2",
        "email": "yn11av@gmail.com",
        "fullName": "yonatan",
        "createdAt": "2025-09-01T01:25:30.383Z"
      },
      {
        "userId": "15NxtbLVATRBgQxL88Oxajr9i1n2",
        "email": "test@example.com",
        "fullName": "Test User",
        "createdAt": "2025-08-15T14:20:10.123Z"
      }
    ],
    "errors": []
  }
}
```

### Error Response (Unauthorized)

```json
{
  "success": false,
  "message": "Unauthorized: Invalid admin secret"
}
```

## Monitoring

### Check Firebase Console Logs

1. Go to [Firebase Console](https://console.firebase.google.com/project/social-vault/functions)
2. Click on "Functions" in the left sidebar
3. Find `cleanupOrphanedUsers` function
4. Click "Logs" to see detailed execution logs

### Log Messages to Look For

- `🧹 Starting orphaned users cleanup...`
- `📊 Found X user documents in Firestore`
- `✅ User {userId} has Auth account - OK`
- `🗑️ Found orphaned user: {userId}`
- `✅ Deleted orphaned user document: {userId}`
- `🧹 Cleaning up data for orphaned user: {userId}`
- `🎉 Orphaned users cleanup completed`

## Best Practices

1. **Backup First**: Before running the cleanup, consider exporting your Firestore data
   ```bash
   firebase firestore:export gs://social-vault.appspot.com/backups/$(date +%Y-%m-%d)
   ```

2. **Test with Dry Run**: Review the logs to see what would be deleted before committing

3. **Run During Low Traffic**: Schedule cleanup during off-peak hours

4. **Keep Secret Secure**: Never commit the admin secret to version control

5. **One-Time Use**: This is a maintenance function - not meant for regular use

## Troubleshooting

### Function Times Out

If you have many users, the function might timeout. The function uses `Promise.allSettled` to handle errors gracefully, but for very large datasets, you might need to:

1. Increase the timeout in `email_verification/index.js`:
   ```javascript
   exports.cleanupOrphanedUsers = onRequest(
     { timeoutSeconds: 540, memory: "1GiB" },
     async (req, res) => { ... }
   );
   ```

2. Redeploy:
   ```bash
   firebase deploy --only functions:cleanupOrphanedUsers
   ```

### "Invalid admin secret" Error

- Double-check your secret key matches what's configured
- If using environment variables, verify it's set:
  ```bash
  firebase functions:config:get
  ```

### Some Users Not Deleted

Check the `errors` array in the response for specific error messages.

## After Cleanup

Once the cleanup is complete:

1. ✅ Check Firebase Console to verify orphaned users are removed
2. ✅ Review the cleanup summary in the response
3. ✅ Monitor your app to ensure no issues
4. ✅ The proper `deleteUserAccount` function will prevent future orphaned users

## Future Prevention

With the new `deleteUserAccount` function in place, orphaned users should no longer occur because:
- Users delete their own accounts through the app
- All related data is cleaned up in one transaction
- Firebase Auth accounts are deleted last, ensuring consistency

---

**Function URL**: `https://us-central1-social-vault.cloudfunctions.net/cleanupOrphanedUsers`

**Status**: ✅ Deployed and Ready

**Last Updated**: 2025-11-11

