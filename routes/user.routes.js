const express = require('express');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
 const userModel = require('./config/models/user.model'); 
 const CreatorRequest = require('./config/models/Creatorrequest');
  const Otp = require('./config/models/otpmodel');
 const Movie = require('./config/models/moviemodel');   
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const path = require('path');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const passport = require("passport");
const session = require('express-session');
const sendOtpEmail = require('../utils/mailer');
const multer = require('multer');
const storageMulter = multer.memoryStorage();
const upload = multer({ storage: storageMulter });
const cookieParser = require('cookie-parser');
const app = express();
const router = express.Router();
const { Dropbox } = require("dropbox");
const fs = require("fs");
const fetch = require('node-fetch');



// ✅ SSE for progress
let clients = [];
router.get('/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients.push(res);

  req.on('close', () => {
    clients = clients.filter(c => c !== res);
  });
});

function broadcastProgress(percent) {
  clients.forEach(res => {
    res.write(`data: ${percent}\n\n`);
  });
}

// so your upload route
  const dbx = new Dropbox({
    
    accessToken: process.env.DROPBOX_ACCESS_TOKEN,
    fetch: fetch
  });

  // Exchange refresh token for access token


(async () => {
  try {
    const account = await dbx.usersGetCurrentAccount();
    console.log("Connected as:", account.result.name.display_name);
  } catch (err) {
    console.error("Dropbox auth failed:", err);
  }
})();

router.use(cookieParser());
const { body ,validationResult } = require('express-validator');
const { useReducer } = require('react');

router.use(
  session({
    secret: "!@#$%^&*()QWERTYUIOPqwertyuiop_+-=",  
    resave: false,
    saveUninitialized: true,
  })
);


router.use(passport.initialize());
router.use(passport.session());


passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
      
        let user = await userModel.findOne({ email: profile.emails[0].value });

        if (!user) {
         
          user = new userModel({
            googleId: profile.id,
            username: profile.displayName,
            email: profile.emails[0].value,
          });
          await user.save();
        } else if (!user.googleId) {
         
          user.googleId = profile.id;
          await user.save();
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);


passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
  const user = await userModel.findById(id);
  done(null, user);
});




router.get(
  "/auth/google", 
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/user/home" }),
  async (req, res) => {
    try {
      const user = req.user;

     
      const token = jwt.sign(
        { id: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      
      res.cookie("token", token, { httpOnly: true });

      
      res.redirect("/user/netflex/home");
    } catch (err) {
      console.error("Google login error:", err);
      res.redirect("/user/home");
    }
  }
);

 const authenticate = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(400).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // now req.user contains { userId, username, role, email }
    next();
  } catch (err) {
    console.log('Invalid token:', err.message);
    return res.status(401).json({message: 'invalid tokenn'}) // redirect if token is invalid
  }
};
router.get('/home', (req,res) => {
  res.render('home');
}
);
router.get('/netflex/home',authenticate, async (req, res) => {
  try {
    const movies = await Movie.find(); 
    res.render('netflexhome', { role: req.user.role, movies });; 
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});





router.get('/netflex/tvshows',authenticate, (req, res) => {
  res.render('netflextvshows',{ role: req.user.role}); 
});

router.get('/netflex/setting/profile', (req, res) => {
  res.render('settingprofile'); 
});
router.get('/netflex/setting/admin', (req, res) => {
  res.render('settingadmin'); 
});
router.get('/netflex/setting/creator', (req, res) => {
  res.render('settingcreator'); 
});
router.get('/netflex/setting/security', (req, res) => {
  res.render('settingsecurity'); 
});
router.get('/netflex/setting/subscription', (req, res) => {
  res.render('settingsubscription'); 
});
router.get('/netflex/setting/notifications', async (req, res) => {
    try {
        const notifications = await Notification.findOne({ userId: req.user._id })
        res.render('settingnotifications', { notifications });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });

    }
} );
router.get('/netflex/setting/language', (req, res) => {
  res.render('settinglanguage'); 
});
router.get('/netflex/setting/playback', (req, res) => {
  res.render('settingplayback'); 
});
router.get('/netflex/setting/devices', (req, res) => {
  res.render('settingdevices'); 
});
router.get('/netflex/setting/help', (req, res) => {
  res.render('settinghelp'); 
});

router.get('/register', (req, res) =>
     {res.render('register');

    })
    router.post('/register', 
            body('email').trim().isEmail().isLength({min: 10}),
        body('password').trim().isLength({min: 5 }),
        body('username').trim().isLength({min: 3}),  
        async (req, res) => 
       {
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
           return res.status(400).json({
          message: 'invalid data'
           })}
        
            const { username, email, password } = req.body;
         
            const existingUser = await userModel.findOne({ $or: [{ email }, { username }] });
            if (existingUser) {
                return res.status(400).json({
                    message: 'Username or email already exists'
                })
            }
//otp generation
 const otp = Math.floor(100000 + Math.random() * 900000).toString();
   console.log("Generated OTP for", email, "is:", otp);
    await Otp.create({ email, otp, username, password });

   //send otp to email
               await sendOtpEmail(email, otp);

   

    res.render("verify", { email });
 console.log('otp sent to : ',email);
  }
);
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  // Find OTP record
  const record = await Otp.findOne({ email, otp });
  console.log(record);
  if (!record) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  // Hash password before saving
  const hashedPassword =  await bcrypt.hash(record.password, 10);  

  // Create user
  const newUser = new userModel({
    username: record.username,
    email: record.email,
    password: hashedPassword,
  });
  await newUser.save();

  // Delete OTP after use
  await Otp.deleteMany({ email });

  return res.redirect('/user/login');
});

router.get('/login', (req, res) =>
     {res.render('login');

    })
    router.post('/login', 
            
        body('password').trim().isLength({min: 5 }),
        body('username').trim().isLength({min: 3}),  
        async (req, res) => 
       {
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
           return res.status(400).json({
          message: 'invalid data'
           })}
        
            const { username, password } = req.body;
            const user = await userModel.findOne({
                username : username })
            if (!user) {
                return res.status(404).json({
                    message: 'Username or password is incorrect'
                })
            }
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({
                    message: 'Username or password is incorrect '
                 }) }
        
                
        console.log( "user found", user);
            const token = jwt.sign({
                 userId: user._id,
                 email: user.email,
                    username: user.username,
                    role: user.role
                }, 
                process.env.JWT_SECRET, 
            ) 
            res.cookie('token',token
            )
            res.redirect('/user/netflex/home');


                
          }  )
          router.post('/netflex/setting/creator', async (req, res) => {
            try {
              const token = req.cookies.token;
              if (!token) {
                return res.status(401).json({ message: 'Unauthorized' });
              }
      
              const decoded = jwt.verify(token, process.env.JWT_SECRET);
              const userId = decoded.userId;
      
              // Check if the user has already applied
              const existingRequest = await CreatorRequest.findOne({ userId });
              if (existingRequest) {
                return res.status(400).json({ message: 'You have already applied for creator status.' });
              }
      
              // Create a new creator request
              const newRequest = new CreatorRequest({ userId });
              await newRequest.save();
      
//res.status(200).json({ message: 'Creator request submitted successfully.' });
              res.redirect('/user/netflex/setting?msg=Creator request submitted successfully.');
            } catch (error) {
              console.error('Error submitting creator request:', error);
              res.status(500).json({ message: 'Internal server error' });
            }
          });
          router.post('/netflex/setting/logout', (req, res) => {
            res.clearCookie('token');
            res.redirect('/user/login');
          });
         

router.get  ('/netflex/setting',authenticate, (req,res) => {
  res.render('netflexsetting', {role: req.user.role});
});
// Middleware to check role
function requireCreator(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.status(401).send('Access denied. No token provided.');

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'creator' && decoded.role !== 'admin') {
            return res.status(403).send('Access denied. Only creators can upload trailers.');
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(400).send('Invalid token');
    }
}


router.get('/netflex/upload', requireCreator, (req, res) => {
try {
    res.render('netflexupload',{role: req.user.role}); // <- view file
 }
catch (err) {
      console.error("Google login error:", err);}}
 );


function makeDirectLink(url) {
  return url.replace("www.dropbox.com", "dl.dropboxusercontent.com").replace("?dl=0", "");
}
 // SSE endpoint for progress
router.get('/upload-progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.(); // some Express versions need this

  // Keep clients in a global array
  if (!global.clients) global.clients = [];
  global.clients.push(res);

  req.on('close', () => {
    global.clients = global.clients.filter(c => c !== res);
  });
});

// Broadcast helper
function broadcastProgress(percent) {
  if (global.clients && global.clients.length > 0) {
    global.clients.forEach(client => {
      client.write(`data: ${percent}\n\n`);
    });
  }
}
async function uploadLargeFile(dbx, fileBuffer, filePath, onProgress) {
  const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB chunks
  let offset = 0;
  let sessionId = null;

  while (offset < fileBuffer.length) {
    const chunk = fileBuffer.slice(offset, offset + CHUNK_SIZE);

    if (offset === 0) {
      const response = await dbx.filesUploadSessionStart({ contents: chunk });
      sessionId = response.result.session_id;
    } else {
      await dbx.filesUploadSessionAppendV2({
        cursor: { session_id: sessionId, offset },
        contents: chunk,
      });
    }

    offset += chunk.length;

    if (onProgress) {
      const percent = Math.round((offset / fileBuffer.length) * 100);
      onProgress(percent);
    }
  }

  await dbx.filesUploadSessionFinish({
    cursor: { session_id: sessionId, offset },
    commit: { path: filePath, mode: 'add', autorename: true },
  });
    }
     router.post(
  '/netflex/upload',
  requireCreator,
  upload.fields([
    { name: 'poster', maxCount: 1 },
    { name: 'movie', maxCount: 1 },
      { name: 'actressPhotos', maxCount: 10 },
  ]),
  async (req, res) => {
    try {
    
      const account = await dbx.usersGetCurrentAccount();
  console.log("Dropbox connected as:", account.result.name.display_name);

    let posterUrl = null;
      let actressUrl = [];
      let movieUrl = null;

      // Poster upload
      if (req.files['poster']) {
        const posterFile = req.files['poster'][0];
        const posterPath = "/" + Date.now() + "-" + posterFile.originalname;

        await dbx.filesUpload({ path: posterPath, contents: posterFile.buffer });
        const link = await dbx.sharingCreateSharedLinkWithSettings({ path: posterPath });
 posterUrl = makeDirectLink(link.result.url);
      }
        if (req.files['actressPhotos']) {
        for (let file of req.files['actressPhotos']) {
          const photoPath = "/" + Date.now() + "-" + file.originalname;

          await dbx.filesUpload({ path: photoPath, contents: file.buffer });
          const link = await dbx.sharingCreateSharedLinkWithSettings({ path: photoPath });
 actressUrl.push(makeDirectLink(link.result.url));
        }
      }	                  	                                  
console.log("Movie body data:", req.body);

       
        const movieFile = req.files['movie'][0];
        console.log("Buffer type:", Buffer.isBuffer(movieFile.buffer));
  console.log("Buffer length:", movieFile.buffer.length);
        const moviePath = "/movies/" + Date.now() + "-" + movieFile.originalname;
       if (movieFile.size < 10 * 1024 * 1024) {
        let simulatedPercent = 0;
  const interval = setInterval(() => {
    if (simulatedPercent < 90) {
      simulatedPercent += 10;
      broadcastProgress(simulatedPercent);
    }
  }, 300); // every 300ms
    // Small file, normal upload
    await dbx.filesUpload({ path: moviePath, contents: movieFile.buffer });
       clearInterval(interval);
  broadcastProgress(100);
  console.log("Upload complete (small file).");
  } else {
        await uploadLargeFile(dbx, movieFile.buffer, moviePath, (percent) => {
          console.log(`Upload progress: ${percent}%`);
          broadcastProgress(percent); // sends updates to frontend via SSE
        });
      }
        const link = await dbx.sharingCreateSharedLinkWithSettings({ path: moviePath });
 movieUrl = makeDirectLink(link.result.url);
                       	                                            	      	                                   
                            	      	         
       	                  	          
// Build movie data object
let movieData = {
  title: req.body.title,
  description: req.body.description,
  year: req.body.year,
  country: req.body.country,
  type: req.body.type,
  genre: req.body.genre,
  audioLanguages: req.body.audioLanguages ? req.body.audioLanguages.split(',').map(a => a.trim()) : [],
  director: req.body.director,
  cast: req.body.cast ? req.body.cast.split(',').map(c => c.trim()) : [],
  duration: req.body.duration,
  tags: req.body.tags ? req.body.tags.split(',').map(t => t.trim()) : [],
  rating: req.body.rating,
  posterUrl: posterUrl,
  actressPhotos: actressUrl,
  uploadedBy: req.user.userId
};

if (req.body.type === "movie" || req.body.type === "song" ) {
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

router.post('/netflex/movie/:movieId/season/:seasonNumber/complete', authenticate, async (req, res) => {
  try {
    const { movieId, seasonNumber } = req.params;
    const movie = await Movie.findById(movieId);
    if (!movie) return res.status(404).send('Movie not found');

    const season = movie.seasonsUrl.find(s => s.seasonNumber == seasonNumber);
    if (!season) return res.status(404).send('Season not found');
   
      if (
        req.user.role !== 'admin' &&
        movie.uploadedBy.toString() !== req.user.userId
      ) return res.status(403).send('Not allowed');

    season.isCompleted = true; // ✅ Mark it complete
    const newSeason = {
      seasonNumber: movie.seasonsUrl.length + 1,
      title: `Season ${movie.seasonsUrl.length + 1}`,
      episodes: [],
      isCompleted: false
    };
    movie.seasonsUrl.push(newSeason);

    
    await movie.save();

    res.redirect(`/user/netflex/movie/${movieId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

  router.get('/netflex/movie/:id',authenticate, async (req, res) => {
  const movie = await Movie.findById(req.params.id);
 let currentEpisode = null;
 if (movie.type === 'series' && movie.seasonsUrl.length > 0) {
    // pick first season and first episode by default
    const firstSeason = movie.seasonsUrl[0];
    if (firstSeason.episodes.length > 0) {
      currentEpisode = firstSeason.episodes[0];
    }
  }
    const suggestedMovies = await Movie.find({
    	    _id: { $ne: movie._id },
    	        genre: { $in: movie.genre }
    	          }).limit(6);
    
  res.render('movieDetails', { movie , role: req.user.role,suggestedMovies, user: req.user ,currentEpisode , season: movie.seasonsUrl})
});
     
router.post('/netflex/mylist/:movieId',authenticate, async (req, res) => {
  try {
    const user = await userModel.findById(req.user.userId);
    if (!user.myList.includes(req.params.movieId)) {
      user.myList.push(req.params.movieId);
      await user.save();
    }
    res.redirect('/user/netflex/mylist');
  } catch (err) {
    console.error('Error adding to My List:', err);
    res.status(500).send('Failed to add to My List');
  }
});


router.get('/netflex/mylist', authenticate, async (req, res) => {
  try {
    const user = await userModel.findById(req.user.userId).populate('myList');
    console.log("Fetched My List:", user.myList);
    res.render('netflexmylist', { movies: user.myList || [], role: req.user.role }); 
  } catch (err) {
    console.error('Error fetching My List:', err);
    res.status(500).send('Failed to load My List'); 
  }
});


router.get('/netflex/search',authenticate, async (req, res) => {
  try {
    const query = req.query.query || "";

    
    let movies = [];
    if (query) {
      movies = await Movie.find({
        title: { $regex: query, $options: "i" } 
      });
    }

    res.render("netflexsearch", { movies,query, role: req.user.role  }); 
  } catch (err) {
    console.error("Error searching movies:", err);
    res.status(500).send("Failed to search movies");
  }
});

async function uploadLargeFile(dbx, buffer, dropboxPath, onProgress) {
  const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB per chunk
  let offset = 0;
  let sessionId = null;

  while (offset < buffer.length) {
    const chunk = buffer.slice(offset, offset + CHUNK_SIZE);

    if (offset === 0) {
      // Start session
      const res = await dbx.filesUploadSessionStart({ contents: chunk });
      sessionId = res.result.session_id;
    } else if (offset + CHUNK_SIZE < buffer.length) {
      // Append
      await dbx.filesUploadSessionAppendV2({
        cursor: { session_id: sessionId, offset },
        contents: chunk
      });
    } else {
      // Finish
      await dbx.filesUploadSessionFinish({
        cursor: { session_id: sessionId, offset },
        commit: { path: dropboxPath, mode: 'add', autorename: true, mute: false },
        contents: chunk
      });
    }

    offset += CHUNK_SIZE;
    let percent = Math.round((offset / buffer.length) * 100);
    if (onProgress) onProgress(percent); // callback for progress
  }
}
// Movie download route
router.get('/movies/:id/download', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie || !movie.movieUrl) {
      return res.status(404).send('Movie not found');
    }

    const fileUrl = movie.movieUrl;

    // Set headers so it downloads instead of streaming in browser
    res.setHeader('Content-Disposition', `attachment; filename="${movie.title}.mp4"`);

    // Stream the file from Dropbox to user
    const response = await fetch(fileUrl);
    response.body.pipe(res);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).send("Download failed");
  }
});

 // Mark a season as completed

router.post(
  "/netflex/movieDetails/add-episode/:movieId",
  requireCreator,
  upload.single("episodeFile"),
  async (req, res) => {
    try {
      
const movie = await Movie.findById(req.params.movieId).exec();
      console.log("req.user:", req.user);
console.log("movie.uploadedBy:", movie.uploadedBy);
console.log("movie.type:", movie.type);

      if (!movie || movie.type !== "series") {
        return res.status(400).send("Invalid series ID");
      }
if (
  req.user.role !== "admin" &&
  (!movie.uploadedBy || movie.uploadedBy.toString() !== req.user.userId)
) {
  return res.status(403).send("Not allowed to add episodes");
}

      let episodeUrl = null;
      if (req.file) {
        const episodePath = "/episodes/" + Date.now() + "-" + req.file.originalname;

        if (req.file.size < 150 * 1024 * 1024) {
          await dbx.filesUpload({ path: episodePath, contents: req.file.buffer });
        } else {
          await uploadLargeFile(dbx, req.file.buffer, episodePath);
        }
        const link = await dbx.sharingCreateSharedLinkWithSettings({ path: episodePath });
        episodeUrl = makeDirectLink(link.result.url);
      }
let lastSeason = movie.seasonsUrl[movie.seasonsUrl.length - 1];

    // ✅ If no season exists OR last season is completed → create new season
    if (!lastSeason || lastSeason.isCompleted) {
      const newSeason = {
        seasonNumber: movie.seasonsUrl.length + 1,
        episodes: [],
        isCompleted: false
      };
      movie.seasonsUrl.push(newSeason);
      lastSeason = newSeason;
    }

    // ✅ Generate episode details
    const episodeNumber = lastSeason.episodes.length + 1;
    const newEpisode = {
      title: req.body.title || `Episode ${episodeNumber}`,
      episodeNumber: episodeNumber,
      description: req.body.description || "",
      videoUrl: episodeUrl,
      duration: req.body.duration
    };

    // ✅ Add episode to last season
    lastSeason.episodes.push(newEpisode);



      await movie.save();

      res.redirect("/user/netflex/home");
    } catch (err) {
      console.error("Error adding episode:", err);
      
      res.status(500).json({
    message: "Failed to add episode",
    error: err.message,
    stack: err.stack
  });
    }
  }
);

router.post(
  '/netflex/movie/:movieId/episode/:episodeNumber/delete',
  requireCreator,
  async (req, res) => {
    try {
      const { movieId, episodeNumber } = req.params;
      const movie = await Movie.findById(movieId);

      if (!movie || movie.type !== 'series') return res.status(400).send('Invalid series');

      if (
        req.user.role !== 'admin' &&
        movie.uploadedBy.toString() !== req.user.userId
      ) return res.status(403).send('Not allowed');

      // Remove the episode
      movie.seasonsUrl[seasonIndex].episodes = movie.seasonsUrl[seasonIndex].episodes.filter(
  ep => ep.episodeNumber != episodeNumber
);

// If no episodes left in this season, remove the season
if (movie.seasonsUrl[seasonIndex].episodes.length === 0) {
  movie.seasonsUrl.splice(seasonIndex, 1); // remove the whole season
}

// If no seasons left at all, delete the series
if (movie.seasonsUrl.length === 0) {
  await Movie.findByIdAndDelete(movie._id);
  return res.redirect('/user/netflex/home');
}
    } catch (err) {
      console.error(err);
      res.status(500).send('Failed to delete episode');
    }
  }
);
router.post(
  '/netflex/movie/:movieId/delete',
  requireCreator,
  async (req, res) => {
    try {
      const movie = await Movie.findById(req.params.movieId);
      if (!movie) return res.status(404).send('Video not found');

      if (
        req.user.role !== 'admin' &&
        movie.uploadedBy.toString() !== req.user.userId
      ) return res.status(403).send('Not allowed');

      await Movie.findByIdAndDelete(req.params.movieId);
      res.redirect('/user/netflex/home');
    } catch (err) {
      console.error(err);
      res.status(500).send('Failed to delete video');
    }
  }
);
router.post("/netflex/movie/:movieId/complete-series", authenticate, requireCreator, async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.movieId);
    if (!movie) return res.status(404).send("Movie not found");
 
      if (
        req.user.role !== 'admin' &&
        movie.uploadedBy.toString() !== req.user.userId
      ) return res.status(403).send('Not allowed');
    if (movie.type !== "series") {
      return res.status(400).send("Not a series");
    }
    // ✅ Mark ALL seasons as completed
    movie.seasonsUrl.forEach(season => (season.isCompleted = true));
    movie.isSeriesCompleted = true; // 👈 add new field in schema if not exists

    await movie.save();
    res.redirect(`/user/netflex/movie/${movie._id}`);
  } catch (err) {
    console.error("Error completing series:", err);
    res.status(500).send("Failed to complete series");
  }
});

 module.exports = router;
