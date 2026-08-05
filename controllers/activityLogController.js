const prisma = require('../config/prisma');

const getAdminLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      search = '',
      actionType,
      userType = 'all'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(1000, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const [allLogs, allUsers] = await Promise.all([
      prisma.activityLog.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.user.findMany()
    ]);

    const userMap = {};
    allUsers.forEach(u => {
      userMap[u.id] = u;
    });

    let filtered = allLogs;

    // Filter by userType (customer vs admin vs all)
    if (userType === 'customer') {
      filtered = filtered.filter(l => {
        const u = l.userId ? userMap[l.userId] : null;
        const role = u ? u.role : 'customer';
        return role === 'customer' || role === 'user';
      });
    } else if (userType === 'admin') {
      filtered = filtered.filter(l => {
        const u = l.userId ? userMap[l.userId] : null;
        const role = u ? u.role : 'customer';
        return role === 'admin' || role === 'vendor' || role === 'staff';
      });
    }

    if (actionType && actionType !== 'all') {
      filtered = filtered.filter(l => (l.action || '').toLowerCase() === actionType.toLowerCase());
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(l => {
        const u = l.userId ? userMap[l.userId] : null;
        return (
          (l.action && l.action.toLowerCase().includes(q)) ||
          (u && u.name && u.name.toLowerCase().includes(q)) ||
          (u && u.email && u.email.toLowerCase().includes(q)) ||
          (l.ipAddress && l.ipAddress.includes(q))
        );
      });
    }

    const total = filtered.length;
    const paginated = filtered.slice(skip, skip + limitNum);

    const formattedLogs = paginated.map(l => {
      const u = l.userId ? userMap[l.userId] : null;
      return {
        id: l.id,
        logId: l.id,
        userId: l.userId || (u ? u.id : null),
        userName: u ? u.name : 'System User',
        email: u ? u.email : 'N/A',
        role: u ? u.role : 'customer',
        actionType: l.action || 'system_event',
        url: (l.details && typeof l.details === 'object' ? l.details.url : '') || '/admin',
        method: (l.details && typeof l.details === 'object' ? l.details.method : '') || 'POST',
        timestamp: l.createdAt ? l.createdAt.toISOString() : new Date().toISOString(),
        ipAddress: l.ipAddress || '127.0.0.1',
        device: l.userAgent || 'Desktop',
        status: 'Success'
      };
    });

    const actionTypesSet = new Set(allLogs.map(l => l.action).filter(Boolean));

    res.json({
      success: true,
      logs: formattedLogs,
      filters: {
        actionTypes: Array.from(actionTypesSet)
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (error) {
    console.error('getAdminLogs error:', error);
    res.status(500).json({ message: 'Failed to fetch activity logs', error: error.message });
  }
};

const createActivityLog = async (req, res) => {
  try {
    const { actionType, url, method, status } = req.body || {};
    const created = await prisma.activityLog.create({
      data: {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        userId: req.user ? req.user.id : null,
        action: actionType || 'system_event',
        details: { url, method, status },
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null
      }
    });
    res.status(201).json({ success: true, logId: created.id });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create activity log' });
  }
};

module.exports = {
  getAdminLogs,
  createActivityLog
};
