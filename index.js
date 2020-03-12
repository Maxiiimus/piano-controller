// index.js

/**
 * Required External Modules
 */

const express = require("express");
//const path = require("path");
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const MidiPlayer = require('midi-player-js');
const path = require('path');
const fs = require('fs');
//const rpio = require('rpio');
const {Board, ShiftRegister} = require("johnny-five");

/**
 * App Variables
 */

//const app = express();
const port = process.env.PORT || "8000";

const SER_Pin = 11;   // Serial Input SER (18 on chip)
const RCK_Pin = 13;   // Register Clock (RCLK, 7 on chip) - Latch pin
const SRCK_Pin = 15   // Shift-Register Clock (SRCLK, 8 on chip) - Clock pin
const SRCLR_PIN = 16; // Shift_Register clear (SRCLR - 3 on chip) - Set to high to enable storage transfer

const board = new Board();

// For use with 74HC595 chip

board.on("ready", () => {
    let srclr = new five.Pin(SRCLR_PIN);
    srclr.high(); // Set to high to enable transfer

    const register = new ShiftRegister({
        size: 8,
        pins: {
            data: SER_Pin,
            clock: SRCK_Pin,
            latch: RCK_Pin
        }
    });

    let value = 0b00000000;
    let upper = 0b10001000;
    let lower = 0b00010001;

    function next() {
        register.send(value = value > lower ? value >> 1 : upper);
        setTimeout(next, 200);
    }

    next();
});

app.use(express.static(path.join(__dirname, 'public')));

//app.get('/', function(req, res){
//    res.sendFile(__dirname + '/public/index.html');
//});

io.on('connection', function(socket){
    console.log('a user connected');

    socket.on('chat message', function(msg){
        console.log('message: ' + msg);
        io.emit('chat message', msg);
    });

    socket.on('disconnect', function(){
        console.log('user disconnected');
    });

    //joining path of directory
    const directoryPath = path.join(__dirname, 'midis');
    //passsing directoryPath and callback function
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
});

/**
 * Server Activation
 */

http.listen(port, function(){
    console.log(`listening to requests on http://localhost:${port}`);
});

// Initialize player and register event handler
var Player = new MidiPlayer.Player(function(event) {
    //console.log(event);
    if (event.name === "Note on") {
        if (event.velocity === 0 ) {
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
Player.loadFile('./midis/Satisfaction.mid');
Player.play();

