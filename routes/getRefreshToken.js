require("dotenv").config();
const { Dropbox } = require("dropbox");
const fetch = require("node-fetch");

(async () => {
  const dbx = new Dropbox({
    clientId: process.env.DROPBOX_APP_KEY,
    clientSecret: process.env.DROPBOX_APP_SECRET,
    fetch
  });

  try {
    const tokenResponse = await dbx.auth.getAccessTokenFromRefreshToken(process.env.DROPBOX_REFRESH_TOKEN);
    console.log("Access token:", tokenResponse.result.access_token);

    dbx.auth.setAccessToken(tokenResponse.result.access_token);

    const account = await dbx.usersGetCurrentAccount();
    console.log("Connected as:", account.result.name.display_name);
  } catch (err) {
    console.error("Dropbox auth failed:", err);
  }
})();
