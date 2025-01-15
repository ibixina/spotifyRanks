const express = require("express");
const app = express();

const storage = require("node-persist");
const myStorage = storage.create();
myStorage.initSync();

const addThreshold = 1200;

require("dotenv").config();
const request = require("request");
const bodyParser = require("express").json;
var querystring = require("querystring");

const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const playlistId = process.env.PLAYLIST_ID;

const tokenUrl = "https://accounts.spotify.com/api/token";
const redirectUri = "http://localhost:8080/callback";
const authorizationUrl = "https://accounts.spotify.com/authorize";
let token;

app.use(bodyParser());
const cors = require("cors");
app.use(cors());

const ranking = {};

const headers = {
  client_id: clientId,
  response_type: "code",
  redirect_uri: redirectUri,
  scope: "user-library-read playlist-modify-public playlist-modify-private",
};

let counter = 0;

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("/callback", function (req, res) {
  var code = req.query.code || null;

  var authOptions = {
    url: "https://accounts.spotify.com/api/token",
    form: {
      code: code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    },
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        new Buffer.from(clientId + ":" + clientSecret).toString("base64"),
    },
    json: true,
  };
  const newToken = request.post(
    authOptions,
    async function (error, response, body) {
      token = body.access_token;
      console.log(token);

      console.log("added");
      res.redirect("/rank");
    },
  );
});
app.listen(8080, function () {
  console.log("Example app listening on port 8080!");
});

app.get("/rank", async function (req, res) {
  const likedSongs = await getLikedSongs();
  const names = likedSongs.map((song) => song.track.name);
  res.sendFile(__dirname + "/rank.html");
});

app.get("/api/get", async function (req, res) {
  const [song1, song2] = chooseRandom();

  ranking[song1.track.id].matches += 1;
  ranking[song2.track.id].matches += 1;

  const elo1 = ranking[song1.track.id].elo;
  const elo2 = ranking[song2.track.id].elo;

  await myStorage.setItem(song1.track.id, {
    elo: elo1,
    matches: ranking[song1.track.id].matches,
  });
  await myStorage.setItem(song2.track.id, {
    elo: elo2,
    matches: ranking[song2.track.id].matches,
  });

  const initialRanking = Object.values(ranking).sort((a, b) => b.elo - a.elo);
  const bottomRanking = initialRanking.slice(-10);
  const topRanking = initialRanking.slice(0, 10);
  const responseToSend = {
    songs: [song1, song2],
    ranking: topRanking,
    rankingBottom: bottomRanking,
  };

  res.json(responseToSend);
});

app.get("/login", function (req, res) {
  let scope = headers.scope;

  res.redirect(
    "https://accounts.spotify.com/authorize?" +
      querystring.stringify({
        response_type: "code",
        client_id: clientId,
        scope: scope,
        redirect_uri: redirectUri,
      }),
  );
});

async function fetchWebApi(endpoint, method, body) {
  const res = await fetch(`https://api.spotify.com/${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method,
    body: JSON.stringify(body),
  });
  return await res.json();
}

async function addToPlayList(playlistId, songId) {
  const uriFormate = `spotify:track:${songId}`;
  const response = await fetchWebApi(
    `v1/playlists/${playlistId}/tracks`,
    "POST",
    {
      uris: [uriFormate],
    },
  );
  console.log(response);
  return response;
}

const likedSongsList = [];
const limit = 50; // Maximum number of items to return per request

async function getLikedSongs(offset = 0) {
  // Construct the URL with the provided offset
  const url = `v1/me/tracks?limit=${limit}&offset=${offset}`;

  // Fetch the liked songs from the API
  const response = await fetchWebApi(url, "GET");
  response.items.forEach(async (song) => {
    likedSongsList.push(song);
    let elo = 1000;
    let matches = 0;
    const storedData = await myStorage.getItem(song.track.id);
    if (storedData !== undefined && storedData !== null) {
      elo = storedData.elo || 1000;
      matches = storedData.matches || 0;
    }
    ranking[song.track.id] = {
      name: song.track.name,
      elo: elo,
      matches: matches,
    };
  });

  // Check if there are more items to fetch
  if (response.next) {
    // Recursively fetch the next set of songs
    await getLikedSongs(offset + limit);
  }

  return likedSongsList;
}

app.post("/api/choose", async function (req, res) {
  console.log(req.body);
  let { songid, win } = req.body;
  win = win * 1;
  const songid1 = songid[0];
  const songid2 = songid[1];
  const elo1 = ranking[songid1].elo;
  const elo2 = ranking[songid2].elo;
  console.log(elo1, elo2);
  const [newelo1, newelo2] = winner(elo1, elo2, win);
  ranking[songid1].elo = newelo1;
  ranking[songid2].elo = newelo2;

  await myStorage.setItem(songid1, {
    elo: newelo1,
    matches: ranking[songid1].matches,
  });
  await myStorage.setItem(songid2, {
    elo: newelo2,
    matches: ranking[songid2].matches,
  });

  if (newelo1 > addThreshold) {
    await addToPlayList(playlistId, songid1);
  }
  if (newelo2 > addThreshold) {
    await addToPlayList(playlistId, songid2);
  }

  res.send("ok");
});

function chooseRandom() {
  const shuffled = likedSongsList.sort(() => 0.5 - Math.random());
  const randomSongs = shuffled.slice(0, 2);
  return randomSongs;
}

function winner(track1elo, track2elo, winner) {
  console.log(track1elo, track2elo, winner);
  const expected = 1 / (1 + 10 ** ((track2elo - track1elo) / 400));
  const K = 30;
  const actual1 = winner == 1 ? 1 : 0;
  const actual2 = winner == 0 ? 1 : 0;
  const newelo1 = track1elo + K * (actual1 - expected);
  const newelo2 = track2elo + K * (actual2 - 1 + expected);
  console.log(newelo1, newelo2);
  return [newelo1, newelo2];
}

//const likedSongs = await getLikedSongs();
