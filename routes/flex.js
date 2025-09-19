// routes/flex.js
const express = require('express');
const Busboy = require('busboy');
const mongoose = require('mongoose');
const { Dropbox } = require('dropbox');
const fetch = require('node-fetch');
const FlexFile = require('./config/models/FlexFile'); // adjust path if needed
const cookieParser = require('cookie-parser');

const DROPBOX_ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN;
if (!DROPBOX_ACCESS_TOKEN) {
  console.warn('No DROPBOX_ACCESS_TOKEN in env — Dropbox upload will fail');
}
const dbx = new Dropbox({ accessToken: DROPBOX_ACCESS_TOKEN, fetch });

/**
 * Helper: create upload session and stream chunks
 * Accepts an async generator of Buffer chunks (e.g. from Busboy file stream)
 * Returns { dropboxPath, sharedUrl }
 */
async function uploadStreamToDropbox(chunkAsyncIterator, destPath, onProgress = () => {}) {
  // prefer 8MB chunk sizes for Dropbox session
  const CHUNK_SIZE = 8 * 1024 * 1024;

  // accumulate chunks into chunk-sized buffers
  let sessionId = null;
  let offset = 0;
  let uploadedBytes = 0;

  // We'll maintain a buffer pool for the current chunk
  let bufferQueue = [];
  let bufferQueueLen = 0;

  async function flushAppend(isLast = false) {
    if (bufferQueueLen === 0) return;
    const combined = Buffer.concat(bufferQueue, bufferQueueLen);
    bufferQueue = [];
    bufferQueueLen = 0;

    if (!sessionId) {
      // start session
      const res = await dbx.filesUploadSessionStart({ contents: combined });
      sessionId = res.result.session_id;
      offset += combined.length;
    } else {
      // append
      await dbx.filesUploadSessionAppendV2({
        cursor: { session_id: sessionId, offset },
        contents: combined
      });
      offset += combined.length;
    }
    uploadedBytes += combined.length;
    onProgress(Math.round((uploadedBytes / estimatedSize) * 100));
  }

  // We need estimatedSize to report progress. We'll allow it to be set externally.
  // If not available, progress will still update roughly after each flush.
  let estimatedSize = 0;
  // We'll accept a special control: first yielded item can be { _meta: { size } }
  for await (const chunk of chunkAsyncIterator) {
    if (chunk && chunk._meta && typeof chunk._meta.size === 'number') {
      estimatedSize = chunk._meta.size;
      continue;
    }
    bufferQueue.push(chunk);
    bufferQueueLen += chunk.length;

    if (bufferQueueLen >= CHUNK_SIZE) {
      await flushAppend(false);
    }
  }

  // flush remainder and finish session
  
  if (!sessionId) {
    // file was small — only one combined buffer present
    const finalBuffer = Buffer.concat(bufferQueue, bufferQueueLen);
    const res = await dbx.filesUpload({ path: destPath, contents: finalBuffer, mode: { '.tag': 'add' } });
    // create shared link
    const link = await dbx.sharingCreateSharedLinkWithSettings({ path: res.result.path_lower || destPath });
    const directUrl = link.result.url.replace('?dl=0', '?raw=1').replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    return { dropboxPath: res.result.path_lower || destPath, sharedUrl: directUrl };
  } else {
    if (bufferQueueLen > 0) await flushAppend(true);
    // finish session
    await dbx.filesUploadSessionFinish({
      cursor: { session_id: sessionId, offset },
      commit: { path: destPath, mode: { '.tag': 'add' }, autorename: true, mute: false }
    });
    // create shared link
    const link = await dbx.sharingCreateSharedLinkWithSettings({ path: destPath });
    const directUrl = link.result.url.replace('?dl=0', '?raw=1').replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    return { dropboxPath: destPath, sharedUrl: directUrl };
  }
}

/**
 * chunkAsyncIterator must be an async generator which yields Buffer chunks,
 * and optionally one initial { _meta: { size } } object to indicate total size.
 */

function createFlexRouter(io) {
  const router = express.Router();
  router.use(cookieParser());

  // try to require authenticate from your user.routes
  let authenticate;
  try {
    authenticate = require('./user.routes').authenticate;
  } catch (e) {
    // fallback dummy (NOT recommended for production)
    authenticate = (req, res, next) => { req.user = { userId: req.cookies?.userId || null, username: req.cookies?.username || 'anon', role: 'user' }; next(); };
  }

  // GET list (do not show messages deleted for this user)
  router.get('/', authenticate, async (req, res) => {
    try {
      const files = await FlexFile.find({ deletedFor: { $ne: req.user.userId } })
        .sort({ createdAt: 1 })
        .populate('uploadedBy', 'username role')
        .populate('replyTo');
      res.render('flex', { files, role: req.user.role, userId: String(req.user.userId) });
    } catch (err) {
      console.error('Failed to load Flex chat', err);
      res.status(500).send('Failed to load Flex chat');
    }
  });

  // Direct streaming upload endpoint
  // We parse multipart via Busboy and forward file stream chunks to Dropbox upload session
  router.post('/upload', authenticate, (req, res) => {
    try {
      const busboy = Busboy({ headers: req.headers, limits: { fileSize: 5 * 1024 * 1024 * 1024 } }); // 5GB limit
      let formFields = {};
      let fileFieldInfo = null;
      let fileStreamEnded = false;
      let fileUploadPromise = null;

      // create async generator for chunks
      async function* chunkGenerator(fileStream, fileSize) {
        // first yield meta if known
        if (typeof fileSize === 'number') {
          yield { _meta: { size: fileSize } };
        }
        for await (const chunk of fileStream) {
          yield chunk;
        }
      }

      busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        // this file is a readable stream. We'll pass it to uploadStreamToDropbox
        fileFieldInfo = { fieldname, filename, encoding, mimetype, size: req.headers['content-length'] ? parseInt(req.headers['content-length'], 10) : null };
        const destPath = `/flex/${Date.now()}-${filename.replace(/\s+/g, '_')}`;

        // create async iterator from busboy file stream
        const asyncIter = chunkGenerator(file, null); // we don't know file size precisely per-file here
        // progress callback
        const onProgress = (percent) => {
          try {
            // attempt to send progress to uploader's socket room (user-specific)
            if (io && req.user && req.user.userId) {
              io.to(`user_${req.user.userId}`).emit('flex:uploadProgress', { percent, filename });
            }
          } catch (e) {}
        };

        // Start upload promise
        fileUploadPromise = (async () => {
          try {
            const { dropboxPath, sharedUrl } = await uploadStreamToDropbox(asyncIter, destPath, onProgress);
            return { dropboxPath, sharedUrl };
          } catch (e) {
            console.error('Dropbox upload failed', e);
            throw e;
          }
        })();
      });

      busboy.on('field', (name, val) => {
        formFields[name] = val;
      });

      busboy.on('close', async () => {
        try {
          // If there was a file upload, wait for it
          let fileResult = null;
          if (fileUploadPromise) {
            fileResult = await fileUploadPromise;
          }

          // Build DB doc
          const doc = {
            message: formFields.message || null,
            fileUrl: fileResult ? fileResult.sharedUrl : null,
            fileName: fileResult ? (fileFieldInfo.filename) : null,
            fileType: fileResult ? fileFieldInfo.mimetype : null,
            dropboxPath: fileResult ? fileResult.dropboxPath : null,
           // routes/flex.js, line 198
           uploadedBy: new mongoose.Types.ObjectId(req.user.userId),
            replyTo: formFields.replyTo ?new  mongoose.Types.ObjectId(formFields.replyTo) : null,
            createdAt: new Date()
          };

          const newFile = new FlexFile(doc);
          await newFile.save();
          await newFile.populate('uploadedBy', 'username role');
          await newFile.populate('replyTo');

          // broadcast new message
          if (io) io.emit('flex:new', {
            _id: newFile._id,
            message: newFile.message,
            fileUrl: newFile.fileUrl,
            fileName: newFile.fileName,
            fileType: newFile.fileType,
            uploadedBy: newFile.uploadedBy,
            replyTo: newFile.replyTo,
            createdAt: newFile.createdAt
          });

          // respond with success
          res.status(200).json({ ok: true });
        } catch (err) {
          console.error('Upload flow error', err);
          res.status(500).json({ error: err.message || 'Upload failed' });
        }
      });

      req.pipe(busboy);
    } catch (err) {
      console.error('Upload endpoint error', err);
      res.status(500).send('Upload failed');
    }
  });

  // Delete message: delete for me or delete for everyone
  router.delete('/delete/:id', authenticate, async (req, res) => {
    try {
      const id = req.params.id;
      const type = req.query.type || 'me';
      const file = await FlexFile.findById(id);
      if (!file) return res.status(404).json({ error: 'Not found' });

      const isOwner = String(file.uploadedBy) === String(req.user.userId);
      const isAdmin = req.user.role === 'admin';

      if (type === 'everyone') {
        if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Not allowed' });
        if (file.dropboxPath) {
          try { await dbx.filesDeleteV2({ path: file.dropboxPath }); } catch (e) { console.warn('dropbox delete err', e); }
        }
        await FlexFile.findByIdAndDelete(id);
        if (io) io.emit('flex:deleted', { id, type: 'everyone', by: req.user.userId });
        return res.json({ ok: true });
      } else {
        // add to deletedFor
        await FlexFile.findByIdAndUpdate(id, { $addToSet: { deletedFor: mongoose.Types.ObjectId(req.user.userId) } });
        if (io) io.to(`user_${req.user.userId}`).emit('flex:deleted', { id, type: 'me', by: req.user.userId });
        return res.json({ ok: true });
      }
    } catch (err) {
      console.error('Delete failed', err);
      res.status(500).json({ error: 'Delete failed' });
    }
  });

  // Reply injection endpoint (alternative to sending reply via upload)
  router.post('/:id/reply', authenticate, express.urlencoded({ extended: true }), async (req, res) => {
    try {
      const parent = await FlexFile.findById(req.params.id);
      if (!parent) return res.status(404).send('Parent not found');
      parent.replies.push({
        message: req.body.message,
        uploadedBy: mongoose.Types.ObjectId(req.user.userId),
        createdAt: new Date()
      });
      await parent.save();
      if (io) io.emit('flex:reply', { id: parent._id, reply: parent.replies[parent.replies.length - 1] });
      res.redirect('/netflex/flex');
    } catch (err) {
      console.error('Reply failed', err);
      res.status(500).send('Reply failed');
    }
  });

  // socket join for user rooms
  if (io) {
    io.on('connection', (socket) => {
      socket.on('join', (data) => {
        try {
          if (data && data.userId) socket.join(`user_${data.userId}`);
        } catch (e) {}
      });
    });
  }

  return router;
}

module.exports = createFlexRouter;
