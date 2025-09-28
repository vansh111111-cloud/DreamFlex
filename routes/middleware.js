const jwt = require('jsonwebtoken');

// authenticate
function authenticate(req, res, next) {
  const token = req.cookies?.token || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);
  console.log('authenticate token:', token);
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // attach to both req.user and res.locals.user (res.locals survives better across some handlers)
    req.user = decoded;
    res.locals.user = decoded;
    console.log('authenticate -> decoded:', decoded);
    return next();
  } catch (err) {
    console.error('authenticate -> invalid token', err.message);
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// requireCreator
function requireCreator(req, res, next) {
  // try to get user from req.user first, fallback to res.locals.user
  const user = req.user || res.locals?.user;
  console.log('requireCreator sees user (req.user/res.locals.user):', req.user, res.locals?.user);

  if (!user) {
    return res.status(401).json({ message: 'Access denied. No user found' });
  }
  if (user.role !== 'creator' && user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Only creators or admins allowed' });
  }

  // ensure req.user is set for downstream handlers
  req.user = user;
  return next();
}

async function uploadLargeFile(dbx, fileBuffer, filePath, onProgress) {
  const CHUNK_SIZE = 8 * 1024 * 1024;
  let offset = 0, sessionId = null;
  while (offset < fileBuffer.length) {
    const chunk = fileBuffer.slice(offset, offset + CHUNK_SIZE);
    if (offset === 0) {
      const response = await dbx.filesUploadSessionStart({ contents: chunk });
      sessionId = response.result.session_id;
    } else {
      await dbx.filesUploadSessionAppendV2({
        cursor: { session_id: sessionId, offset },
        contents: chunk
      });
    }
    offset += chunk.length;
    if (onProgress) onProgress(Math.round((offset / fileBuffer.length) * 100));
  }
  await dbx.filesUploadSessionFinish({
    cursor: { session_id: sessionId, offset },
    commit: { path: filePath, mode: 'add', autorename: true }
  });
}

module.exports = { authenticate, requireCreator, uploadLargeFile };
