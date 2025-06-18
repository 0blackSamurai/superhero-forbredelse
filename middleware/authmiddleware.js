const jwt = require('jsonwebtoken');
const User = require('../models/usermodel');
const Favorite = require('../models/favoritemodel');
const mongoose = require('mongoose');

// Middleware to set authentication status for all routes
const setAuthStatus = async (req, res, next) => {
  try {
    const token = req.cookies.user;
    
    if (!token) {
      res.locals.isAuthenticated = false;
      res.locals.userFavorites = [];
      return next();
    }

    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️  MongoDB not connected, clearing auth cookie');
      res.clearCookie('user');
      res.locals.isAuthenticated = false;
      res.locals.userFavorites = [];
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      res.clearCookie('user');
      res.locals.isAuthenticated = false;
      res.locals.userFavorites = [];
      return next();
    }

    res.locals.isAuthenticated = true;
    res.locals.username = user.username;
    
    // Get user's favorite superhero API IDs
    const favorites = await Favorite.find({ userId: user._id }).select('superheroApiId');
    res.locals.userFavorites = favorites.map(fav => fav.superheroApiId);
    
    next();
  } catch (error) {
    console.error('Auth status error:', error.message);
    res.clearCookie('user');
    res.locals.isAuthenticated = false;
    res.locals.userFavorites = [];
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
        isAuthenticated: false
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

module.exports = {
  setAuthStatus,
  requireAuth
};