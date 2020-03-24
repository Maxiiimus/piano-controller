const rpio = require('rpio');
const isPi = require('detect-rpi')();

class KeyRegister {
    constructor(data, clock, latch, clear) {

        //let isPi = detectPi();
        console.log("isPi: " + isPi);
        console.log("data: "+ data);
        console.log("clock: "+ clock);
        console.log("latch: "+ latch);
        console.log("clear: "+ clear);

        // If running on another OS, then just mock the RaspberryPi
        if (!isPi) {
            rpio.init({mock: 'raspi-3'});
            /* Override default warn handler to avoid mock warnings */
            rpio.on('warn', function() {});
        }

        // Set class properties to use
        this.dataPin = data;
        this.clockPin = clock;
        this.latchPin = latch;
        this.clearPin = clear;

        // Open the data, clock, and latch pins for writing
        rpio.open(this.dataPin, rpio.OUTPUT, rpio.LOW);
        rpio.open(this.clockPin, rpio.OUTPUT, rpio.LOW);
        rpio.open(this.latchPin, rpio.OUTPUT, rpio.LOW);
        rpio.open(this.clearPin, rpio.OUTPUT, rpio.HIGH);
    }

    /*
        Send an array of bits to the shift registers
        Will send all values of the Buffer, regardless of the number of registers
     */
    send(original_data) {
        //console.log("Incoming  Data: " + JSON.stringify(original_data));
        let data = this.reorderKeyData(original_data);
        //console.log("Reordered Data: " + JSON.stringify(data));

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

    // Unfortunately, the hardware input and output ports on the key controller modules are backward.
    // Therefore, the valves are in reverse order for each module of 8 valves and keys.
    // Instead of having all of the wires or tubes mixed around, this function reorders the buffer array
    // to load bits in the mapping to the keys on the piano.
    // If this has a measurable impact on performance, then will address in hardware.
    reorderKeyData(original_data) {
        let data = Buffer.from(original_data);
        let numModules = data.length / 8; // Get the number of modules. Each module has 8 keys
        //console.log("NumModules: " + numModules);
        let i, j, offset, temp;

        // Loop through each module and swap the order
        for (i = 0; i < numModules; i++) {
            offset = i * 8;
            for (j = 0; j < 4; j++) {
                temp = data[offset+j];
                data[offset+j] = data[offset + 7 - j];
                data[offset + 7 - j] = temp;
            }
        }
        return data;
    }

    /*
        Clear the register by toggling the clear bit
     */
    clear() {
        rpio.open(this.clearPin, rpio.OUTPUT, rpio.LOW);
        rpio.open(this.clearPin, rpio.OUTPUT, rpio.HIGH);
    }
}

module.exports = KeyRegister;
