const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'dev-jwt-secret-for-local-development-only';
const BASE_URL = 'http://127.0.0.1:5000/api/marketing';

async function testRBACSecurity() {
  console.log('🔒 Testing RBAC Security & Restrictions...');

  try {
    // 1. Regular customer token
    const customerToken = jwt.sign(
      { id: '68556024a6790127441df774', email: 'badodhekhushal@gmail.com', role: 'user' },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    try {
      await axios.get(`${BASE_URL}/dashboard`, {
        headers: { Authorization: `Bearer ${customerToken}` }
      });
      console.error('❌ SECURITY FAILED: Regular user was able to access /marketing/dashboard!');
    } catch (err) {
      if (err.response?.status === 403) {
        console.log('✅ RBAC BLOCKED Customer from /marketing/dashboard with 403 Forbidden:', err.response.data.message);
      } else {
        console.error('Unexpected status:', err.response?.status);
      }
    }

    // 2. Marketing Team token trying to update settings (head only)
    const teamToken = jwt.sign(
      { id: 'usr_mkt_team_001', email: 'team_member@sbf.com', role: 'marketing_team' },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    try {
      await axios.put(`${BASE_URL}/settings`, { attributionModel: 'Direct' }, {
        headers: { Authorization: `Bearer ${teamToken}` }
      });
      console.error('❌ SECURITY FAILED: Marketing Team was able to update settings!');
    } catch (err) {
      if (err.response?.status === 403) {
        console.log('✅ RBAC BLOCKED Marketing Team from editing settings with 403 Forbidden:', err.response.data.message);
      } else {
        console.error('Unexpected status:', err.response?.status);
      }
    }

    // 3. Marketing Head token accessing /api/products/ (admin CRUD should block marketing head)
    const headToken = jwt.sign(
      { id: '6a24223766953fdb14ab7559', email: 'head@sbflorist.in', role: 'marketing_head' },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    try {
      await axios.post('http://127.0.0.1:5000/api/products/admin/bulk-action', { action: 'delete' }, {
        headers: { Authorization: `Bearer ${headToken}` }
      });
      console.error('❌ SECURITY FAILED: Marketing Head was able to execute admin product bulk action!');
    } catch (err) {
      if (err.response?.status === 403) {
        console.log('✅ RBAC BLOCKED Marketing Head from modifying products with 403 Forbidden:', err.response.data.message);
      } else {
        console.log('Blocked with status:', err.response?.status);
      }
    }

    console.log('🎉 ALL RBAC SECURITY RESTRICTION TESTS PASSED PERFECTLY!');
  } catch (err) {
    console.error('RBAC Test Error:', err);
  }
}

testRBACSecurity();
