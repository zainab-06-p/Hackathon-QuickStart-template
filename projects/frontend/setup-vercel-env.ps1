# Copy .env.production to .env for Vercel to use
Copy-Item .env.production .env -Force
Write-Host "✅ Environment variables ready. Now redeploy with: vercel --prod"
