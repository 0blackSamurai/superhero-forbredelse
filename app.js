require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET environment variable is not set!');
  process.exit(1);
}

if (!process.env.DB_URL) {
  console.error('❌ DB_URL environment variable is not set!');
  process.exit(1);
} else if (!process.env.DB_URL.startsWith('mongodb://') && !process.env.DB_URL.startsWith('mongodb+srv://')) {
  console.error('❌ Invalid DB_URL format. It must start with "mongodb://" or "mongodb+srv://"');
  console.error('Current value:', process.env.DB_URL);
  process.exit(1);
}

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cookieParser = require('cookie-parser');

const { setAuthStatus } = require('./middleware/authmiddleware.js');

const authRoutes = require('./router/authroutes');
// const userRoutes = require('./routes/userRoutes'); // Commented out - uncomment when userRoutes exists

// Initialize app
const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Add this middleware to log auth cookies on each request
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    const authCookie = req.cookies.user;
    console.log('Auth cookie present:', !!authCookie);
  }
  next();
});

app.use(setAuthStatus); // This MUST come before routes to properly set variables

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Database connection
console.log('⏳ Connecting to MongoDB...');
mongoose.connect(process.env.DB_URL, {
  socketTimeoutMS: 30000,
  serverSelectionTimeoutMS: 5000,
  bufferCommands: false,
  maxPoolSize: 10
})
  .then(() => {
    console.log("✅ Database connection successful");
  })
  .catch((err) => {
    console.error("❌ Database connection error:", err.message);
    console.error("📝 Instructions to fix:");
    console.error("1. Use MongoDB Atlas (recommended): Go to https://www.mongodb.com/atlas");
    console.error("2. Create a free account and cluster");
    console.error("3. Get your connection string and update DB_URL in .env file");
    console.error("4. Or install MongoDB locally and ensure it's running on port 27017");
    console.error("⚠️  Server will continue running but database operations will fail");
  });

// Handle MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  Mongoose disconnected from MongoDB');
});

// Routes
app.use('/', authRoutes);       // Auth routes first for login, register, etc.
// app.use('/user', userRoutes);   // User routes with prefix - uncomment when userRoutes exists

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  // If JSON is requested or it's an API route, return JSON error
  if (req.path.startsWith('/api') || 
     (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.status(500).json({ error: 'Server error', message: err.message });
  }

  // Otherwise render error page with appropriate locals
  res.status(500).render('error', { 
    title: 'Error',
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err : {},
    isAuthenticated: res.locals.isAuthenticated || false
  });
});

// 404 handler
app.use((req, res) => {
    const path = req.path;
    console.log(`404 Not Found: ${req.method} ${path}`);
    // If JSON is requested or it's an API route, return JSON error
    if (path.startsWith('/api') || 
       (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(404).json({ 
            error: 'Not Found', 
            message: `The requested URL ${path} was not found on this server.` 
        });
    }
    
    // Otherwise render error page
    res.status(404).render('error', { 
        title: 'Not Found',
        message: `Page not found: ${path}`, 
        error: {
            status: 404,
            stack: process.env.NODE_ENV === 'development' ? 
                `The route ${path} is not defined in your application.` : ''
        },
        isAuthenticated: res.locals.isAuthenticated || false
    });
});

// Start the server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server started on port ${PORT}`);
});