const express = require('express');
const routerr = express.Router();

const { body, validationResult } = require('express-validator');
const userModel = require('./config/models/user.model');
const CreatorRequest = require('./config/models/Creatorrequest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;
const cookieParser = require('cookie-parser');
// Admin Dashboard
function isAdmin(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).send('Access Denied. No token provided.');
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        if (req.user.role !== 'admin')  {
            return res.status(403).send('Access Denied. Not an admin.');
        } next();
    } catch (error) {
        return res.status(400).send('Invalid token.');
    } }
    routerr.get('/netflex/setting/notifications', isAdmin, async (req, res) => {
        try {
            const requests = await CreatorRequest.find({ status: 'pending' }).populate('userId');
            res.render('adminNotifications', { requests });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error' });
        } 

    });
    routerr.post('/netflex/setting/notifications/:id/approve', isAdmin, async (req, res) => {
        try {
            const requestId = req.params.id;
            const request = await CreatorRequest.findById(requestId);
            if (!request) {
                return res.status(404).json({ message: 'Request not found' });
            }
            request.status = 'approved';
            request.reviewedAt = new Date();
            await request.save();
            await userModel.findByIdAndUpdate(request.userId, { role: 'creator' });
            res.redirect('/admin/netflex/setting/notifications');
        } catch (error) {
            res.status(500).json({ message: 'Internal server error' });
        }
    });
    routerr.post('/ntflex/setting/notifications/:id/reject', isAdmin ,async (req,res) => {
        try{
            const requestId = req.params.id;
            const request = await CreatorRequest.findById(requestId);
            if(!request){
                return res.status(400).json({message: 'Request not found'});
            }
                request.status = 'rejected';
                request.reviewedAt = new Date();
                await request.save();
                res.redirect('/admin/netflex/setting/notifications');
        }catch(error){
            res.status(500).json({message: 'Internal server error'});
        }
    })
    module.exports = routerr;
