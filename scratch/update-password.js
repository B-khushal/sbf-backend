const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://khushalprasad242:ddkka2006@cluster0.qxae3.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0";

async function updatePassword() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');
    
    const User = require('../models/User');
    const user = await User.findOne({ email: 'admin@sbf.com' });
    if (!user) {
      console.log('Admin user admin@sbf.com not found!');
      return;
    }
    
    user.password = 'admin123';
    await user.save();
    console.log('Password updated successfully for admin@sbf.com');
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

updatePassword();
