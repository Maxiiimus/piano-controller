//$(function () {
let socket = io();
/*$('form').submit(function (e) {
    e.preventDefault(); // prevents page reloading
    socket.emit('chat message', $('#m').val());
    $('#m').val('');
    return false;
});
socket.on('chat message', function (msg) {
    $('#messages').append($('<li>').text(msg));
});

socket.on('add midi', function (file) {
    $('#messages').append($('<li>').text(file));
});

socket.on('note on', function (key_id) {
    //$('#messages').append($('<li>').text(key_id + " on"));
    document.getElementById(key_id).style.backgroundColor = "#71DB90";
});

socket.on('note off', function (key_id) {
    let key = document.getElementById(key_id);
    //console.log(key.className);
    if (key.classList.contains("white")) {
        key.style.backgroundColor = "#F2F2DE";
    } else {
        key.style.backgroundColor = "rgb(32, 32, 32)";
    }
    //$('#messages').append($('<li>').text(key_id + " off"));
});

 */

    socket.on('update switches', function (switch_bits) {
        //let mask = 1;
        //console.log("incoming switch_bits: " + switch_bits);
        // The keys (on/off) are in a Buffer array of bits sent by the server
        let keys = JSON.parse(switch_bits).data;

        for (let i = 0; i < 8; i++) {
            document.getElementById("LED"+i).checked = keys[i];// & mask;
            //console.log("LED" + i + ":" + keys[i]);//(switch_bits));
            //mask <<= 1;
        }
    });

    function handleClick(cb) {
        socket.emit('toggle switch', cb.id);
    }
//});
