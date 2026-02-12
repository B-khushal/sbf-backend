const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Helper function to calculate percentage change
const calculatePercentageChange = (current, previous) => {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
};

// @desc    Get dashboard statistics
// @route   GET /api/dashboard
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
  try {
    // Current date calculations
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    // Previous month calculations
    const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    // Get counts and totals in parallel with improved performance
    const [
      totalOrders,
      currentMonthOrders,
      previousMonthOrders,
      totalProducts,
      lowStockProducts,
      totalUsers,
      activeUsers,
      totalRevenue,
      currentMonthRevenue,
      previousMonthRevenue,
      pendingOrders
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({
        createdAt: {
          $gte: new Date(currentYear, currentMonth, 1),
          $lt: new Date(currentYear, currentMonth + 1, 1)
        }
      }),
      Order.countDocuments({
        createdAt: {
          $gte: new Date(previousYear, previousMonth, 1),
          $lt: new Date(previousYear, previousMonth + 1, 1)
        }
      }),
      Product.countDocuments(),
      Product.countDocuments({ countInStock: { $lt: 10 } }),
      User.countDocuments(),
      User.countDocuments({ lastActive: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
      Order.aggregate([{ 
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
      }]),
      Order.aggregate([
        { 
          $match: {
            createdAt: {
              $gte: new Date(currentYear, currentMonth, 1),
              $lt: new Date(currentYear, currentMonth + 1, 1)
            }
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
      ]),
      Order.aggregate([
        { 
          $match: {
            createdAt: {
              $gte: new Date(previousYear, previousMonth, 1),
              $lt: new Date(previousYear, previousMonth + 1, 1)
            }
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
      ]),
      Order.countDocuments({ status: 'pending' })
    ]);

    // Extract revenue values
    const revenue = totalRevenue[0]?.total || 0;
    const currentRevenue = currentMonthRevenue[0]?.total || 0;
    const previousRevenue = previousMonthRevenue[0]?.total || 0;

    // Debug logging for currency conversion
    console.log('=== DASHBOARD REVENUE CONVERSION DEBUG ===');
    console.log('Total Revenue (INR after conversion):', revenue);
    console.log('Current Month Revenue (INR):', currentRevenue);
    console.log('Previous Month Revenue (INR):', previousRevenue);
    
    // Log some sample orders for debugging
    const sampleOrders = await Order.find({ currency: 'USD' }).limit(3).lean();
    if (sampleOrders.length > 0) {
      console.log('Sample USD Orders:');
      sampleOrders.forEach(order => {
        const rate = order.currencyRate || 0.01162;
        const convertedAmount = order.totalAmount / rate;
        console.log(`  Order ${order.orderNumber}: $${order.totalAmount} USD → ₹${Math.round(convertedAmount * 100) / 100} INR (rate: ${rate})`);
      });
    }
    console.log('=============================================');

    res.json({
      revenue: {
        total: revenue,
        percentChange: calculatePercentageChange(currentRevenue, previousRevenue)
      },
      sales: {
        total: totalOrders,
        percentChange: calculatePercentageChange(currentMonthOrders, previousMonthOrders),
        pending: pendingOrders
      },
      activeUsers: {
        total: activeUsers,
        percentChange: calculatePercentageChange(activeUsers, totalUsers - activeUsers)
      },
      inventory: {
        total: totalProducts,
        lowStock: lowStockProducts
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get recent orders with improved real-time data
// @route   GET /api/dashboard/recent-orders
// @access  Private/Admin
const getRecentOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'name email')
      .lean();
    
    const formattedOrders = orders.map(order => {
      // Convert USD amounts to INR for display
      let displayAmount = order.totalAmount;
      if (order.currency === 'USD') {
        // Convert USD to INR: divide by currency rate (USD rate) to get INR
        const rate = order.currencyRate || 0.01162; // fallback rate
        displayAmount = order.totalAmount / rate;
      }
      
      return {
        id: order._id,
        orderNumber: order.orderNumber || `ORD-${order._id.toString().substring(0, 6)}`,
        customer: order.user?.name || 'Guest',
        amount: Math.round(displayAmount * 100) / 100, // Round to 2 decimal places
        status: order.status,
        date: order.createdAt.toISOString().split('T')[0],
        items: order.items.length,
        paymentMethod: order.paymentDetails?.method || 'N/A',
        originalCurrency: order.currency || 'INR', // Add original currency info
        originalAmount: order.totalAmount // Add original amount for reference
      };
    });
    
    res.json(formattedOrders);
  } catch (error) {
    console.error('Recent orders error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get top selling products with improved real-time data
// @route   GET /api/dashboard/top-products
// @access  Private/Admin
const getTopProducts = async (req, res) => {
  try {
    const products = await Product.aggregate([
      { $sort: { sold: -1 } },
      { $limit: 5 },
      { $project: { 
        _id: 1, 
        name: 1, 
        price: 1, 
        sold: 1, 
        countInStock: 1,
        image: 1,
        category: 1
      }}
    ]);
    
    const formattedProducts = products.map(p => ({
      id: p._id,
      name: p.name,
      sold: p.sold,
      price: p.price,
      inStock: p.countInStock,
      image: p.image,
      category: p.category
    }));
    
    res.json(formattedProducts);
  } catch (error) {
    console.error('Top products error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get sales data for chart with improved real-time data
// @route   GET /api/dashboard/sales-data
// @access  Private/Admin
const getSalesData = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(currentYear, 0, 1),
            $lt: new Date(currentYear + 1, 0, 1)
          }
        }
      },
      {
        $group: {
          _id: { 
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" }
          },
          total: { 
            $sum: {
              $cond: {
                if: { $eq: ["$currency", "USD"] },
                then: { $divide: ["$totalAmount", { $ifNull: ["$currencyRate", 0.01162] }] },
                else: "$totalAmount"
              }
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.month": 1, "_id.day": 1 } }
    ]);

    // Fill in missing months with 0 and calculate daily averages
    const fullYearData = Array(12).fill(0).map((_, index) => {
      const monthData = salesData.filter(item => item._id.month === index + 1);
      const monthTotal = monthData.reduce((sum, item) => sum + item.total, 0);
      const monthCount = monthData.reduce((sum, item) => sum + item.count, 0);
      
      return {
        name: new Date(currentYear, index).toLocaleString('default', { month: 'short' }),
        total: monthTotal,
        orders: monthCount,
        average: monthCount > 0 ? monthTotal / monthCount : 0
      };
    });

    res.json(fullYearData);
  } catch (error) {
    console.error('Sales data error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get real-time notifications
// @route   GET /api/dashboard/notifications
// @access  Private/Admin
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    res.json(notifications.map(notification => ({
      id: notification._id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      isRead: notification.isRead,
      createdAt: notification.createdAt
    })));
  } catch (error) {
    console.error('Notifications error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get real-time user activity
// @route   GET /api/dashboard/user-activity
// @access  Private/Admin
const getUserActivity = async (req, res) => {
  try {
    const recentUsers = await User.find()
      .sort({ lastActive: -1 })
      .limit(10)
      .select('name email lastActive role')
      .lean();
    
    const activeUsers = await User.countDocuments({
      lastActive: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
    });
    
    res.json({
      recentUsers: recentUsers.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        lastActive: user.lastActive
      })),
      activeUsers
    });
  } catch (error) {
    console.error('User activity error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getDashboardStats,
  getRecentOrders,
  getTopProducts,
  getSalesData,
  getNotifications,
  getUserActivity
};