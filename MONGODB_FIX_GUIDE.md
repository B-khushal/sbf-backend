# MongoDB Atlas Connection Fix Guide

## Issue
Reviews are not saving because the server cannot connect to MongoDB Atlas due to IP whitelisting restrictions.

## Fix Steps

### 1. Update MongoDB Atlas IP Whitelist
1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Log into your account
3. Navigate to your cluster
4. Click "Network Access" in the left sidebar
5. Click "Add IP Address"
6. Choose one of these options:
   - **For Development**: Click "Add Current IP Address"
   - **For Production**: Add your server's IP address
   - **For Testing**: Add `0.0.0.0/0` (allows all IPs - NOT recommended for production)

### 2. Verify Connection String
Make sure your MONGODB_URI in the .env file looks like this:
```
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-name>.xxxxx.mongodb.net/<database-name>?retryWrites=true&w=majority
```

### 3. Test Connection
Run this command to test the connection:
```bash
node test-review-endpoint.js
```

### 4. Alternative: Use Local MongoDB (For Development)
If Atlas continues to have issues, you can use local MongoDB:
1. Install MongoDB locally
2. Update MONGODB_URI in .env:
```
MONGODB_URI=mongodb://localhost:27017/sbf-local
```

## Common Issues and Solutions

### Issue: "Authentication failed"
- Check username and password in connection string
- Ensure the database user has read/write permissions

### Issue: "Network timeout"
- Check internet connection
- Verify cluster is running
- Check firewall settings

### Issue: "IP not whitelisted"
- Follow step 1 above to add your IP
- Wait 2-3 minutes for changes to take effect

## Environment Variables Required
Make sure your .env file contains:
```
NODE_ENV=development
PORT=5000
MONGODB_URI=your-mongodb-atlas-connection-string
JWT_SECRET=your-long-random-jwt-secret-here
``` 