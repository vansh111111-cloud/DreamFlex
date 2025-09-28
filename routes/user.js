const express = require("express");
const router = express.Router();
const User = require("./config/models/user.model");
const Movie = require("./config/models/moviemodel");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const { authenticate, requireCreator, uploadLargeFile} = require("./middleware");
const { dbx ,uploadFileToDropbox, deleteFileFromDropbox } = require("./config/dropbox");

// -----------------------
// Multer storage (memory only, since we upload to Dropbox)
const storage = multer.memoryStorage();
const upload = multer({ storage });
console.log("requireCreator type:", typeof requireCreator);
// -----------------------
// GET /me -> Profile page
router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .populate("myList", "title posterUrl")
      .populate("recentlyWatched", "title posterUrl")
      .lean();

    if (!user) return res.redirect("/user/netflex/home");

    // defaults for safe loops
    user.myList = user.myList || [];
    user.recentlyWatched = user.recentlyWatched || [];

    res.render("ProfilePage", { user, role:req.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------
// Update user info
router.put("/me", authenticate, upload.single("profilePicture"), async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const updateData = {};

    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (password) updateData.password = await bcrypt.hash(password, 10);

    // handle profile picture via Dropbox
    if (req.file) {
      // delete old pic from Dropbox if exists
      const oldPath = req.user.profilePicturePath;
      if (oldPath) await deleteFileFromDropbox(oldPath);

      // upload new pic
      const destPath = `/profile_pictures/${Date.now()}-${req.file.originalname}`;
      const { sharedUrl } = await uploadFileToDropbox(req.file.buffer, destPath);
      updateData.profilePicture = sharedUrl;
      updateData.profilePicturePath = destPath;
    }

    const user = await User.findByIdAndUpdate(req.user.userId, updateData, { new: true }).lean();
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------
// Delete account
router.delete("/me", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    // delete profile pic from Dropbox
    if (user.profilePicturePath) {
      await deleteFileFromDropbox(user.profilePicturePath);
    }

    await User.findByIdAndDelete(req.user.userId);
    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/me/:id/photo", authenticate, upload.single("profilePicture"), async (req, res) => {
  try {
    const userId = req.params.id;
    const file = req.file;

    if (!file) {
      return res.status(400).send("No file uploaded");
    }

    // Dropbox destination path
    const dropboxPath = `/netflex/profile_photos/${Date.now()}_${file.originalname}`;

    // Upload directly to Dropbox
    await dbx.filesUpload({
      path: dropboxPath,
      contents: file.buffer,
      mode: { ".tag": "add" },
    });

    // Create a shared link and convert it to direct link
    const link = await dbx.sharingCreateSharedLinkWithSettings({ path: dropboxPath });
    const directUrl = link.result.url
      .replace("?dl=0", "?raw=1")
      .replace("www.dropbox.com", "dl.dropboxusercontent.com");

    // Update user profilePicture
    const user = await User.findById(userId);
    if (!user) return res.status(404).send("User not found");

    user.profilePicture = directUrl;
    await user.save();

    res.redirect("/user/netflex/me"); // redirect back to profile page
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).send("Error uploading profile photo");
  }
});



// update username + password
router.post("/me/:id/update", authenticate, async (req, res) => {
  try {
    const userId = req.params.id;
    const { username, currentPassword, newPassword, confirmPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).send("User not found");

    // ✅ Update username only if provided
    if (username && username.trim() !== "" && username !== user.username) {
      user.username = username.trim();
    }

    // ✅ Update password only if new password fields are provided
    if (newPassword || confirmPassword) {
      if (!currentPassword) {
        return res.status(400).send("Current password required");
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).send("Current password is incorrect");
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).send("New passwords do not match");
      }

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
    }

    await user.save();
    res.redirect("/user/netflex/me"); // back to profile page
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).send("Error updating profile");
  }
});
// Show red dot when a new message arrives

module.exports = router;
