#!/bin/bash
# Add all Firebase environment variables to Vercel production

echo "Adding Firebase credentials to Vercel..."

# Firebase API Key
echo "AIzaSyBDGu7wUFjbknmPxRueKo7dVwnNfJ3vVl0" | vercel env add VITE_FIREBASE_API_KEY production --yes

# Firebase Auth Domain  
echo "algorand-b8f15.firebaseapp.com" | vercel env add VITE_FIREBASE_AUTH_DOMAIN production --yes

# Firebase Database URL
echo "https://algorand-b8f15-default-rtdb.asia-southeast1.firebasedatabase.app" | vercel env add VITE_FIREBASE_DATABASE_URL production --yes

# Firebase Project ID
echo "algorand-b8f15" | vercel env add VITE_FIREBASE_PROJECT_ID production --yes

# Firebase Storage Bucket
echo "algorand-b8f15.firebasestorage.app" | vercel env add VITE_FIREBASE_STORAGE_BUCKET production --yes

# Firebase Messaging Sender ID
echo "320167805117" | vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID production --yes

# Firebase App ID
echo "1:320167805117:web:a7ed8c46bee1831a39b7d4" | vercel env add VITE_FIREBASE_APP_ID production --yes

echo "✅ All Firebase credentials added to Vercel!"
echo "Now run: vercel --prod"
