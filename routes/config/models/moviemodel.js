const mongoose = require('mongoose');
const episodeSchema =new mongoose.Schema ({
  episodeNumber : {type: Number , default: 1},
  title: {type: String},
  description: {type: String},
  videoUrl: {type: String},
  duration: {type: Number},
  releaseDate: {type: Date},
  createdAt: {type: Date, default: Date.now}

})
const seasonSchema = new mongoose.Schema({
  seasonNumber: { type: Number, default: 1 },
  title: { type: String, },
  episodes: { type: [episodeSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  isCompleted: { type: Boolean, default: false } 
});
const movieSchema = new mongoose.Schema({
  type: { type: String, enum: ['movie', 'series','song'], required: true },
  title: { type: String, required: true },           
  description: { type: String },                       
  posterUrl: { type: String, required: true },     
   isSeriesCompleted: { type: Boolean, default: false },      
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 

  // New Fields
  year: { type: Number },                              
  country: { type: String },                            
  genre: {
      type: [String],
      enum: ["Drama", "Action","tvshows", "Comedy", "Horror", "Romance", "Sci-Fi", "Thriller", "Adventure", "Fantasy"],
      default: []
    },                        
  audioLanguages: { type: [String], default: ['English'] },
  director: { type: String },                           
  cast: { type: [String] },                             
  duration: { type: Number },                           
  tags: { type: [String] },                             
  rating: { type: Number, min: 0, max: 10 },          
   actressPhotos: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
  movieUrl: {
    type: String,
    required: function() { return this.type === 'movie' || this.type === 'song'; }
  },
  seasonsUrl: {  
    type: [seasonSchema],   
    validate: {
      validator: function(val) {
        return this.type !== 'series' || (val && val.length > 0);
      },
      message: 'Series must have at least one season.'
    }
  }
});

module.exports = mongoose.model('Movie', movieSchema);
