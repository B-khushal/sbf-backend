const Newsletter = require('../models/Newsletter');
const { sendEmail } = require('../services/emailService');

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
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; background: linear-gradient(135deg, #ec4899 0%, #be185d 100%); color: white; padding: 30px;">
              <h1 style="margin: 0; font-size: 28px;">Spring Blossoms Florist</h1>
              <p style="font-style: italic; font-size: 14px; opacity: 0.9; margin: 5px 0 0;">A Reason to Express</p>
            </div>
            <div style="padding: 30px; background-color: #fdf2f8; color: #374151;">
              <h2 style="color: #be185d; margin-top: 0;">Welcome to our Newsletter! 🌸</h2>
              <p>Thank you for subscribing to our newsletter. You'll be the first to know about:</p>
              <ul style="line-height: 1.8;">
                <li>New flower collections</li>
                <li>Seasonal offers and discounts</li>
                <li>Special event decorations</li>
                <li>Floral arrangement tips</li>
              </ul>
              <p>Stay blooming!</p>
              <p style="margin-bottom: 0;">Best regards,<br><strong>Spring Blossoms Florist Team</strong></p>
            </div>
            <div style="text-align: center; padding: 20px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
              <p style="margin: 0 0 5px 0;">Spring Blossoms Florist</p>
              <p style="margin: 0 0 5px 0;">Website: <a href="https://sbflorist.in" style="color: #ec4899; text-decoration: none;">https://sbflorist.in</a> | Email: <a href="mailto:contact@sbflorist.in" style="color: #ec4899; text-decoration: none;">contact@sbflorist.in</a></p>
              <p style="margin: 0;">Thank you for choosing Spring Blossoms Florist.</p>
            </div>
          </div>
        `,
        text: `Welcome to Spring Blossoms Florist!\n\nThank you for subscribing to our newsletter. You will be the first to know about our new flower collections, seasonal offers, event decorations, and floral arrangement tips.\n\nBest regards,\nSpring Blossoms Florist Team`,
        type: 'newsletter_subscription'
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