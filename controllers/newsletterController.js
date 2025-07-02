const Newsletter = require('../models/Newsletter');
const { sendEmail } = require('../services/emailNotificationService');

// Subscribe to newsletter
exports.subscribe = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide a valid email address' 
      });
    }

    // Check if email already exists
    let subscriber = await Newsletter.findOne({ email });
    
    if (subscriber) {
      // If subscriber exists but inactive, reactivate
      if (!subscriber.isActive) {
        subscriber.isActive = true;
        subscriber.lastUpdated = new Date();
        await subscriber.save();
        return res.status(200).json({ 
          success: true, 
          message: 'Welcome back! Your subscription has been reactivated.' 
        });
      }
      return res.status(400).json({ 
        success: false, 
        message: 'This email is already subscribed to our newsletter' 
      });
    }

    // Create new subscriber
    subscriber = new Newsletter({ email });
    await subscriber.save();

    // Send welcome email
    try {
      await sendEmail({
        to: email,
        subject: 'Welcome to Spring Blossoms Florist Newsletter!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #e11d48;">Welcome to Spring Blossoms Florist! 🌸</h2>
            <p>Thank you for subscribing to our newsletter. You'll be the first to know about:</p>
            <ul>
              <li>New flower collections</li>
              <li>Seasonal offers and discounts</li>
              <li>Special event decorations</li>
              <li>Floral arrangement tips</li>
            </ul>
            <p>Stay blooming!</p>
            <p>Best regards,<br>Spring Blossoms Florist Team</p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
      // Continue with subscription even if email fails
    }

    res.status(201).json({ 
      success: true, 
      message: 'Successfully subscribed to newsletter!' 
    });

  } catch (error) {
    console.error('Newsletter subscription error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing newsletter subscription' 
    });
  }
};

// Unsubscribe from newsletter
exports.unsubscribe = async (req, res) => {
  try {
    const { email } = req.body;

    const subscriber = await Newsletter.findOne({ email });
    
    if (!subscriber) {
      return res.status(404).json({ 
        success: false, 
        message: 'Email not found in our subscription list' 
      });
    }

    subscriber.isActive = false;
    subscriber.lastUpdated = new Date();
    await subscriber.save();

    res.status(200).json({ 
      success: true, 
      message: 'Successfully unsubscribed from newsletter' 
    });

  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing unsubscribe request' 
    });
  }
};

// Get all subscribers (admin only)
exports.getAllSubscribers = async (req, res) => {
  try {
    const subscribers = await Newsletter.find()
      .select('email subscriptionDate isActive lastUpdated')
      .sort('-subscriptionDate');

    res.status(200).json({
      success: true,
      count: subscribers.length,
      data: subscribers
    });

  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching newsletter subscribers' 
    });
  }
}; 