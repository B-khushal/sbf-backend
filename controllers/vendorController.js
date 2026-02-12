const Vendor = require('../models/Vendor');
const VendorPayout = require('../models/VendorPayout');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const mongoose = require('mongoose');

// @desc    Register as vendor
// @route   POST /api/vendors/register
// @access  Private
const registerVendor = async (req, res) => {
    try {
        const {
            storeName,
            storeDescription,
            storeAddress,
            contactInfo,
            businessInfo,
            bankDetails
        } = req.body;

        // Check if user is already a vendor
        const existingVendor = await Vendor.findOne({ user: req.user._id });
        if (existingVendor) {
            return res.status(400).json({ message: 'User is already registered as a vendor' });
        }

        // Check if store name is already taken
        const existingStoreName = await Vendor.findOne({ storeName });
        if (existingStoreName) {
            return res.status(400).json({ message: 'Store name already exists' });
        }

        // Create vendor profile
        const vendor = new Vendor({
            user: req.user._id,
            storeName,
            storeDescription,
            storeAddress,
            contactInfo,
            businessInfo,
            bankDetails
        });

        await vendor.save();

        // Update user role to vendor
        await User.findByIdAndUpdate(req.user._id, { role: 'vendor' });

        res.status(201).json({
            success: true,
            message: 'Vendor registration successful. Awaiting admin approval.',
            vendor
        });
    } catch (error) {
        console.error('Error registering vendor:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get vendor profile
// @route   GET /api/vendors/profile
// @access  Private (Vendor)
const getVendorProfile = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({ user: req.user._id }).populate('user', 'name email');
        
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor profile not found' });
        }

        res.json({ vendor });
    } catch (error) {
        console.error('Error fetching vendor profile:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Update vendor profile
// @route   PUT /api/vendors/profile
// @access  Private (Vendor)
const updateVendorProfile = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({ user: req.user._id });
        
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor profile not found' });
        }

        // Update vendor data
        const allowedUpdates = [
            'storeDescription', 'storeLogo', 'storeBanner', 'storeAddress',
            'contactInfo', 'businessInfo', 'bankDetails', 'storeSettings',
            'salesSettings', 'socialMedia'
        ];

        allowedUpdates.forEach(field => {
            if (req.body[field]) {
                vendor[field] = { ...vendor[field], ...req.body[field] };
            }
        });

        await vendor.save();

        res.json({
            success: true,
            message: 'Vendor profile updated successfully',
            vendor
        });
    } catch (error) {
        console.error('Error updating vendor profile:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get vendor dashboard data
// @route   GET /api/vendors/dashboard
// @access  Private (Vendor)
const getVendorDashboard = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({ user: req.user._id });
        
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor profile not found' });
        }

        // Get current month data
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

        // Aggregate dashboard data
        const [
            totalProducts,
            activeProducts,
            totalOrders,
            monthlyOrders,
            totalRevenue,
            monthlyRevenue,
            pendingOrders,
            lowStockProducts,
            recentOrders
        ] = await Promise.all([
            Product.countDocuments({ vendor: vendor._id }),
            Product.countDocuments({ vendor: vendor._id, hidden: false }),
            Order.countDocuments({ 'orderItems.product': { $in: await Product.find({ vendor: vendor._id }).distinct('_id') } }),
            Order.countDocuments({
                'orderItems.product': { $in: await Product.find({ vendor: vendor._id }).distinct('_id') },
                createdAt: { $gte: startOfMonth, $lte: endOfMonth }
            }),
            Order.aggregate([
                {
                    $match: {
                        'orderItems.vendor': vendor._id,
                        status: { $in: ['delivered', 'completed'] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$totalPrice' }
                    }
                }
            ]).then(result => result[0]?.total || 0),
            Order.aggregate([
                {
                    $match: {
                        'orderItems.vendor': vendor._id,
                        status: { $in: ['delivered', 'completed'] },
                        createdAt: { $gte: startOfMonth, $lte: endOfMonth }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$totalPrice' }
                    }
                }
            ]).then(result => result[0]?.total || 0),
            Order.countDocuments({
                'orderItems.product': { $in: await Product.find({ vendor: vendor._id }).distinct('_id') },
                status: 'pending'
            }),
            Product.find({ vendor: vendor._id, quantity: { $lte: 10 } }).limit(5),
            Order.find({
                'orderItems.product': { $in: await Product.find({ vendor: vendor._id }).distinct('_id') }
            })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('user', 'name email')
            .populate('orderItems.product', 'name price')
        ]);

        // Calculate vendor earnings (assuming 10% commission)
        const commissionRate = vendor.commission?.rate || 0.1;
        const vendorEarnings = totalRevenue * (1 - commissionRate);
        const monthlyEarnings = monthlyRevenue * (1 - commissionRate);

        // Get sales trend data
        const salesTrend = await getSalesTrend(vendor._id);
        const topProducts = await getTopProducts(vendor._id);

        res.json({
            vendor: {
                storeName: vendor.storeName,
                status: vendor.status,
                isVerified: vendor.verification.isVerified,
                subscription: {
                    plan: vendor.subscription.plan,
                    isActive: vendor.subscription.isActive
                }
            },
            stats: {
                totalProducts,
                activeProducts,
                totalOrders,
                monthlyOrders,
                totalRevenue,
                monthlyRevenue,
                vendorEarnings,
                monthlyEarnings,
                pendingOrders,
                lowStockCount: lowStockProducts.length
            },
            recentOrders,
            lowStockProducts,
            charts: {
                salesTrend,
                topProducts
            }
        });
    } catch (error) {
        console.error('Error fetching vendor dashboard:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get vendor products
// @route   GET /api/vendors/products
// @access  Private (Vendor)
const getVendorProducts = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({ user: req.user._id });
        
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor profile not found' });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const category = req.query.category || '';
        const status = req.query.status || '';

        // Build query
        let query = { vendor: vendor._id };
        
        if (search) {
            query.title = { $regex: search, $options: 'i' };
        }
        
        if (category) {
            query.category = category;
        }

        if (status === 'active') {
            query.hidden = false;
        } else if (status === 'inactive') {
            query.hidden = true;
        } else if (status === 'low-stock') {
            query.countInStock = { $lte: vendor.salesSettings.lowStockThreshold };
        }

        const products = await Product.find(query)
            .select('title images price countInStock category hidden isFeatured isNew approvalStatus rejectionReason createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Product.countDocuments(query);

        res.json({
            products,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalProducts: total,
                hasNextPage: page < Math.ceil(total / limit),
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        console.error('Error fetching vendor products:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get vendor orders
// @route   GET /api/vendors/orders
// @access  Private (Vendor)
const getVendorOrders = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({ user: req.user._id });
        
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor profile not found' });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const status = req.query.status || '';
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;

        // Get vendor product IDs
        const vendorProductIds = await Product.find({ vendor: vendor._id }).distinct('_id');

        // Build query - NOTE: Order model uses 'items' not 'orderItems'
        let query = { 'items.product': { $in: vendorProductIds } };
        
        if (status) {
            query.status = status;
        }

        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const orders = await Order.find(query)
            .populate('user', 'name email phone')
            .populate('items.product', 'title images price vendor')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Filter order items to only include vendor's products
        const filteredOrders = orders.map(order => {
            const vendorItems = order.items.filter(item => 
                item.product && item.product.vendor && 
                item.product.vendor.toString() === vendor._id.toString()
            );
            
            return {
                ...order.toObject(),
                items: vendorItems,
                vendorTotal: vendorItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
            };
        }).filter(order => order.items.length > 0);

        const total = await Order.countDocuments(query);

        res.json({
            orders: filteredOrders,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalOrders: total,
                hasNextPage: page < Math.ceil(total / limit),
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        console.error('Error fetching vendor orders:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get vendor analytics
// @route   GET /api/vendors/analytics
// @access  Private (Vendor)
const getVendorAnalytics = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({ user: req.user._id });
        
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor profile not found' });
        }

        const { period = '30d' } = req.query;
        
        // Calculate date range
        let startDate, endDate = new Date();
        
        switch (period) {
            case '7d':
                startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
                break;
            case '1y':
                startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        }

        const analytics = {
            salesTrend: await getSalesTrend(vendor._id, startDate, endDate),
            topProducts: await getTopProducts(vendor._id, 10),
            orderStatus: await getOrderStatusDistribution(vendor._id),
            revenueByCategory: await getRevenueByCategory(vendor._id),
            customerInsights: await getCustomerInsights(vendor._id),
            performanceMetrics: await getPerformanceMetrics(vendor._id, startDate, endDate)
        };

        res.json(analytics);
    } catch (error) {
        console.error('Error fetching vendor analytics:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get vendor payouts
// @route   GET /api/vendors/payouts
// @access  Private (Vendor)
const getVendorPayouts = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({ user: req.user._id });
        
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor profile not found' });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const payouts = await VendorPayout.find({ vendor: vendor._id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await VendorPayout.countDocuments({ vendor: vendor._id });

        // Calculate pending earnings
        const vendorProductIds = await Product.find({ vendor: vendor._id }).distinct('_id');
        const lastPayout = await VendorPayout.findOne({ vendor: vendor._id })
            .sort({ 'period.endDate': -1 });

        const pendingStartDate = lastPayout ? lastPayout.period.endDate : new Date(0);
        
        const pendingEarnings = await Order.aggregate([
            {
                $lookup: {
                    from: 'products',
                    localField: 'orderItems.product',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            {
                $match: {
                    'productDetails.vendor': vendor._id,
                    status: { $in: ['delivered', 'completed'] },
                    createdAt: { $gt: pendingStartDate }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$totalPrice' }
                }
            }
        ]);

        const pendingAmount = pendingEarnings[0]?.total || 0;
        const vendorPendingEarnings = vendor.calculateEarnings(pendingAmount);

        res.json({
            payouts,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalPayouts: total,
                hasNextPage: page < Math.ceil(total / limit),
                hasPrevPage: page > 1
            },
            pendingEarnings: {
                totalSales: pendingAmount,
                vendorEarnings: vendorPendingEarnings.vendorEarnings,
                platformCommission: vendorPendingEarnings.platformCommission
            }
        });
    } catch (error) {
        console.error('Error fetching vendor payouts:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Admin Functions

// @desc    Get all vendors (Admin)
// @route   GET /api/vendors/admin/all
// @access  Private (Admin)
const getAllVendors = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const status = req.query.status || '';
        const search = req.query.search || '';

        // Build query
        let query = {};
        
        if (status) {
            query.status = status;
        }

        if (search) {
            query.$or = [
                { storeName: { $regex: search, $options: 'i' } },
                { 'contactInfo.email': { $regex: search, $options: 'i' } }
            ];
        }

        const vendors = await Vendor.find(query)
            .populate('user', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Vendor.countDocuments(query);

        // Add vendor stats
        const vendorsWithStats = await Promise.all(vendors.map(async (vendor) => {
            const productCount = await Product.countDocuments({ vendor: vendor._id });
            const orderCount = await Order.countDocuments({
                'orderItems.product': { $in: await Product.find({ vendor: vendor._id }).distinct('_id') }
            });

            return {
                ...vendor.toObject(),
                stats: {
                    totalProducts: productCount,
                    totalOrders: orderCount
                }
            };
        }));

        res.json({
            vendors: vendorsWithStats,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalVendors: total,
                hasNextPage: page < Math.ceil(total / limit),
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        console.error('Error fetching vendors:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Update vendor status (Admin)
// @route   PUT /api/vendors/admin/:id/status
// @access  Private (Admin)
const updateVendorStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const { id } = req.params;

        const vendor = await Vendor.findById(id);
        
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        vendor.status = status;
        
        if (status === 'approved') {
            vendor.verification.isVerified = true;
            vendor.verification.verificationDate = new Date();
            vendor.verification.verifiedBy = req.user._id;
        }

        await vendor.save();

        res.json({
            success: true,
            message: `Vendor status updated to ${status}`,
            vendor
        });
    } catch (error) {
        console.error('Error updating vendor status:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Helper Functions
const getSalesTrend = async (vendorId, startDate = null, endDate = null) => {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const vendorProductIds = await Product.find({ vendor: vendorId }).distinct('_id');

    return await Order.aggregate([
        {
            $match: {
                'items.product': { $in: vendorProductIds },
                createdAt: { $gte: start, $lte: end },
                status: { $in: ['delivered', 'completed'] }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                },
                sales: { $sum: '$totalAmount' },
                orders: { $sum: 1 }
            }
        },
        {
            $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
        }
    ]);
};

const getTopProducts = async (vendorId, limit = 5) => {
    const vendorProductIds = await Product.find({ vendor: vendorId }).distinct('_id');

    return await Order.aggregate([
        { $unwind: '$items' },
        {
            $match: {
                'items.product': { $in: vendorProductIds },
                status: { $in: ['delivered', 'completed'] }
            }
        },
        {
            $group: {
                _id: '$items.product',
                totalSold: { $sum: '$items.quantity' },
                totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
            }
        },
        {
            $lookup: {
                from: 'products',
                localField: '_id',
                foreignField: '_id',
                as: 'product'
            }
        },
        { $unwind: '$product' },
        {
            $project: {
                title: '$product.title',
                images: '$product.images',
                totalSold: 1,
                totalRevenue: 1
            }
        },
        { $sort: { totalSold: -1 } },
        { $limit: limit }
    ]);
};

const getOrderStatusDistribution = async (vendorId) => {
    const vendorProductIds = await Product.find({ vendor: vendorId }).distinct('_id');

    return await Order.aggregate([
        {
            $match: {
                'items.product': { $in: vendorProductIds }
            }
        },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);
};

const getRevenueByCategory = async (vendorId) => {
    return await Product.aggregate([
        { $match: { vendor: vendorId } },
        {
            $lookup: {
                from: 'orders',
                let: { productId: '$_id' },
                pipeline: [
                    { $unwind: '$items' },
                    {
                        $match: {
                            $expr: { $eq: ['$items.product', '$$productId'] },
                            status: { $in: ['delivered', 'completed'] }
                        }
                    }
                ],
                as: 'orders'
            }
        },
        {
            $group: {
                _id: '$category',
                revenue: {
                    $sum: {
                        $sum: {
                            $map: {
                                input: '$orders',
                                as: 'order',
                                in: { $multiply: ['$$order.items.price', '$$order.items.quantity'] }
                            }
                        }
                    }
                }
            }
        }
    ]);
};

const getCustomerInsights = async (vendorId) => {
    const vendorProductIds = await Product.find({ vendor: vendorId }).distinct('_id');

    const [totalCustomers, repeatCustomers] = await Promise.all([
        Order.distinct('user', { 'items.product': { $in: vendorProductIds } }).then(customers => customers.length),
        Order.aggregate([
            { $match: { 'items.product': { $in: vendorProductIds } } },
            { $group: { _id: '$user', orderCount: { $sum: 1 } } },
            { $match: { orderCount: { $gt: 1 } } },
            { $count: 'repeatCustomers' }
        ]).then(result => result[0]?.repeatCustomers || 0)
    ]);

    return {
        totalCustomers,
        repeatCustomers,
        repeatCustomerRate: totalCustomers > 0 ? (repeatCustomers / totalCustomers * 100).toFixed(2) : 0
    };
};

const getPerformanceMetrics = async (vendorId, startDate, endDate) => {
    const vendorProductIds = await Product.find({ vendor: vendorId }).distinct('_id');

    const [
        averageOrderValue,
        conversionRate,
        averageProcessingTime
    ] = await Promise.all([
        Order.aggregate([
            {
                $match: {
                    'items.product': { $in: vendorProductIds },
                    createdAt: { $gte: startDate, $lte: endDate },
                    status: { $in: ['delivered', 'completed'] }
                }
            },
            {
                $group: {
                    _id: null,
                    averageValue: { $avg: '$totalAmount' }
                }
            }
        ]).then(result => result[0]?.averageValue || 0),
        // Note: Conversion rate would need additional tracking of page views/sessions
        0, // Placeholder for conversion rate
        Order.aggregate([
            {
                $match: {
                    'items.product': { $in: vendorProductIds },
                    createdAt: { $gte: startDate, $lte: endDate },
                    status: { $in: ['shipped', 'delivered', 'completed'] }
                }
            },
            {
                $project: {
                    processingTime: {
                        $divide: [
                            { $subtract: ['$shippedAt', '$createdAt'] },
                            1000 * 60 * 60 * 24 // Convert to days
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    averageProcessingTime: { $avg: '$processingTime' }
                }
            }
        ]).then(result => result[0]?.averageProcessingTime || 0)
    ]);

    return {
        averageOrderValue: averageOrderValue.toFixed(2),
        conversionRate: conversionRate.toFixed(2),
        averageProcessingTime: averageProcessingTime.toFixed(1)
    };
};

module.exports = {
    registerVendor,
    getVendorProfile,
    updateVendorProfile,
    getVendorDashboard,
    getVendorProducts,
    getVendorOrders,
    getVendorAnalytics,
    getVendorPayouts,
    getAllVendors,
    updateVendorStatus
}; 