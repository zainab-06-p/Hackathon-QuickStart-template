# Firebase Real-Time Sync Testing Guide

## ⚠️ CRITICAL: Update Firebase Rules First!

Before testing, you MUST update your Firebase Realtime Database rules:

### Step 1: Go to Firebase Console
Open: https://console.firebase.google.com/project/algorand-b8f15/database/algorand-b8f15-default-rtdb/rules

### Step 2: Click "Rules" tab

### Step 3: Replace with these rules:
```json
{
  "rules": {
    "campaigns": {
      ".read": true,
      ".write": true,
      "$campaignId": {
        ".validate": "newData.hasChildren(['appId', 'title', 'description', 'goal', 'creator', 'createdAt'])"
      }
    },
    "events": {
      ".read": true,
      ".write": true,
      "$eventId": {
        ".validate": "newData.hasChildren(['appId', 'title', 'description', 'venue', 'eventDate', 'creator', 'createdAt'])"
      }
    }
  }
}
```

### Step 4: Click "Publish" button (top right)

---

## ✅ Testing Real-Time Sync (2 Devices)

### Device A (Your Computer):
1. Open: http://localhost:5173/
2. Connect wallet
3. Go to "Fundraising" page
4. Click "Create Campaign"
5. Fill form:
   - Title: "Test Campaign"
   - Description: "Testing Firebase sync"
   - Goal: 50 ALGOs
   - Click "Create Campaign"
6. Wait for blockchain confirmation (~4 seconds)
7. **Watch browser console for**: `🔥 Campaign saved to Firebase for real-time sync`

### Device B (Phone/Another Browser):
1. Open same URL: http://localhost:5173/ (use your computer's IP if on same network)
   - OR open production: https://hackathon-quick-start-template-1zrngmexc.vercel.app
2. Connect wallet (can be different address)
3. Go to "Fundraising" page
4. **Campaign should appear instantly** (within 1 second!)

### Check Firebase Console:
Go to: https://console.firebase.google.com/project/algorand-b8f15/database/algorand-b8f15-default-rtdb/data

You should see:
```
📂 algorand-b8f15-default-rtdb
  └─📂 campaigns
      └─📄 -ABC123xyz (random ID)
          ├─ appId: "123456789"
          ├─ title: "Test Campaign"
          ├─ description: "Testing Firebase sync"
          ├─ goal: "50"
          ├─ creator: "YOUR_WALLET_ADDRESS"
          ├─ createdAt: 1739537000000
          └─ blockchainTxId: "TX123..."
```

---

## 🐛 Troubleshooting

### If nothing appears in Firebase:

**1. Check browser console for errors:**
   - Press F12 → Console tab
   - Look for Firebase errors in red

**2. Verify environment variables are loaded:**
   - In console, type: `import.meta.env.VITE_FIREBASE_API_KEY`
   - Should show: `"AIzaSyBDGu7wUFjbknmPxRueKo7dVwnNfJ3vVl0"`

**3. Check Firebase initialization:**
   - Should see: `🔥 Firebase initialized successfully` in console

**4. Verify rules were published:**
   - Go to Firebase Console → Database → Rules
   - Should see the rules with `".read": true, ".write": true`
   - Check "Rules published" timestamp (should be recent)

### If Device B doesn't see updates:

**1. Check console for listener:**
   - Should see: `🔥 Firebase campaigns updated: X campaigns` 

**2. Verify network access:**
   - Device B must be able to reach Firebase (check internet)

**3. Try hard refresh:**
   - Ctrl+Shift+R (Windows/Linux)
   - Cmd+Shift+R (Mac)

---

## 📊 Expected Behavior

✅ **Create Campaign on Device A:**
- Takes ~4 seconds (blockchain confirmation)
- Console shows: `🔥 Campaign saved to Firebase`
- Console shows: `✅ Campaign registered in on-chain registry!`

✅ **Device B Updates:**
- Takes <1 second after Device A saves
- Console shows: `🔥 Firebase campaigns updated: 1 campaigns`
- Campaign appears in list immediately

✅ **Both Devices:**
- Can see real-time donation progress
- Can donate to campaigns
- All transactions still go through blockchain (secure)

---

## 🔒 Security Note

The current rules allow anyone to read/write for testing. For production, you should:

1. Add authentication requirements
2. Validate creator addresses
3. Add rate limiting
4. Enable Firebase App Check

But for now, these open rules let you test the real-time sync!
