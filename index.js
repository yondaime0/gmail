// npm deps
const express = require("express");
const https = require("https");
require("dotenv").config();
const crypto = require("crypto");
const { URL } = require("url");
const QueryString = require("querystring");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const { google } = require("googleapis");

const OAuth2 = google.auth.OAuth2;
const OAuth2_client = new OAuth2(
  "539833916388-ffvaauilp8v6mjbu484ej4suhd83gck0.apps.googleusercontent.com",
  "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",
  "https://developers.google.com/oauthplayground"
);

OAuth2_client.setCredentials({
  refresh_token:
    "1//04hgUnVm2qr2zCgYIARAAGAQSNwF-L9IrXDiASt3e9fqWa8u1wqjmIS8B26qT0Kx6AyzebqjPs6-dvprZpb3RdfkPJMfV7Yq9i7I",
});
// Require the framework and instantiate it
const app = express();

// init spotify config
const spClientId = "d964504fcfb643728d676c5de2875cac";
const spClientSecret = "01bd3450ffb3484fa1254464f8fa4b0f";
const spClientCallback = "https://spotify-dimar.herokuapp.com/callback";
const authString = Buffer.from(spClientId + ":" + spClientSecret).toString(
  "base64"
);
const authHeader = `Basic ${authString}`;
const spotifyEndpoint = "https://accounts.spotify.com/api/token";

// encryption
const encSecret = "dsa89jffioewjiofsldfds";
const encMethod = "aes-256-ctr";
const encrypt = (text) => {
  const aes = crypto.createCipher(encMethod, encSecret);
  let encrypted = aes.update(text, "utf8", "hex");
  encrypted += aes.final("hex");
  return encrypted;
};
const decrypt = (text) => {
  const aes = crypto.createDecipher(encMethod, encSecret);
  let decrypted = aes.update(text, "hex", "utf8");
  decrypted += aes.final("utf8");
  return decrypted;
};

// handle sending POST request
function postRequest(url, data = {}) {
  console.log("data", data);
  return new Promise((resolve, reject) => {
    // build request data
    url = new URL(url);
    const reqData = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };

    // create request
    const req = https.request(reqData, (res) => {
      // build response
      let buffers = [];
      res.on("data", (chunk) => {
        buffers.push(chunk);
      });

      res.on("end", () => {
        // parse response
        let result = null;
        try {
          result = Buffer.concat(buffers);
          result = result.toString();
          var contentType = res.headers["content-type"];
          if (typeof contentType == "string") {
            contentType = contentType.split(";")[0].trim();
          }
          if (contentType == "application/x-www-form-urlencoded") {
            result = QueryString.parse(result);
          } else if (contentType == "application/json") {
            result = JSON.parse(result);
          }
        } catch (error) {
          error.response = res;
          error.data = result;
          reject(error);
          return;
        }
        resolve({ response: res, result: result });
      });
    });

    // handle error
    req.on("error", (error) => {
      reject(error);
    });

    // send
    data = QueryString.stringify(data);
    req.write(data);
    req.end();
  });
}

// support form body
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
/**
 * Swap endpoint
 * Uses an authentication code on body to request access and refresh tokens
 */

app.post("/swap", async (req, res) => {
  try {
    // build request data
    const reqData = {
      grant_type: "authorization_code",
      redirect_uri: spClientCallback,
      code: req.body.code,
    };

    // get new token from Spotify API
    const { response, result } = await postRequest(spotifyEndpoint, reqData);

    // encrypt refresh_token
    if (result.refresh_token) {
      result.refresh_token = encrypt(result.refresh_token);
    }

    // send response
    res.status(response.statusCode).json(result);
  } catch (error) {
    console.log("error2", error);
    if (error.response) {
      res.status(error.response.statusCode);
    } else {
      res.status(500);
    }
    if (error.data) {
      res.send(error.data);
    } else {
      res.send("");
    }
  }
});

/**
 * Refresh endpoint
 * Uses the refresh token on request body to get a new access token
 */
app.post("/refresh", async (req, res) => {
  try {
    // ensure refresh token parameter
    if (!req.body.refresh_token) {
      res.status(400).json({
        error: "Refresh token is missing from body",
      });
      return;
    }

    // decrypt token
    const refreshToken = decrypt(req.body.refresh_token);
    // build request data
    const reqData = {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    };
    // get new token from Spotify API
    const { response, result } = await postRequest(spotifyEndpoint, reqData);

    // encrypt refresh_token
    if (result.refresh_token) {
      result.refresh_token = encrypt(result.refresh_token);
    }

    // send response
    res.status(response.statusCode).json(result);
  } catch (error) {
    console.log("error3", error);
    if (error.response) {
      res.status(error.response.statusCode);
    } else {
      res.status(500);
    }
    if (error.data) {
      res.send(error.data);
    } else {
      res.send("");
    }
  }
});

app.post("/send-mail", async (req, res) => {
  const { from, text } = req.body;
  console.log("for", req.body);
  let testAccount = await nodemailer.createTestAccount();

  const accessToken = OAuth2_client.getAccessToken();
  // const refreshToken = OAuth2_client.generateAuthUrl();

  // console.log("accesToken", refreshToken);

  let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      type: "OAUTH2",
      user: "montagegarage.mailer@gmail.com",
      clientId:
        "539833916388-ffvaauilp8v6mjbu484ej4suhd83gck0.apps.googleusercontent.com",
      clientSecret: "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",
      refreshToken:
        "1//04hgUnVm2qr2zCgYIARAAGAQSNwF-L9IrXDiASt3e9fqWa8u1wqjmIS8B26qT0Kx6AyzebqjPs6-dvprZpb3RdfkPJMfV7Yq9i7I",
      accessToken,
    },
  });
  const mailData = {
    from: from,
    to: "support@montage-garage.com",
    subject: `Montage Garage report from ${from}`,
    text: text,
  };

  transporter.sendMail(mailData, (error, info) => {
    if (error) {
      console.log("error", error);
      return console.log(error);
    }
    console.log("info", info);

    res.status(200).send({
      message: "Mail send",
      message_id: info.message_id,
    });
  });
});

// start server
const spServerPort = 5000;
app.listen(spServerPort, () => {
  console.log("Example app listening on port " + spServerPort + "!");
});
