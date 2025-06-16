const mongoose = require('mongoose');

const superheroSchema = new mongoose.Schema({
  apiId: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  fullName: { type: String },
  image: { type: String },
  publisher: { type: String },
  biography: {
    fullName: String,
    alterEgos: String,
    aliases: [String],
    placeOfBirth: String,
    firstAppearance: String,
    publisher: String,
    alignment: String
  },
  appearance: {
    gender: String,
    race: String,
    height: [String],
    weight: [String],
    eyeColor: String,
    hairColor: String
  },
  work: {
    occupation: String,
    base: String
  },
  connections: {
    groupAffiliation: String,
    relatives: String
  },
  powerstats: {
    intelligence: String,
    strength: String,
    speed: String,
    durability: String,
    power: String,
    combat: String
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create text index for search functionality
superheroSchema.index({ 
  name: 'text', 
  fullName: 'text', 
  'biography.publisher': 'text',
  'biography.aliases': 'text'
});

module.exports = mongoose.model('Superhero', superheroSchema);
