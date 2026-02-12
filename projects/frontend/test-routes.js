// Quick test script to verify all routes are accessible
const routes = [
  '/',
  '/fundraising',
  '/fundraising/create',
  '/fundraising/reputation',
  '/ticketing',
  '/ticketing/create',
  '/ticketing/nft-evolution',
  '/history',
  '/federation'
];

const BASE_URL = 'http://localhost:5175';

async function testRoute(route) {
  try {
    const response = await fetch(`${BASE_URL}${route}`);
    const contentType = response.headers.get('content-type');
    const isHTML = contentType && contentType.includes('text/html');
    
    if (response.ok && isHTML) {
      return { route, status: '✅ PASS', code: response.status };
    } else {
      return { route, status: '❌ FAIL', code: response.status };
    }
  } catch (error) {
    return { route, status: '❌ ERROR', error: error.message };
  }
}

async function runTests() {
  console.log('🧪 Testing all routes...\n');
  console.log('Base URL:', BASE_URL);
  console.log('─'.repeat(60));
  
  const results = [];
  for (const route of routes) {
    const result = await testRoute(route);
    results.push(result);
    
    const statusIcon = result.status.includes('✅') ? '✅' : '❌';
    console.log(`${statusIcon} ${result.route.padEnd(35)} [${result.code || 'ERROR'}]`);
    
    if (result.error) {
      console.log(`   └─ Error: ${result.error}`);
    }
  }
  
  console.log('─'.repeat(60));
  
  const passed = results.filter(r => r.status.includes('✅')).length;
  const failed = results.filter(r => r.status.includes('❌')).length;
  
  console.log(`\n📊 Results: ${passed}/${routes.length} passed, ${failed} failed`);
  
  if (passed === routes.length) {
    console.log('\n🎉 All routes are accessible!\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some routes failed. Check the errors above.\n');
    process.exit(1);
  }
}

// Wait 2 seconds for dev server to be fully ready
setTimeout(runTests, 2000);
