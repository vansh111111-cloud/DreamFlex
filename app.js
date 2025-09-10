const express = require('express');
const mongoose = require('mongoose');

const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const dotenv = require('dotenv');
dotenv.config();
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static("public"));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

const connectToDB = require('./routes/config/db');
connectToDB();
const adminRouter = require('./routes/adminroutes')
const userRouter = require('./routes/user.routes')
app.use(cookieParser()); 
app.use('/admin',adminRouter);
app.use(cookieParser());
app.set('view engine', 'ejs');
app.use(express.json())
app.use(express.urlencoded({ extended: true })) 
app.use('/user',userRouter);

const PORT = process.env.PORT || 3000;

         
app.listen(PORT, () => {
    console.log("Server is running on port " + PORT);
})