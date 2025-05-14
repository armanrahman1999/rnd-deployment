const express = require("express");
const cors = require("cors");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const bodyParser = require("body-parser");

const app = express();
app.use(
  cors({
    origin: "*", // Allow all origins
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(bodyParser.json());

const CLIENT_ID = "Ov23ligSpt2ezibhkkfD";
const CLIENT_SECRET = "3f58327d365b05779382a762f8bd11ee8d82c390";
const PORT = 4000;

// Store active sessions (in a real app, use Redis or a database)
const activeSessions = new Set();

app.get("/getAccessToken", async function (req, res) {
  try {
    const code = req.query.code;

    if (!code) {
      return res.status(400).json({ error: "Authorization code is required" });
    }

    const params = `?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&code=${code}`;

    const response = await fetch(
      "https://github.com/login/oauth/access_token" + params,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
      }
    );

    const data = await response.json();

    if (data.access_token) {
      // Store the token in our active sessions
      activeSessions.add(data.access_token);
    }

    res.json(data);
  } catch (error) {
    console.error("Access token error:", error);
    res.status(500).json({ error: "Failed to get access token" });
  }
});

app.get("/getUserData", async function (req, res) {
  try {
    console.log("works");
    const authHeader = req.get("Authorization");

    if (!authHeader || !authHeader.startsWith("token ")) {
      return res
        .status(401)
        .json({ error: "Missing or invalid authorization header" });
    }

    const token = authHeader.split(" ")[1];

    // Check if token is in our active sessions
    if (!activeSessions.has(token)) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    const response = await fetch("https://api.github.com/user", {
      method: "GET",
      headers: {
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      // If GitHub says the token is invalid, clean up our session
      if (response.status === 401) {
        activeSessions.delete(token);
      }
      return res.status(response.status).json({ error: "GitHub API error" });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("User data error:", error);
    res.status(500).json({ error: "Failed to get user data" });
  }
});

app.get("/getUserRepos", async function (req, res) {
  try {
    console.log("hit");
    const authHeader = req.get("Authorization");

    if (!authHeader || !authHeader.startsWith("token ")) {
      return res
        .status(401)
        .json({ error: "Missing or invalid authorization header" });
    }

    const token = authHeader.split(" ")[1];

    // Check if token is in our active sessions
    if (!activeSessions.has(token)) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    // Get optional query parameters
    const {
      sort = "updated",
      direction = "desc",
      per_page = 30,
      page = 1,
    } = req.query;

    // Build the query string
    const queryParams = new URLSearchParams({
      sort,
      direction,
      per_page,
      page,
    }).toString();

    // Fetch the authenticated user's repositories
    const response = await fetch(
      `https://api.github.com/user/repos?${queryParams}`,
      {
        method: "GET",
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      // If GitHub says the token is invalid, clean up our session
      if (response.status === 401) {
        activeSessions.delete(token);
      }
      return res.status(response.status).json({
        error: "GitHub API error",
        message: await response.text(),
      });
    }
    console.log("hitting server");
    const repos = await response.json();
    res.json(repos);
  } catch (error) {
    console.error("Repository fetch error:", error);
    res.status(500).json({ error: "Failed to fetch repositories" });
  }
});

// NEW ENDPOINT FOR FETCHING REPOSITORIES

app.post("/logout", function (req, res) {
  try {
    const authHeader = req.get("Authorization");

    if (authHeader && authHeader.startsWith("token ")) {
      const token = authHeader.split(" ")[1];
      // Remove the token from active sessions
      activeSessions.delete(token);
    }

    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
