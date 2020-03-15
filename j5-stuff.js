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
    });
}

function setLEDs(led_val) {
    led_state ^= led_val; // toggle by bitwise XOR
    if (isPi) {
        register.send(led_state); // update the register state
    }
    console.log("LEDS: " + dec2bin(led_state));
}
