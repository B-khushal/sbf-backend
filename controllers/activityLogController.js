const mongoose = require('mongoose');
const ActivityLog = require('../models/ActivityLog');
const { logActivity } = require('../utils/activityLogger');

const allowedSortFields = new Set(['timestamp', 'user', 'actionType']);

// @desc    Track activity event
// @route   POST /api/activity/log
// @access  Public (optional auth)
const createActivityLog = async (req, res) => {
  try {
    const {
      actionType,
      url,
      method,
      status,
      sessionId,
      metadata,
      userName,
      email,
    } = req.body || {};

    if (!actionType) {
      return res.status(400).json({ message: 'actionType is required' });
    }

    const created = await logActivity({
      req,
      actionType,
      url,
      method,
      status,
      sessionId,
      metadata,
      userName,
      email,
    });

    return res.status(201).json({
      success: true,
      logId: created?._id || null,
    });
  } catch (error) {
    console.error('createActivityLog error:', error);
    return res.status(500).json({ message: 'Failed to create activity log' });
  }
};

// @desc    Get admin activity logs
// @route   GET /api/admin/logs
// @access  Private/Admin
const getAdminLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      search = '',
      actionType,
      url,
      status,
      method,
      dateFrom,
      dateTo,
      sortBy = 'timestamp',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const baseMatch = {};

    if (actionType && actionType !== 'all') {
      baseMatch.actionType = actionType;
    }

    if (status && status !== 'all') {
      baseMatch.status = status;
    }

    if (method && method !== 'all') {
      baseMatch.method = method.toUpperCase();
    }

    if (url && url !== 'all') {
      baseMatch.url = { $regex: String(url), $options: 'i' };
    }

    if (dateFrom || dateTo) {
      baseMatch.timestamp = {};
      if (dateFrom) {
        baseMatch.timestamp.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        baseMatch.timestamp.$lte = endDate;
      }
    }

    const normalizedSortBy = allowedSortFields.has(sortBy) ? sortBy : 'timestamp';
    const sortDirection = String(sortOrder).toLowerCase() === 'asc' ? 1 : -1;

    const sortStage =
      normalizedSortBy === 'user'
        ? { 'user.name': sortDirection, timestamp: -1 }
        : { [normalizedSortBy]: sortDirection };

    const searchRegex = search ? new RegExp(String(search), 'i') : null;

    const pipeline = [
      { $match: baseMatch },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    if (searchRegex) {
      pipeline.push({
        $match: {
          $or: [
            { 'user.name': { $regex: searchRegex } },
            { userName: { $regex: searchRegex } },
            { 'user.email': { $regex: searchRegex } },
            { email: { $regex: searchRegex } },
            { sessionId: { $regex: searchRegex } },
          ],
        },
      });
    }

    pipeline.push(
      {
        $addFields: {
          resolvedUserName: { $ifNull: ['$user.name', '$userName'] },
          resolvedEmail: { $ifNull: ['$user.email', '$email'] },
        },
      },
      { $sort: sortStage },
      {
        $facet: {
          logs: [
            { $skip: skip },
            { $limit: limitNum },
            {
              $project: {
                _id: 0,
                id: '$_id',
                logId: { $toString: '$_id' },
                userId: {
                  $ifNull: ['$user._id', '$userId'],
                },
                userName: '$resolvedUserName',
                email: '$resolvedEmail',
                actionType: 1,
                url: 1,
                method: 1,
                timestamp: 1,
                ipAddress: 1,
                device: 1,
                status: 1,
                sessionId: 1,
                metadata: 1,
              },
            },
          ],
          totalCount: [{ $count: 'count' }],
          actionTypes: [{ $group: { _id: '$actionType' } }, { $sort: { _id: 1 } }],
        },
      }
    );

    const result = await ActivityLog.aggregate(pipeline);
    const payload = result[0] || { logs: [], totalCount: [], actionTypes: [] };
    const total = payload.totalCount[0]?.count || 0;

    return res.json({
      success: true,
      logs: payload.logs,
      filters: {
        actionTypes: payload.actionTypes.map((a) => a._id).filter(Boolean),
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('getAdminLogs error:', error);
    return res.status(500).json({ message: 'Failed to fetch activity logs' });
  }
};

module.exports = {
  createActivityLog,
  getAdminLogs,
};
