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
const {Pin, Board, ShiftRegister} = require("johnny-five");
const isPi = require('detect-rpi')();

if (isPi) {
    const {RaspiIO} = require("raspi-io");
}

/**
 * App Variables
 */

//const app = express();
const port = process.env.PORT || "8000";

//const SER_Pin = 11;   // Serial Input SER (18 on chip)
//const RCK_Pin = 13;   // Register Clock (RCLK, 7 on chip) - Latch pin
//const SRCK_Pin = 15;   // Shift-Register Clock (SRCLK, 8 on chip) - Clock pin
//const SRCLR_PIN = 16; // Shift_Register clear (SRCLR - 3 on chip) - Set to high to enable storage transfer

const SER_Pin = 'GPIO17';   // Serial Input SER (18 on chip)
const RCK_Pin = 'GPIO27';   // Register Clock (RCLK, 7 on chip) - Latch pin
const SRCK_Pin = 'GPIO22';   // Shift-Register Clock (SRCLK, 8 on chip) - Clock pin
const SRCLR_PIN = 'GPIO23'; // Shift_Register clear (SRCLR - 3 on chip) - Set to high to enable storage transfer



let register;

if (isPi) {
    const board = new Board({
        io: new RaspiIO()
    });


    board.on("ready", () => {
        let srclr = new Pin(SRCLR_PIN);
        srclr.high(); // Set to high to enable transfer

        register = new ShiftRegister({
            //size: 8,
            pins: {
                data: SER_Pin,
                clock: SRCK_Pin,
                latch: RCK_Pin
            }
        });

        /*
        let value = 0b00000000;
        let upper = 0b10000000;
        let lower = 0b00000000;
        let swap = true;
        let a = 0b01010101;
        let b = 0b10101010;
        let count = 0;

        function next() {
            if (swap) {
                //register.send(value = value > lower ? value >> 1 : upper);
                register.send(a);
            } else {
                register.send(b);
            }
            swap = !swap;
            count++;
            if (count < 50) {
                setTimeout(next, 200);
            } else {
                register.send(lower);
            }
        }

        next();
        */
    });
}

app.use(express.static(path.join(__dirname, 'public')));

let led_state = 0b00000000;

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

function dec2bin(dec){
    return (dec >>> 0).toString(2);
}

function setLEDs(led_val) {
    led_state ^= led_val; // toggle by bitwise XOR
    if (isPi) {
        register.send(led_state); // update the register state
    }
    console.log("LEDS: " + dec2bin(led_state));
}

io.on('connection', function(socket){
    console.log('a user connected');
    io.emit('update switches', led_state);

    socket.on('switch on', function(switch_id){
        console.log('Switch On: ' + switch_id);
        setLEDs(getLEDByte(switch_id));
        io.emit('update switches', led_state);
    });

    socket.on('switch off', function(switch_id){
        console.log('Switch Off: ' + switch_id);
        setLEDs(getLEDByte(switch_id));
        io.emit('update switches', led_state);
    });

    socket.on('chat message', function(msg){
        console.log('message: ' + msg);
        io.emit('chat message', msg);
    });

    socket.on('disconnect', function(){
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
//Player.loadFile('./midis/Satisfaction.mid');
//Player.play();

