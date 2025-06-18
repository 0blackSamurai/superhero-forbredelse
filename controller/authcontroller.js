const User = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
    console.log("hei")
    const { username, epost, passord, confirmpassord } = req.body;

    try {
        // Validate input
        if (!username || !epost || !passord || !confirmpassord) {
            return res.status(400).send('All fields are required');
        }

        if (passord !== confirmpassord) {
            return res.status(400).send('Passwords do not match');
        }

        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [{ epost }, { username }] 
        });
        
        if (existingUser) {
            return res.status(400).send('User with this email or username already exists');
        }

        // Hash password
        SALTROUNDS=process.env.SALTROUNDS;
        try {
            SALTROUNDS = parseInt(SALTROUNDS, 10); // Ensure it's an integer
            if (isNaN(SALTROUNDS) || SALTROUNDS <= 0) {
                throw new Error('Invalid SALTROUNDS value');
            }
        } catch (error) {
            console.error('Error parsing SALTROUNDS:', error);
            return res.status(500).send('Server error: Invalid SALTROUNDS value');
        }
        console.log("SALTROUNDS",SALTROUNDS)
        console.log(typeof SALTROUNDS)
         
        const hashedPassword = await bcrypt.hash(passord, SALTROUNDS);

        // Create new user
        console.log("creating new user")

        const newUser = new User({
            username,
            epost,
            passord: hashedPassword
        });
        console.log("new user",newUser)
        await newUser.save();
        console.log("new user saved")
        // Auto-login after registration
        const token = jwt.sign(
            { userId: newUser._id },
            process.env.JWT_SECRET,
            { expiresIn: '48h' }
        );
        
        res.cookie('user', token, { httpOnly: true });
        res.redirect('/profile');
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).send('Error registering user');
    }
};

exports.login = async (req, res) => {
    const { epost, passord } = req.body;
    
    try {
        // Find user by email
        const user = await User.findOne({ epost });

        if (!user) {
            return res.render('login', { 
                title: 'Login',
                error: 'User not found. Please check your email or register.' 
            });
        }

        // Compare password
        const isMatch = await bcrypt.compare(passord, user.passord);

        if (!isMatch) {
            return res.render('login', { 
                title: 'Login',
                error: 'Invalid password. Please try again.' 
            });
        }

        // Create token with correct userId property and include email
        const token = jwt.sign(
            { 
                userId: user._id.toString(), // Ensure userId is a string
                username: user.username,
                email: user.epost // Include email in the token
            },
            process.env.JWT_SECRET,
            { expiresIn: '48h' }
        );
        
        // Log token debug info (remove in production)
        console.log('Generated token with user ID:', user._id.toString());
        
        // Set HTTP-only cookie
        res.cookie('user', token, { 
            httpOnly: true,
            maxAge: 48 * 60 * 60 * 1000 // 48 hours
        });
        
        return res.redirect('/profile');
    } catch (error) {
        console.error('Login error:', error);
        res.render('login', {
            title: 'Login',
            error: 'An error occurred during login. Please try again.'
        });
    }
};

exports.logout = (req, res) => {
    try {
      res.clearCookie('user');
      res.redirect('/login');
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).send('An error occurred during logout');
    }
};

exports.renderRegisterPage = (req, res) => {
    // If already logged in, redirect to profile
    if (res.locals.isAuthenticated) {
        return res.redirect('/profile');
    }
    res.render('register', { title: 'Create Account' });
};

exports.renderLoginPage = (req, res) => {
    // If already logged in, redirect to profile
    if (res.locals.isAuthenticated) {
        return res.redirect('/profile');
    }
    res.render('login', { title: 'Login' });
};

exports.renderForgotPasswordPage = (req, res) => {
    // If already logged in, redirect to profile
    if (res.locals.isAuthenticated) {
        return res.redirect('/profile');
    }
    res.render('forgot-password', { title: 'Forgot Password' });
};

exports.forgotPassword = async (req, res) => {
    const { epost } = req.body;
    
    try {
        const user = await User.findOne({ epost });
        
        if (!user) {
            return res.status(404).json({
                success: false, 
                message: 'No account with that email address exists.'
            });
        }
        
     
        return res.status(200).json({
            success: true,
            message: 'If an account with that email exists, you will receive password reset instructions.'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred. Please try again later.'
        });
    }
};

exports.renderProfilePage = async (req, res) => {
    try {
        // Find user profile info
        const user = await User.findById(req.user.userId).select('-passord');
        
        if (!user) {
            return res.status(404).render('error', {
                title: 'User Not Found',
                message: 'User profile could not be found',
                error: { status: 404 }
            });
        }
        
        // Fetch user's favorites
        const Favorite = require('../models/favoritemodel');
        const favorites = await Favorite.find({ userId: req.user.userId })
            .populate('superheroId')
            .sort({ createdAt: -1 });
        
        // Extract the superhero data from favorites
        const favoriteHeroes = favorites
            .map(fav => fav.superheroId)
            .filter(hero => hero !== null);
        
        res.render('profile', {
            title: 'Your Profile',
            user,
            username: user.username,
            Favorite: favoriteHeroes,
            isAuthenticated: true
        });
    } catch (error) {
        console.error('Error rendering profile page:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load profile page',
            error: { status: 500 }
        });
    }
};