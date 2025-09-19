const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  message: String,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

// top-level reply pointer (for replyTo populate)
const flexFileSchema = new mongoose.Schema({
  message: { type: String, default: null },
  fileUrl: { type: String, default: null },       // shared link (direct)
  fileName: { type: String, default: null },
  fileType: { type: String, default: null },
  dropboxPath: { type: String, default: null },   // Dropbox path for deletion
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'FlexFile', default: null },
  replies: [replySchema],                          // nested replies (optional)
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // soft-delete per user
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('FlexFile', flexFileSchema);
