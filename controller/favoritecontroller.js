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


