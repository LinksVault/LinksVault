# Trash Cleanup Deployment Guide

## Problem Solved
Collections that were deleted over 30 days ago were not being automatically cleaned up from the trash. This was because the automatic cleanup Cloud Function existed but wasn't deployed.

## What Was Fixed

### 1. **Added Automatic Cleanup Function** (`functions/index.js`)
   - **Function:** `cleanupOldDeletedCollections`
   - **Schedule:** Runs daily at 2:00 AM UTC
   - **Purpose:** Automatically deletes collections that have been in trash for 30+ days
   - **Actions:** 
     - Finds collections with `isDeleted: true` and `deletedAt` older than 30 days
     - Permanently deletes the collection document
     - Cleans up associated link previews

### 2. **Added Manual Cleanup Function** (`functions/index.js`)
   - **Function:** `manualCleanupOldDeletedCollections`
   - **Type:** HTTP callable function
   - **Purpose:** Allows users to manually trigger cleanup of old deleted collections
   - **Actions:** Same as automatic cleanup, but can be triggered on-demand

### 3. **Added UI Button** (`screens/Collections.js`)
   - Added "Clean Up" button in trash view header
   - Shows confirmation dialog before cleanup
   - Calls the manual cleanup function
   - Displays success/failure messages
   - Refreshes trash view after cleanup

## Deployment Steps

### Step 1: Deploy the Firebase Functions

1. **Navigate to the functions directory:**
   ```bash
   cd functions
   ```

2. **Install dependencies (if not already installed):**
   ```bash
   npm install
   ```

3. **Deploy the functions to Firebase:**
   ```bash
   firebase deploy --only functions
   ```

   Or deploy specific functions:
   ```bash
   firebase deploy --only functions:cleanupOldDeletedCollections,functions:manualCleanupOldDeletedCollections
   ```

### Step 2: Verify Deployment

1. **Check Firebase Console:**
   - Go to Firebase Console → Functions
   - Verify that these functions are deployed:
     - `cleanupOldDeletedCollections` (scheduled)
     - `manualCleanupOldDeletedCollections` (HTTP)

2. **Check the Cloud Scheduler:**
   - Go to Google Cloud Console → Cloud Scheduler
   - Verify that the scheduled job exists and runs daily at 2:00 AM UTC

### Step 3: Test the Manual Cleanup

1. **Open your app**
2. **Navigate to Collections → Hamburger Menu → View Trash**
3. **Tap the "Clean Up" button** in the top right corner
4. **Confirm the cleanup**
5. **Check the results** - it should tell you how many collections were deleted

## How It Works

### Automatic Cleanup (Daily)
- Runs every day at 2:00 AM UTC
- Finds all collections where:
  - `isDeleted === true`
  - `deletedAt < (current date - 30 days)`
- Permanently deletes these collections and their link previews
- Logs all actions to Firebase Functions logs

### Manual Cleanup (User Triggered)
- User taps "Clean Up" button in trash view
- Shows confirmation dialog
- Calls the Cloud Function via HTTP request
- Returns result with count of deleted collections
- Refreshes trash view to show updated list

## Checking Function Logs

To see the cleanup logs:

```bash
firebase functions:log --only cleanupOldDeletedCollections
```

Or view all function logs:

```bash
firebase functions:log
```

Or check in Firebase Console → Functions → Logs

## What Happens to Your Current Collections

After deployment:
- The **automatic cleanup** will run at the next 2:00 AM UTC
- You can **manually trigger** cleanup right now using the "Clean Up" button in the app
- Only collections deleted **30+ days ago** will be permanently deleted
- Collections deleted less than 30 days ago will remain in trash

## Testing the Functions Locally (Optional)

You can test the functions locally before deploying:

```bash
firebase emulators:start --only functions
```

Then call the manual cleanup function:
```bash
curl -X POST http://localhost:5001/linksvault-8b9db/us-central1/manualCleanupOldDeletedCollections
```

## Troubleshooting

### Function Not Running
- Check Cloud Scheduler is enabled in Google Cloud Console
- Verify the scheduled job exists and is not paused
- Check function logs for errors

### Manual Cleanup Not Working
- Verify the function URL in `Collections.js` matches your Firebase project
- Check network connectivity
- Look for CORS errors in browser/app console

### Collections Not Being Deleted
- Verify collections have `isDeleted: true` field
- Check `deletedAt` field is a valid ISO string
- Confirm collections are actually 30+ days old

## Cost Considerations

- **Scheduled function**: Runs once per day (very low cost)
- **Manual function**: Only runs when user triggers it
- Both functions are lightweight and process in batches
- Expected cost: < $0.01/month for typical usage

## Security

- Manual cleanup function is open (no auth required) but only deletes old items
- Consider adding authentication if needed
- The function only affects collections with `isDeleted: true`
- Cannot accidentally delete active collections

## Next Steps After Deployment

1. ✅ Deploy the functions
2. ✅ Test manual cleanup in the app
3. ✅ Wait for next scheduled run (2:00 AM UTC)
4. ✅ Monitor function logs for any errors
5. ✅ Verify old collections are being cleaned up

## Summary

Your trash cleanup system is now complete! Collections will:
- ✅ Be moved to trash when deleted (soft delete)
- ✅ Be restorable for 30 days
- ✅ Be automatically deleted after 30 days
- ✅ Can be manually cleaned up via "Clean Up" button

The issue with your 2 old collections will be resolved as soon as you:
1. Deploy the functions
2. Either wait for the scheduled run or tap the "Clean Up" button

---

**Created:** $(date)
**Status:** Ready for deployment

