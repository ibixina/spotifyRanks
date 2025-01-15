// Authorization token that must have been created previously. See : https://developer.spotify.com/documentation/web-api/concepts/authorization

const clientId = "7a13cdb69a5f4d0e93a302a155e81473";
const clientSecret = "4b44513b49424bda82cbfcc25f42835f";
const tokenUrl = "https://accounts.spotify.com/api/token";

const redirectUri = "http://localhost:8080/callback";
const authorizationUrl = "https://accounts.spotify.com/authorize";
const headers = {
  client_id: clientId,
  response_type: "code",
  redirect_uri: redirectUri,
  scope: "user-library-read",
};

const token = await fetch(tokenUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
  },
  body: new URLSearchParams(headers),
});

console.log(token);

const accessToken = await token.json();
console.log(accessToken);

const fullUrl = authorizationUrl + "?" + new URLSearchParams(headers);
console.log(fullUrl);

async function getLikedSongs() {
  // Endpoint reference: https://developer.spotify.com/documentation/web-api/reference/get-users-saved-tracks
  const limit = 50; // Maximum number of items to return per request
  const offset = 0; // Index of the first item to return
  const url = `v1/me/tracks?limit=${limit}&offset=${offset}`;

  const response = await fetchWebApi(url, "GET");
  console.log(response);
  return;
  const likedSongs = response.items;

  //// If there are more tracks, fetch them using pagination
  if (response.next) {
    let nextPageUrl = response.next;
    while (nextPageUrl) {
      const nextPageResponse = await fetchWebApi(nextPageUrl, "GET");
      likedSongs.push(...nextPageResponse.items);
      nextPageUrl = nextPageResponse.next;
    }
  }

  return likedSongs;
}

function winner(track1elo, track2elo, winner) {
  const expected = 1 / (1 + 10 ** ((track2elo - track1elo) / 400));
  const K = 30;
  const actual1 = winner == 1 ? 1 : 0;
  const actual2 = winner == 0 ? 1 : 0;
  const newelo1 = track1elo + K * (actual1 - expected);
  const newelo2 = track2elo + K * (actual2 - 1 + expected);
  console.log(newelo1, newelo2);
  return [newelo1, newelo2];
}

const likedSongs = await getLikedSongs();
