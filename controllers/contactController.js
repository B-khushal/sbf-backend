const { sendEmailNotification } = require('../services/emailNotificationService');
const Notification = require('../models/Notification');

// @desc    Submit contact form
// @route   POST /api/contact
// @access  Public
const submitContactForm = async (req, res) => {
  try {
    const { firstName, lastName, email, message } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    const fullName = `${firstName} ${lastName}`;
    const currentDate = new Date().toLocaleDateString();
    
    // Create notification for admin
    try {
      const notification = new Notification({
        type: 'system',
        title: '📨 New Contact Form Submission',
        message: `${fullName} (${email}) sent a message: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`,
        userId: null, // Admin notification
        read: false,
        metadata: {
          contactForm: true,
          customerName: fullName,
          customerEmail: email,
          customerMessage: message,
          submittedAt: new Date()
        }
      });
      
      await notification.save();
      console.log('✅ Contact form notification created for admin');
    } catch (notificationError) {
      console.error('❌ Error creating contact notification:', notificationError);
    }

    // Send email notification to admin
    try {
      const adminEmailContent = {
        subject: `🌸 New Contact Form - ${fullName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>New Contact Form Submission</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .info-card { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #10b981; }
              .message-box { background: #f0f9ff; padding: 20px; border-radius: 8px; border: 1px solid #bae6fd; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🌸 New Contact Form Submission</h1>
                <p>Someone wants to get in touch with Spring Blossoms Florist!</p>
              </div>
              
              <div class="content">
                <div class="info-card">
                  <h3 style="margin-top: 0; color: #059669;">Customer Information</h3>
                  <p><strong>Name:</strong> ${fullName}</p>
                  <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                  <p><strong>Submitted:</strong> ${currentDate}</p>
                </div>
                
                <div class="message-box">
                  <h3 style="color: #0369a1; margin-top: 0;">Message</h3>
                  <p style="margin: 0; white-space: pre-wrap;">${message}</p>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                  <a href="mailto:${email}?subject=Re: Your inquiry to Spring Blossoms Florist" 
                     style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 12px 25px; text-decoration: none; border-radius: 25px; font-weight: bold;">
                    Reply to Customer
                  </a>
                </div>
              </div>
              
              <div class="footer">
                <p>This email was sent from your Spring Blossoms Florist contact form</p>
                <p>Spring Blossoms Florist | Door No. 12-2-786/A & B, Najam Centre, Hyderabad</p>
              </div>
            </div>
          </body>
          </html>
        `,
        to: '2006sbf@gmail.com'
      };

      // Send email (you would implement this with your email service)
      console.log('📧 Contact form email prepared for admin:', adminEmailContent.subject);
    } catch (emailError) {
      console.error('❌ Error preparing contact email:', emailError);
    }

    // Send confirmation email to customer
    try {
      const customerEmailContent = {
        subject: '🌸 Thank you for contacting Spring Blossoms Florist',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Thank You - Spring Blossoms Florist</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #ec4899 0%, #be185d 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #fdf2f8; padding: 30px; border-radius: 0 0 10px 10px; }
              .highlight-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #ec4899; }
              .contact-info { background: #f0f9ff; padding: 20px; border-radius: 8px; margin-top: 20px; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🌸 Thank You, ${firstName}!</h1>
                <p>We've received your message and will get back to you soon</p>
              </div>
              
              <div class="content">
                <div class="highlight-box">
                  <h3 style="margin-top: 0; color: #be185d;">Message Received Successfully!</h3>
                  <p>Thank you for reaching out to Spring Blossoms Florist. We appreciate your interest in our beautiful floral arrangements.</p>
                  <p><strong>We typically respond within 24 hours</strong> during business hours.</p>
                </div>
                
                <h3 style="color: #be185d;">Your Message:</h3>
                <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; border-left: 3px solid #ec4899;">
                  <p style="margin: 0; white-space: pre-wrap;">${message}</p>
                </div>
                
                <div class="contact-info">
                  <h3 style="color: #0369a1; margin-top: 0;">Need Immediate Assistance?</h3>
                  <p><strong>📞 Phone:</strong> +91 9849589710</p>
                  <p><strong>💬 WhatsApp:</strong> <a href="https://wa.me/9949683222" style="color: #059669;">9949683222</a></p>
                  <p><strong>✉️ Email:</strong> <a href="mailto:2006sbf@gmail.com">2006sbf@gmail.com</a></p>
                  <p><strong>📍 Visit Us:</strong> Door No. 12-2-786/A & B, Najam Centre, Hyderabad</p>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${process.env.FRONTEND_URL || 'https://www.sbflorist.in'}/shop" 
                     style="background: linear-gradient(135deg, #ec4899 0%, #be185d 100%); color: white; padding: 12px 25px; text-decoration: none; border-radius: 25px; font-weight: bold; margin-right: 10px;">
                    🛍️ Browse Our Collection
                  </a>
                </div>
              </div>
              
              <div class="footer">
                <p>Thank you for choosing Spring Blossoms Florist!</p>
                <p>🌸 Where every bloom tells a story 🌸</p>
              </div>
            </div>
          </body>
          </html>
        `,
        to: email
      };

      console.log('📧 Customer confirmation email prepared for:', email);
    } catch (customerEmailError) {
      console.error('❌ Error preparing customer confirmation email:', customerEmailError);
    }

    res.status(200).json({
      success: true,
      message: 'Thank you for your message! We\'ll get back to you within 24 hours.',
      data: {
        name: fullName,
        email: email,
        submittedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Contact form submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Sorry, there was an error sending your message. Please try again or contact us directly.',
      error: error.message
    });
  }
};

// @desc    Get contact information
// @route   GET /api/contact/info
// @access  Public
const getContactInfo = async (req, res) => {
  try {
    const contactInfo = {
      address: {
        street: 'Door No. 12-2-786/A & B, Najam Centre',
        area: 'Pillar No. 32, Rethi Bowli, Mehdipatnam',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500028',
        landmark: 'Near Tolichihocki, HITEC City'
      },
      phone: {
        primary: '+91 9849589710',
        whatsapp: '9949683222'
      },
      email: '2006sbf@gmail.com',
      businessHours: {
        monday: '9:00 AM - 8:00 PM',
        tuesday: '9:00 AM - 8:00 PM',
        wednesday: '9:00 AM - 8:00 PM',
        thursday: '9:00 AM - 8:00 PM',
        friday: '9:00 AM - 8:00 PM',
        saturday: '9:00 AM - 8:00 PM',
        sunday: '10:00 AM - 6:00 PM'
      },
      socialMedia: {
        website: 'www.sbflorist.com',
        whatsapp: 'https://wa.me/9949683222'
      }
    };

    res.status(200).json({
      success: true,
      contactInfo
    });
  } catch (error) {
    console.error('Error fetching contact info:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching contact information'
    });
  }
};

module.exports = {
  submitContactForm,
  getContactInfo
}; 