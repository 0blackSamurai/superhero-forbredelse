const Favorite = require('../models/favoritemodel');
const Superhero = require('../models/superheromodel');

// Function to fetch and store superhero from API if not in database
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

// Add or remove favorite
exports.toggleFavorite = async (req, res) => {
  try {
    const superheroApiId = parseInt(req.params.apiId);
    const userId = req.user._id;

    // Validate apiId
    if (isNaN(superheroApiId) || superheroApiId <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid superhero ID' 
      });
    }

    // Check if superhero exists in our database
    let superhero = await Superhero.findOne({ apiId: superheroApiId });
    
    if (!superhero) {
      // Fetch and store superhero if not in database
      superhero = await fetchAndStoreSuperhero(superheroApiId);
      if (!superhero) {
        return res.status(404).json({ 
          success: false, 
          message: 'Superhero not found' 
        });
      }
    }

    // Check if already favorited
    const existingFavorite = await Favorite.findOne({ 
      userId: userId, 
      superheroApiId: superheroApiId 
    });

    if (existingFavorite) {
      // Remove from favorites
      await Favorite.deleteOne({ _id: existingFavorite._id });
      console.log(`User ${userId} removed superhero ${superheroApiId} from favorites`);
      
      return res.json({ 
        success: true, 
        action: 'removed',
        message: 'Fjernet fra favoritter',
        superheroName: superhero.name
      });
    } else {
      // Add to favorites
      const newFavorite = new Favorite({
        userId: userId,
        superheroId: superhero._id,
        superheroApiId: superheroApiId
      });
      
      await newFavorite.save();
      console.log(`User ${userId} added superhero ${superheroApiId} to favorites`);
      
      return res.json({ 
        success: true, 
        action: 'added',
        message: 'Lagt til i favoritter',
        superheroName: superhero.name
      });
    }
  } catch (error) {
    console.error('Error managing favorite:', error);
    
    // Handle duplicate key error (in case of race condition)
    if (error.code === 11000) {
      return res.status(409).json({ 
        success: false, 
        message: 'Superhero is already in favorites' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Server error while managing favorite' 
    });
  }
};

// Get user's favorites
exports.getUserFavorites = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get total count
    const totalFavorites = await Favorite.countDocuments({ userId: userId });
    const totalPages = Math.ceil(totalFavorites / limit);

    // Get favorites with pagination
    const favorites = await Favorite.find({ userId: userId })
      .populate('superheroId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const favoriteHeroes = favorites
      .map(fav => fav.superheroId)
      .filter(hero => hero !== null);
    
    res.json({ 
      success: true, 
      favorites: favoriteHeroes,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalFavorites,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching favorites' 
    });
  }
};

// Get user's favorite superhero API IDs (for checking if superhero is favorited)
exports.getUserFavoriteIds = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const favorites = await Favorite.find({ userId: userId }).select('superheroApiId');
    const favoriteIds = favorites.map(fav => fav.superheroApiId);
    
    res.json({ 
      success: true, 
      favoriteIds: favoriteIds 
    });
  } catch (error) {
    console.error('Error fetching favorite IDs:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching favorite IDs' 
    });
  }
};

// Remove multiple favorites
exports.removeMultipleFavorites = async (req, res) => {
  try {
    const userId = req.user._id;
    const { superheroApiIds } = req.body;

    if (!Array.isArray(superheroApiIds) || superheroApiIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid superhero IDs provided' 
      });
    }

    // Validate all IDs are numbers
    const validIds = superheroApiIds.filter(id => Number.isInteger(id) && id > 0);
    if (validIds.length !== superheroApiIds.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'Some superhero IDs are invalid' 
      });
    }

    const result = await Favorite.deleteMany({ 
      userId: userId, 
      superheroApiId: { $in: validIds } 
    });

    console.log(`User ${userId} removed ${result.deletedCount} favorites`);

    res.json({ 
      success: true, 
      message: `Fjernet ${result.deletedCount} favoritter`,
      removedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error removing multiple favorites:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while removing favorites' 
    });
  }
};

// Check if superhero is favorited by user
exports.checkFavoriteStatus = async (req, res) => {
  try {
    const superheroApiId = parseInt(req.params.apiId);
    const userId = req.user._id;

    if (isNaN(superheroApiId) || superheroApiId <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid superhero ID' 
      });
    }

    const favorite = await Favorite.findOne({ 
      userId: userId, 
      superheroApiId: superheroApiId 
    });

    res.json({ 
      success: true, 
      isFavorited: !!favorite,
      favoriteId: favorite ? favorite._id : null
    });
  } catch (error) {
    console.error('Error checking favorite status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while checking favorite status' 
    });
  }
};

// Get favorite statistics for user
exports.getFavoriteStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const stats = await Favorite.aggregate([
      { $match: { userId: userId } },
      {
        $lookup: {
          from: 'superheroes',
          localField: 'superheroId',
          foreignField: '_id',
          as: 'superhero'
        }
      },
      { $unwind: '$superhero' },
      {
        $group: {
          _id: '$superhero.publisher',
          count: { $sum: 1 },
          heroes: { $push: '$superhero.name' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const totalFavorites = await Favorite.countDocuments({ userId: userId });

    res.json({ 
      success: true, 
      totalFavorites: totalFavorites,
      publisherStats: stats
    });
  } catch (error) {
    console.error('Error getting favorite stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while getting favorite statistics' 
    });
  }
};
