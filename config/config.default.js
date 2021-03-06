var config = {
  radioname: "Client Room Radio",
  affiliate: "youtube",
  scrobbleToHost: false,
  whitelist: true,
  lfm: {
    apiKey: "<API_KEY>",
    secret: "<SECRET>",
    sk: "<SK>"
  },
  spotify: {
    username: "<SPOTIFY_USERNAME>",
    password: "<SPOTIFY_PASSWORD>"
  },
  host: "localhost",
  chatBacklogLength: 100,
  port: 3000,
  stationOverride: null,
  noRepeatDays: 10
};

// for nodejs
module.exports = config;
