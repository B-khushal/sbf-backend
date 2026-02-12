// Test script to simulate the exact API call when changing order status to delivered
const express = require('express');
const mongoose = require('mongoose');
const Order = require('./models/Order');
const User = require('./models/User');

// Import the actual controller function
const { updateOrderStatus } = require('./controllers/orderController');

async function testRealOrderStatusUpdate() {
  console.log('🧪 Testing real order status update...');
  
  try {
    // Mock express request/response objects
    const mockReq = {
      params: {
        id: 'ORDER_ID_HERE' // You'll need to replace this with a real order ID
      },
      body: {
        status: 'delivered'
      },
      user: {
        _id: 'admin_user_id', // Mock admin user
        role: 'admin'
      }
    };

    const mockRes = {
      status: (code) => ({
        json: (data) => {
          console.log(`📤 Response ${code}:`, data);
          return mockRes;
        }
      }),
      json: (data) => {
        console.log('📤 Response 200:', data);
        return mockRes;
      }
    };

    console.log('🔄 Calling updateOrderStatus function directly...');
    console.log('📋 Order ID:', mockReq.params.id);
    console.log('📊 New Status:', mockReq.body.status);

    // Call the actual controller function
    await updateOrderStatus(mockReq, mockRes);

  } catch (error) {
    console.error('❌ Error in test:', error);
    console.error('Stack:', error.stack);
  }
}

console.log('⚠️  IMPORTANT: Replace ORDER_ID_HERE with a real order ID from your database');
console.log('📝 To get an order ID, check your admin panel or database');
console.log('');

// You can uncomment this line after setting a real order ID
// testRealOrderStatusUpdate(); 