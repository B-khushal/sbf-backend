const axios = require('axios');

const BASE_URL = 'http://127.0.0.1:5000/api/marketing';

async function testMarketingAPI() {
  console.log('🧪 Starting Marketing Intelligence Verification Tests...');

  try {
    const testVid = `vid_test_${Date.now()}`;
    const testSid = `sid_test_${Date.now()}`;

    console.log(`📤 Sending mock event batch for visitor: ${testVid}...`);
    const ingestRes = await axios.post(`${BASE_URL}/events`, {
      visitorId: testVid,
      sessionId: testSid,
      sessionData: {
        device: 'Desktop',
        trafficSource: 'Instagram',
        utmCampaign: 'spring_roses_2026',
        landingPage: '/shop'
      },
      events: [
        {
          eventType: 'page_view',
          eventCategory: 'Navigation',
          path: '/shop'
        },
        {
          eventType: 'product_view',
          eventCategory: 'Product',
          productId: 'prod_luxury_red_roses',
          productTitle: 'Premium Red Rose Bouquet',
          productPrice: 2499,
          productCategory: 'Bouquets',
          occasion: 'Anniversary'
        },
        {
          eventType: 'scroll_depth',
          eventCategory: 'Engagement',
          metadata: { milestone: 75, percent: 78 }
        },
        {
          eventType: 'add_to_cart',
          eventCategory: 'Cart',
          productId: 'prod_luxury_red_roses',
          productTitle: 'Premium Red Rose Bouquet',
          productPrice: 2499,
          cartValue: 2499
        },
        {
          eventType: 'checkout_started',
          eventCategory: 'Checkout',
          cartValue: 2499
        },
        {
          eventType: 'search',
          eventCategory: 'Search',
          searchQuery: 'anniversary roses'
        },
        {
          eventType: 'zero_result_search',
          eventCategory: 'Search',
          searchQuery: 'white orchids premium'
        }
      ]
    });

    console.log('✅ Ingestion Response:', ingestRes.status, ingestRes.data);

    // 2. Test Identity Stitching
    console.log('🔗 Testing Identity Stitching...');
    const stitchRes = await axios.post(`${BASE_URL}/stitch-identity`, {
      visitorId: testVid,
      userId: 'user_test_marketing_001',
      email: 'verified.customer@sbflorist.in',
      customerName: 'Aarav Sharma',
      customerPhone: '+91 98765 43210'
    });
    console.log('✅ Stitching Response:', stitchRes.status, stitchRes.data);

    console.log('🎉 All Marketing API Ingestion & Stitching Tests PASSED!');
  } catch (error) {
    if (error.response) {
      console.error('❌ Status:', error.response.status, 'Data:', error.response.data);
    } else {
      console.error('❌ Network/Setup Error:', error.message, error.code);
    }
  }
}

testMarketingAPI();
