

const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer(); // memory storage
const { dbx , uploadFileToDropbox } = require('../routes/config/dropbox.js'); // path to your helper
const {  requireCreator , authenticate , uploadLargeFile  } = require('./middleware');
const { simulateProgress, broadcastProgress  } = require('../utils/progress.js');
const userRoutes = require('./user.routes'); // or '../user.routes' if in subfolder
console.log("userRoutes:", userRoutes);
console.log("requireCreator type:", typeof requireCreator);
console.log("authenticate type:", typeof authenticate);
console.log("dbx type:", typeof dbx);
router.post(
  '/netflex/upload',
  authenticate,
  (req, res, next) => {
    // show user, and compare function identity to what is loaded from disk
    console.log('DEBUG before requireCreator: req.user =', req.user);
    // the path below must be the exact path you use to require middleware in this file
    const mw = require('./middleware'); 
    console.log('DEBUG requireCreator identity check:', requireCreator === mw.requireCreator);
    console.log('DEBUG authenticate identity check:', authenticate === mw.authenticate);
    console.log('DEBUG mw module filename:', mw && mw.__filename ? mw.__filename : Object.keys(mw));
    next();
  },
 
   requireCreator,
  upload.fields([
    { name: 'poster', maxCount: 1 },
    { name: 'movie', maxCount: 1 },
    { name: 'actressPhotos', maxCount: 10 },
  ]),
  async (req, res) => {

  console.log('req.cookies:', req.cookies); // should include token
    console.log('req.user:', req.user);       // should now
    try {
    console.log('req.user:', req.user);
    console.log('Token from cookie:', token);
      // Dropbox account check
      const account = await dbx.usersGetCurrentAccount();
      console.log("Dropbox connected as:", account.result.name.display_name);

      let posterUrl = null;
      let actressUrl = [];
      let movieUrl = null;

      // --- Poster upload ---
      if (req.files['poster']) {
        const posterFile = req.files['poster'][0];
        const posterPath = "/" + Date.now() + "-" + posterFile.originalname;

        const { sharedUrl } = await uploadFileToDropbox(posterFile.buffer, posterPath, (percent) => {
          broadcastProgress(percent);
        });
        posterUrl = sharedUrl;
      }

      // --- Actress photos upload ---
      if (req.files['actressPhotos']) {
        for (let file of req.files['actressPhotos']) {
          const photoPath = "/" + Date.now() + "-" + file.originalname;

          const { sharedUrl } = await uploadFileToDropbox(file.buffer, photoPath, (percent) => {
            broadcastProgress(percent);
          });
          actressUrl.push(sharedUrl);
        }
      }

      // --- Movie upload ---
   // --- Movie upload ---
   if (req.files['movie']) {
     const movieFile = req.files['movie'][0];
     console.log("Buffer type:", Buffer.isBuffer(movieFile.buffer));
     console.log("Buffer length:", movieFile.buffer.length);
   
     const moviePath = "/movies/" + Date.now() + "-" + movieFile.originalname;
   
     // Simulate progress for small files
     let simulatedPercent = 0;
     const interval = setInterval(() => {
       if (simulatedPercent < 90) {
         simulatedPercent += 10;
         broadcastProgress(simulatedPercent);
       }
     }, 300);
   
     if (movieFile.size < 10 * 1024 * 1024) {
       // Small file: use your normal upload
       const { sharedUrl } = await uploadFileToDropbox(movieFile.buffer, moviePath);
       movieUrl = sharedUrl;
     } else {
       // Large file: use the exported uploadLargeFile
        // import at the top in practice
       await uploadLargeFile(dbx, movieFile.buffer, moviePath, (percent) => {
         broadcastProgress(percent); // actual upload progress
       });
   
       // After upload, generate shared link
       const link = await dbx.sharingCreateSharedLinkWithSettings({ path: moviePath });
       movieUrl = makeDirectLink(link.result.url);
     }
   
     clearInterval(interval);
     broadcastProgress(100);
     console.log("Upload complete for movie.");
   }

      console.log("Movie body data:", req.body);

      // --- Build movie data object ---
      let movieData = {
        title: req.body.title,
        description: req.body.description,
        year: req.body.year,
        country: req.body.country,
        type: req.body.type,
        genre: req.body.genre,
        audioLanguages: req.body.audioLanguages
          ? req.body.audioLanguages.split(',').map(a => a.trim())
          : [],
        director: req.body.director,
        cast: req.body.cast ? req.body.cast.split(',').map(c => c.trim()) : [],
        duration: req.body.duration,
        tags: req.body.tags ? req.body.tags.split(',').map(t => t.trim()) : [],
        rating: req.body.rating,
        posterUrl: posterUrl,
        actressPhotos: actressUrl,
        uploadedBy: req.user.userId
      };

      if (req.body.type === "movie" || req.body.type === "song") {
        movieData.movieUrl = movieUrl;
      }

      if (req.body.type === "series" && req.files['movie']) {
        movieData.seasonsUrl = [
          {
            seasonNumber: 1,
            title: "Season 1",
            episodes: [
              {
                title: req.body.episodeTitle || "Episode 1",
                episodeNumber: 1,
                description: req.body.episodeDescription || "First episode",
                videoUrl: movieUrl, // required
                duration: req.body.duration || 0,
                releaseDate: new Date()
              }
            ]
          }
        ];
      }

      const movie = new Movie(movieData);
      await movie.save();

      res.redirect('/user/netflex/home');
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);
module.exports = router;
