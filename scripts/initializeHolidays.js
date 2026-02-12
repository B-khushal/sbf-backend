const mongoose = require('mongoose');
const Holiday = require('../models/Holiday');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Default holidays for India
const getDefaultHolidays = (year) => {
  return [
    {
      name: "New Year's Day",
      date: new Date(year, 0, 1), // January 1
      reason: "New Year's Day - Store closed",
      type: 'fixed',
      category: 'other',
      isActive: true,
      recurring: true,
      recurringYears: [year, year + 1, year + 2],
      createdBy: 'system'
    },
    {
      name: "Republic Day",
      date: new Date(year, 0, 26), // January 26
      reason: "National holiday - Republic Day",
      type: 'fixed',
      category: 'national',
      isActive: true,
      recurring: true,
      recurringYears: [year, year + 1, year + 2],
      createdBy: 'system'
    },
    {
      name: "Independence Day",
      date: new Date(year, 7, 15), // August 15
      reason: "National holiday - Independence Day",
      type: 'fixed',
      category: 'national',
      isActive: true,
      recurring: true,
      recurringYears: [year, year + 1, year + 2],
      createdBy: 'system'
    },
    {
      name: "Gandhi Jayanti",
      date: new Date(year, 9, 2), // October 2
      reason: "National holiday - Gandhi Jayanti",
      type: 'fixed',
      category: 'national',
      isActive: true,
      recurring: true,
      recurringYears: [year, year + 1, year + 2],
      createdBy: 'system'
    },
    {
      name: "Christmas",
      date: new Date(year, 11, 25), // December 25
      reason: "Christmas Day - Store closed",
      type: 'fixed',
      category: 'religious',
      isActive: true,
      recurring: true,
      recurringYears: [year, year + 1, year + 2],
      createdBy: 'system'
    },
    {
      name: "New Year's Eve",
      date: new Date(year, 11, 31), // December 31
      reason: "Store closed for New Year's Eve celebrations",
      type: 'fixed',
      category: 'other',
      isActive: true,
      recurring: true,
      recurringYears: [year, year + 1, year + 2],
      createdBy: 'system'
    },
    // Simplified festival dates (these should be updated with accurate dates)
    {
      name: "Diwali",
      date: new Date(year, 9, 15), // October 15 (approximate)
      reason: "Diwali - Festival of Lights - Limited delivery availability",
      type: 'dynamic',
      category: 'religious',
      isActive: true,
      recurring: true,
      recurringYears: [year, year + 1, year + 2],
      createdBy: 'system'
    },
    {
      name: "Holi",
      date: new Date(year, 2, 15), // March 15 (approximate)
      reason: "Holi - Festival of Colors - Limited delivery availability",
      type: 'dynamic',
      category: 'religious',
      isActive: true,
      recurring: true,
      recurringYears: [year, year + 1, year + 2],
      createdBy: 'system'
    }
  ];
};

const initializeHolidays = async () => {
  try {
    await connectDB();
    
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear + 1];
    
    for (const year of years) {
      console.log(`Initializing holidays for year ${year}...`);
      
      const defaultHolidays = getDefaultHolidays(year);
      
      for (const holidayData of defaultHolidays) {
        // Check if holiday already exists for this date
        const existingHoliday = await Holiday.findOne({
          year: year,
          month: holidayData.date.getMonth() + 1,
          day: holidayData.date.getDate(),
          name: holidayData.name
        });
        
        if (!existingHoliday) {
          const holiday = new Holiday({
            ...holidayData,
            createdBy: '000000000000000000000000' // System user ID
          });
          
          await holiday.save();
          console.log(`✅ Created holiday: ${holidayData.name} (${holidayData.date.toDateString()})`);
        } else {
          console.log(`⏭️  Holiday already exists: ${holidayData.name} (${holidayData.date.toDateString()})`);
        }
      }
    }
    
    console.log('🎉 Holiday initialization completed successfully!');
    
    // Display summary
    const totalHolidays = await Holiday.countDocuments();
    console.log(`📊 Total holidays in database: ${totalHolidays}`);
    
    const activeHolidays = await Holiday.countDocuments({ isActive: true });
    console.log(`✅ Active holidays: ${activeHolidays}`);
    
    const inactiveHolidays = await Holiday.countDocuments({ isActive: false });
    console.log(`❌ Inactive holidays: ${inactiveHolidays}`);
    
  } catch (error) {
    console.error('❌ Error initializing holidays:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the initialization
initializeHolidays(); 