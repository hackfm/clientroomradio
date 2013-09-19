module.exports = function() {
    var that = this;

    var requests = [];
    var lame = require('lame');
    var crypto = require("crypto");
    var fs = require("fs");
    var sp;
    var spSession;

    if ( fs.existsSync(__dirname + '/../spotify/spotify_appkey.key') ) {
        sp = require('libspotify');

        spSession = new sp.Session({
            cache_location: __dirname + "/../spotify/cache/",
            settings_location: __dirname + "/../spotify/settings/",
            applicationKey: __dirname + '/../spotify/spotify_appkey.key'
        });

        spSession.relogin();
        spSession.once('login', onLogin);
    }

    function onLogin(err) {
        if (err) console.log("Spotify login failed:", err);
        else console.log("Spotify login success!");
    }

    function finished() {
        // remove the request now that we've finished downloading it
        that.emit('downloadedTrack', requests.shift().track);

        if (requests.length > 0) {
            downloadTrack(requests[0]);
        }
    }

    function onDownloadedTrack() {
        console.log('Spotify track finished downloading.');
        this.close();
        finished();
    }

    function onSearchReady() {
        if(!this.tracks.length) {
            console.log('There is no track to play :[');
        }
        else {
            console.log("Found:", this.tracks[0].artist.name, this.tracks[0].title);

            // There is a track to play!

            var spTrack = this.tracks[0];

            requests.push({
                "track": {},
                "spTrack": spTrack
            });

            if ( requests.length == 1 ) {
                // we can't already be downloading one so start now
                downloadTrack(requests[0]);
            }
        }
    }

    that.request = function(searchTerm) {
        var spSearch = new sp.Search(searchTerm);
        spSearch.trackCount = 1; // we're only interested in the first result;
        spSearch.execute();
        spSearch.once('ready', (onSearchReady).bind(spSearch) );
    }

    function downloadTrack(request) {
    	console.log("Download Spotify track!");

        request.track.creator = request.spTrack.artist.name;
        request.track.album = request.spTrack.album.name;
        request.track.title = request.spTrack.title;
        request.track.duration = String(request.spTrack.duration);

    	var hash = crypto.createHash("md5").update(request.track.creator + request.track.title).digest("hex");
        var mp3location = __dirname + '/../spotify/tracks/' + hash + '.mp3';
        request.track.location = mp3location;
        request.track.identifier = hash;
        request.track.extension = {};

        //__dirname + "/spTracks/"

        if (fs.existsSync(mp3location)) {
            // We already have this file so just use that
            finished();
        }
        else {
            // start downloading the track
            var spPlayer = spSession.getPlayer();
            spPlayer.load(request.spTrack);
            spPlayer.play();

            // VLC needs a file to play (and didn't seem to like being
            // given PCM data) so use lame to convert Spotify's PCM data
            // to mp3 and write that to a file that can be read by VLC
            var fileWS = fs.createWriteStream( mp3location );
            var lameEncoder = new lame.Encoder();
            spPlayer.pipe(lameEncoder).pipe(fileWS);

            spPlayer.once('track-end', (onDownloadedTrack).bind(fileWS) );
        }
    }
}

require('util').inherits(module.exports, require("events").EventEmitter);