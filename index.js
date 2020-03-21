const express = require("express");
//const path = require("path");
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const MidiPlayer = require('midi-player-js');
const path = require('path');
const fs = require('fs');
const keyRegister = require('./key-register');

/**
 * App Variables
 */

//const app = express();
const port = process.env.PORT || "8000";
const numModules = 4;
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
let myInterval = setInterval(testAllKeys, 500);

function testAllKeys() {
    keys[keyIndex] = 1;
    if (keyIndex > 0) {
        keys[keyIndex-1] = 0;
    }
    if (keyIndex >= numModules * registerSize - 1) {
        clearInterval(myInterval);
    }
    register.send(keys);
    console.log("Keys: " + JSON.stringify(keys));
    keyIndex++;
}

testAllKeys();

io.on('connection', function (socket) {
    console.log('a user connected');
    io.emit('update switches', JSON.stringify(keys));

    socket.on('toggle switch', function (switch_id) {
        console.log('Switch Off: ' + switch_id);
        toggleKeyValue(getKeyIndex(switch_id));
        io.emit('update switches', JSON.stringify(keys));
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
var Player = new MidiPlayer.Player(function (event) {
    //console.log(event);
    if (event.name === "Note on") {
        if (event.velocity === 0) {
            io.emit('note off', "KEY_" + event.noteNumber);
            console.log('note off: ' + event.noteNumber);
        } else {
            io.emit('note on', "KEY_" + event.noteNumber);
            console.log('note on: ' + event.noteNumber);
        }
    }
    if (event.name === "Note off") {
        io.emit('note off', "KEY_" + event.noteNumber);
        console.log('note off: ' + event.noteNumber);
    }
});

// Load a MIDI file
//Player.loadFile('./midis/Dead_South/In_Hell_Ill_Be_In_Good_Company.mid');
//Player.play();

