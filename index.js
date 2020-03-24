const express = require("express");
//const path = require("path");
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const MidiPlayer = require('midi-player-js');
const path = require('path');
const fs = require('fs');
const keyRegister = require('./key-register');
//const midiTools = require('./piano-midi-player');

/**
 * App Variables
 */

//const app = express();
const port = process.env.PORT || "8000";
const numModules = 11;
const registerSize = 8;
const SER_Pin = 11;   // Serial Input SER (18 on chip)
const RCK_Pin = 13;   // Register Clock (RCLK, 7 on chip) - Latch pin
const SRCK_Pin = 15;   // Shift-Register Clock (SRCLK, 8 on chip) - Clock pin
const SRCLR_PIN = 16; // Shift_Register clear (SRCLR - 3 on chip) - Set to high to enable storage transfer

app.use(express.static(path.join(__dirname, 'public')));

//let led_state = 0b00000000;
let register = new keyRegister(SER_Pin, SRCK_Pin, RCK_Pin, SRCLR_PIN);
let keys = Buffer.alloc(numModules * registerSize).fill(0);

function getKeyIndex(ledId) {
    return parseInt(ledId.substring(3));
}

function toggleKeyValue(index) {
    keys[index] ^= 1;    // toggle by bitwise XOR
    register.send(keys); // update the register state

    console.log("LEDS: " + JSON.stringify(keys));
}

let keyIndex = 0;
let myInterval; // = setInterval(testAllKeys, 500);

function runTest() {
    keyIndex = 0;
    keys.fill(0);
    if (myInterval) {
        clearInterval(myInterval);
    }
    myInterval = setInterval(testAllKeys, 500);
}

function testAllKeys() {
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

function runPowerTest() {
    keyIndex = 0;
    keys.fill(0);
    if (myInterval) {
        clearInterval(myInterval);
    }
    myInterval = setInterval(testPowerDraw, 500);
}

function testPowerDraw() {
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

function playSong() {
    if (myInterval) {
        clearInterval(myInterval);
    }
    keys.fill(0);
    register.send(keys);

    // Load a MIDI file
    Player.loadFile('./midis/Dead_South/In_Hell_Ill_Be_In_Good_Company.mid');
    console.log("Song length: " + Player.getSongTime());
    /*Player.tracks.forEach(function(track){
        track.events.forEach(function(event){
            //console.log("Instrument: " + JSON.stringify(event));
            if(event.name != "Note on") {
                //let trackNameEvent = event.values[0].values[0];
                //store track instrument in config
                console.log("Event: " + JSON.stringify(event));
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

    socket.on("test all keys", function() {
        runTest();
    });

    socket.on("test power draw", function() {
        runPowerTest();
    });

    socket.on("stop tests", function() {
        stopTests();
    });

    socket.on("play song", function() {
        playSong();
    });

    socket.on('update key', function (id, keyState) {
        if (id >= 0 && id <= keys.length) {
            keys[id] = keyState;
            io.emit('update keys', JSON.stringify(keys));
            console.log('Updated keys[' + id + ']' + ": " + keyState);
        }
    });

    socket.on('toggle switch', function (switch_id) {
        console.log('Switch Off: ' + switch_id);
        toggleKeyValue(getKeyIndex(switch_id));
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

// Initialize player and register event handler
let Player = new MidiPlayer.Player(function (event) {
    let keyIndex = 21;
    let keyVal = 0;
    if (event.name === "Note on" || event.name === "Note off") {
        if (event.velocity !== 0) {
            keyVal = 1;
        }

        keyIndex = event.noteNumber - 21;
        keys[keyIndex] = keyVal;
        register.send(keys);
        io.emit('update keys', JSON.stringify(keys));
        console.log("Key " + event.noteNumber + ": " + (keyVal ? "ON" : "OFF"));
    }
});


