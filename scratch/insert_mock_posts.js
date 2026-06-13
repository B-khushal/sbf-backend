const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables from parent directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const SocialFeedPost = require('../models/SocialFeedPost');

const run = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sbf-local';
  console.log('Connecting to MongoDB at:', mongoURI);
  await mongoose.connect(mongoURI);
  
  // Delete all existing posts first to start fresh
  await SocialFeedPost.deleteMany({});
  
  // Array of valid public Instagram posts
  const posts = [
    {
      embedUrl: 'https://www.instagram.com/p/DP9hBT_Ew-4/',
      isActive: true,
      displayOrder: 0
    },
    {
      embedUrl: 'https://www.instagram.com/p/C7UoM1wI4v_/',
      isActive: true,
      displayOrder: 1
    },
    {
      embedUrl: 'https://www.instagram.com/p/C7R1L92oK8k/',
      isActive: true,
      displayOrder: 2
    }
  ];

  for (const p of posts) {
    const post = new SocialFeedPost(p);
    await post.save();
    console.log('Added post:', p.embedUrl);
  }
  
  console.log('✅ Seeding of mock Instagram embeds completed!');
  mongoose.connection.close();
};

run().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
