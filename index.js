const express = require("express");
//const path = require("path");
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const MidiPlayer = require('midi-player-js');
const path = require('path');
const fs = require('fs');
//const rpio = require('rpio');
//const {Pin, Board, ShiftRegister} = require("johnny-five");
//const isPi = require('detect-rpi')();
const keyRegister = require('./key-register');

//if (isPi) {
//    const {RaspiIO} = require("raspi-io");
//}

/**
 * App Variables
 */

//const app = express();
const port = process.env.PORT || "8000";
const numModules = 1;
const registerSize = 8;
const SER_Pin = 11;   // Serial Input SER (18 on chip)
const RCK_Pin = 13;   // Register Clock (RCLK, 7 on chip) - Latch pin
const SRCK_Pin = 15;   // Shift-Register Clock (SRCLK, 8 on chip) - Clock pin
const SRCLR_PIN = 16; // Shift_Register clear (SRCLR - 3 on chip) - Set to high to enable storage transfer

app.use(express.static(path.join(__dirname, 'public')));

//let led_state = 0b00000000;
let register = new keyRegister(SER_Pin, SRCK_Pin, RCK_Pin, SRCLR_PIN);
let keys = new Buffer(numModules * registerSize).fill(0);

/*
function getLEDByte(led_id) {
    switch (led_id) {
        case "LED0":
            return 0b00000001;
        case "LED1":
            return 0b00000010;
        case "LED2":
            return 0b00000100;
        case "LED3":
            return 0b00001000;
        case "LED4":
            return 0b00010000;
        case "LED5":
            return 0b00100000;
        case "LED6":
            return 0b01000000;
        case "LED7":
            return 0b10000000;
        default:
            return 0b00000000;
    }
}
*/

function getKeyIndex(ledId) {
    return parseInt(ledId.substring(3));
}

/*
function dec2bin(dec){
    return (dec >>> 0).toString(2);
}

function setLEDs(led_val) {
    led_state ^= led_val; // toggle by bitwise XOR
    register.send(keys); // update the register state

    console.log("LEDS: " + dec2bin(led_state));
}
*/

function toggleKeyValue(index) {
    keys[index] ^= 1;    // toggle by bitwise XOR
    register.send(keys); // update the register state

    console.log("LEDS: " + JSON.stringify(keys));
}

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

    /*
    //joining path of directory
    const directoryPath = path.join(__dirname, 'midis');
    //passing directoryPath and callback function
    fs.readdir(directoryPath, function (err, files) {
        //handling error
        if (err) {
            return console.log('Unable to scan directory: ' + err);
        }
        //listing all files using forEach
        files.forEach(function (file) {
            // Do whatever you want to do with the file
            io.emit('add midi', file);
            console.log(file);
        });
     });
     */
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
        } else {
            io.emit('note on', "KEY_" + event.noteNumber);
        }
    }
    if (event.name === "Note off") {
        io.emit('note off', "KEY_" + event.noteNumber);
    }
    //if(event.track === 3) {
    //console.log(event.string);
    //    io.emit('chat message', JSON.stringify(event.string));
    //}
});

// Load a MIDI file
//Player.loadFile('./midis/Satisfaction.mid');
//Player.play();

