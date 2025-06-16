const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/usermodel');
const Superhero = require('../models/superheromodel');
const { requireAuth, requireAdmin } = require('../middleware/authmiddleware');

const router = express.Router();

// Function to fetch and store superhero from API
async function fetchAndStoreSuperhero(id) {
  const apiKey = '5e6ac8ed8500cd90b760abd3753f7562';
  
  try {
    // Check if superhero already exists in database
    const existingHero = await Superhero.findOne({ apiId: id });
    if (existingHero) {
      return existingHero;
    }

    const response = await fetch(`https://superheroapi.com/api/${apiKey}/${id}`);
    
    if (response.ok) {
      const hero = await response.json();
      if (hero.response === 'success') {
        const superhero = new Superhero({
          apiId: parseInt(hero.id),
          name: hero.name,
          fullName: hero.biography?.['full-name'] || hero.name,
          image: hero.image?.url || '',
          publisher: hero.biography?.publisher || 'Unknown',
          biography: {
            fullName: hero.biography?.['full-name'] || '',
            alterEgos: hero.biography?.['alter-egos'] || '',
            aliases: hero.biography?.aliases || [],
            placeOfBirth: hero.biography?.['place-of-birth'] || '',
            firstAppearance: hero.biography?.['first-appearance'] || '',
            publisher: hero.biography?.publisher || '',
            alignment: hero.biography?.alignment || ''
          },
          appearance: {
            gender: hero.appearance?.gender || '',
            race: hero.appearance?.race || '',
            height: hero.appearance?.height || [],
            weight: hero.appearance?.weight || [],
            eyeColor: hero.appearance?.['eye-color'] || '',
            hairColor: hero.appearance?.['hair-color'] || ''
          },
          work: {
            occupation: hero.work?.occupation || '',
            base: hero.work?.base || ''
          },
          connections: {
            groupAffiliation: hero.connections?.['group-affiliation'] || '',
            relatives: hero.connections?.relatives || ''
          },
          powerstats: {
            intelligence: hero.powerstats?.intelligence || 'Unknown',
            strength: hero.powerstats?.strength || 'Unknown',
            speed: hero.powerstats?.speed || 'Unknown',
            durability: hero.powerstats?.durability || 'Unknown',
            power: hero.powerstats?.power || 'Unknown',
            combat: hero.powerstats?.combat || 'Unknown'
          }
        });

        await superhero.save();
        return superhero;
      }
    }
  } catch (error) {
    console.error(`Error fetching superhero ${id}:`, error);
    return null;
  }
  
  return null;
}

// Function to seed database with superheroes (improved)
async function seedSuperheroes(count = 50) {
  try {
    const existingCount = await Superhero.countDocuments();
    console.log(`Current superhero count: ${existingCount}`);
    
    if (existingCount >= count) {
      console.log(`Database already has ${existingCount} superheroes (target: ${count})`);
      return existingCount;
    }

    console.log(`Seeding ${count - existingCount} more superheroes...`);
    
    // Create a set of random IDs to avoid duplicates
    const existingApiIds = await Superhero.distinct('apiId');
    const randomIds = new Set();
    
    // Generate unique random IDs
    while (randomIds.size < (count - existingCount)) {
      const randomId = Math.floor(Math.random() * 731) + 1;
      if (!existingApiIds.includes(randomId)) {
        randomIds.add(randomId);
      }
    }

    console.log(`Generated ${randomIds.size} unique API IDs to fetch`);

    // Fetch superheroes in smaller batches to avoid overwhelming the API
    const batchSize = 5; // Reduced batch size for better reliability
    const idArray = Array.from(randomIds);
    let successCount = 0;
    
    for (let i = 0; i < idArray.length; i += batchSize) {
      const batch = idArray.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(idArray.length/batchSize)}: IDs ${batch.join(', ')}`);
      
      // Process batch sequentially for better reliability
      for (const id of batch) {
        try {
          const hero = await fetchAndStoreSuperhero(id);
          if (hero) {
            successCount++;
            console.log(`✓ Successfully stored: ${hero.name} (${successCount}/${idArray.length})`);
          } else {
            console.log(`✗ Failed to fetch hero with ID: ${id}`);
          }
        } catch (error) {
          console.error(`Error fetching hero ${id}:`, error.message);
        }
      }
      
      // Longer delay between batches to be respectful to the API
      if (i + batchSize < idArray.length) {
        console.log('Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const finalCount = await Superhero.countDocuments();
    console.log(`Seeding complete. Successfully added ${successCount} heroes. Total in database: ${finalCount}`);
    return finalCount;
  } catch (error) {
    console.error('Error in seedSuperheroes:', error);
    throw error;
  }
}

// Home route with pagination and search
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20; // Ensure we're showing 20 per page
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    // Check if database needs seeding
    const totalSuperheroes = await Superhero.countDocuments();
    console.log(`Total superheroes in database: ${totalSuperheroes}`);
    
    if (totalSuperheroes < 20) {
      console.log('Database has fewer than 20 superheroes, seeding...');
      
      // Seed synchronously to ensure we have data before rendering
      try {
        await seedSuperheroes(50);
        console.log('Seeding completed, checking count again...');
        const newCount = await Superhero.countDocuments();
        console.log(`After seeding: ${newCount} superheroes`);
      } catch (seedError) {
        console.error('Seeding failed:', seedError);
      }
    }

    // Build search query
    let query = {};
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { fullName: { $regex: search, $options: 'i' } },
          { publisher: { $regex: search, $options: 'i' } },
          { 'biography.publisher': { $regex: search, $options: 'i' } }
        ]
      };
    }

    // Get total count for pagination
    const totalResults = await Superhero.countDocuments(query);
    const totalPages = Math.ceil(totalResults / limit);

    console.log(`Query: ${JSON.stringify(query)}`);
    console.log(`Total results: ${totalResults}, Page: ${page}, Limit: ${limit}, Skip: ${skip}`);

    // Get superheroes with pagination
    const superheroes = await Superhero.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);

    console.log(`Found ${superheroes.length} superheroes on page ${page}`);

    // If we still don't have enough heroes after seeding, show what we have
    if (superheroes.length === 0 && totalResults === 0) {
      return res.render('index', {
        title: 'Superhero Explorer',
        superheroes: [],
        currentPage: 1,
        totalPages: 1,
        search: search,
        totalResults: 0,
        error: 'No superheroes found. Database seeding may have failed.',
        loading: false,
        isAuthenticated: res.locals.isAuthenticated,
        isAdmin: res.locals.isAdmin,
        userRole: res.locals.isAdmin ? 'Admin' : 'User'
      });
    }

    res.render('index', {
      title: 'Superhero Explorer',
      superheroes: superheroes,
      currentPage: page,
      totalPages: totalPages,
      search: search,
      totalResults: totalResults,
      error: null,
      loading: false,
      isAuthenticated: res.locals.isAuthenticated,
      isAdmin: res.locals.isAdmin,
      userRole: res.locals.isAdmin ? 'Admin' : 'User'
    });
  } catch (error) {
    console.error('Error loading home page:', error);
    res.render('index', {
      title: 'Superhero Explorer',
      superheroes: [],
      currentPage: 1,
      totalPages: 1,
      search: '',
      totalResults: 0,
      error: 'Failed to load superheroes: ' + error.message,
      loading: false,
      isAuthenticated: res.locals.isAuthenticated,
      isAdmin: res.locals.isAdmin,
      userRole: res.locals.isAdmin ? 'Admin' : 'User'
    });
  }
});

// Individual superhero route - Updated to use apiId primarily
router.get('/superhero/:id', async (req, res) => {
  try {
    const superheroId = req.params.id;
    let superhero;

    // Always try to find by apiId first (since it's shorter and what we're using in URLs)
    const apiId = parseInt(superheroId);
    if (!isNaN(apiId)) {
      superhero = await Superhero.findOne({ apiId: apiId });
    }
    
    // Only try MongoDB _id as fallback if it looks like a valid ObjectId
    if (!superhero && superheroId.match(/^[0-9a-fA-F]{24}$/)) {
      superhero = await Superhero.findById(superheroId);
    }

    if (!superhero) {
      // Try to fetch from API if not in database
      superhero = await fetchAndStoreSuperhero(apiId);
    }

    if (!superhero) {
      return res.status(404).render('error', {
        title: 'Superhero Not Found',
        message: 'The requested superhero could not be found.',
        error: { status: 404 },
        isAuthenticated: res.locals.isAuthenticated,
        isAdmin: res.locals.isAdmin,
        userRole: res.locals.userRole
      });
    }

    // Get 4 related superheroes from same publisher
    const relatedHeroes = await Superhero.find({
      apiId: { $ne: superhero.apiId }, // Use apiId instead of _id
      publisher: superhero.publisher
    }).limit(4);

    res.render('superhero', {
      title: superhero.name,
      superhero: superhero,
      relatedHeroes: relatedHeroes,
      isAuthenticated: res.locals.isAuthenticated,
      isAdmin: res.locals.isAdmin,
      userRole: res.locals.userRole
    });
  } catch (error) {
    console.error('Error loading superhero:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load superhero details',
      error: error,
      isAuthenticated: res.locals.isAuthenticated,
      isAdmin: res.locals.isAdmin,
      userRole: res.locals.userRole
    });
  }
});

// API endpoint to manually seed more superheroes (admin only)
router.post('/api/seed-superheroes', requireAuth, requireAdmin, async (req, res) => {
  try {
    const count = parseInt(req.body.count) || 20;
    await seedSuperheroes(count);
    res.json({ success: true, message: `Seeded ${count} superheroes` });
  } catch (error) {
    console.error('Error seeding superheroes:', error);
    res.status(500).json({ success: false, message: 'Failed to seed superheroes' });
  }
});

// Login routes
router.get('/login', (req, res) => {
  if (res.locals.isAuthenticated) {
    return res.redirect('/profile');
  }
  res.render('login', {
    title: 'Login',
    error: null,
    isAuthenticated: false,
    isAdmin: false,
    userRole: null
  });
});

router.post('/login', async (req, res) => {
  try {
    const { username, passord } = req.body;

    if (!username || !passord) {
      return res.render('login', {
        title: 'Login',
        error: 'Username and password are required',
        isAuthenticated: false,
        isAdmin: false,
        userRole: null
      });
    }

    const user = await User.findOne({
      $or: [{ username: username }, { epost: username }]
    });

    if (!user) {
      return res.render('login', {
        title: 'Login',
        error: 'Invalid credentials',
        isAuthenticated: false,
        isAdmin: false,
        userRole: null
      });
    }

    const isValidPassword = await bcrypt.compare(passord, user.passord);
    if (!isValidPassword) {
      return res.render('login', {
        title: 'Login',
        error: 'Invalid credentials',
        isAuthenticated: false,
        isAdmin: false,
        userRole: null
      });
    }

    const token = jwt.sign(
      { 
        userId: user._id, 
        username: user.username,
        isAdmin: user.isAdmin 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('user', token, { 
      httpOnly: true, 
      maxAge: 24 * 60 * 60 * 1000
    });

    if (user.isAdmin) {
      res.redirect('/admin/users');
    } else {
      res.redirect('/profile');
    }

  } catch (error) {
    console.error('Login error:', error);
    res.render('login', {
      title: 'Login',
      error: 'Server error. Please try again.',
      isAuthenticated: false,
      isAdmin: false,
      userRole: null
    });
  }
});

// Register routes
router.get('/register', (req, res) => {
  if (res.locals.isAuthenticated) {
    return res.redirect('/profile');
  }
  res.render('register', {
    title: 'Register',
    error: null,
    isAuthenticated: false,
    isAdmin: false,
    userRole: null
  });
});

router.post('/register', async (req, res) => {
  try {
    const { username, epost, passord, confirmPassword } = req.body;

    if (!username || !epost || !passord || !confirmPassword) {
      return res.render('register', {
        title: 'Register',
        error: 'All fields are required',
        isAuthenticated: false,
        isAdmin: false,
        userRole: null
      });
    }

    if (passord !== confirmPassword) {
      return res.render('register', {
        title: 'Register',
        error: 'Passwords do not match',
        isAuthenticated: false,
        isAdmin: false,
        userRole: null
      });
    }

    if (passord.length < 6) {
      return res.render('register', {
        title: 'Register',
        error: 'Password must be at least 6 characters long',
        isAuthenticated: false,
        isAdmin: false,
        userRole: null
      });
    }

    const existingUser = await User.findOne({
      $or: [{ username: username }, { epost: epost }]
    });

    if (existingUser) {
      return res.render('register', {
        title: 'Register',
        error: 'Username or email already exists',
        isAuthenticated: false,
        isAdmin: false,
        userRole: null
      });
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(passord, saltRounds);

    const newUser = new User({
      username,
      epost,
      passord: hashedPassword,
      isAdmin: false
    });

    await newUser.save();

    const token = jwt.sign(
      { 
        userId: newUser._id, 
        username: newUser.username,
        isAdmin: newUser.isAdmin 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('user', token, { 
      httpOnly: true, 
      maxAge: 24 * 60 * 60 * 1000 
    });

    res.redirect('/profile');

  } catch (error) {
    console.error('Registration error:', error);
    res.render('register', {
      title: 'Register',
      error: 'Server error. Please try again.',
      isAuthenticated: false,
      isAdmin: false,
      userRole: null
    });
  }
});

// Profile route
router.get('/profile', requireAuth, (req, res) => {
  res.render('profile', {
    title: 'Profile',
    username: req.user.username,
    isAuthenticated: true,
    isAdmin: res.locals.isAdmin,
    userRole: res.locals.isAdmin ? 'Admin' : 'User'
  });
});

// Admin users management route
router.get('/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}).select('-passord');
    const superheroCount = await Superhero.countDocuments();
    
    res.render('adminusers', {
      title: 'Admin - User Management',
      username: req.user.username,
      users: users,
      superheroCount: superheroCount,
      isAuthenticated: true,
      isAdmin: true,
      userRole: 'Admin'
    });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load user management',
      error: error,
      isAuthenticated: true,
      isAdmin: true,
      userRole: 'Admin'
    });
  }
});

// Logout route
router.post('/logout', (req, res) => {
  res.clearCookie('user');
  res.redirect('/login');
});

router.get('/logout', (req, res) => {
  res.clearCookie('user');
  res.redirect('/login');
});

module.exports = router;
