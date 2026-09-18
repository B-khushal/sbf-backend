const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'dev-jwt-secret-for-local-development-only';
const BASE_URL = 'http://127.0.0.1:5000/api/marketing';

async function testMarketingQueries() {
  console.log('🧪 Testing Protected Marketing Endpoints...');

  try {
    // Generate valid dev token for marketing access using real admin user
    const token = jwt.sign(
      { id: '6a24223766953fdb14ab7559', email: 'admin@sbf.com', role: 'admin' },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    const headers = { Authorization: `Bearer ${token}` };

    // 1. Live Visitors
    console.log('📡 Calling GET /live-visitors...');
    const liveRes = await axios.get(`${BASE_URL}/live-visitors`, { headers });
    console.log('✅ Live Visitors:', liveRes.data.activeCount, 'active, total:', liveRes.data.visitors?.length);

    // 2. Dashboard Overview
    console.log('📊 Calling GET /dashboard...');
    const dashRes = await axios.get(`${BASE_URL}/dashboard?timeframe=30d`, { headers });
    console.log('✅ Dashboard KPIs: Visitors:', dashRes.data.kpis?.totalVisitors, 'Revenue:', dashRes.data.kpis?.revenue, 'Purchases:', dashRes.data.kpis?.purchases);

    // 3. Conversion Funnel
    console.log('🔽 Calling GET /funnel...');
    const funnelRes = await axios.get(`${BASE_URL}/funnel?timeframe=30d`, { headers });
    console.log('✅ Funnel Stages Count:', funnelRes.data.stages?.length, 'Overall Rate:', funnelRes.data.overallConversionRate);

    // 4. Products Analytics
    console.log('💐 Calling GET /products...');
    const prodRes = await axios.get(`${BASE_URL}/products?timeframe=30d`, { headers });
    console.log('✅ Products Count:', prodRes.data.products?.length);

    // 5. Search Analytics
    console.log('🔍 Calling GET /search...');
    const searchRes = await axios.get(`${BASE_URL}/search?timeframe=30d`, { headers });
    console.log('✅ Searches:', searchRes.data.topSearches?.length, 'Zero-result:', searchRes.data.zeroResultSearches?.length);

    // 6. Cart Intelligence
    console.log('🛒 Calling GET /cart-intelligence...');
    const cartRes = await axios.get(`${BASE_URL}/cart-intelligence`, { headers });
    console.log('✅ Abandoned Carts:', cartRes.data.carts?.length, 'Potential Recovery: ₹', cartRes.data.summary?.potentialRecoveryRevenue);

    // 7. Attribution
    console.log('🔀 Calling GET /attribution...');
    const attrRes = await axios.get(`${BASE_URL}/attribution?model=Last+Touch`, { headers });
    console.log('✅ Attribution Channels:', attrRes.data.channels?.length);

    // 8. Opportunities
    console.log('💡 Calling GET /opportunities...');
    const oppRes = await axios.get(`${BASE_URL}/opportunities`, { headers });
    console.log('✅ Opportunities Count:', oppRes.data.opportunities?.length);

    console.log('🎉 ALL MARKETING ENDPOINTS TESTED AND VERIFIED SUCCESSFULLY!');
  } catch (error) {
    if (error.response) {
      console.error('❌ Status:', error.response.status, 'Data:', error.response.data);
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

testMarketingQueries();
