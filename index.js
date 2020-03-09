// index.js

/**
 * Required External Modules
 */

//const express = require("express");
//const path = require("path");
const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

/**
 * App Variables
 */

//const app = express();
const port = process.env.PORT || "8000";

//app.get("/", (req, res) => {
//    res.status(200).send("WHATABYTE: Food For Devs");
//});

app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket){
    console.log('a user connected');

    socket.on('chat message', function(msg){
        console.log('message: ' + msg);
        io.emit('chat message', msg);
    });

    socket.on('disconnect', function(){
        console.log('user disconnected');
    });
});

/**
 * Server Activation
 */

http.listen(port, function(){
    console.log(`listening to requests on http://localhost:${port}`);
});


var MidiPlayer = require('midi-player-js');

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
    if(event.track === 3) {
        console.log(event.string);
        io.emit('chat message', JSON.stringify(event.string));
    }
});

// Load a MIDI file
Player.loadFile('./Satisfaction.mid');
Player.play();

