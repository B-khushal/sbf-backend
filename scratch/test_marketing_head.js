const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'dev-jwt-secret-for-local-development-only';
const BASE_URL = 'http://127.0.0.1:5000/api/marketing';

async function testMarketingHeadEndpoints() {
  console.log('🧪 Testing Marketing Head Privileged Endpoints...');

  try {
    const token = jwt.sign(
      { id: '6a24223766953fdb14ab7559', email: 'admin@sbf.com', role: 'admin' },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    const headers = { Authorization: `Bearer ${token}` };

    // 1. Settings GET
    console.log('⚙️ GET /settings...');
    const setGet = await axios.get(`${BASE_URL}/settings`, { headers });
    console.log('✅ Settings GET:', setGet.data.settings?.id, 'Attribution Model:', setGet.data.settings?.attributionModel);

    // 2. Settings PUT
    console.log('⚙️ PUT /settings...');
    const setPut = await axios.put(`${BASE_URL}/settings`, {
      attributionModel: 'First Touch'
    }, { headers });
    console.log('✅ Settings PUT:', setPut.data.message);

    // 3. Activity Logs GET
    console.log('📜 GET /activity-logs...');
    const logsRes = await axios.get(`${BASE_URL}/activity-logs`, { headers });
    console.log('✅ Activity Logs Count:', logsRes.data.logs?.length);

    // 4. Segments GET
    console.log('👥 GET /segments...');
    const segRes = await axios.get(`${BASE_URL}/segments`, { headers });
    console.log('✅ Segments Count:', segRes.data.segments?.length);

    // 5. Campaigns GET
    console.log('📢 GET /campaigns...');
    const cmpRes = await axios.get(`${BASE_URL}/campaigns`, { headers });
    console.log('✅ Campaigns Count:', cmpRes.data.campaigns?.length);

    // 6. Reports Export
    console.log('📄 GET /reports/export...');
    const repRes = await axios.get(`${BASE_URL}/reports/export?reportType=daily_summary&timeframe=30d`, { headers });
    console.log('✅ Report CSV Length:', repRes.data.length, 'bytes');

    console.log('🎉 ALL MARKETING HEAD PRIVILEGED ENDPOINTS VERIFIED SUCCESSFULLY!');
  } catch (error) {
    if (error.response) {
      console.error('❌ Status:', error.response.status, 'Data:', error.response.data);
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

testMarketingHeadEndpoints();
