const prisma = require('../config/prisma');

async function execSingle(sql, ...args) {
  const trimmed = sql.trim();
  if (!trimmed) return;
  if (args.length > 0) {
    return prisma.$executeRawUnsafe(trimmed, ...args);
  }
  return prisma.$executeRawUnsafe(trimmed);
}

async function execBatch(statements) {
  for (const stmt of statements) {
    const clean = stmt.trim();
    if (clean) {
      await prisma.$executeRawUnsafe(clean);
    }
  }
}

async function initMarketingDB() {
  try {
    console.log('📊 Initializing Marketing Intelligence Database Tables in PostgreSQL...');

    // 1. analytics_visitors
    await execSingle(`
      CREATE TABLE IF NOT EXISTS "analytics_visitors" (
        "id" VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64),
        "email" VARCHAR(255),
        "customerName" VARCHAR(255),
        "firstSeenAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "totalSessions" INT DEFAULT 1,
        "totalPageViews" INT DEFAULT 0,
        "totalProductViews" INT DEFAULT 0,
        "totalCartAdds" INT DEFAULT 0,
        "totalCheckouts" INT DEFAULT 0,
        "totalOrders" INT DEFAULT 0,
        "totalRevenue" NUMERIC(12, 2) DEFAULT 0,
        "interestScore" INT DEFAULT 5,
        "interestLevel" VARCHAR(32) DEFAULT 'Low',
        "device" VARCHAR(32) DEFAULT 'Desktop',
        "browser" VARCHAR(64) DEFAULT 'Unknown',
        "os" VARCHAR(64) DEFAULT 'Unknown',
        "city" VARCHAR(128) DEFAULT 'Mumbai',
        "region" VARCHAR(128) DEFAULT 'Maharashtra',
        "country" VARCHAR(64) DEFAULT 'India',
        "initialTrafficSource" VARCHAR(64) DEFAULT 'Direct',
        "initialCampaign" VARCHAR(128),
        "isBot" BOOLEAN DEFAULT FALSE,
        "status" VARCHAR(32) DEFAULT 'active',
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await execBatch([
      `CREATE INDEX IF NOT EXISTS "idx_visitors_userId" ON "analytics_visitors" ("userId")`,
      `CREATE INDEX IF NOT EXISTS "idx_visitors_lastSeenAt" ON "analytics_visitors" ("lastSeenAt")`,
      `CREATE INDEX IF NOT EXISTS "idx_visitors_interestScore" ON "analytics_visitors" ("interestScore")`
    ]);

    // 2. analytics_sessions
    await execSingle(`
      CREATE TABLE IF NOT EXISTS "analytics_sessions" (
        "id" VARCHAR(64) PRIMARY KEY,
        "visitorId" VARCHAR(64) NOT NULL,
        "userId" VARCHAR(64),
        "startedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "lastActiveAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "endedAt" TIMESTAMPTZ,
        "durationSeconds" INT DEFAULT 0,
        "landingPage" VARCHAR(512) DEFAULT '/',
        "exitPage" VARCHAR(512) DEFAULT '/',
        "currentPath" VARCHAR(512) DEFAULT '/',
        "referrer" VARCHAR(512),
        "trafficSource" VARCHAR(64) DEFAULT 'Direct',
        "trafficMedium" VARCHAR(64) DEFAULT 'none',
        "utmSource" VARCHAR(128),
        "utmMedium" VARCHAR(128),
        "utmCampaign" VARCHAR(128),
        "utmContent" VARCHAR(128),
        "utmTerm" VARCHAR(128),
        "device" VARCHAR(32) DEFAULT 'Desktop',
        "browser" VARCHAR(64) DEFAULT 'Unknown',
        "os" VARCHAR(64) DEFAULT 'Unknown',
        "city" VARCHAR(128) DEFAULT 'Mumbai',
        "pageViewsCount" INT DEFAULT 1,
        "productViewsCount" INT DEFAULT 0,
        "cartAddsCount" INT DEFAULT 0,
        "checkoutsCount" INT DEFAULT 0,
        "purchasesCount" INT DEFAULT 0,
        "sessionRevenue" NUMERIC(12, 2) DEFAULT 0,
        "activityStage" VARCHAR(64) DEFAULT 'Browsing',
        "status" VARCHAR(32) DEFAULT 'Active',
        "isBounce" BOOLEAN DEFAULT FALSE,
        "createdAt" TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await execBatch([
      `CREATE INDEX IF NOT EXISTS "idx_sessions_visitorId" ON "analytics_sessions" ("visitorId")`,
      `CREATE INDEX IF NOT EXISTS "idx_sessions_lastActiveAt" ON "analytics_sessions" ("lastActiveAt")`,
      `CREATE INDEX IF NOT EXISTS "idx_sessions_trafficSource" ON "analytics_sessions" ("trafficSource")`,
      `CREATE INDEX IF NOT EXISTS "idx_sessions_utmCampaign" ON "analytics_sessions" ("utmCampaign")`,
      `CREATE INDEX IF NOT EXISTS "idx_sessions_status" ON "analytics_sessions" ("status")`
    ]);

    // 3. analytics_events
    await execSingle(`
      CREATE TABLE IF NOT EXISTS "analytics_events" (
        "id" VARCHAR(64) PRIMARY KEY,
        "visitorId" VARCHAR(64) NOT NULL,
        "sessionId" VARCHAR(64) NOT NULL,
        "userId" VARCHAR(64),
        "eventType" VARCHAR(64) NOT NULL,
        "eventCategory" VARCHAR(64) NOT NULL,
        "url" VARCHAR(512),
        "path" VARCHAR(512),
        "productId" VARCHAR(64),
        "productTitle" VARCHAR(255),
        "productPrice" NUMERIC(10, 2),
        "productCategory" VARCHAR(128),
        "occasion" VARCHAR(128),
        "searchQuery" VARCHAR(255),
        "cartValue" NUMERIC(12, 2),
        "orderId" VARCHAR(64),
        "orderNumber" VARCHAR(64),
        "revenue" NUMERIC(12, 2),
        "metadata" JSONB DEFAULT '{}'::jsonb,
        "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await execBatch([
      `CREATE INDEX IF NOT EXISTS "idx_events_visitorId" ON "analytics_events" ("visitorId")`,
      `CREATE INDEX IF NOT EXISTS "idx_events_sessionId" ON "analytics_events" ("sessionId")`,
      `CREATE INDEX IF NOT EXISTS "idx_events_eventType" ON "analytics_events" ("eventType")`,
      `CREATE INDEX IF NOT EXISTS "idx_events_timestamp" ON "analytics_events" ("timestamp")`,
      `CREATE INDEX IF NOT EXISTS "idx_events_productId" ON "analytics_events" ("productId")`,
      `CREATE INDEX IF NOT EXISTS "idx_events_searchQuery" ON "analytics_events" ("searchQuery")`
    ]);

    // 4. analytics_carts
    await execSingle(`
      CREATE TABLE IF NOT EXISTS "analytics_carts" (
        "id" VARCHAR(64) PRIMARY KEY,
        "visitorId" VARCHAR(64) NOT NULL,
        "sessionId" VARCHAR(64) NOT NULL,
        "userId" VARCHAR(64),
        "customerName" VARCHAR(255),
        "customerEmail" VARCHAR(255),
        "customerPhone" VARCHAR(64),
        "products" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "totalValue" NUMERIC(12, 2) NOT NULL DEFAULT 0,
        "itemCount" INT DEFAULT 0,
        "checkoutStarted" BOOLEAN DEFAULT FALSE,
        "paymentAttempted" BOOLEAN DEFAULT FALSE,
        "isPurchased" BOOLEAN DEFAULT FALSE,
        "isAbandoned" BOOLEAN DEFAULT FALSE,
        "abandonmentStage" VARCHAR(64) DEFAULT 'Cart',
        "lastActivityAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await execBatch([
      `CREATE INDEX IF NOT EXISTS "idx_carts_visitorId" ON "analytics_carts" ("visitorId")`,
      `CREATE INDEX IF NOT EXISTS "idx_carts_isAbandoned" ON "analytics_carts" ("isAbandoned")`,
      `CREATE INDEX IF NOT EXISTS "idx_carts_lastActivityAt" ON "analytics_carts" ("lastActivityAt")`
    ]);

    // 5. analytics_campaigns
    await execSingle(`
      CREATE TABLE IF NOT EXISTS "analytics_campaigns" (
        "id" VARCHAR(64) PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL,
        "platform" VARCHAR(64) NOT NULL,
        "status" VARCHAR(32) DEFAULT 'active',
        "utmCampaign" VARCHAR(128) NOT NULL,
        "utmSource" VARCHAR(128),
        "utmMedium" VARCHAR(128),
        "utmContent" VARCHAR(128),
        "budget" NUMERIC(12, 2) DEFAULT 0,
        "spend" NUMERIC(12, 2) DEFAULT 0,
        "impressions" INT DEFAULT 0,
        "reach" INT DEFAULT 0,
        "clicks" INT DEFAULT 0,
        "sessions" INT DEFAULT 0,
        "productViews" INT DEFAULT 0,
        "addToCartCount" INT DEFAULT 0,
        "checkoutCount" INT DEFAULT 0,
        "purchases" INT DEFAULT 0,
        "revenue" NUMERIC(12, 2) DEFAULT 0,
        "startDate" TIMESTAMPTZ,
        "endDate" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await execSingle(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_campaigns_utmCampaign" ON "analytics_campaigns" ("utmCampaign");
    `);

    // 6. analytics_segments
    await execSingle(`
      CREATE TABLE IF NOT EXISTS "analytics_segments" (
        "id" VARCHAR(64) PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "type" VARCHAR(64) NOT NULL DEFAULT 'predefined',
        "rules" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "memberCount" INT DEFAULT 0,
        "createdBy" VARCHAR(64),
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 7. marketing_activity_logs
    await execSingle(`
      CREATE TABLE IF NOT EXISTS "marketing_activity_logs" (
        "id" VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL,
        "userName" VARCHAR(255),
        "userRole" VARCHAR(64) NOT NULL,
        "action" VARCHAR(128) NOT NULL,
        "entityType" VARCHAR(64),
        "entityId" VARCHAR(64),
        "details" JSONB DEFAULT '{}'::jsonb,
        "ipAddress" VARCHAR(64),
        "userAgent" VARCHAR(255),
        "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await execSingle(`
      CREATE INDEX IF NOT EXISTS "idx_marketing_logs_timestamp" ON "marketing_activity_logs" ("timestamp");
    `);

    // 8. marketing_settings
    await execSingle(`
      CREATE TABLE IF NOT EXISTS "marketing_settings" (
        "id" VARCHAR(64) PRIMARY KEY DEFAULT 'default',
        "interestWeights" JSONB NOT NULL,
        "attributionModel" VARCHAR(32) DEFAULT 'Last Touch',
        "alertThresholds" JSONB NOT NULL,
        "retentionPolicies" JSONB NOT NULL,
        "botFilteringRules" JSONB NOT NULL,
        "adIntegrations" JSONB NOT NULL,
        "updatedBy" VARCHAR(64),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Seed default settings if not existing
    const existingSettings = await prisma.$queryRawUnsafe(`SELECT "id" FROM "marketing_settings" WHERE "id" = 'default' LIMIT 1;`);
    if (!existingSettings || existingSettings.length === 0) {
      const defaultWeights = JSON.stringify({
        productView: 5,
        repeatProductView: 10,
        longEngagement: 10,
        galleryInteraction: 5,
        scroll75: 5,
        deliveryInfoViewed: 8,
        addToCart: 30,
        checkoutStarted: 50,
        purchase: 100,
        removeFromCart: -10,
        checkoutAbandoned: -20
      });

      const defaultAlerts = JSON.stringify({
        highCartAbandonmentThreshold: 75,
        trafficSpikeThreshold: 50,
        conversionDropThreshold: 30,
        zeroResultSearchSpikeThreshold: 15,
        paymentFailureSpikeThreshold: 20
      });

      const defaultRetention = JSON.stringify({
        rawEventsDays: 90,
        sessionsDays: 180,
        aggregateYears: 2,
        activityLogsDays: 365
      });

      const defaultBotRules = JSON.stringify({
        filterKnownCrawlers: true,
        maxEventsPerMinute: 120,
        blockHeadless: false
      });

      const defaultAdIntegrations = JSON.stringify({
        metaAds: { connected: false, accountId: null, pixelId: null, autoSync: false },
        googleAds: { connected: false, customerId: null, conversionId: null, autoSync: false }
      });

      await prisma.$executeRawUnsafe(`
        INSERT INTO "marketing_settings" ("id", "interestWeights", "attributionModel", "alertThresholds", "retentionPolicies", "botFilteringRules", "adIntegrations")
        VALUES ('default', $1::jsonb, 'Last Touch', $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb);
      `, defaultWeights, defaultAlerts, defaultRetention, defaultBotRules, defaultAdIntegrations);
      console.log('✅ Seeded default marketing settings.');
    }

    // Seed default audience segments if empty
    const segmentsCount = await prisma.$queryRawUnsafe(`SELECT count(*) FROM "analytics_segments";`);
    if (parseInt(segmentsCount[0].count, 10) === 0) {
      const predefinedSegments = [
        {
          id: 'seg_high_intent',
          name: 'High Intent Visitors',
          description: 'Visitors who viewed multiple products, added to cart or started checkout without completing purchase.',
          type: 'predefined',
          rules: JSON.stringify({ minProductViews: 2, addedToCart: true, purchased: false })
        },
        {
          id: 'seg_cart_abandoners',
          name: 'Cart Abandoners',
          description: 'Visitors who added floral arrangements to cart within the last 7 days but abandoned before purchase.',
          type: 'predefined',
          rules: JSON.stringify({ addedToCart: true, purchased: false, withinDays: 7 })
        },
        {
          id: 'seg_product_interested',
          name: 'Product Interested',
          description: 'Visitors who repeatedly viewed the same bouquet or luxury box 3+ times.',
          type: 'predefined',
          rules: JSON.stringify({ repeatProductViews: 3 })
        },
        {
          id: 'seg_returning_visitors',
          name: 'Returning Visitors',
          description: 'Visitors with 2 or more distinct browsing sessions.',
          type: 'predefined',
          rules: JSON.stringify({ minSessions: 2 })
        },
        {
          id: 'seg_high_value_customers',
          name: 'High Value Customers',
          description: 'Customers with cumulative purchase value exceeding ₹5,000.',
          type: 'predefined',
          rules: JSON.stringify({ minTotalSpend: 5000 })
        },
        {
          id: 'seg_occasion_shoppers',
          name: 'Occasion Shoppers',
          description: 'Visitors showing strong intent across Anniversary, Birthday, or Valentine collections.',
          type: 'predefined',
          rules: JSON.stringify({ hasOccasionViews: true })
        },
        {
          id: 'seg_new_visitors',
          name: 'New Visitors',
          description: 'First-time visitors exploring the sbflorist.in storefront.',
          type: 'predefined',
          rules: JSON.stringify({ sessions: 1 })
        }
      ];

      for (const seg of predefinedSegments) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "analytics_segments" ("id", "name", "description", "type", "rules", "memberCount")
          VALUES ($1, $2, $3, $4, $5::jsonb, 0)
          ON CONFLICT ("id") DO NOTHING;
        `, seg.id, seg.name, seg.description, seg.type, seg.rules);
      }
      console.log('✅ Seeded default marketing audience segments.');
    }

    // Seed default sample campaigns if empty
    const campaignsCount = await prisma.$queryRawUnsafe(`SELECT count(*) FROM "analytics_campaigns";`);
    if (parseInt(campaignsCount[0].count, 10) === 0) {
      const sampleCampaigns = [
        {
          id: 'cmp_ig_roses_2026',
          name: 'Instagram Luxury Roses Spring',
          platform: 'Instagram',
          status: 'active',
          utmCampaign: 'spring_roses_2026',
          utmSource: 'instagram',
          utmMedium: 'social',
          budget: 15000,
          spend: 8400,
          impressions: 42500,
          clicks: 1850,
          sessions: 1420
        },
        {
          id: 'cmp_google_anniversary',
          name: 'Google Search - Premium Anniversary Flowers',
          platform: 'Google Ads',
          status: 'active',
          utmCampaign: 'anniversary_search_delhi',
          utmSource: 'google',
          utmMedium: 'cpc',
          budget: 25000,
          spend: 14200,
          impressions: 28400,
          clicks: 2120,
          sessions: 1890
        },
        {
          id: 'cmp_whatsapp_repeat',
          name: 'WhatsApp VIP Floral Club',
          platform: 'WhatsApp',
          status: 'active',
          utmCampaign: 'vip_retention_march',
          utmSource: 'whatsapp',
          utmMedium: 'direct_chat',
          budget: 2000,
          spend: 850,
          impressions: 3500,
          clicks: 940,
          sessions: 820
        }
      ];

      for (const cmp of sampleCampaigns) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "analytics_campaigns" ("id", "name", "platform", "status", "utmCampaign", "utmSource", "utmMedium", "budget", "spend", "impressions", "clicks", "sessions")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT ("utmCampaign") DO NOTHING;
        `, cmp.id, cmp.name, cmp.platform, cmp.status, cmp.utmCampaign, cmp.utmSource, cmp.utmMedium, cmp.budget, cmp.spend, cmp.impressions, cmp.clicks, cmp.sessions);
      }
      console.log('✅ Seeded default marketing campaigns.');
    }

    // Register Marketing Roles in Role model
    const Role = require('../models/Role');
    const marketingHeadRole = await Role.findOne({ name: 'Marketing Head' });
    if (!marketingHeadRole) {
      await Role.create({
        id: 'role_marketing_head',
        name: 'Marketing Head',
        displayName: 'Marketing Head',
        description: 'Full leadership access to Marketing Intelligence, Campaigns, Segments, Analytics, Reports, and Settings.',
        permissions: [
          'marketing:view',
          'marketing:analytics',
          'marketing:journeys',
          'marketing:campaigns:manage',
          'marketing:segments:manage',
          'marketing:reports:export',
          'marketing:settings:manage'
        ]
      });
      console.log('✅ Created Marketing Head Role.');
    }

    const marketingTeamRole = await Role.findOne({ name: 'Marketing Team' });
    if (!marketingTeamRole) {
      await Role.create({
        id: 'role_marketing_team',
        name: 'Marketing Team',
        displayName: 'Marketing Team',
        description: 'Read-only access to Marketing Intelligence dashboards, customer journeys, conversion funnels, product & campaign analytics.',
        permissions: [
          'marketing:view',
          'marketing:analytics',
          'marketing:journeys',
          'marketing:campaigns:view',
          'marketing:segments:view'
        ]
      });
      console.log('✅ Created Marketing Team Role.');
    }

    console.log('✨ Marketing Intelligence Database Initialization Completed Successfully!');
    return true;
  } catch (error) {
    console.error('❌ Marketing Intelligence Database Initialization Error:', error);
    throw error;
  }
}

module.exports = { initMarketingDB };
