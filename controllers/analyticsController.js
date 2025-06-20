const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

// Helper function to calculate percentage change
const calculatePercentageChange = (current, previous) => {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
};

// Helper function to get date range
const getDateRange = (period) => {
  const currentDate = new Date();
  let startDate;
  
  switch (period) {
    case '7d':
      startDate = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(currentDate.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      startDate = new Date(currentDate.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  
  return { startDate, endDate: currentDate };
};

// @desc    Get revenue analytics
// @route   GET /api/analytics/revenue
// @access  Private/Admin
const getRevenueAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const { startDate, endDate } = getDateRange(period);
    
    // Get total revenue with currency conversion
    const totalRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $in: ['completed', 'processing'] }
        }
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $cond: {
                if: { $eq: ["$currency", "USD"] },
                then: { $divide: ["$totalAmount", { $ifNull: ["$currencyRate", 0.01162] }] },
                else: "$totalAmount"
              }
            }
          }
        }
      }
    ]);

    // Get previous period revenue
    const previousPeriodStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
    const previousRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: previousPeriodStart, $lt: startDate },
          status: { $in: ['completed', 'processing'] }
        }
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $cond: {
                if: { $eq: ["$currency", "USD"] },
                then: { $divide: ["$totalAmount", { $ifNull: ["$currencyRate", 0.01162] }] },
                else: "$totalAmount"
              }
            }
          }
        }
      }
    ]);

    // Daily revenue data for the last 30 days
    const dailyRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), $lte: endDate },
          status: { $in: ['completed', 'processing'] }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" }
          },
          amount: {
            $sum: {
              $cond: {
                if: { $eq: ["$currency", "USD"] },
                then: { $divide: ["$totalAmount", { $ifNull: ["$currencyRate", 0.01162] }] },
                else: "$totalAmount"
              }
            }
          },
          orders: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      { $limit: 30 }
    ]);

    // Monthly revenue for the last 12 months
    const monthlyRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(endDate.getFullYear() - 1, endDate.getMonth(), 1), $lte: endDate },
          status: { $in: ['completed', 'processing'] }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          amount: {
            $sum: {
              $cond: {
                if: { $eq: ["$currency", "USD"] },
                then: { $divide: ["$totalAmount", { $ifNull: ["$currencyRate", 0.01162] }] },
                else: "$totalAmount"
              }
            }
          },
          orders: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      { $limit: 12 }
    ]);

    // Revenue breakdown by categories
    const revenueBreakdown = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $in: ['completed', 'processing'] }
        }
      },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "productInfo"
        }
      },
      { $unwind: "$productInfo" },
      {
        $group: {
          _id: "$productInfo.category",
          amount: {
            $sum: {
              $multiply: [
                "$items.finalPrice",
                "$items.quantity",
                {
                  $cond: {
                    if: { $eq: ["$currency", "USD"] },
                    then: { $divide: [1, { $ifNull: ["$currencyRate", 0.01162] }] },
                    else: 1
                  }
                }
              ]
            }
          }
        }
      },
      { $sort: { amount: -1 } }
    ]);

    const totalRevenueAmount = totalRevenue[0]?.total || 0;
    const previousRevenueAmount = previousRevenue[0]?.total || 0;
    const totalBreakdownAmount = revenueBreakdown.reduce((sum, item) => sum + item.amount, 0);

    const response = {
      total: Math.round(totalRevenueAmount * 100) / 100,
      growth: calculatePercentageChange(totalRevenueAmount, previousRevenueAmount),
      daily: dailyRevenue.map(item => ({
        date: `${item._id.month}/${item._id.day}`,
        amount: Math.round(item.amount * 100) / 100,
        orders: item.orders
      })),
      monthly: monthlyRevenue.map(item => ({
        month: new Date(item._id.year, item._id.month - 1).toLocaleDateString('default', { month: 'short' }),
        amount: Math.round(item.amount * 100) / 100,
        orders: item.orders
      })),
      breakdown: revenueBreakdown.map(item => ({
        category: item._id || 'Uncategorized',
        amount: Math.round(item.amount * 100) / 100,
        percentage: totalBreakdownAmount > 0 ? Math.round((item.amount / totalBreakdownAmount) * 100 * 100) / 100 : 0
      }))
    };

    res.json(response);
  } catch (error) {
    console.error('Revenue analytics error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get sales analytics
// @route   GET /api/analytics/sales
// @access  Private/Admin
const getSalesAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    const totalOrders = await Order.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const previousPeriodStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
    const previousOrders = await Order.countDocuments({
      createdAt: { $gte: previousPeriodStart, $lt: startDate }
    });

    const ordersByStatus = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    const ordersByHour = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $hour: "$createdAt" },
          orders: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: {
                if: { $eq: ["$currency", "USD"] },
                then: { $divide: ["$totalAmount", { $ifNull: ["$currencyRate", 0.01162] }] },
                else: "$totalAmount"
              }
            }
          }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    const totalRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $in: ['completed', 'processing'] }
        }
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $cond: {
                if: { $eq: ["$currency", "USD"] },
                then: { $divide: ["$totalAmount", { $ifNull: ["$currencyRate", 0.01162] }] },
                else: "$totalAmount"
              }
            }
          }
        }
      }
    ]);

    const revenueAmount = totalRevenue[0]?.total || 0;
    const averageOrderValue = totalOrders > 0 ? revenueAmount / totalOrders : 0;
    const conversionRate = 2.5; // Mock data
    const totalStatusOrders = ordersByStatus.reduce((sum, item) => sum + item.count, 0);

    const response = {
      total: totalOrders,
      growth: calculatePercentageChange(totalOrders, previousOrders),
      conversion: conversionRate,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      ordersByStatus: ordersByStatus.map(item => ({
        status: item._id,
        count: item.count,
        percentage: totalStatusOrders > 0 ? Math.round((item.count / totalStatusOrders) * 100 * 100) / 100 : 0
      })),
      ordersByHour: Array.from({ length: 24 }, (_, hour) => {
        const hourData = ordersByHour.find(item => item._id === hour);
        return {
          hour: `${hour.toString().padStart(2, '0')}:00`,
          orders: hourData?.orders || 0,
          revenue: Math.round((hourData?.revenue || 0) * 100) / 100
        };
      })
    };

    res.json(response);
  } catch (error) {
    console.error('Sales analytics error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get product analytics
// @route   GET /api/analytics/products
// @access  Private/Admin
const getProductAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    const totalProducts = await Product.countDocuments();

    const topSelling = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $in: ['completed', 'processing'] }
        }
      },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "productInfo"
        }
      },
      { $unwind: "$productInfo" },
      {
        $group: {
          _id: "$items.product",
          name: { $first: "$productInfo.name" },
          category: { $first: "$productInfo.category" },
          sold: { $sum: "$items.quantity" },
          revenue: {
            $sum: {
              $multiply: [
                "$items.finalPrice",
                "$items.quantity",
                {
                  $cond: {
                    if: { $eq: ["$currency", "USD"] },
                    then: { $divide: [1, { $ifNull: ["$currencyRate", 0.01162] }] },
                    else: 1
                  }
                }
              ]
            }
          }
        }
      },
      { $sort: { sold: -1 } },
      { $limit: 10 }
    ]);

    const categories = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $in: ['completed', 'processing'] }
        }
      },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "productInfo"
        }
      },
      { $unwind: "$productInfo" },
      {
        $group: {
          _id: "$productInfo.category",
          products: { $addToSet: "$items.product" },
          revenue: {
            $sum: {
              $multiply: [
                "$items.finalPrice",
                "$items.quantity",
                {
                  $cond: {
                    if: { $eq: ["$currency", "USD"] },
                    then: { $divide: [1, { $ifNull: ["$currencyRate", 0.01162] }] },
                    else: 1
                  }
                }
              ]
            }
          }
        }
      },
      {
        $project: {
          name: "$_id",
          products: { $size: "$products" },
          revenue: 1
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    const lowStock = await Product.find({
      countInStock: { $lt: 10 }
    }).select('name category countInStock').limit(10);

    const productPerformance = topSelling.slice(0, 5).map(product => ({
      name: product.name,
      views: Math.floor(Math.random() * 1000) + 100,
      orders: product.sold,
      conversion: Math.min(((product.sold / (Math.floor(Math.random() * 500) + 200)) * 100), 100)
    }));

    const totalCategoryRevenue = categories.reduce((sum, cat) => sum + cat.revenue, 0);
    const totalSold = topSelling.reduce((sum, product) => sum + product.sold, 0);

    const response = {
      total: totalProducts,
      sold: totalSold,
      topSelling: topSelling.map(product => ({
        name: product.name,
        sold: product.sold,
        revenue: Math.round(product.revenue * 100) / 100,
        category: product.category || 'Uncategorized'
      })),
      categories: categories.map(cat => ({
        name: cat.name || 'Uncategorized',
        products: cat.products,
        revenue: Math.round(cat.revenue * 100) / 100,
        percentage: totalCategoryRevenue > 0 ? Math.round((cat.revenue / totalCategoryRevenue) * 100 * 100) / 100 : 0
      })),
      lowStock: lowStock.map(product => ({
        name: product.name,
        stock: product.countInStock,
        category: product.category || 'Uncategorized'
      })),
      performance: productPerformance.map(product => ({
        name: product.name,
        views: product.views,
        orders: product.orders,
        conversion: Math.round(product.conversion * 100) / 100
      }))
    };

    res.json(response);
  } catch (error) {
    console.error('Product analytics error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get user analytics
// @route   GET /api/analytics/users
// @access  Private/Admin
const getUserAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({
      lastLogin: { $gte: startDate }
    });
    const newUsers = await User.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const userActivity = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" }
          },
          users: { $sum: 1 },
          sessions: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
    ]);

    const demographics = [
      { location: 'India', users: Math.floor(totalUsers * 0.6), percentage: 60 },
      { location: 'USA', users: Math.floor(totalUsers * 0.2), percentage: 20 },
      { location: 'UK', users: Math.floor(totalUsers * 0.1), percentage: 10 },
      { location: 'Others', users: Math.floor(totalUsers * 0.1), percentage: 10 }
    ];

    const retention = 75.5;

    const response = {
      total: totalUsers,
      active: activeUsers,
      newUsers: newUsers,
      retention: retention,
      demographics: demographics,
      activity: userActivity.map(item => ({
        date: `${item._id.month}/${item._id.day}`,
        users: item.users,
        sessions: item.sessions
      }))
    };

    res.json(response);
  } catch (error) {
    console.error('User analytics error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get performance analytics
// @route   GET /api/analytics/performance
// @access  Private/Admin
const getPerformanceAnalytics = async (req, res) => {
  try {
    const performanceData = {
      pageViews: Math.floor(Math.random() * 10000) + 5000,
      bounceRate: Math.round((Math.random() * 20 + 30) * 100) / 100,
      averageSessionTime: Math.floor(Math.random() * 300) + 120,
      conversionRate: Math.round((Math.random() * 2 + 1.5) * 100) / 100,
      topPages: [
        { page: '/shop', views: 2500, time: 180 },
        { page: '/', views: 2000, time: 120 },
        { page: '/product/*', views: 1800, time: 240 },
        { page: '/cart', views: 800, time: 90 },
        { page: '/checkout', views: 400, time: 300 }
      ],
      devices: [
        { device: 'Mobile', users: 6000, percentage: 60 },
        { device: 'Desktop', users: 3000, percentage: 30 },
        { device: 'Tablet', users: 1000, percentage: 10 }
      ]
    };

    res.json(performanceData);
  } catch (error) {
    console.error('Performance analytics error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getRevenueAnalytics,
  getSalesAnalytics,
  getProductAnalytics,
  getUserAnalytics,
  getPerformanceAnalytics
};
