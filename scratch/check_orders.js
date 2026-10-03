const prisma = require('../config/prisma');

async function check() {
  const orders = await prisma.order.findMany({
    select: { id: true, orderNumber: true, totalAmount: true, orderStatus: true, createdAt: true, isTestOrder: true }
  });
  console.log('Orders in DB:', orders);

  // Check dashboard API output
  const axios = require('axios');
  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { id: '6a24223766953fdb14ab7559', role: 'admin', email: 'admin@sbf.com' },
    'dev-jwt-secret-for-local-development-only',
    { expiresIn: '1h' }
  );

  const res = await axios.get('http://127.0.0.1:5000/api/marketing/dashboard?timeframe=all', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Dashboard Data (timeframe=all):', {
    kpis: res.data.kpis,
    funnel: res.data.funnel,
    topProducts: res.data.topProducts,
    trafficSources: res.data.trafficSources,
    topCampaigns: res.data.topCampaigns
  });

  const res30d = await axios.get('http://127.0.0.1:5000/api/marketing/dashboard?timeframe=30d', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Dashboard Data (timeframe=30d):', {
    kpis: res30d.data.kpis,
    funnel: res30d.data.funnel,
    topProducts: res30d.data.topProducts,
    trafficSources: res30d.data.trafficSources
  });

  await prisma.$disconnect();
}

check().catch(console.error);
