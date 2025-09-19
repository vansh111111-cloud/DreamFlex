const { Dropbox } = require('dropbox');
const fetch = require('node-fetch');
const fs = require('fs');

const dbx = new Dropbox({ accessToken: process.env.DROPBOX_ACCESS_TOKEN, fetch });

/**
 * Upload a local file path to Dropbox using upload session (works for large files)
 * returns { path: dropboxPath, sharedUrl: directLink }
 */
async function uploadFileToDropbox(localPath, destPath, onProgress = () => {}) {
  const stat = fs.statSync(localPath);
  const fileSize = stat.size;
  const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB per chunk
  const stream = fs.createReadStream(localPath, { highWaterMark: CHUNK_SIZE });

  if (fileSize <= CHUNK_SIZE) {
    const contents = fs.readFileSync(localPath);
    await dbx.filesUpload({ path: destPath, contents, mode: { '.tag': 'add' } });
  } else {
    // start session
    let cursor = null;
    let uploaded = 0;
    for await (const chunk of stream) {
      if (!cursor) {
        const res = await dbx.filesUploadSessionStart({ contents: chunk });
        cursor = { session_id: res.result.session_id, offset: chunk.length };
        uploaded = chunk.length;
      } else {
        await dbx.filesUploadSessionAppendV2({
          cursor: { session_id: cursor.session_id, offset: cursor.offset },
          contents: chunk
        });
        cursor.offset += chunk.length;
        uploaded += chunk.length;
      }
      const percent = Math.round((uploaded / fileSize) * 100);
      onProgress(percent);
    }
    // finish
    await dbx.filesUploadSessionFinish({
      cursor: { session_id: cursor.session_id, offset: cursor.offset },
      commit: { path: destPath, mode: { '.tag': 'add' }, autorename: true, mute: false }
    });
  }

  // create shared link and convert to direct
  const link = await dbx.sharingCreateSharedLinkWithSettings({ path: destPath });
  const direct = link.result.url.replace('?dl=0', '?raw=1').replace('www.dropbox.com', 'dl.dropboxusercontent.com');
  return { path: destPath, sharedUrl: direct };
}

/**
 * delete dropbox file by path
 */
async function deleteFileFromDropbox(path) {
  try {
    await dbx.filesDeleteV2({ path });
  } catch (err) {
    // ignore if not found
    console.warn('Dropbox delete error', err);
  }
}

module.exports = { dbx, uploadFileToDropbox, deleteFileFromDropbox };
