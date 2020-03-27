let socket = io();
let ac = new AudioContext();

let piano = null;
Soundfont.instrument(ac, 'acoustic_grand_piano').then(function (p) {
    piano = p;
});

document.getElementById("btnAudio").isOn = true;
document.getElementById("btnPlay").isPlaying = false;

socket.on('update switches', function (switch_bits) {
    //let mask = 1;
    //console.log("incoming switch_bits: " + switch_bits);
    // The keys (on/off) are in a Buffer array of bits sent by the server
    let keys = JSON.parse(switch_bits).data;

    for (let i = 0; i < 8; i++) {
        document.getElementById("LED" + i).checked = keys[i];// & mask;
        //console.log("LED" + i + ":" + keys[i]);//(switch_bits));
        //mask <<= 1;
    }
});

socket.on('update keys', function (incoming_keys) {
    // The keys (on/off) are in a Buffer array of bits sent by the server
    let keys = JSON.parse(incoming_keys).data;

    for (let i = 0; i < 88; i++) {
        let key = document.getElementById("KEY_" + (i + 21));
        //key.checked = keys[i];
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

socket.on('song list', function (song_list) {
    // The keys (on/off) are in a Buffer array of bits sent by the server
    //let songs = song_list;//JSON.parse(song_list).data;
    let songs = JSON.parse(song_list).songs;
    console.log("Songs: " + songs);

    document.getElementById("playlist").innerHTML = "";

    for (let i = 0; i < songs.length; i++) {
        let para = document.createElement("li");
        let node = document.createTextNode(songs[i].title);
        para.appendChild(node);
        para.id = songs[i].id;
        para.onclick = function () {
            playSong(songs[i].id)
        };

        let element = document.getElementById("playlist");
        element.appendChild(para);
    }
});

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

function setKeyState(key, keyState) {
    // Just return if the state hasn't changed
    if (key.state == keyState) {
        return;
    }
    else {
        key.state = keyState;
    }
    console.log("Key " + key.note + ": " + keyState);
    socket.emit('update key', key.note - 21, keyState);

    if (key.state && piano) {
        piano.play(key.note);
        //Soundfont.instrument(ac, 'acoustic_grand_piano').then(function (piano) {

        //})
    }
}

function updateTempo() {
    let slider = document.getElementById("tempo");
    let output = document.getElementById("tempo_value");
    output.innerHTML = "" + slider.value + "%";

    socket.emit('update tempo', slider.value / 100.0);
}

function handleClick(cb) {
    socket.emit('toggle switch', cb.id);
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
