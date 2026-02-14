# PowerShell script to add Firebase credentials to Vercel production

Write-Host "🔥 Adding Firebase credentials to Vercel..." -ForegroundColor Yellow

# Change to frontend directory
Set-Location "D:\Hackathon-QuickStart-template\projects\frontend"

# Add each Firebase environment variable
Write-Host "`n1/7 Adding VITE_FIREBASE_API_KEY..." -ForegroundColor Cyan
"AIzaSyBDGu7wUFjbknmPxRueKo7dVwnNfJ3vVl0" | vercel env add VITE_FIREBASE_API_KEY production

Write-Host "`n2/7 Adding VITE_FIREBASE_AUTH_DOMAIN..." -ForegroundColor Cyan
"algorand-b8f15.firebaseapp.com" | vercel env add VITE_FIREBASE_AUTH_DOMAIN production

Write-Host "`n3/7 Adding VITE_FIREBASE_DATABASE_URL..." -ForegroundColor Cyan
"https://algorand-b8f15-default-rtdb.asia-southeast1.firebasedatabase.app" | vercel env add VITE_FIREBASE_DATABASE_URL production

Write-Host "`n4/7 Adding VITE_FIREBASE_PROJECT_ID..." -ForegroundColor Cyan
"algorand-b8f15" | vercel env add VITE_FIREBASE_PROJECT_ID production

Write-Host "`n5/7 Adding VITE_FIREBASE_STORAGE_BUCKET..." -ForegroundColor Cyan
"algorand-b8f15.firebasestorage.app" | vercel env add VITE_FIREBASE_STORAGE_BUCKET production

Write-Host "`n6/7 Adding VITE_FIREBASE_MESSAGING_SENDER_ID..." -ForegroundColor Cyan
"320167805117" | vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID production

Write-Host "`n7/7 Adding VITE_FIREBASE_APP_ID..." -ForegroundColor Cyan
"1:320167805117:web:a7ed8c46bee1831a39b7d4" | vercel env add VITE_FIREBASE_APP_ID production

Write-Host "`n✅ All Firebase credentials added to Vercel!" -ForegroundColor Green
Write-Host "`n🚀 Deploying to production..." -ForegroundColor Yellow

vercel --prod --yes

Write-Host "`n🎉 Deployment complete!" -ForegroundColor Green
