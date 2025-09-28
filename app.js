const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();


   const { authenticate , requireCreator , uploadLargeFile  }= require('./routes/middleware');
  
   console.log("requireCreator type:", typeof requireCreator);
  console.log("authenticate type:", typeof authenticate);
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.log('MongoDB connection error:', err));
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// DB connect code (your existing)
// require('./routes/config/db')();
// Make logged-in user available in all EJS templates
app.use((req, res, next) => {
	  res.locals.user = req.user || null;
	    next();
	    });
// Import routers (keep your admin/user routers)
const adminRouter = require('./routes/adminroutes');
const userRouter = require('./routes/user.routes');

console.log("DEBUG userRoutes typeof:", typeof userRouter);
console.log("DEBUG userRoutes keys:", Object.keys(userRouter));
 // adapt to your file
app.use('/admin', adminRouter);
app.use('/user', userRouter);
const userRoute = require('./routes/user');
app.use('/user/netflex', userRoute);
// create http server + io
const server = http.createServer(app);
const io = new Server(server);
// Serve static files (if you have frontend JS/CSS in /public)

// mount flex router factory and pass io
const createFlexRouter = require('./routes/flex');
app.use('/netflex/flex', createFlexRouter(io));

// other app.use(...) keep them

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log('Server running on', PORT));
