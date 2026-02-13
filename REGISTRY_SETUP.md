# 🎯 Registry Contract Setup Guide

## What is the Registry Contract?

The **CampusChain Registry** is a decentralized database smart contract that stores all deployed campaign and event app IDs on the Algorand blockchain. This enables **true cross-device discovery** without hardcoded addresses or localStorage dependencies.

### Benefits:
✅ **Real-time cross-device visibility** - Device B sees campaigns immediately after Device A creates them  
✅ **No configuration needed** - No need to hardcode creator addresses  
✅ **Truly decentralized** - No central server, all data on blockchain  
✅ **Persistent** - Survives localStorage clearing and works on fresh devices  

---

## 📋 Setup Process

### Step 1: Deploy the Registry Contract

1. **Navigate to contracts directory:**
   ```bash
   cd projects/contracts
   ```

2. **Ensure AlgoKit is installed:**
   ```bash
   algokit --version
   ```
   If not installed: https://developer.algorand.org/docs/get-started/algokit/

3. **Deploy the registry to TestNet:**
   ```bash
   algokit deploy
   ```
   
4. **When prompted, select:**
   - Network: `testnet`
   - Contract: `registry` (CampusChainRegistry)
   
5. **Save the App ID** from the deployment output:
   ```
   ✅ Registry deployed successfully!
   📋 Registry App ID: 123456789
   ```

### Step 2: Configure Frontend

1. **Open `.env.production`:**
   ```bash
   cd ../frontend
   code .env.production
   ```

2. **Add the registry app ID:**
   ```env
   VITE_REGISTRY_APP_ID=123456789
   ```
   Replace `123456789` with your actual registry app ID from Step 1.

3. **Commit and push:**
   ```bash
   git add .env.production
   git commit -m "Add registry contract app ID"
   git push
   ```

4. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

---

## 🔧 How It Works

### When Creating a Campaign/Event:

**Before (Old Approach):**
1. Device A deploys campaign → stored in Device A's localStorage
2. Device B polls indexer, tries to find campaign (fails due to indexer limitations)
3. Cross-device discovery ❌ doesn't work

**After (Registry Approach):**
1. Device A deploys campaign
2. Device A **automatically registers** the campaign app ID with the registry contract
3. Registry stores the app ID in on-chain box storage
4. Device B queries registry → gets all app IDs → discovers campaign immediately
5. Cross-device discovery ✅ works perfectly!

### Discovery Flow:

```
Device A (Creator)              Registry Contract              Device B (Student)
      |                                |                              |
      | 1. Deploy campaign              |                              |
      | (App ID: 755123456)            |                              |
      |                                |                              |
      | 2. Register with registry      |                              |
      |------------------------------>  |                              |
      |                                |                              |
      |                                | Stores in box storage        |
      |                                | fundraisers: [755123456]     |
      |                                |                              |
      |                                |  3. Query registry           |
      |                                | <-----------------------------|
      |                                |                              |
      |                                | Returns: [755123456]         |
      |                                |----------------------------->|
      |                                |                              |
      |                                | 4. Query campaign details    |
      |                                | <-----------------------------|
      |                                |                              |
      |                                | ✅ Campaign visible!          |
```

---

## 🧪 Testing Cross-Device Discovery

### Test 1: Same Device (Sanity Check)
1. Create a campaign on Device A
2. Check console logs for: `📋 Registry returned N fundraiser app IDs`
3. Verify campaign appears immediately

### Test 2: Different Device (Real Test)
1. **Device A:** Create a campaign
   - Wait 30 seconds for blockchain propagation
   
2. **Device B:** 
   - Clear localStorage (F12 → Application → Local Storage → Clear All)
   - Refresh the page
   - Check console for: `🚀 BOOTSTRAP: Empty localStorage, querying registry...`
   - Campaign should appear within 30-60 seconds

### Test 3: Fresh Device (Cold Start)
1. Open app on completely new Device C (never visited before)
2. Should immediately see all campaigns from registry
3. No configuration or manual setup needed

---

## 🔍 Troubleshooting

### Registry not working (campaigns not showing):

**Check 1: Registry app ID configured?**
```bash
# In frontend/.env.production:
VITE_REGISTRY_APP_ID=123456789  # Should NOT be empty
```

**Check 2: Registry deployed on TestNet?**
```bash
cd projects/contracts
algokit deploy
# Select: testnet → registry
```

**Check 3: Check browser console logs:**
```javascript
// Should see one of these:
📋 Registry returned 4 fundraiser app IDs  // ✅ Working!
⚠️ Registry contract not deployed yet      // ❌ Not configured
Registry contract not found                // ❌ Wrong app ID
```

**Check 4: Verify registry on AlgoExplorer:**
1. Go to: https://testnet.algoexplorer.io/application/YOUR_REGISTRY_APP_ID
2. Should see:
   - Status: Online
   - Boxes: `fundraisers`, `ticketing`
   - Creator: Your wallet address

---

## 📊 Current Status

**Registry Integration:**
- ✅ Smart contract created (`registry/contract.py`)
- ✅ Deploy config created (`registry/deploy_config.py`)
- ✅ Frontend query method added (`queryRegistryContract()`)
- ✅ Discovery strategies updated (registry = primary source)
- ⚠️ **TODO: Deploy the registry contract to TestNet**
- ⚠️ **TODO: Add registry app ID to `.env.production`**
- ⚠️ **TODO: Integrate automatic registration when creating campaigns/events**

---

## 🚀 Next Steps

1. **Deploy the registry contract** (see Step 1 above)
2. **Add app ID to `.env.production`** (see Step 2 above)
3. **Integrate with campaign/event creation**:
   - Automatically call `register_fundraiser(appId)` after deploying campaign
   - Automatically call `register_ticketing(appId)` after deploying event
4. **Test cross-device discovery** (see Testing section above)

---

## 💡 Alternative: Manual Registration (Temporary)

If you need cross-device discovery NOW before full integration:

**Option 1: Add creator addresses to code** (quick fix):
```typescript
// In contractRegistry.ts:
const BOOTSTRAP_CREATOR_ADDRESSES: string[] = [
  'YOUR_WALLET_ADDRESS_HERE'
]
```

**Option 2: Share via URL** (share individual campaigns):
```
https://your-app.vercel.app/campaigns?id=755473869
```

**Option 3: Use registry** (best long-term solution):
- Requires registry deployment + integration (this guide)
- Provides automatic discovery for ALL users

---

## 📚 Technical Details

### Registry Contract Storage:

**Box Storage:**
- `fundraisers`: DynamicArray of UInt64 (up to ~1000 app IDs per 8KB box)
- `ticketing`: DynamicArray of UInt64 (up to ~1000 app IDs per 8KB box)

**Methods:**
- `create_registry()` - Initialize with empty arrays
- `register_fundraiser(app_id)` - Add campaign app ID
- `register_ticketing(app_id)` - Add event app ID  
- `get_fundraisers()` - Returns all campaign app IDs
- `get_ticketing()` - Returns all event app IDs
- `get_total_counts()` - Returns (fundraiser_count, ticketing_count)

### Box Storage Limits:
- Max box size: 32KB
- Current allocation: 8KB per type
- Capacity: ~1000 app IDs per type
- Can be increased by creating multiple boxes if needed

---

## 🆘 Need Help?

**Common Issues:**

1. **"Registry contract not found"**
   - Check app ID matches deployment
   - Verify on TestNet explorer
   
2. **"Failed to query registry contract"**
   - Check internet connection
   - Verify TestNet API endpoints in `.env`
   
3. **"Registry returned 0 app IDs"**
   - Registry is deployed but empty
   - Create a test campaign to populate it
   - Verify registration is working

For more help, check:
- Algorand Developer Docs: https://developer.algorand.org
- AlgoKit Docs: https://github.com/algorandfoundation/algokit-cli
- Algorand Discord: https://discord.gg/algorand
