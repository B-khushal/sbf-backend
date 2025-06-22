const mongoose = require('mongoose');
require('dotenv').config();

async function testDatabaseConnection() {
  console.log('🔍 Testing MongoDB Atlas Connection...\n');
  
  const MONGODB_URI = process.env.MONGODB_URI;
  
  if (!MONGODB_URI) {
    console.log('❌ MONGODB_URI environment variable not found!');
    console.log('💡 Make sure you have a .env file with your MongoDB connection string\n');
    return;
  }
  
  console.log('🔗 Connection string found (first 50 chars):', MONGODB_URI.substring(0, 50) + '...');
  console.log('🔌 Attempting connection...\n');
  
  try {
    // Connect with same settings as your server
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      ssl: true,
      sslValidate: false,
    });
    
    console.log('✅ SUCCESS: Connected to MongoDB Atlas!');
    console.log('📊 Database:', mongoose.connection.db.databaseName);
    console.log('🌐 Host:', mongoose.connection.host);
    console.log('📡 Ready state:', mongoose.connection.readyState === 1 ? 'Connected' : 'Not connected');
    
    // Test basic operations
    console.log('\n🧪 Testing basic operations...');
    
    // List collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📁 Collections found:', collections.map(c => c.name).join(', ') || 'None yet');
    
    // Test if we can write (create a test document)
    const TestModel = mongoose.model('ConnectionTest', new mongoose.Schema({ 
      timestamp: { type: Date, default: Date.now },
      message: String 
    }));
    
    const testDoc = new TestModel({ message: 'Connection test successful' });
    await testDoc.save();
    console.log('✍️ Write test: SUCCESS');
    
    // Clean up test document
    await TestModel.deleteOne({ _id: testDoc._id });
    console.log('🧹 Cleanup: SUCCESS');
    
    console.log('\n🎉 Database connection is working perfectly!');
    console.log('✅ Your promo code system is ready to use!');
    
  } catch (error) {
    console.log('❌ CONNECTION FAILED:');
    console.log('Error:', error.message);
    
    if (error.message.includes('IP')) {
      console.log('\n💡 SOLUTION: Add your IP to MongoDB Atlas whitelist:');
      console.log('1. Go to atlas.mongodb.com');
      console.log('2. Network Access → Add IP Address');
      console.log('3. Add Current IP or use 0.0.0.0/0 for testing');
      console.log('4. Wait 2-3 minutes for changes to apply');
    } else if (error.message.includes('authentication')) {
      console.log('\n💡 SOLUTION: Check your database credentials:');
      console.log('1. Verify username and password in connection string');
      console.log('2. Make sure user has read/write permissions');
    } else {
      console.log('\n💡 Check your MongoDB Atlas cluster status and connection string');
    }
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the test
testDatabaseConnection(); 