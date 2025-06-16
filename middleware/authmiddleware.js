const jwt = require('jsonwebtoken');
const User = require('../models/usermodel');
const mongoose = require('mongoose');

// Middleware to set authentication status for all routes
const setAuthStatus = async (req, res, next) => {
  try {
    const token = req.cookies.user;
    
    if (!token) {
      res.locals.isAuthenticated = false;
      res.locals.isAdmin = false;
      res.locals.userRole = null;
      return next();
    }

    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️  MongoDB not connected, clearing auth cookie');
      res.clearCookie('user');
      res.locals.isAuthenticated = false;
      res.locals.isAdmin = false;
      res.locals.userRole = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      res.clearCookie('user');
      res.locals.isAuthenticated = false;
      res.locals.isAdmin = false;
      res.locals.userRole = null;
      return next();
    }

    res.locals.isAuthenticated = true;
    res.locals.isAdmin = user.isAdmin;
    res.locals.userRole = user.isAdmin ? 'Admin' : 'User';
    res.locals.username = user.username;
    
    next();
  } catch (error) {
    console.error('Auth status error:', error.message);
    res.clearCookie('user');
    res.locals.isAuthenticated = false;
    res.locals.isAdmin = false;
    res.locals.userRole = null;
    next();
  }
};

// Middleware to require authentication
const requireAuth = async (req, res, next) => {
  try {
    const token = req.cookies.user;
    
    if (!token) {
      return res.redirect('/login');
    }

    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      return res.render('error', {
        title: 'Database Error',
        message: 'Database connection unavailable. Please try again later.',
        error: { status: 503 },
        isAuthenticated: false,
        isAdmin: false,
        userRole: null
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      res.clearCookie('user');
      return res.redirect('/login');
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    res.clearCookie('user');
    res.redirect('/login');
  }
};

// Middleware to require admin privileges
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).render('error', {
      title: 'Access Denied',
      message: 'Admin access required',
      error: { status: 403 },
      isAuthenticated: res.locals.isAuthenticated || false,
      isAdmin: false,
      userRole: res.locals.userRole || null
    });
  }
  next();
};

module.exports = {
  setAuthStatus,
  requireAuth,
  requireAdmin
};