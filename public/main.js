let socket = io();
let ac = new AudioContext();
let audioOn = true;

// This is used to hear audio playing on the client. Useful for testing, but doesn't sound great
let piano = null;
Soundfont.instrument(ac, 'acoustic_grand_piano').then(function (p) {
    piano = p;
});

document.getElementById("btnAudio").isOn = true;
document.getElementById("btnPlay").isPlaying = false;

// Set up handlers for the keyboard
for (let i = 21; i < 21 + 88; i++) {
    let key = document.getElementById("KEY_" + i);
    key.note = i;
    key.state = false;

    key.onmousedown = function () {
        setKeyState(key, true)
    };
    key.ontouchstart = function () {
        setKeyState(key, true)
    };
    key.onmouseup = function () {
        setKeyState(key, false)
    };
    key.onmouseout = function () {
        setKeyState(key, false)
    };
    key.ontouchend = function () {
        setKeyState(key, false)
    };
}

$(function () {

    /*
    $("#sortable1").sortable({
        connectWith: ".connectedSortable",
        forcePlaceholderSize: false,
        helper: function (e, li) {
            copyHelper = li.clone().insertAfter(li);
            return li.clone();
        },
        stop: function () {
            copyHelper && copyHelper.remove();
        }
    });
    $(".connectedSortable").sortable({
        receive: function (e, ui) {
            copyHelper = null;
        }
    });

     */

    $("#songlist").sortable({
        connectWith: "#playlist",
        forcePlaceholderSize: false,
        //placeholder: "placeholder",
        delay: 150,
        helper: function (e, li) {
            copyHelper = li.clone().insertAfter(li);
            return li.clone();
        },
        stop: function () {
            copyHelper && copyHelper.remove();
        }
    }).disableSelection();

    $("#playlist").sortable({
        placeholder: "placeholder",
        delay: 150,
        update: updatePlaylist,
        receive: function (e, ui) {
            copyHelper = null;
        }
    }).disableSelection()
});

function updatePlaylist(event, ui) {
    let playlisttEl = event.target;
    console.log("UpdateLists called for: ", playlisttEl.id);

    let playlist = playlisttEl.querySelectorAll("li");
    let newPlaylist = new Array();

    console.log ("Songlist:");
    for (let i = 0; i < playlist.length; i++) {
       console.log(i + ") " + playlist[i].innerText);

       newPlaylist.push(
           {
               title: playlist[i].innerText,
               id: playlist[i].getAttribute("data-id")
           });
    }

    //console.log("Updating playlist: " + JSON.stringify(newPlaylist));
    socket.emit('update playlist', newPlaylist);
}

function filterSonglist() {
    // Declare variables
    let input, filter, ul, li, a, i, txtValue;
    input = document.getElementById('myInput');
    filter = input.value.toUpperCase();
    ul = document.getElementById("songlist");
    li = ul.getElementsByTagName('li');

    // Loop through all list items, and hide those who don't match the search query
    for (i = 0; i < li.length; i++) {
        a = li[i];//.getElementsByTagName("a")[0];
        txtValue = a.textContent || a.innerText;
        if (txtValue.toUpperCase().indexOf(filter) > -1) {
            li[i].style.display = "";
        } else {
            li[i].style.display = "none";
        }
    }
}

// Following code enables drag and drop on mobile devices
// ======================================================
function touchHandler(event) {
    var touch = event.changedTouches[0];

    var simulatedEvent = document.createEvent("MouseEvent");
    simulatedEvent.initMouseEvent({
            touchstart: "mousedown",
            touchmove: "mousemove",
            touchend: "mouseup"
        }[event.type], true, true, window, 1,
        touch.screenX, touch.screenY,
        touch.clientX, touch.clientY, false,
        false, false, false, 0, null);

    touch.target.dispatchEvent(simulatedEvent);
    event.preventDefault();
}

function init() {
    document.addEventListener("touchstart", touchHandler, true);
    document.addEventListener("touchmove", touchHandler, true);
    document.addEventListener("touchend", touchHandler, true);
    document.addEventListener("touchcancel", touchHandler, true);
}

init();
// ======================================================

/*
 * Various client UI functions
 */

function setKeyState(key, keyState) {
    // Just return if the state hasn't changed
    if (key.state == keyState) {
        return;
    } else {
        key.state = keyState;
    }
    //console.log("Key " + key.note + ": " + keyState);
    socket.emit('update key', key.note - 21, keyState);

    if (key.state && piano && audioOn) {
        piano.play(key.note);
    }
}

function testAllKeys() {
    socket.emit('test all keys');
}

function testPowerDraw() {
    socket.emit('test power draw');
}

function stopTests() {
    socket.emit('stop tests');
}

function playSong(id) {
    console.log("Playing song: " + id);
    socket.emit('play song', id);
}

function toggleAudio() {
    let button = document.getElementById("btnAudio");
    let btnIcon = document.getElementById("btnAudioIcon");

    if (button.isOn) {
        btnIcon.className = "fa fa-toggle-off";
    } else {
        btnIcon.className = "fa fa-toggle-on";
    }
    button.isOn = !button.isOn;
    audioOn = button.isOn;
}

function playOrPause() {
    let button = document.getElementById("btnPlay");
    let btnIcon = document.getElementById("btnPlayIcon");
    let btnLabel = document.getElementById("btnPlayLabel");

    if (!button.isPlaying) {
        btnIcon.className = "fa fa-pause";
        btnLabel.innerText = " Pause";
    } else {
        btnIcon.className = "fa fa-play";
        btnLabel.innerText = " Play";
    }
    button.isPlaying = !button.isPlaying;
}

/*
 *  Messages from the server over socket.io to update the UI
 */

// Method: 'update keys'
//
// incoming_keys: A buffer array representing the on/off state for each key
socket.on('update keys', function (incoming_keys) {
    // The keys (on/off) are in a Buffer array of bits sent by the server
    let keys = JSON.parse(incoming_keys).data;

    for (let i = 0; i < 88; i++) {
        let key = document.getElementById("KEY_" + (i + 21));
        if (keys[i]) {
            key.style.backgroundColor = "#71DB90";
            if (piano) {
                piano.play(key.note);
            }
        } else if (key.classList.contains("white")) {
            key.style.backgroundColor = "#F2F2DE";
        } else {
            key.style.backgroundColor = "rgb(32, 32, 32)";
        }
    }
});

// Method: 'song list'
//
// song_list: A JSON object with all the available songs to play
socket.on('song list', function (allSongs, playlistSongs) {
    // This list of songs is sent in as JSON
    let songlist = JSON.parse(allSongs).songs;
    //let playlist = JSON.parse(playlistSongs).songs;
    //console.log("Songs: " + songs);

    //document.getElementById("songlist").innerHTML = "";
    let songlistEl = document.getElementById("songlist");
    //let playlistEl = document.getElementById("playlist");
    songlistEl.innerHTML = "";
    //playlistEl.innerHTML = "";

    // Update the songs list
    for (let i = 0; i < songlist.length; i++) {
        let song_item = document.createElement("li");
        let node = document.createTextNode(songlist[i].title);
        song_item.appendChild(node);
        song_item.setAttribute("data-id", songlist[i].id);
        song_item.className = "facet";
        song_item.onclick = function () {
            playSong(songlist[i].id)
        };

        songlistEl.appendChild(song_item);
    }
});

// Method: 'update playlist'
//
// song_list: A JSON object with the songs in the playlist
socket.on('update playlist', function (playlistSongs) {
    // This list of songs is sent in as JSON
    //let songlist = JSON.parse(allSongs).songs;
    if (playlistSongs == null) return;
    console.log("incoming playlist: " + JSON.stringify(playlistSongs));
    let playlist = JSON.parse(playlistSongs);
    //console.log("Songs: " + songs);

    let playlistEl = document.getElementById("playlist");
    playlistEl.innerHTML = "";

    // Update the playlist
    for (let i = 0; i < playlist.length; i++) {
        let song_item = document.createElement("li");
        let node = document.createTextNode(playlist[i].title);
        song_item.appendChild(node);
        song_item.setAttribute("data-id", playlist[i].id);
        song_item.className = "facet";
        song_item.onclick = function () {
            playSong(playlist[i].id)
        };

        playlistEl.appendChild(song_item);
    }
});

