const rpio = require('rpio');

const SER_Pin = 11;
const RCK_Pin = 12;
const SRCLR_PIN = 13;

//#define SER_Pin 5    // Serial Input SER (18 on chip)
//#define RCK_Pin 6    //RCLK (7 on chip)
//#define SRCK_Pin 7   //SRCLK (8 on chip)
//#define SRCLR_Pin 8

rpio.init({mock: 'raspi-3'});
rpio.open(SER_Pin, rpio.OUTPUT, rpio.LOW);
rpio.open(RCK_Pin, rpio.OUTPUT, rpio.LOW);

//rpio.setOutput(pinDS);
//rpio.setOutput(pinClk);

// Start with the clock pin low
rpio.write(pinClk, rpio.LOW);

/*
 * This is what we want to send through the shift register - start with
 * all zeros to clear the buffer, then insert 10110111, with a final bit
 * to clock in the storage register.
 */
let input = [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 1, 1, 0];
//let input = new Buffer(8).fill(rpio.LOW);
//input[8] = input[10] = input[11] = input[13] = input[14] = input[15] = rpio.HIGH;

/*
 * Configure the speed in Hz.  setInterval() and setTimeout have a maximum
 * resolution of 1ms, and we need a regular clock, so with each 'tick' and
 * 'tock' at a max of 1ms intervals our theoretical top speed is 500Hz.
 *
 * The 74HC595 is rated to 52MHz so we are in no danger of overclocking ;)
 */
let speed = 1;

setInterval(function clock() {
    /*
     * Pop the first bit of input into DS.  If there is no more
     * input then exit.
     */
    if (input.length) {
        input.shift();
        rpio.writebuf(SER_Pin, input);
        console.log("Writing buffer: " + input)
        //rpio.write(pinDS, input.shift());
    } else {
        process.exit(0);
    }
    /*
     * Then cycle the clock at regular intervals, starting by setting it
     * high then setting a timeout for half way until the next interval
     * when we set it low.
     */
    rpio.write(RCK_Pin, rpio.HIGH);

    setTimeout(function clocklow() {
        rpio.write(RCK_Pin, rpio.LOW);
    }, parseInt(1000 / speed / 2));

}, parseInt(1000 / speed));
