const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  superheroId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Superhero', 
    required: true 
  },
  superheroApiId: { 
    type: Number, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Ensure a user can't favorite the same hero twice
favoriteSchema.index({ userId: 1, superheroApiId: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
