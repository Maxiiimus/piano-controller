const rpio = require('rpio');
const isPi = require('detect-rpi')();
const MidiPlayer = require('midi-player-js');

class PianoMidiPlayer {

    constructor(data, clock, latch, clear) {

    }

    /*
        Send an array of bits to the shift registers
        Will send all values of the Buffer, regardless of the number of registers
     */
    send(data) {

        // Set data and clock pins to low to start
        rpio.write(this.dataPin, rpio.LOW);
        rpio.write(this.clockPin, rpio.LOW);

        // Serial in of all the data to shift register(s) memory
        for (let i = 0; i < data.length; i++) {
            // Set the data pin to the 1 or 0 bit value
            rpio.write(this.dataPin, data[i] ? rpio.HIGH : rpio.LOW)

            // Cycle the clock pin to write to the shift register memory
            rpio.write(this.clockPin, rpio.HIGH);
            rpio.write(this.clockPin, rpio.LOW);
        }

        // All bits are in shift register memory, now cycle the latch pin to push to outputs
        rpio.write(this.latchPin, rpio.HIGH);
        rpio.write(this.latchPin, rpio.LOW);
    }

    /*
        Clear the register by toggling the clear bit
     */
    clear() {
        rpio.open(this.clearPin, rpio.OUTPUT, rpio.LOW);
        rpio.open(this.clearPin, rpio.OUTPUT, rpio.HIGH);
    }

    analyzeMidi(player, songIndex){

        var song = config.songs[songIndex];
        var trackNests = [];
        var trackNotes = [];

        //create config tracks array
        var tracks = [];

        //group all notes by track
        player.tracks.forEach(function(track){
            trackNests.push(d3.nest()
                .key(function(d) { return d.name; })
                .key(function(d) { return d.noteNumber; }).sortKeys((a, b)=>{
                    var numA = parseInt(a);
                    var numB = parseInt(b);
                    return numA - numB;
                })
                .entries(track.events))
        });

        //store which notes each track contains
        trackNests.forEach((trackNest, i)=>{

            trackNotes[i] = [];

            var instrument = '';
            var maxVelocity = 0;

            trackNest.forEach((event)=>{
                if(event.key == "Note on"){
                    event.values.forEach((noteNumber)=>{
                        var noteMaxVelocity = d3.max(noteNumber.values, (d)=>{ return d.velocity});
                        maxVelocity = (noteMaxVelocity > maxVelocity) ? noteMaxVelocity : maxVelocity;
                        trackNotes[i].push(parseInt(noteNumber.key));
                    });
                }else if(event.key == "Sequence/Track Name"){
                    var trackNameEvent = event.values[0].values[0];
                    //store track instrument in config
                    instrument = trackNameEvent.string.trim();
                }
            });

            //create track object
            tracks.push({
                name: 'Track'+(i+1),
                index: i, //retain original index which will be resorted by median pitch later so that midi events can be matched up to trackObject
                instrument: instrument,
                maxVelocity: maxVelocity,
                volumeScale: d3.scaleLinear().range([0,100]).domain([0,maxVelocity])
            });
        });

        //calculate track stats
        trackNotes.forEach((notes, i)=>{
            tracks[i].medianPitch = (notes.length) ? d3.median(notes) : 0; //median pitch
            tracks[i].notes = notes;
        });

        //sort tracks by pitch so higher pitch notes show up at end of pixel strip and lower notes show up at other end of pixel strip
        var sortDirection = (config.pitchSort) ? d3[config.pitchSort] : d3.ascending;
        tracks.sort((a,b)=>{
            return sortDirection(a.medianPitch, b.medianPitch);
        });
        song.originalTrackOrder = [];

        //merge in trackOptions from config file
        if(typeof song.trackOptions != 'undefined'){
            song.trackOptions.forEach((trackOptions)=>{
                var found = false;
                tracks.forEach((track)=>{
                    if(trackOptions.name == track.name){
                        if(typeof trackOptions.color != 'undefined'){
                            var colorObject = d3.color(trackOptions.color);
                            if(colorObject != null){
                                track.color = colorObject;
                            }else{
                                console.log('Config track "'+trackOptions.name+'" for "'+song.midiFile+'" has invalid color: "'+trackOptions.color+'".');
                            }
                        }

                        if(trackOptions.hide){
                            track.hide = true;
                        }
                        found = true;
                    }
                });
                if(!found){
                    console.log('Config track "'+trackOptions.name+'" not found for "'+song.midiFile+'".  Change config trackOptions names to one of these tracks with notes:');
                    tracks.forEach((track)=>{
                        if(track.notes.length)
                            console.log('    "'+track.name+'" has '+track.notes.length+' notes. Median pitch '+track.medianPitch+'. Instrument: "'+track.instrument+'".');
                    });
                }
            });
        }

        song.totalNotes = 0;
        tracks.forEach((track)=>{
            if(!track.hide){
                song.totalNotes += track.notes.length;
            }
        });

        //calculate pixel width of each note
        var rawSegmentSize, segmentSize;
        if(song.tracksUseFullWidth){
            //PIXELS CAN OVERLAP IF MULTIPLE TRACKS PLAY NOTES SIMULTANEOUSLY
            //tracks with few notes have very wide pixel segments, tracks with many notes have narrow segments
        }else{
            //tracks are separated into lanes, guaranteed not to overlap.  all notes have same segment size
            song.rawSegmentSize = config.numPixels/song.totalNotes; //tracks separated into "lanes" of pixels
            song.segmentSize = Math.floor(song.rawSegmentSize);
            if(song.segmentSize < 1){
                song.segmentSize = 1;
            }
        }

        var pixelIndex = config.startPixel;
        var colorIndex = 0;
        song.trackObjects = tracks;

        //assign track color and pixel range
        song.trackObjects.forEach((trackObject, i)=>{
            var notes = trackObject.notes;
            trackObject.numNotes = notes.length;

            //store original track order from before sorting
            song.originalTrackOrder[trackObject.index] = i;

            //if track has notes, assign next color in config.colors, unless trackOption color already specified or track hide=true
            if(trackObject.numNotes && !trackObject.color && !trackObject.hide){
                trackObject.color = d3.color(d3.scaleOrdinal().range(config.colors).domain(d3.range(config.colors.length))(colorIndex++%config.colors.length));
            }

            var range = [];

            if(song.tracksUseFullWidth){
                rawSegmentSize = config.numPixels/notes.length;
                segmentSize = Math.floor(rawSegmentSize);
                trackObject.segmentSize = segmentSize;
                range = d3.range(config.startPixel, config.startPixel+config.numPixels, rawSegmentSize).map((d)=>{ return Math.round(d)});
            }else if(!trackObject.hide){

                while(range.length < notes.length){
                    var pixel = Math.round((pixelIndex-config.startPixel)*song.rawSegmentSize)+config.startPixel;
                    range.push(pixel);
                    pixelIndex++;
                }
            }

            if(config.pitchSort == 'descending'){
                range.reverse();
            }

            trackObject.scale = d3.scaleOrdinal(range).domain(notes);
            trackObject.range = trackObject.scale.range();
            trackObject.domain = trackObject.scale.domain();

        });
    }
}

module.exports = PianoMidiPlayer;
