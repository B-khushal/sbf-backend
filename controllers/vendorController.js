const Vendor = require('../models/Vendor');
const VendorPayout = require('../models/VendorPayout');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const mongoose = require('mongoose');
const pdf = require('html-pdf');
const fs = require('fs');
const path = require('path');
const { getPdfOptions, getLogoBase64 } = require('../utils/pdfHelper');
const { sendEmailNotification } = require('../services/emailNotificationService');
const nodemailer = require('nodemailer');

// Simple email helper for vendor-related notifications
const sendSimpleEmail = async ({ to, subject, html }) => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER || process.env.ORDER_CONFIRMATION_EMAIL_USER,
                pass: process.env.EMAIL_PASS || process.env.ORDER_CONFIRMATION_EMAIL_PASS
            }
        });
        await transporter.sendMail({
            from: { name: 'Spring Blossoms Florist', address: process.env.EMAIL_USER || process.env.ORDER_CONFIRMATION_EMAIL_USER || 'noreply@sbflorist.in' },
            to,
            subject,
            html
        });
        console.log('✅ Email sent to:', to);
    } catch (err) {
        console.error('⚠️ Failed to send email:', err.message);
    }
};

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads/vendor-consents');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// @desc    Apply as a new vendor (with consent)
// @route   POST /api/vendors/apply
// @access  Public
const applyVendor = async (req, res) => {
    try {
        console.log('📋 Raw request body keys:', Object.keys(req.body));
        console.log('📋 Request content-type:', req.headers['content-type']);
        console.log('📋 Request body size:', JSON.stringify(req.body).length, 'bytes');

        const {
            vendorDetails,
            consentAccepted,
            signatureImage
        } = req.body;

        console.log('📋 Vendor Application Request:', {
            hasVendorDetails: !!vendorDetails,
            vendorDetailsType: typeof vendorDetails,
            consentAccepted,
            hasSignature: !!signatureImage,
            signatureLength: signatureImage?.length || 0,
            vendorDetailsKeys: vendorDetails ? Object.keys(vendorDetails) : 'undefined'
        });

        if (!consentAccepted || !signatureImage) {
            console.log('❌ Missing consent or signature');
            return res.status(400).json({ message: 'Consent and signature are required.' });
        }

        if (!vendorDetails) {
            console.log('❌ Missing vendorDetails object');
            return res.status(400).json({ message: 'Vendor details are required.' });
        }

        const {
            fullName,
            businessName,
            email,
            phone,
            address,
            city,
            state,
            zipCode,
            website,
            instagram,
            businessDescription
        } = vendorDetails;

        console.log('📋 Extracted vendor details:', {
            fullName: fullName || 'MISSING',
            businessName: businessName || 'MISSING',
            email: email || 'MISSING',
            phone: phone || 'MISSING',
            address: address || 'MISSING',
            city: city || 'MISSING',
            state: state || 'MISSING',
            zipCode: zipCode || 'MISSING',
            hasWebsite: !!website,
            hasInstagram: !!instagram,
            hasDescription: !!businessDescription
        });

        // Validate required fields
        if (!fullName || !businessName || !email || !phone || !address || !city || !state || !zipCode) {
            console.log('❌ Validation failed - missing required fields');
            return res.status(400).json({
                message: 'All required fields must be provided.',
                missing: {
                    fullName: !fullName,
                    businessName: !businessName,
                    email: !email,
                    phone: !phone,
                    address: !address,
                    city: !city,
                    state: !state,
                    zipCode: !zipCode
                }
            });
        }

        // Check if store name is already taken
        const existingStoreName = await Vendor.findOne({ storeName: businessName });
        if (existingStoreName) {
            return res.status(400).json({ message: 'Store name already exists. Please choose a different business name.' });
        }

        // Create the vendor application
        const newVendor = new Vendor({
            user: req.user._id, // Link consent form to the logged-in user
            ownerName: fullName,
            storeName: businessName,
            storeDescription: businessDescription || 'New vendor application',
            storeAddress: {
                street: address,
                city,
                state,
                zipCode,
                country: 'India'
            },
            contactInfo: {
                phone,
                email,
                website
            },
            socialMedia: {
                instagram
            },
            status: 'pending',
            signatureImage
        });

        try {
            await newVendor.save();
            console.log('✅ Vendor application saved successfully:', newVendor._id);
        } catch (saveError) {
            console.error('❌ Error saving vendor:', saveError);
            if (saveError.name === 'ValidationError') {
                const errors = Object.values(saveError.errors).map(err => err.message);
                return res.status(400).json({
                    message: 'Validation failed',
                    errors
                });
            }
            throw saveError; // Re-throw if not a validation error
        }

        // Send success response IMMEDIATELY after save (don't wait for PDF/email)
        res.status(201).json({
            success: true,
            message: 'Vendor application submitted successfully!',
            vendorId: newVendor._id
        });

        // Generate PDF and send admin email in the background (non-blocking)
        try {
            const signatureBase64 = signatureImage;
            const logoBase64 = getLogoBase64();
            const pdfHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #333; line-height: 1.6; }
                        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #ed8796; padding-bottom: 20px; }
                        .header h1 { color: #ed8796; margin: 0; }
                        .header p { margin: 5px 0; color: #666; }
                        .section { margin-bottom: 25px; }
                        .section h2 { font-size: 18px; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
                        .detail-row { margin-bottom: 10px; }
                        .detail-label { font-weight: bold; display: inline-block; width: 140px; }
                        .agreement-text { font-size: 14px; background: #f9f9f9; padding: 15px; border-left: 4px solid #ed8796; margin-bottom: 20px; text-align: justify; }
                        .signature-section { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px; }
                        .signature-box { margin-bottom: 10px; }
                        .signature-img { max-height: 100px; max-width: 250px; border: 1px dashed #ccc; padding: 5px; }
                        .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #999; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <img src="${logoBase64}" alt="SBF Logo" style="height: 60px; margin-bottom: 10px;" />
                        <p>Vendor Consent Agreement</p>
                    </div>
                    
                    <div class="section">
                        <h2>Vendor Information</h2>
                        <div class="detail-row"><span class="detail-label">Vendor Name:</span> ${fullName}</div>
                        <div class="detail-row"><span class="detail-label">Business Name:</span> ${businessName}</div>
                        <div class="detail-row"><span class="detail-label">Email:</span> ${email}</div>
                        <div class="detail-row"><span class="detail-label">Phone:</span> ${phone}</div>
                        <div class="detail-row"><span class="detail-label">Address:</span> ${address}, ${city}, ${state} ${zipCode}</div>
                    </div>

                    <div class="section">
                        <h2>Digital Consent Agreement</h2>
                        <div class="agreement-text">
                            By signing this agreement, the Vendor acknowledges and agrees to abide by all the terms, policies, and quality standards set forth by Spring Blossoms Florist. The Vendor confirms that all provided information is accurate and that they possess the necessary rights and licenses to operate their business. The Vendor agrees to maintain the delivery standards, fulfill orders promptly, and adhere to the agreed-upon commission structures. Spring Blossoms Florist reserves the right to review, suspend, or terminate this partnership if the terms of this agreement are violated.
                        </div>
                    </div>

                    <div class="signature-section">
                        <div style="float: left; width: 50%;">
                            <div style="font-weight: bold; margin-bottom: 10px;">Vendor Signature</div>
                            <div class="signature-box">
                                <img src="${signatureBase64}" class="signature-img" />
                            </div>
                            <div><strong>Name:</strong> ${fullName}</div>
                            <div><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
                        </div>
                        <div style="clear: both;"></div>
                    </div>
                    
                    <div class="footer">
                        Document generated on ${new Date().toLocaleString()} | Application ID: ${newVendor._id}
                    </div>
                </body>
                </html>
            `;
            const pdfOptions = { format: 'A4', orientation: 'portrait', border: '15mm' };
            pdf.create(pdfHtml, pdfOptions).toBuffer(async (err, buffer) => {
                if (err) {
                    console.error('⚠️ PDF generation failed (non-critical):', err.message);
                } else {
                    try {
                        newVendor.consentPdfData = buffer.toString('base64');
                        newVendor.consentPdf = `/api/vendors/pdf/${newVendor._id}/consent`;
                        await newVendor.save();
                        console.log('✅ Consent PDF generated and saved');
                    } catch (saveErr) {
                        console.error('⚠️ Failed to save PDF data:', saveErr.message);
                    }
                }
            });
        } catch (pdfError) {
            console.error('⚠️ PDF generation setup failed (non-critical):', pdfError.message);
        }

        // Send admin notification email (non-blocking)
        try {
            const adminEmail = process.env.ADMIN_EMAIL || 'admin@sbflorist.in';
            sendSimpleEmail({
                to: adminEmail,
                subject: 'New Vendor Application Received',
                html: `
                    <h2>New Vendor Application</h2>
                    <p>A new vendor application has been submitted by <strong>${fullName}</strong> (${businessName}).</p>
                    <p>Please log in to the admin panel to review and approve the application.</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Phone:</strong> ${phone}</p>
                `
            }).catch(emailErr => {
                console.error('⚠️ Failed to send admin notification:', emailErr.message);
            });
        } catch (emailErr) {
            console.error('⚠️ Admin email setup failed:', emailErr.message);
        }
    } catch (error) {
        console.error('Error in applyVendor:', error);
        // Only send error response if headers haven't been sent yet
        if (!res.headersSent) {
            res.status(500).json({ message: 'Server error', error: error.message });
        }
    }
};




// @desc    Register as vendor (Completes the profile after consent)
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

        // Find the existing vendor created by the consent form
        const existingVendor = await Vendor.findOne({ user: req.user._id });

        if (!existingVendor) {
            return res.status(400).json({ message: 'Consent form required. Please fill out the vendor consent form first.' });
        }

        // Update existing vendor with registration details
        existingVendor.businessInfo = businessInfo || existingVendor.businessInfo;
        existingVendor.bankDetails = bankDetails || existingVendor.bankDetails;

        if (storeName) existingVendor.storeName = storeName;
        if (storeDescription) existingVendor.storeDescription = storeDescription;
        if (storeAddress) Object.assign(existingVendor.storeAddress, storeAddress);
        if (contactInfo) Object.assign(existingVendor.contactInfo, contactInfo);

        await existingVendor.save();

        res.status(200).json({
            success: true,
            message: 'Vendor registration completed successfully.',
            vendor: existingVendor
        });
    } catch (error) {
        console.error('Error registering vendor:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get vendor consent data for registration prefill
// @route   GET /api/vendors/consent-data
// @access  Private
const getVendorConsentData = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({ user: req.user._id });

        if (!vendor) {
            return res.status(404).json({ message: 'No consent form found. Please complete the consent form first.' });
        }

        res.json({
            success: true,
            vendorData: {
                storeName: vendor.storeName || '',
                storeDescription: vendor.storeDescription || '',
                storeAddress: vendor.storeAddress || { street: '', city: '', state: '', zipCode: '', country: 'India' },
                contactInfo: vendor.contactInfo || { phone: '', email: '', website: '' }
            }
        });
    } catch (error) {
        console.error('Error fetching consent data:', error);
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
            salesOverTime: await getSalesTrend(vendor._id, startDate, endDate),
            topProducts: await getTopProducts(vendor._id, 10),
            orderStatus: await getOrderStatusDistribution(vendor._id),
            categoryPerformance: await getRevenueByCategory(vendor._id),
            customerInsights: await getCustomerInsights(vendor._id),
            keyStats: await getPerformanceMetrics(vendor._id, startDate, endDate)
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

        // Aggregate payouts to get summary
        const payoutStats = await VendorPayout.aggregate([
            { $match: { vendor: vendor._id } },
            {
                $group: {
                    _id: '$status',
                    totalAmount: { $sum: '$amount' }
                }
            }
        ]);

        let totalPaid = 0;
        let existingPendingPayouts = 0;

        payoutStats.forEach(stat => {
            if (stat._id === 'paid' || stat._id === 'completed' || stat._id === 'approved') {
                totalPaid += stat.totalAmount;
            } else if (stat._id === 'pending' || stat._id === 'processing') {
                existingPendingPayouts += stat.totalAmount;
            }
        });

        const newPendingEarnings = vendorPendingEarnings.vendorEarnings;
        const totalPending = existingPendingPayouts + newPendingEarnings;

        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        nextMonth.setDate(1);
        nextMonth.setHours(0, 0, 0, 0);

        res.json({
            payouts,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalPayouts: total,
                hasNextPage: page < Math.ceil(total / limit),
                hasPrevPage: page > 1
            },
            summary: {
                totalEarned: totalPaid + totalPending,
                totalPaid: totalPaid,
                pendingPayout: totalPending,
                nextPayoutDate: nextMonth.toISOString()
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
            message: `Vendor status updated to ${status} `,
            vendor
        });
    } catch (error) {
        console.error('Error updating vendor status:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Approve Vendor and generate signed agreement
// @route   PUT /api/vendors/admin/:id/approve
// @access  Private (Admin)
const approveVendor = async (req, res) => {
    try {
        const { adminSignature } = req.body;
        const { id } = req.params;

        if (!adminSignature) {
            return res.status(400).json({ message: 'Admin signature is required for approval.' });
        }

        const vendor = await Vendor.findById(id);
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found.' });
        }

        // Update vendor details
        vendor.status = 'approved';
        vendor.verification.isVerified = true;
        vendor.verification.verificationDate = new Date();
        vendor.verification.verifiedBy = req.user._id;
        vendor.adminSignature = adminSignature;
        vendor.approvedAt = new Date();

        // Ensure ownerName exists to prevent mongoose validation error
        if (!vendor.ownerName) {
            vendor.ownerName = vendor.user?.name || 'Authorized Vendor';
        }

        await vendor.save();

        // Update the User record's role to 'vendor' so the frontend detects vendor access
        if (vendor.user) {
            await User.findByIdAndUpdate(vendor.user, { role: 'vendor', vendorStatus: 'approved' });
            console.log('✅ User role updated to vendor for user:', vendor.user);
        }

        // Generate Finalized PDF
        const logoBase64 = getLogoBase64();
        const pdfHtml = `
            <!DOCTYPE html>
            <html>
                    <head>
                        <style>
                            body {font - family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #333; line-height: 1.6; }
                            .header {text - align: center; margin-bottom: 30px; border-bottom: 2px solid #28a745; padding-bottom: 20px; }
                            .header h1 {color: #28a745; margin: 0; }
                            .header p {margin: 5px 0; color: #666; font-weight: bold; }
                            .section {margin - bottom: 25px; }
                            .section h2 {font - size: 18px; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
                            .detail-row {margin - bottom: 10px; }
                            .detail-label {font - weight: bold; display: inline-block; width: 140px; }
                            .agreement-text {font - size: 14px; background: #f9f9f9; padding: 15px; border-left: 4px solid #28a745; margin-bottom: 20px; text-align: justify; }
                            .signature-section {margin - top: 40px; border-top: 1px solid #ddd; padding-top: 20px; display: flex; justify-content: space-between; }
                            .signature-box {margin - bottom: 10px; }
                            .signature-img {max - height: 100px; max-width: 250px; border: 1px dashed #ccc; padding: 5px; }
                            .footer {text - align: center; margin-top: 50px; font-size: 12px; color: #999; }
                            .sig-block {width: 45%; float: left; }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <img src="${logoBase64}" alt="SBF Logo" style="height: 60px; margin-bottom: 10px;" />
                            <p>OFFICIAL APPROVED VENDOR AGREEMENT</p>
                        </div>

                        <div class="section">
                            <h2>Vendor Information</h2>
                            <div class="detail-row"><span class="detail-label">Vendor Name:</span> ${vendor.ownerName || vendor.user?.name || 'Authorized Vendor'}</div>
                            <div class="detail-row"><span class="detail-label">Business Name:</span> ${vendor.storeName}</div>
                            <div class="detail-row"><span class="detail-label">Email:</span> ${vendor.contactInfo.email}</div>
                            <div class="detail-row"><span class="detail-label">Phone:</span> ${vendor.contactInfo.phone}</div>
                        </div>

                        <div class="section">
                            <h2>Digital Consent Agreement</h2>
                            <div class="agreement-text">
                                This document constitutes the fully executed and approved Vendor Agreement between Spring Blossoms Florist and ${vendor.storeName}. The Vendor's application has been reviewed and officially approved by the Administration. All terms regarding fulfillment, quality, standards, and commission apply as per the vendor policies in effect at the time of approval.
                            </div>
                        </div>

                        <div class="signature-section">
                            <div class="sig-block">
                                <div style="font-weight: bold; margin-bottom: 10px; color: #ed8796;">Vendor Signature</div>
                                <div class="signature-box">
                                    <img src="${vendor.signatureImage || ''}" class="signature-img" alt="Vendor Signature" />
                                </div>
                                <div><strong>Name:</strong> ${vendor.ownerName || vendor.user?.name || 'Authorized Vendor'}</div>
                                <div><strong>Date:</strong> ${vendor.createdAt ? new Date(vendor.createdAt).toLocaleDateString() : 'N/A'}</div>
                            </div>

                            <div class="sig-block" style="float: right;">
                                <div style="font-weight: bold; margin-bottom: 10px; color: #28a745;">Admin Approval Signature</div>
                                <div class="signature-box">
                                    <img src="${adminSignature}" class="signature-img" />
                                </div>
                                <div><strong>Status:</strong> APPROVED</div>
                                <div><strong>Date:</strong> ${vendor.approvedAt.toLocaleDateString()}</div>
                            </div>
                            <div style="clear: both;"></div>
                        </div>

                        <div class="footer">
                            Document finalized on ${new Date().toLocaleString()} | Application ID: ${vendor._id}
                        </div>
                    </body>
                </html>
        `;
        const pdfOptions = { format: 'A4', orientation: 'portrait', border: '15mm' };
        pdf.create(pdfHtml, pdfOptions).toBuffer(async (err, buffer) => {
            if (err) {
                console.error('Error generating approval PDF:', err);
                return res.status(500).json({ message: 'Error generating approval PDF' });
            }

            vendor.approvalPdfData = buffer.toString('base64');
            vendor.approvalPdf = `/api/vendors/pdf/${vendor._id}/approval`;
            await vendor.save();

            // Send approval email to vendor with PDF link or attachment
            try {
                // Here we will just send an email with the link to the PDF
                await sendSimpleEmail({
                    to: vendor.contactInfo.email,
                    subject: 'Your Vendor Application is Approved!',
                    html: `
                        <h2>Congratulations ${vendor.ownerName || vendor.user?.name || 'Partner'}!</h2>
                        <p>Your application for <strong>${vendor.storeName}</strong> has been officially approved by Spring Blossoms Florist.</p>
                        <p>You can download your finalized and signed agreement here:</p>
                        <p><a href="${process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`}${vendor.approvalPdf}" target="_blank">Download Approved Vendor Agreement PDF</a></p>
                        <br/>
                        <p>We're excited to have you on board!</p>
                        <p>Best Regards,<br>Spring Blossoms Florist Team</p>
                    `
                });
            } catch (emailErr) {
                console.error('Failed to send vendor approval notification:', emailErr);
            }

            res.status(200).json({
                success: true,
                message: 'Vendor approved and agreement finalized.',
                vendor
            });
        });
    } catch (error) {
        console.error('Error in approveVendor:', error);
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

// @desc    Get vendor PDF from database
// @route   GET /api/vendors/pdf/:id/:type
// @access  Public
const getVendorPdf = async (req, res) => {
    try {
        const { id, type } = req.params;
        const vendor = await Vendor.findById(id).select('consentPdfData approvalPdfData');

        if (!vendor) {
            return res.status(404).send('Pdf or Vendor not found');
        }

        let base64Data;
        let filename;
        if (type === 'consent' && vendor.consentPdfData) {
            base64Data = vendor.consentPdfData;
            filename = `Vendor-Consent-${id}.pdf`;
        } else if (type === 'approval' && vendor.approvalPdfData) {
            base64Data = vendor.approvalPdfData;
            filename = `Vendor-Approved-${id}.pdf`;
        } else {
            return res.status(404).send('PDF not found');
        }

        const buffer = Buffer.from(base64Data, 'base64');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.send(buffer);
    } catch (error) {
        console.error('Error fetching vendor PDF:', error);
        res.status(500).send('Server error loading document');
    }
};

// @desc    Get vendor by ID for admin
// @route   GET /api/vendors/admin/:id
// @access  Private/Admin
const getVendorById = async (req, res) => {
    try {
        const { id } = req.params;
        const vendor = await Vendor.findById(id).populate('user', 'name email role');

        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        res.json({ success: true, vendor });
    } catch (error) {
        console.error('Error fetching vendor by ID:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Delete vendor
// @route   DELETE /api/vendors/admin/:id
// @access  Private/Admin
const deleteVendor = async (req, res) => {
    try {
        const { id } = req.params;

        const vendor = await Vendor.findById(id);

        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        // Optional: Delete all products associated with this vendor
        await Product.deleteMany({ vendor: id });

        // Demote the associated user back to a regular 'user' role
        if (vendor.user) {
            await User.findByIdAndUpdate(vendor.user, { role: 'user', vendorStatus: 'pending' });
        }

        // Delete the vendor
        await Vendor.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'Vendor deleted and user role reverted successfully'
        });
    } catch (error) {
        console.error('Error deleting vendor:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get vendor notifications
// @route   GET /api/vendors/notifications
// @access  Private (Vendor)
const getVendorNotifications = async (req, res) => {
    try {
        const { since } = req.query;
        let query = { userId: req.user._id };

        if (since && since !== 'null' && since !== 'undefined') {
            query.createdAt = { $gt: new Date(since) };
        }

        const Notification = require('../models/Notification');
        const notifications = await Notification.find(query).sort({ createdAt: -1 }).limit(50);

        res.json({ success: true, notifications });
    } catch (error) {
        console.error('Error fetching vendor notifications:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get vendor settings
// @route   GET /api/vendors/settings
// @access  Private (Vendor)
const getVendorSettings = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({ user: req.user._id });
        if (!vendor) return res.status(404).json({ message: 'Vendor profile not found' });

        res.json({
            storeName: vendor.storeName || '',
            storeDescription: vendor.storeDescription || '',
            contactInfo: {
                email: vendor.contactInfo?.email || '',
                phone: vendor.contactInfo?.phone || ''
            },
            payoutInfo: {
                bankAccountHolder: vendor.bankDetails?.accountHolderName || '',
                bankAccountNumber: vendor.bankDetails?.accountNumber || '',
                bankIfsc: vendor.bankDetails?.routingNumber || ''
            }
        });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update vendor settings
// @route   PUT /api/vendors/settings
// @access  Private (Vendor)
const updateVendorSettings = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({ user: req.user._id });
        if (!vendor) return res.status(404).json({ message: 'Vendor profile not found' });

        const { storeName, storeDescription, contactInfo, payoutInfo } = req.body;

        if (storeName) vendor.storeName = storeName;
        if (storeDescription) vendor.storeDescription = storeDescription;
        if (contactInfo) {
            if (!vendor.contactInfo) vendor.contactInfo = {};
            if (contactInfo.email) vendor.contactInfo.email = contactInfo.email;
            if (contactInfo.phone) vendor.contactInfo.phone = contactInfo.phone;
        }
        if (payoutInfo) {
            if (!vendor.bankDetails) vendor.bankDetails = {};
            if (payoutInfo.bankAccountHolder) vendor.bankDetails.accountHolderName = payoutInfo.bankAccountHolder;
            if (payoutInfo.bankAccountNumber) vendor.bankDetails.accountNumber = payoutInfo.bankAccountNumber;
            if (payoutInfo.bankIfsc) vendor.bankDetails.routingNumber = payoutInfo.bankIfsc;
        }

        await vendor.save();
        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    applyVendor,
    approveVendor,
    registerVendor,
    getVendorConsentData,
    getVendorProfile,
    updateVendorProfile,
    getVendorDashboard,
    getVendorProducts,
    getVendorOrders,
    getVendorAnalytics,
    getVendorPayouts,
    getAllVendors,
    getVendorById,
    updateVendorStatus,
    getVendorPdf,
    deleteVendor,
    getVendorNotifications,
    getVendorSettings,
    updateVendorSettings
}; 