let socket = io();
let ac = new AudioContext();
let audioOn = false;
let songtime = 100;

// This is used to hear audio playing on the client. Useful for testing, but doesn't sound great
let piano = null;
Soundfont.instrument(ac, 'acoustic_grand_piano').then(function (p) {
    piano = p;
});

$("#songlist").filterable({
    filterPlaceholder: "Find songs..."
});

let songlist, playlist, currentSong;
let isPlaying = false;

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

function testEachKey() {
    $("#playbutton").removeClass("ui-icon-play").addClass("ui-icon-pause");
    socket.emit('test each key');
}

function testAllKeys() {
    $("#playbutton").removeClass("ui-icon-play").addClass("ui-icon-pause");
    socket.emit('test all keys');
}

function playSong(id) {
    /*
    currentSong = id;
    let song = songlist.find(el => el.id === Number.parseInt(id));
    console.log("Playing song: " + song.title);
    if (song.image) {
        $("#artistImage").attr("src", song.image);
    } else {
        $("#artistImage").attr("src", "images/piano.png");
    }
    $("#songTitle").text(song.title);
    $("#artistName").text(song.artist);
    $("#playbutton").removeClass("ui-icon-play").addClass("ui-icon-pause");
     */


    console.log("Calling set song: " + id);
    socket.emit('set song', id);
    socket.emit('play');
}

function setSongTime() {
    let val =  $("#timeslider").val();
    //console.log ("slider = " + val);
    socket.emit("set time", val);
}

function addToQueue(id) {
    let list = $("#playlist");
    let song = songlist.find(el => el.id === Number.parseInt(id));

    console.log("adding song: " + song.title + " - " + song.id);
    // Update the songs list
    list.append(
            '<li><a href="#" data-song-id="' +
            song.id + '" onclick="playSong(' + song.id +
            ');">' + song.title + '</a>' +
            '<a href="#" onclick="removeFromQueue($(this));" class="ui-btn ui-icon-delete">Remove</a></li>'
        );

    list.listview( "refresh" );

    updatePlaylist();
}

function removeFromQueue(el) {
    el.parent().remove();
    updatePlaylist();
}

function updatePlaylist() {
    let playlistEl = $("#playlist");
    //console.log("UpdateLists called for: ", playlistEl.attr('id'));

    let list = playlistEl.children("li");
    //console.log("Found li children: " + list.length);
    if (!list) return;
    let newPlaylist = [];

    //console.log ("Playlist:");
    for (let i = 0; i < list.length; i++) {
        //console.log(i + ") " + $(list[i]).text() + " - " + $(list[i]).children(":first").attr("data-song-id"));
        //console.log("outerhtml: " + $(list[i])[0].outerHTML);

        newPlaylist.push(
            {
                title: $(list[i]).text(),
                id: $(list[i]).children(":first").attr("data-song-id")
            });
    }

    //console.log("Updating playlist: " + JSON.stringify(newPlaylist));
    socket.emit('update playlist', JSON.stringify(newPlaylist));
}

function setAudio(el) {
    audioOn = el.is(":checked");
}

function playOrPause(el) {
    isPlaying = !isPlaying;

    if (isPlaying) {
        el.removeClass("ui-icon-play").addClass("ui-icon-pause");
        socket.emit('play');
    } else {
        el.removeClass("ui-icon-pause").addClass("ui-icon-play");
        socket.emit('pause');
    }
}

function previousSong() {

}

function nextSong() {

}

/*
 *  Messages from the server over socket.io to update the UI
 */

// Method: 'update keys'
//
// incoming_keys: A buffer array representing the on/off state for each key
socket.on('update keys', function (incoming_keys) {
    // If we're receiving key updates, we are playing
    if (!isPlaying) {
        isPlaying = true;
        $("#playbutton").removeClass("ui-icon-play").addClass("ui-icon-pause");
    }

    if (!audioOn || !piano) return;
    let keys = JSON.parse(incoming_keys).data;

    for (let i = 0; i < 88; i++) {
        if (keys[i]) {
            piano.play(i + 21);
        }
    }
});

function getTimeString(time) {
    let minutes = Math.floor(time / 60.0);
    let seconds = Math.floor(time - minutes * 60);
    return(minutes + ":" + (seconds < 10 ? "0" + seconds : seconds));
}

// Method: 'set song'
//
// id: Server sends what song id is currently playing
socket.on('set song', function (id) {
    if (id == currentSong) return;
    currentSong = id;

    let song = songlist.find(el => el.id === Number.parseInt(id));
    if (!song) return;

    console.log("Setting current song: " + song.title);
    if (song.image) {
        $("#artistImage").attr("src", song.image);
    } else {
        $("#artistImage").attr("src", "images/piano.png");
    }
    $("#songTitle").text(song.title);
    $("#artistName").text(song.artist);
});


// Method: 'time remaining'
//
// song_time: The length the song in seconds
// time_remaining: The seconds remaining in the song
socket.on('update time', function (song_time, time_remaining) {
    let time_played = song_time - time_remaining
    let slider_position = 0;
    if (song_time !== 0) {
        slider_position = Math.floor((song_time - time_remaining) / song_time * 100.0);
    }

    //console.log("updating time: " + song_time + ", " + time_remaining);

    $("#timeplayed").text(getTimeString(time_played));
    $("#timeremaining").text("-" + getTimeString(time_remaining));
    $("#timeslider").val(slider_position);
    $("#timeslider").slider("refresh");
});

// Method: 'song over'
//
// Server sends an update when the current song has finished playing
socket.on('song over', function () {
    $("#timeplayed").text("");
    $("#timeremaining").text("");
    $("#timeslider").val(0);
    $("#timeslider").slider("refresh");
    $("#playbutton").removeClass("ui-icon-pause").addClass("ui-icon-play");
});

// Method: 'song list'
//
// song_list: A JSON object with all the available songs to play
socket.on('song list', function (all_songs) {
    // This list of songs is sent in as JSON
    songlist = JSON.parse(all_songs).songs;
    let list = $("#songlist");

    list.empty();
    // Update the songs list
    for (let i = 0; i < songlist.length; i++) {
        if (songlist[i].hidden) continue;

        list.append(
            '<li><a style="padding: .3em;" href="#" data-song-id="' +
            songlist[i].id + '" onclick="playSong(' + songlist[i].id +
            ');"><p style="font-weight: bold">' + songlist[i].title + '</p><p>' +
            songlist[i].artist + '</p></a>' +
            '<a href="#" onclick="addToQueue(' + songlist[i].id + ');" class="ui-btn ui-icon-plus">Add</a></li>'
        );
    }
    list.listview( "refresh" );
});

// Method: 'update playlist'
//
// playlistSongs: A JSON object with the songs in the playlist
socket.on('update playlist', function (playlist_songs) {
    playlist = JSON.parse(playlist_songs);
    console.log("updated playlist: " + JSON.stringify(playlist_songs));

    $("#playlist").empty();
    // Update the songs list
    for (let i = 0; i < playlist.length; i++) {
        $("#playlist").append(
            '<li><a href="#" data-song-id="' +
            playlist[i].id + '" onclick="playSong(' + playlist[i].id +
            ');">' + playlist[i].title +
            '</a><a href="#" onclick="removeFromQueue($(this));" class="ui-btn ui-icon-delete">Remove</a></li>'
        );
    }
    $("#playlist").listview( "refresh" );

    /*
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
     */
});

