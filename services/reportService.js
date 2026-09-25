const prisma = require('../config/prisma');

// Date range resolution helper
function getDateRange(timeframe = '30d', customStart, customEnd) {
  const now = new Date();
  let start = new Date();

  switch (timeframe) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'yesterday':
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      now.setDate(now.getDate() - 1);
      now.setHours(23, 59, 59, 999);
      break;
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    case '90d':
      start.setDate(start.getDate() - 90);
      break;
    case 'this_month': {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    }
    case 'last_month': {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      now.setTime(new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime());
      break;
    }
    case 'all':
    case 'all_time':
    case 'all-time':
      start = new Date('2020-01-01T00:00:00.000Z');
      break;
    case 'custom':
      if (customStart) start = new Date(customStart);
      if (customEnd) now.setTime(new Date(customEnd).getTime());
      break;
    default:
      start.setDate(start.getDate() - 30);
  }

  return { start: start.toISOString(), end: now.toISOString() };
}

// Format CSV string cell (escaping quotes)
function escapeCsv(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// Convert dataset to CSV
function toCsv(columns, rows) {
  const header = columns.map(c => escapeCsv(c.label)).join(',');
  const lines = rows.map(r => {
    return columns.map(c => escapeCsv(r[c.key])).join(',');
  });
  return [header, ...lines].join('\n');
}

// Main Report Generator
async function getReportData({
  reportType = 'daily_summary',
  timeframe = '30d',
  startDate,
  endDate,
  search,
  page = 1,
  limit = 100
}) {
  const { start, end } = getDateRange(timeframe, startDate, endDate);

  switch (reportType) {
    case 'daily_summary': {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT 
          TO_CHAR(d.day, 'YYYY-MM-DD') as "date",
          COALESCE(o."revenue", 0)::NUMERIC as "revenue",
          COALESCE(o."orders", 0)::INT as "orders",
          COALESCE(e."visitors", 0)::INT as "visitors",
          COALESCE(e."pageViews", 0)::INT as "pageViews",
          COALESCE(e."addCart", 0)::INT as "addCart",
          COALESCE(e."checkouts", 0)::INT as "checkouts"
        FROM GENERATE_SERIES($1::timestamptz, $2::timestamptz, '1 day'::interval) d(day)
        LEFT JOIN (
          SELECT 
            DATE_TRUNC('day', "createdAt") as "orderDay",
            SUM("totalAmount") as "revenue",
            COUNT(*) as "orders"
          FROM "Order"
          WHERE "createdAt" >= $1::timestamptz AND "createdAt" <= $2::timestamptz
            AND "orderStatus" NOT IN ('cancelled', 'failed')
            AND "isTestOrder" = false
          GROUP BY DATE_TRUNC('day', "createdAt")
        ) o ON DATE_TRUNC('day', d.day) = o."orderDay"
        LEFT JOIN (
          SELECT 
            DATE_TRUNC('day', "timestamp") as "evDay",
            COUNT(DISTINCT "visitorId") as "visitors",
            COUNT(CASE WHEN "eventType" = 'page_view' THEN 1 END) as "pageViews",
            COUNT(CASE WHEN "eventType" = 'add_to_cart' THEN 1 END) as "addCart",
            COUNT(CASE WHEN "eventType" = 'checkout_started' THEN 1 END) as "checkouts"
          FROM "analytics_events"
          WHERE "timestamp" >= $1::timestamptz AND "timestamp" <= $2::timestamptz
          GROUP BY DATE_TRUNC('day', "timestamp")
        ) e ON DATE_TRUNC('day', d.day) = e."evDay"
        WHERE COALESCE(o."orders", 0) > 0 OR COALESCE(e."visitors", 0) > 0 OR COALESCE(e."pageViews", 0) > 0
        ORDER BY "date" DESC;
      `, start, end);

      let totalRevenue = 0;
      let totalOrders = 0;
      let totalVisitors = 0;
      let totalPageViews = 0;
      let totalCartAdds = 0;

      const formatted = rows.map(r => {
        const rev = Number(r.revenue || 0);
        const ord = Number(r.orders || 0);
        const vis = Number(r.visitors || 0);
        const pv = Number(r.pageViews || 0);
        const cart = Number(r.addCart || 0);
        const conv = vis > 0 ? ((ord / vis) * 100).toFixed(2) : '0.00';
        const aov = ord > 0 ? Math.round(rev / ord) : 0;

        totalRevenue += rev;
        totalOrders += ord;
        totalVisitors += vis;
        totalPageViews += pv;
        totalCartAdds += cart;

        return {
          date: r.date,
          visitors: vis,
          pageViews: pv,
          addCart: cart,
          checkouts: Number(r.checkouts || 0),
          orders: ord,
          revenue: rev,
          conversionRate: `${conv}%`,
          aov
        };
      });

      const columns = [
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'visitors', label: 'Visitors', type: 'number' },
        { key: 'pageViews', label: 'Page Views', type: 'number' },
        { key: 'addCart', label: 'Cart Adds', type: 'number' },
        { key: 'checkouts', label: 'Checkouts', type: 'number' },
        { key: 'orders', label: 'Orders', type: 'number' },
        { key: 'revenue', label: 'Gross Revenue (₹)', type: 'currency' },
        { key: 'conversionRate', label: 'Conv. Rate', type: 'badge' },
        { key: 'aov', label: 'AOV (₹)', type: 'currency' }
      ];

      return {
        reportType,
        reportTitle: 'Daily Executive Marketing Summary',
        reportDescription: 'Day-by-day telemetry matching visitor traffic, cart additions, checkouts, reconciled orders, and gross revenue.',
        category: 'Executive',
        timeframe,
        range: { start, end },
        columns,
        summary: {
          totalRevenue,
          totalOrders,
          totalVisitors,
          totalPageViews,
          totalCartAdds,
          avgConversionRate: totalVisitors > 0 ? `${((totalOrders / totalVisitors) * 100).toFixed(2)}%` : '0.00%',
          blendedAov: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0
        },
        rows: formatted,
        chartData: [...formatted].reverse().map(r => ({
          name: r.date.slice(5),
          fullDate: r.date,
          revenue: r.revenue,
          orders: r.orders,
          visitors: r.visitors
        })),
        totalRows: formatted.length
      };
    }

    case 'weekly_summary': {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT 
          TO_CHAR(DATE_TRUNC('week', d.day), 'YYYY-"W"IW') as "week",
          TO_CHAR(DATE_TRUNC('week', d.day), 'YYYY-MM-DD') as "weekStart",
          COALESCE(SUM(o."revenue"), 0)::NUMERIC as "revenue",
          COALESCE(SUM(o."orders"), 0)::INT as "orders",
          COALESCE(SUM(e."visitors"), 0)::INT as "visitors",
          COALESCE(SUM(e."pageViews"), 0)::INT as "pageViews",
          COALESCE(SUM(e."addCart"), 0)::INT as "addCart",
          COALESCE(SUM(e."checkouts"), 0)::INT as "checkouts"
        FROM GENERATE_SERIES($1::timestamptz, $2::timestamptz, '1 day'::interval) d(day)
        LEFT JOIN (
          SELECT 
            DATE_TRUNC('day', "createdAt") as "orderDay",
            SUM("totalAmount") as "revenue",
            COUNT(*) as "orders"
          FROM "Order"
          WHERE "createdAt" >= $1::timestamptz AND "createdAt" <= $2::timestamptz
            AND "orderStatus" NOT IN ('cancelled', 'failed')
            AND "isTestOrder" = false
          GROUP BY DATE_TRUNC('day', "createdAt")
        ) o ON DATE_TRUNC('day', d.day) = o."orderDay"
        LEFT JOIN (
          SELECT 
            DATE_TRUNC('day', "timestamp") as "evDay",
            COUNT(DISTINCT "visitorId") as "visitors",
            COUNT(CASE WHEN "eventType" = 'page_view' THEN 1 END) as "pageViews",
            COUNT(CASE WHEN "eventType" = 'add_to_cart' THEN 1 END) as "addCart",
            COUNT(CASE WHEN "eventType" = 'checkout_started' THEN 1 END) as "checkouts"
          FROM "analytics_events"
          WHERE "timestamp" >= $1::timestamptz AND "timestamp" <= $2::timestamptz
          GROUP BY DATE_TRUNC('day', "timestamp")
        ) e ON DATE_TRUNC('day', d.day) = e."evDay"
        GROUP BY DATE_TRUNC('week', d.day)
        HAVING COALESCE(SUM(o."orders"), 0) > 0 OR COALESCE(SUM(e."visitors"), 0) > 0
        ORDER BY "weekStart" DESC;
      `, start, end);

      let totalRevenue = 0;
      let totalOrders = 0;
      let totalVisitors = 0;

      const formatted = rows.map(r => {
        const rev = Number(r.revenue || 0);
        const ord = Number(r.orders || 0);
        const vis = Number(r.visitors || 0);
        const conv = vis > 0 ? ((ord / vis) * 100).toFixed(2) : '0.00';
        const aov = ord > 0 ? Math.round(rev / ord) : 0;

        totalRevenue += rev;
        totalOrders += ord;
        totalVisitors += vis;

        return {
          week: r.week,
          weekStart: r.weekStart,
          visitors: vis,
          pageViews: Number(r.pageViews || 0),
          addCart: Number(r.addCart || 0),
          checkouts: Number(r.checkouts || 0),
          orders: ord,
          revenue: rev,
          conversionRate: `${conv}%`,
          aov
        };
      });

      const columns = [
        { key: 'week', label: 'Calendar Week', type: 'text' },
        { key: 'weekStart', label: 'Starting Monday', type: 'date' },
        { key: 'visitors', label: 'Visitors', type: 'number' },
        { key: 'pageViews', label: 'Page Views', type: 'number' },
        { key: 'addCart', label: 'Cart Adds', type: 'number' },
        { key: 'orders', label: 'Orders', type: 'number' },
        { key: 'revenue', label: 'Weekly Revenue (₹)', type: 'currency' },
        { key: 'conversionRate', label: 'Conv. Rate', type: 'badge' },
        { key: 'aov', label: 'AOV (₹)', type: 'currency' }
      ];

      return {
        reportType,
        reportTitle: 'Weekly Growth & Conversion Report',
        reportDescription: 'Rolling weekly aggregations analyzing traffic scaling, conversion velocity, and order revenue generation.',
        category: 'Executive',
        timeframe,
        range: { start, end },
        columns,
        summary: {
          totalRevenue,
          totalOrders,
          totalVisitors,
          avgWeeklyRevenue: formatted.length > 0 ? Math.round(totalRevenue / formatted.length) : 0,
          blendedAov: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0
        },
        rows: formatted,
        chartData: [...formatted].reverse().map(r => ({
          name: r.week,
          revenue: r.revenue,
          orders: r.orders,
          visitors: r.visitors
        })),
        totalRows: formatted.length
      };
    }

    case 'product_performance': {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT 
          p."id",
          p."name" as "title",
          p."sku",
          COALESCE(p."details"->>'subcategory', 'Bouquets') as "category",
          p."price"::NUMERIC as "price",
          p."stock",
          COALESCE(ev."views", 0)::INT as "views",
          COALESCE(ev."cartAdds", 0)::INT as "cartAdds",
          COALESCE(ord."unitsSold", 0)::INT as "unitsSold",
          COALESCE(ord."revenue", 0)::NUMERIC as "revenue"
        FROM "Product" p
        LEFT JOIN (
          SELECT 
            "productId",
            COUNT(CASE WHEN "eventType" = 'product_view' THEN 1 END) as "views",
            COUNT(CASE WHEN "eventType" = 'add_to_cart' THEN 1 END) as "cartAdds"
          FROM "analytics_events"
          WHERE "timestamp" >= $1::timestamptz AND "timestamp" <= $2::timestamptz
            AND "productId" IS NOT NULL
          GROUP BY "productId"
        ) ev ON ev."productId" = p."id"
        LEFT JOIN (
          SELECT 
            oi."productId",
            SUM(oi."quantity") as "unitsSold",
            SUM(oi."subtotal") as "revenue"
          FROM "OrderItem" oi
          JOIN "Order" o ON o."id" = oi."orderId"
          WHERE o."createdAt" >= $1::timestamptz AND o."createdAt" <= $2::timestamptz
            AND o."orderStatus" NOT IN ('cancelled', 'failed')
            AND "isTestOrder" = false
          GROUP BY oi."productId"
        ) ord ON ord."productId" = p."id"
        ORDER BY "revenue" DESC, "views" DESC, "cartAdds" DESC;
      `, start, end);

      let totalRevenue = 0;
      let totalUnitsSold = 0;
      let totalViews = 0;
      let totalCartAdds = 0;

      const formatted = rows.map(r => {
        const rev = Number(r.revenue || 0);
        const units = Number(r.unitsSold || 0);
        const views = Number(r.views || 0);
        const cartAdds = Number(r.cartAdds || 0);

        totalRevenue += rev;
        totalUnitsSold += units;
        totalViews += views;
        totalCartAdds += cartAdds;

        const cartToDetail = views > 0 ? ((cartAdds / views) * 100).toFixed(1) : (cartAdds > 0 ? '100.0' : '0.0');
        const conversionRate = views > 0 ? ((units / views) * 100).toFixed(1) : (units > 0 ? '100.0' : '0.0');

        return {
          id: r.id,
          title: r.title,
          sku: r.sku || 'N/A',
          category: r.category,
          price: Number(r.price || 0),
          stock: r.stock,
          views,
          cartAdds,
          unitsSold: units,
          revenue: rev,
          cartToDetailRate: `${cartToDetail}%`,
          conversionRate: `${conversionRate}%`,
          stockStatus: r.stock > 10 ? 'In Stock' : r.stock > 0 ? 'Low Stock' : 'Out of Stock'
        };
      });

      const columns = [
        { key: 'title', label: 'Product Name', type: 'text' },
        { key: 'category', label: 'Category', type: 'badge' },
        { key: 'price', label: 'Price (₹)', type: 'currency' },
        { key: 'views', label: 'Views', type: 'number' },
        { key: 'cartAdds', label: 'Cart Adds', type: 'number' },
        { key: 'unitsSold', label: 'Units Sold', type: 'number' },
        { key: 'revenue', label: 'Revenue (₹)', type: 'currency' },
        { key: 'cartToDetailRate', label: 'Cart Rate', type: 'badge' },
        { key: 'conversionRate', label: 'Conv. Rate', type: 'badge' },
        { key: 'stockStatus', label: 'Stock Status', type: 'badge' }
      ];

      return {
        reportType,
        reportTitle: 'Product Catalog Performance Report',
        reportDescription: 'Item-level intelligence detailing views, cart-to-detail ratios, units sold, gross merchandise value, and inventory health.',
        category: 'Catalog',
        timeframe,
        range: { start, end },
        columns,
        summary: {
          totalProducts: formatted.length,
          totalRevenue,
          totalUnitsSold,
          totalViews,
          totalCartAdds,
          topProduct: formatted[0]?.title || 'None'
        },
        rows: formatted,
        chartData: formatted.slice(0, 8).map(r => ({
          name: r.title.length > 18 ? r.title.slice(0, 18) + '...' : r.title,
          fullName: r.title,
          revenue: r.revenue,
          views: r.views,
          unitsSold: r.unitsSold
        })),
        totalRows: formatted.length
      };
    }

    case 'abandoned_carts': {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT 
          c."id",
          c."visitorId",
          COALESCE(c."customerName", 'Anonymous Shopper') as "customerName",
          COALESCE(c."customerEmail", 'Not Provided') as "customerEmail",
          COALESCE(c."customerPhone", 'Not Provided') as "customerPhone",
          c."totalValue"::NUMERIC as "totalValue",
          c."itemCount",
          c."abandonmentStage",
          c."lastActivityAt",
          c."createdAt",
          c."products"
        FROM "analytics_carts" c
        WHERE c."isAbandoned" = true
          AND c."lastActivityAt" >= $1::timestamptz AND c."lastActivityAt" <= $2::timestamptz
        ORDER BY c."lastActivityAt" DESC;
      `, start, end);

      let totalValue = 0;
      const stageCounts = { Cart: 0, Checkout: 0, Payment: 0 };

      const formatted = rows.map(r => {
        const val = Number(r.totalValue || 0);
        totalValue += val;
        const stage = r.abandonmentStage || 'Cart';
        if (stageCounts[stage] !== undefined) {
          stageCounts[stage]++;
        } else {
          stageCounts[stage] = 1;
        }

        const productItems = Array.isArray(r.products)
          ? r.products.map(p => `${p.title || 'Flower Item'} (x${p.quantity || 1})`).join('; ')
          : '';

        return {
          id: r.id,
          customerName: r.customerName,
          customerEmail: r.customerEmail,
          customerPhone: r.customerPhone,
          totalValue: val,
          itemCount: r.itemCount || 1,
          abandonmentStage: stage,
          productsSummary: productItems,
          lastActivityAt: r.lastActivityAt ? new Date(r.lastActivityAt).toISOString().replace('T', ' ').slice(0, 19) : 'N/A',
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString().replace('T', ' ').slice(0, 19) : 'N/A'
        };
      });

      const columns = [
        { key: 'customerName', label: 'Customer Name', type: 'text' },
        { key: 'customerEmail', label: 'Email', type: 'text' },
        { key: 'customerPhone', label: 'Phone', type: 'text' },
        { key: 'totalValue', label: 'Basket Value (₹)', type: 'currency' },
        { key: 'itemCount', label: 'Items', type: 'number' },
        { key: 'abandonmentStage', label: 'Drop-off Stage', type: 'badge' },
        { key: 'productsSummary', label: 'Products In Cart', type: 'text' },
        { key: 'lastActivityAt', label: 'Last Activity', type: 'date' }
      ];

      return {
        reportType,
        reportTitle: 'Abandoned Carts & Recovery Report',
        reportDescription: 'Auditable register of unpurchased baskets, drop-off stages, potential pipeline value, and recoverable customer contacts.',
        category: 'Sales',
        timeframe,
        range: { start, end },
        columns,
        summary: {
          totalAbandonedCarts: formatted.length,
          totalAbandonedValue: totalValue,
          avgCartValue: formatted.length > 0 ? Math.round(totalValue / formatted.length) : 0,
          stageDistribution: stageCounts
        },
        rows: formatted,
        chartData: Object.entries(stageCounts).map(([stage, count]) => ({
          name: stage,
          count,
          percentage: formatted.length > 0 ? Math.round((count / formatted.length) * 100) : 0
        })),
        totalRows: formatted.length
      };
    }

    case 'campaign_attribution': {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT 
          c."id",
          c."name",
          c."platform",
          c."status",
          c."utmCampaign",
          c."utmSource",
          c."utmMedium",
          c."budget"::NUMERIC as "budget",
          c."spend"::NUMERIC as "spend",
          c."impressions",
          c."clicks",
          c."sessions",
          c."purchases",
          c."revenue"::NUMERIC as "revenue"
        FROM "analytics_campaigns" c
        ORDER BY c."revenue" DESC, c."spend" DESC;
      `);

      let totalSpend = 0;
      let totalRevenue = 0;
      let totalClicks = 0;
      let totalPurchases = 0;
      let totalSessions = 0;

      const formatted = rows.map(r => {
        const spend = Number(r.spend || 0);
        const rev = Number(r.revenue || 0);
        const clicks = Number(r.clicks || 0);
        const purchases = Number(r.purchases || 0);
        const impressions = Number(r.impressions || 0);
        const sess = Number(r.sessions || 0);

        totalSpend += spend;
        totalRevenue += rev;
        totalClicks += clicks;
        totalPurchases += purchases;
        totalSessions += sess;

        const roas = spend > 0 ? (rev / spend).toFixed(2) : (rev > 0 ? '∞' : '0.00');
        const cpa = purchases > 0 ? Math.round(spend / purchases) : 0;
        const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00';
        const convRate = sess > 0 ? ((purchases / sess) * 100).toFixed(2) : '0.00';

        return {
          id: r.id,
          name: r.name,
          platform: r.platform,
          status: r.status,
          utmCampaign: r.utmCampaign,
          utmSource: r.utmSource || 'N/A',
          utmMedium: r.utmMedium || 'N/A',
          budget: Number(r.budget || 0),
          spend,
          impressions,
          clicks,
          ctr: `${ctr}%`,
          sessions: sess,
          purchases,
          conversionRate: `${convRate}%`,
          revenue: rev,
          roas: `${roas}x`,
          cpa
        };
      });

      const columns = [
        { key: 'name', label: 'Campaign Name', type: 'text' },
        { key: 'platform', label: 'Platform', type: 'badge' },
        { key: 'utmSource', label: 'UTM Source', type: 'text' },
        { key: 'spend', label: 'Ad Spend (₹)', type: 'currency' },
        { key: 'clicks', label: 'Clicks', type: 'number' },
        { key: 'ctr', label: 'CTR', type: 'badge' },
        { key: 'sessions', label: 'Sessions', type: 'number' },
        { key: 'purchases', label: 'Purchases', type: 'number' },
        { key: 'revenue', label: 'Revenue (₹)', type: 'currency' },
        { key: 'roas', label: 'ROAS', type: 'badge' },
        { key: 'cpa', label: 'CPA (₹)', type: 'currency' }
      ];

      return {
        reportType,
        reportTitle: 'Campaign & Multi-Channel Attribution Report',
        reportDescription: 'Multi-touch UTM campaign evaluation benchmarking spend against attributed orders, blended ROAS, CPA, and traffic volume.',
        category: 'Acquisition',
        timeframe,
        range: { start, end },
        columns,
        summary: {
          totalCampaigns: formatted.length,
          totalSpend,
          totalRevenue,
          blendedRoas: totalSpend > 0 ? `${(totalRevenue / totalSpend).toFixed(2)}x` : 'N/A',
          totalClicks,
          totalPurchases,
          topCampaign: formatted[0]?.name || 'None'
        },
        rows: formatted,
        chartData: formatted.map(r => ({
          name: r.name.length > 18 ? r.name.slice(0, 18) + '...' : r.name,
          fullName: r.name,
          spend: r.spend,
          revenue: r.revenue,
          purchases: r.purchases
        })),
        totalRows: formatted.length
      };
    }

    case 'search_demand': {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT 
          LOWER(TRIM("searchQuery")) as "query",
          COUNT(*)::INT as "searches",
          COUNT(DISTINCT "visitorId")::INT as "uniqueSearchers",
          COUNT(CASE WHEN "eventType" = 'zero_result_search' THEN 1 END)::INT as "zeroResults",
          MAX("timestamp") as "lastSearched"
        FROM "analytics_events"
        WHERE "searchQuery" IS NOT NULL AND TRIM("searchQuery") != ''
          AND "timestamp" >= $1::timestamptz AND "timestamp" <= $2::timestamptz
        GROUP BY LOWER(TRIM("searchQuery"))
        ORDER BY "searches" DESC;
      `, start, end);

      let totalSearches = 0;
      let totalZeroResults = 0;

      const formatted = rows.map(r => {
        const searches = Number(r.searches || 0);
        const zeroResults = Number(r.zeroResults || 0);
        totalSearches += searches;
        totalZeroResults += zeroResults;
        const zeroResultRate = searches > 0 ? ((zeroResults / searches) * 100).toFixed(1) : '0.0';

        return {
          query: r.query,
          searches,
          uniqueSearchers: Number(r.uniqueSearchers || 0),
          zeroResults,
          zeroResultRate: `${zeroResultRate}%`,
          status: zeroResults > 0 ? 'Zero Hits' : 'Served',
          lastSearched: r.lastSearched ? new Date(r.lastSearched).toISOString().replace('T', ' ').slice(0, 19) : 'N/A'
        };
      });

      const columns = [
        { key: 'query', label: 'Search Query Term', type: 'text' },
        { key: 'searches', label: 'Total Searches', type: 'number' },
        { key: 'uniqueSearchers', label: 'Unique Users', type: 'number' },
        { key: 'zeroResults', label: 'Zero Result Hits', type: 'number' },
        { key: 'zeroResultRate', label: 'Miss Rate', type: 'badge' },
        { key: 'status', label: 'Catalog Match', type: 'badge' },
        { key: 'lastSearched', label: 'Last Searched', type: 'date' }
      ];

      return {
        reportType,
        reportTitle: 'Search Intelligence & Zero-Result Report',
        reportDescription: 'On-site consumer search demand, query volumes, zero-result misses, and merchandising stock opportunities.',
        category: 'Demand',
        timeframe,
        range: { start, end },
        columns,
        summary: {
          totalSearches,
          uniqueKeywords: formatted.length,
          totalZeroResults,
          zeroResultRate: totalSearches > 0 ? `${((totalZeroResults / totalSearches) * 100).toFixed(1)}%` : '0.0%',
          topSearchTerm: formatted[0]?.query || 'None'
        },
        rows: formatted,
        chartData: formatted.slice(0, 8).map(r => ({
          name: r.query,
          searches: r.searches,
          zeroResults: r.zeroResults
        })),
        totalRows: formatted.length
      };
    }

    case 'customer_retention': {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT 
          u."id",
          COALESCE(u."name", 'Customer') as "name",
          u."email",
          COUNT(o."id")::INT as "totalOrders",
          COALESCE(SUM(o."totalAmount"), 0)::NUMERIC as "totalSpent",
          COALESCE(AVG(o."totalAmount"), 0)::NUMERIC as "aov",
          MIN(o."createdAt") as "firstOrderAt",
          MAX(o."createdAt") as "lastOrderAt"
        FROM "User" u
        JOIN "Order" o ON o."userId" = u."id"
        WHERE o."orderStatus" NOT IN ('cancelled', 'failed')
          AND o."isTestOrder" = false
        GROUP BY u."id", u."name", u."email"
        ORDER BY "totalSpent" DESC;
      `);

      let totalRevenue = 0;
      let repeatCustomers = 0;
      let totalOrders = 0;

      const formatted = rows.map(r => {
        const orders = Number(r.totalOrders || 0);
        const spent = Number(r.totalSpent || 0);
        totalRevenue += spent;
        totalOrders += orders;
        if (orders > 1) repeatCustomers++;

        const segment = orders >= 3 ? 'VIP Champion' : orders === 2 ? 'Repeat Buyer' : 'First-Time Buyer';

        return {
          id: r.id,
          name: r.name,
          email: r.email,
          totalOrders: orders,
          totalSpent: spent,
          aov: Math.round(Number(r.aov || 0)),
          segment,
          firstOrderAt: r.firstOrderAt ? new Date(r.firstOrderAt).toISOString().slice(0, 10) : 'N/A',
          lastOrderAt: r.lastOrderAt ? new Date(r.lastOrderAt).toISOString().slice(0, 10) : 'N/A'
        };
      });

      const columns = [
        { key: 'name', label: 'Customer Name', type: 'text' },
        { key: 'email', label: 'Email', type: 'text' },
        { key: 'segment', label: 'Customer Tier', type: 'badge' },
        { key: 'totalOrders', label: 'Orders Count', type: 'number' },
        { key: 'totalSpent', label: 'Total Spent (₹)', type: 'currency' },
        { key: 'aov', label: 'AOV (₹)', type: 'currency' },
        { key: 'firstOrderAt', label: 'First Purchase', type: 'date' },
        { key: 'lastOrderAt', label: 'Latest Purchase', type: 'date' }
      ];

      return {
        reportType,
        reportTitle: 'Customer Cohorts & Retention Report',
        reportDescription: 'Customer order frequency, cumulative lifetime value (LTV), repeat purchase velocity, and VIP account identification.',
        category: 'Retention',
        timeframe,
        range: { start, end },
        columns,
        summary: {
          totalCustomers: formatted.length,
          repeatCustomers,
          repeatRate: formatted.length > 0 ? `${((repeatCustomers / formatted.length) * 100).toFixed(1)}%` : '0.0%',
          avgCustomerLTV: formatted.length > 0 ? Math.round(totalRevenue / formatted.length) : 0,
          totalRevenue
        },
        rows: formatted,
        chartData: [
          { name: '1 Order (First-Time)', count: formatted.filter(r => r.totalOrders === 1).length },
          { name: '2 Orders (Repeat)', count: formatted.filter(r => r.totalOrders === 2).length },
          { name: '3+ Orders (VIP)', count: formatted.filter(r => r.totalOrders >= 3).length }
        ],
        totalRows: formatted.length
      };
    }

    case 'occasions_breakdown': {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT 
          COALESCE(NULLIF(TRIM("occasion"), ''), 'General / Unspecified') as "occasion",
          COUNT(CASE WHEN "eventType" = 'product_view' THEN 1 END)::INT as "views",
          COUNT(CASE WHEN "eventType" = 'add_to_cart' THEN 1 END)::INT as "cartAdds",
          COUNT(CASE WHEN "eventType" = 'purchase' THEN 1 END)::INT as "purchases",
          COALESCE(SUM("revenue"), 0)::NUMERIC as "revenue"
        FROM "analytics_events"
        WHERE "timestamp" >= $1::timestamptz AND "timestamp" <= $2::timestamptz
        GROUP BY COALESCE(NULLIF(TRIM("occasion"), ''), 'General / Unspecified')
        ORDER BY "revenue" DESC, "views" DESC;
      `, start, end);

      let totalRevenue = 0;
      let totalViews = 0;
      let totalPurchases = 0;
      let totalCartAdds = 0;

      const formatted = rows.map(r => {
        const rev = Number(r.revenue || 0);
        const views = Number(r.views || 0);
        const purchases = Number(r.purchases || 0);
        const cartAdds = Number(r.cartAdds || 0);

        totalRevenue += rev;
        totalViews += views;
        totalPurchases += purchases;
        totalCartAdds += cartAdds;

        const convRate = views > 0 ? ((purchases / views) * 100).toFixed(1) : '0.0';

        return {
          occasion: r.occasion,
          views,
          cartAdds,
          purchases,
          revenue: rev,
          conversionRate: `${convRate}%`
        };
      });

      const columns = [
        { key: 'occasion', label: 'Occasion / Event', type: 'text' },
        { key: 'views', label: 'Views', type: 'number' },
        { key: 'cartAdds', label: 'Cart Adds', type: 'number' },
        { key: 'purchases', label: 'Orders Placed', type: 'number' },
        { key: 'revenue', label: 'Revenue Generated (₹)', type: 'currency' },
        { key: 'conversionRate', label: 'Conv. Rate', type: 'badge' }
      ];

      return {
        reportType,
        reportTitle: 'Occasions & Seasonal Sales Breakdown',
        reportDescription: 'Occasion-based consumer buying behaviors across Valentine, Birthday, Anniversary, Sympathy, and Seasonal events.',
        category: 'Occasions',
        timeframe,
        range: { start, end },
        columns,
        summary: {
          totalOccasions: formatted.length,
          totalRevenue,
          totalViews,
          totalPurchases,
          topOccasion: formatted[0]?.occasion || 'General'
        },
        rows: formatted,
        chartData: formatted.map(r => ({
          name: r.occasion,
          revenue: r.revenue,
          views: r.views
        })),
        totalRows: formatted.length
      };
    }

    case 'marketing_audit': {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT * FROM "marketing_activity_logs" 
        WHERE "timestamp" >= $1::timestamptz AND "timestamp" <= $2::timestamptz
        ORDER BY "timestamp" DESC LIMIT 100;
      `, start, end);

      const formatted = rows.map(r => ({
        id: r.id,
        timestamp: r.timestamp ? new Date(r.timestamp).toISOString().replace('T', ' ').slice(0, 19) : 'N/A',
        userName: r.userName || 'Marketing Staff',
        userRole: r.userRole,
        action: r.action,
        entityType: r.entityType || 'General',
        entityId: r.entityId || 'N/A',
        ipAddress: r.ipAddress || 'Internal'
      }));

      const columns = [
        { key: 'timestamp', label: 'Timestamp (UTC)', type: 'date' },
        { key: 'userName', label: 'Staff Member', type: 'text' },
        { key: 'userRole', label: 'Assigned Role', type: 'badge' },
        { key: 'action', label: 'System Action', type: 'text' },
        { key: 'entityType', label: 'Entity Target', type: 'badge' },
        { key: 'entityId', label: 'Entity Identifier', type: 'text' },
        { key: 'ipAddress', label: 'IP Address', type: 'text' }
      ];

      return {
        reportType,
        reportTitle: 'Marketing Activity & Audit Log',
        reportDescription: 'Complete immutable security audit trail of staff actions, report exports, campaign updates, and segment synchronizations.',
        category: 'Security',
        timeframe,
        range: { start, end },
        columns,
        summary: {
          totalLogs: formatted.length,
          uniqueUsers: new Set(rows.map(r => r.userId)).size
        },
        rows: formatted,
        chartData: [],
        totalRows: formatted.length
      };
    }

    default:
      throw new Error(`Unsupported report type: ${reportType}`);
  }
}

// Generate CSV string for export
async function generateReportCsv(params) {
  const data = await getReportData(params);
  return {
    filename: `sbf_${params.reportType}_${params.timeframe || 'period'}_${Date.now()}.csv`,
    csv: toCsv(data.columns, data.rows),
    meta: data
  };
}

module.exports = {
  getDateRange,
  getReportData,
  generateReportCsv
};
