const mongoose = require('mongoose');
const creatorRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    requestedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
    reviewComments: { type: String },
});
const CreatorRequest = mongoose.model('CreatorRequest', creatorRequestSchema);
module.exports = CreatorRequest;