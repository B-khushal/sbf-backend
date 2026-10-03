const prisma = require('../config/prisma');

async function inspectRecentActivity() {
  try {
    const recentLogs = await prisma.activityLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
    console.log('Most recent ActivityLogs:', JSON.stringify(recentLogs, null, 2));

    const recentSessions = await prisma.$queryRawUnsafe(`
      SELECT s."id", s."visitorId", s."userId", s."currentPath", s."device", s."lastActiveAt", s."activityStage"
      FROM "analytics_sessions" s
      ORDER BY s."lastActiveAt" DESC
      LIMIT 10;
    `);
    console.log('Most recent analytics_sessions:', JSON.stringify(recentSessions, null, 2));

  } finally {
    await prisma.$disconnect();
  }
}

inspectRecentActivity();
