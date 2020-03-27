const path = require('path');
const fs = require('fs');

class SongLibrary {

    constructor() {
        let songs = [];
        this.fromDir('./midis','.mid', songs);
        this.songs = songs;

        this.songs.forEach(s => console.log("Song: " + s));
    }

    getSongs() {
        return this.songs;
    }

    fromDir(startPath, filter, midi_files) {
        if (!fs.existsSync(startPath)){
            console.log("no dir ",startPath);
            return;
        }

        let files=fs.readdirSync(startPath);
        for (let i = 0 ;i < files.length; i++) {
            let filename = path.join(startPath,files[i]);
            let stat = fs.lstatSync(filename);
            if (stat.isDirectory()){
                this.fromDir(filename, filter, midi_files); //recurse
            }
            else if (filename.indexOf(filter) >= 0) {
                midi_files.push(filename);
                //console.log('-- found: ',filename);
            };
        };
    };
}

module.exports = SongLibrary;
