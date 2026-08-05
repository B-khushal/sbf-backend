const prisma = require('./prisma');

const connectDB = async () => {
  try {
    console.log('🔍 Connecting to PostgreSQL database using Prisma...');
    // Test PostgreSQL database query
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ PostgreSQL Database Connected Successfully via Prisma!');
  } catch (error) {
    console.error(`❌ PostgreSQL Database Connection Error: ${error.message}`);
    // If process.env.MONGODB_URI is available and fallback is requested, log warning
    console.error('Please verify your DATABASE_URL in .env');
    process.exit(1);
  }
};

module.exports = connectDB;
