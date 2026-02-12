// Component rendering test - checks for console errors
import { chromium } from 'playwright';

const routes = [
  { path: '/', name: 'Home' },
  { path: '/fundraising', name: 'Fundraising' },
  { path: '/fundraising/create', name: 'Create Campaign' },
  { path: '/fundraising/reputation', name: 'Reputation DAO' },
  { path: '/ticketing', name: 'Ticketing' },
  { path: '/ticketing/create', name: 'Create Event' },
  { path: '/ticketing/nft-evolution', name: 'NFT Evolution' },
  { path: '/history', name: 'History' },
  { path: '/federation', name: 'Federation' }
];

const BASE_URL = 'http://localhost:5175';

async function testPageRendering() {
  console.log('🎭 Starting browser-based rendering tests...\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const errors = [];
  const warnings = [];
  
  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  page.on('pageerror', error => {
    errors.push(error.message);
  });
  
  const results = [];
  
  for (const route of routes) {
    console.log(`Testing: ${route.name.padEnd(25)} ${route.path}`);
    
    try {
      const startTime = Date.now();
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle', timeout: 10000 });
      const loadTime = Date.now() - startTime;
      
      // Wait for React to render
      await page.waitForTimeout(500);
      
      // Check if page has content
      const bodyText = await page.textContent('body');
      const hasContent = bodyText && bodyText.trim().length > 100;
      
      // Check for specific elements based on route
      let specificCheck = true;
      if (route.path === '/federation') {
        specificCheck = await page.locator('text=Cross-Campus Federation').count() > 0;
      } else if (route.path === '/ticketing/nft-evolution') {
        specificCheck = await page.locator('text=NFT Evolution').count() > 0;
      } else if (route.path === '/fundraising/reputation') {
        specificCheck = await page.locator('text=Reputation DAO').count() > 0;
      }
      
      const pageErrors = errors.filter(e => !e.includes('Warning'));
      const hasErrors = pageErrors.length > 0;
      
      results.push({
        route: route.path,
        name: route.name,
        status: !hasErrors && hasContent && specificCheck ? '✅' : '❌',
        loadTime,
        hasContent,
        specificCheck,
        errors: pageErrors.length
      });
      
      const icon = !hasErrors && hasContent && specificCheck ? '✅' : '❌';
      console.log(`  ${icon} Loaded in ${loadTime}ms | Content: ${hasContent} | Errors: ${pageErrors.length}\n`);
      
      // Clear errors for next test
      errors.length = 0;
      
    } catch (error) {
      results.push({
        route: route.path,
        name: route.name,
        status: '❌',
        error: error.message
      });
      console.log(`  ❌ Failed: ${error.message}\n`);
    }
  }
  
  await browser.close();
  
  console.log('─'.repeat(70));
  console.log('\n📊 Summary:\n');
  
  const passed = results.filter(r => r.status === '✅').length;
  const failed = results.filter(r => r.status === '❌').length;
  
  console.log(`✅ Passed: ${passed}/${routes.length}`);
  console.log(`❌ Failed: ${failed}/${routes.length}`);
  
  if (failed > 0) {
    console.log('\n⚠️  Failed routes:');
    results.filter(r => r.status === '❌').forEach(r => {
      console.log(`  - ${r.name} (${r.route})`);
      if (r.error) console.log(`    Error: ${r.error}`);
    });
  }
  
  if (passed === routes.length) {
    console.log('\n🎉 All pages render successfully!\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some pages have issues.\n');
    process.exit(1);
  }
}

testPageRendering().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
