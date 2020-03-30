const express = require("express");
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const MidiPlayer = require('midi-player-js');
const path = require('path');
//const fs = require('fs');
const keyRegister = require('./key-register');
// This list of available songs
const songLibrary = require('./midis/song-list');

/**
 * App Variables
 */

// Set up client browser
const port = process.env.PORT || "8000";
app.use(express.static(path.join(__dirname, 'public')));

// Set up Raspberry Pi
const numModules = 11;
const registerSize = 8;
const SER_Pin = 11;   // Serial Input SER (18 on chip)
const RCK_Pin = 13;   // Register Clock (RCLK, 7 on chip) - Latch pin
const SRCK_Pin = 15;   // Shift-Register Clock (SRCLK, 8 on chip) - Clock pin
const SRCLR_PIN = 16; // Shift_Register clear (SRCLR - 3 on chip) - Set to high to enable storage transfer

const CLIENT_INTERVAL = 250;

// The register is all of the shift registers representing the keys
let register = new keyRegister(SER_Pin, SRCK_Pin, RCK_Pin, SRCLR_PIN);

// The keys array keeps track of the current state and is used to send to the register
let keys = Buffer.alloc(numModules * registerSize).fill(0);

// Used for running key tests
let keyIndex = 0; // Key index is used for testing one key at a time
let myInterval; // Timer interval for running key tests

// This is the current playlist or queue, just starts empty
let playlist = [];
let randomizedPlaylist = [];
let playlistChanged = false;
let playlistRepeat = false;
let playlistRandom = false;
let currentPlaylistIndex = 0;
let betweenSongs = false;
let isPlaying = false;

// Keep track of song information
let currentSongId = 0;
let currentSongTime = 0;
let currentSongTimeRemaining = 0;
let currentSongTotalTicks = 0;
let songLoaded = false;

// Initialize player and register event handler
let Player = new MidiPlayer.Player(function (event) {
    let keyIndex = 21;
    let keyVal = 0; // Default to "Note off" with a 0

    // When we get a "Note on" or "Note off" event, update the values in the shift register
    // Also, update the clients in case they are playing the audio locally
    if (event.name === "Note on" || event.name === "Note off") {

        // "Note off" is also represented as a velocity of 0
        // So, we default to 0, but change the value if velocity is not 0
        if (event.velocity !== 0) {
            keyVal = 1;
        }

        keyIndex = event.noteNumber - 21; // Piano key midi notes start at 21
        keys[keyIndex] = keyVal;
        register.send(keys);
        io.emit('update keys', JSON.stringify(keys));

        // Calculate time remaining using the current tick
        let remainingTicks = currentSongTotalTicks - event.tick;
        currentSongTimeRemaining = Math.floor(remainingTicks / currentSongTotalTicks * currentSongTime);
    }
});

Player.on('endOfFile', function() {
    console.log("End of File reached");
    betweenSongs = true;
    io.emit('song over');
});

let songDelay = 0;
// Set an interval to update all connected clients
function updateClients() {
    if (betweenSongs) {
        if (songDelay >= 2000) {
            songDelay = 0;
            betweenSongs = false;
            if (isPlaying) {
                playNextSong();
            }
            return;
        }
        songDelay += CLIENT_INTERVAL;
    }

    // Only update client playlist if it's changed
    if (playlistChanged) {
        io.emit('update playlist', JSON.stringify(playlist));
        playlistChanged = false;
    }

    // Let the clients know what song to play
    io.emit("set song", currentSongId);
    io.emit("update time", currentSongTime, currentSongTimeRemaining);
    io.emit("settings", playlistRepeat, playlistRandom);
}

function runEachKeyTest() {
    keyIndex = 0;
    keys.fill(0);
    if (myInterval) {
        clearInterval(myInterval);
    }
    myInterval = setInterval(testEachKey, 500);
}

function testEachKey() {
    keys[keyIndex] = 1;
    if (keyIndex > 0) {
        keys[keyIndex-1] = 0;
    }
    if (keyIndex >= numModules * registerSize) {
        clearInterval(myInterval);
    }
    register.send(keys);
    io.emit('update keys', JSON.stringify(keys));
    //console.log("Keys: " + JSON.stringify(keys));
    keyIndex++;
}

function runAllKeysTest() {
    keyIndex = 0;
    keys.fill(0);
    if (myInterval) {
        clearInterval(myInterval);
    }
    myInterval = setInterval(testAllKeys, 500);
}

function testAllKeys() {
    keys[keyIndex] = 1;

    if (keyIndex >= numModules * registerSize) {
        register.send(keys);
        io.emit('update keys', JSON.stringify(keys));
        clearInterval(myInterval);
    }
    register.send(keys);
    io.emit('update keys', JSON.stringify(keys));
    keyIndex++;
}

function stopTests() {
    if (myInterval) {
        clearInterval(myInterval);
    }
    Player.stop();

    keys.fill(0);
    register.send(keys);
    io.emit('update keys', JSON.stringify(keys));
}

function playMusic() {
    if(!isPlaying) {
        // Check if a song has been loaded, if pick a random song to load
        if (!songLoaded) {
            let i = Math.floor(Math.random() * Math.floor(songLibrary.songs.length));
            currentSongId = songLibrary.songs[i].id;
            setSong(currentSongId);
        }
        Player.play();
    }
    isPlaying = true;
}

function pauseMusic() {
    if (myInterval) {
        clearInterval(myInterval);
    }
    Player.pause();

    isPlaying = false;
}

function setCurrentSongTime(percent) {
    if (Player.isPlaying()) {
        //console.log("skipping to " + percent);
        Player.skipToPercent(percent);
        Player.play();
    } else {
        Player.skipToPercent(percent);
    }
}

function resetKeys() {
    keys.fill(0);
    register.send(keys);
}

// If random (shuffle) is enabled, then need to create a random ordered playlist to play from
function createRandomizedPlaylist() {
    // First, copy the playlist
    let temp = [...playlist];
    randomizedPlaylist = [];

    // Next copy one at a time at random
    for (let i = 0; i < playlist.length; i++) {
        let j = Math.floor(Math.random() * temp.length);
        console.log("Pushing position: " + j);
        randomizedPlaylist.push(temp.splice(j,1));
    }

    if (playlistRandom) {
        // If playing a random playlist, then reset the index to start over.
        currentPlaylistIndex = 0;
    }
    console.log("Playlist.length = " + playlist.length + " Randomized list length: " + randomizedPlaylist.length);
    console.log("Playlist: " + JSON.stringify(playlist));
    console.log("Randomized: " + JSON.stringify(randomizedPlaylist));
}

function updateSettings(playRandom, playRepeat) {
    // Check if the random setting has changed and if so, create a randomized playlist
    if (playRandom != playlistRandom) {
        playlistRandom = playRandom;

        // Recreate the random playlist
        if (playlistRandom) {
            createRandomizedPlaylist();
        }
    }
    playlistRepeat = playRepeat;
}

function playNextSong() {
    console.log("Playing next song");
    let list;
    if (playlistRandom) {
        console.log("Playing from random list");
        list = randomizedPlaylist;
    } else {
        console.log("Playing from normal list");
        list = playlist;
    }

    if (list.length === 0) return;

    currentPlaylistIndex++;
    if (currentPlaylistIndex >= list.length - 1) {
        currentPlaylistIndex = 0;
        if (!playlistRepeat) return; // Done with the list
    }

    setSong(list[currentPlaylistIndex].id);
    playMusic();
}

function setSong(song_id) {
    // Stop any tests
    if (myInterval) {
        clearInterval(myInterval);
    }
    currentSongId = song_id;

    // Reset all keys
    resetKeys();

    console.log("Received song: " + song_id);
    let song = songLibrary.songs.find(el => el.id === Number.parseInt(song_id));
    console.log("Playing Song: " + song["title"]);

    let songPath = song["path"];

    // Load a MIDI file
    if (Player.isPlaying()) {
        Player.stop();
    }
    Player.loadFile(songPath);
    songLoaded = true;

    let lastTick = 0;
    // Try to estimate the song length in ticks by finding the largest tick value
    Player.tracks.forEach(function(track){
        track.events.forEach(function(event){
            if(event.name == "Note on" || event.name == "Note off") {
                if (event.tick > lastTick) {
                    lastTick = event.tick;
                }
            }
        });
    });

    currentSongTime = Player.getSongTime();
    currentSongTimeRemaining = currentSongTime;
    currentSongTotalTicks = lastTick;
    console.log("Song length: " + Player.getSongTime() + ", Song Total Ticks: " + currentSongTotalTicks);
}

function playSong(song_id) {
    // Stop any tests
    if (myInterval) {
        clearInterval(myInterval);
    }
    currentSongId = song_id;

    // Reset all keys
    resetKeys();

    console.log("Received song: " + song_id);
    let song = songLibrary.songs.find(el => el.id === Number.parseInt(song_id));
    console.log("Playing Song: " + song["title"]);

    let songPath = song["path"];

    // Load a MIDI file
    if (Player.isPlaying()) {
        Player.stop();
    }
    Player.loadFile(songPath);
    console.log("Song length: " + Player.getSongTime());
    //io.emit("set song time", Player.getSongTime());

    /*Player.tracks.forEach(function(track){
        track.events.forEach(function(event){
            //console.log("Instrument: " + JSON.stringify(event));
            if(event.name !== "Note on") {
                //let trackNameEvent = event.values[0].values[0];
                //store track instrument in config
                //console.log("Event: " + JSON.stringify(event));
                //console.log("Instrument: " + trackNameEvent.string.trim());
            }
        });
        //console.log("Track: " + track.name);
    });
    */

    Player.play();
}

io.on('connection', function (socket) {
    console.log('a user connected');
    //io.emit('update switches', JSON.stringify(keys));
    //console.log("Sending: " + songs);
    //io.emit('song list', songs);
    io.emit('song list', JSON.stringify(songLibrary));
    io.emit('update playlist', JSON.stringify(playlist));

    socket.on("test each key", function() {
        runEachKeyTest();
    });

    socket.on("test all keys", function() {
        runAllKeysTest();
    });

    socket.on("stop tests", function() {
        stopTests();
    });

    socket.on("set song", function(id) {
        setSong(id);
    });

    socket.on("update settings", function(playRandom, playRepeat) {
        updateSettings(playRandom, playRepeat);
    });

    //socket.on("play", function() {
    //    playSong();
    //});

    socket.on("play", function() {
        playMusic();
    });

    socket.on("pause", function(id) {
        pauseMusic(id);
    });

    socket.on("set time", function(percent) {
        setCurrentSongTime(percent);
    });

    socket.on('update key', function (id, keyState) {
        if (id >= 0 && id <= keys.length) {
            keys[id] = keyState;
            io.emit('update keys', JSON.stringify(keys));
            console.log('Updated keys[' + id + ']' + ": " + keyState);
            register.send(keys);
        }
    });

    socket.on('update playlist', function (p) {
        console.log('incoming playlist: ' + p);
        playlist = JSON.parse(p);
        playlistChanged = true; // Update all connected clients' playlist
        createRandomizedPlaylist();
        //io.emit('update playlist', JSON.stringify(p));
        //io.emit('update switches', JSON.stringify(keys));
    });

    socket.on('disconnect', function () {
        console.log('user disconnected');
    });
});

/**
 * Server Activation
 */

http.listen(port, function () {
    console.log(`listening to requests on http://localhost:${port}`);
});

//setSong(currentSongId);

// Start updating clients
setInterval(updateClients,CLIENT_INTERVAL); // Update all clients every 250ms


