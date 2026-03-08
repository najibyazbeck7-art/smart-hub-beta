// --- 1. CONFIGURATION ---
const HOST = "64b3984aead9464a9b1aa9c3f34080bb.s1.eu.hivemq.cloud";
const PORT = 8884; 
const USER = "najibyazbeck";
const PASS = "Zaqwsx123*";
const CLIENT_ID = "BetaDash_" + Math.random().toString(16).substr(2, 6);

const relayNames = ["Misting System", "Circulation Fan", "CO2 Exhaust", "Light Control"];
let activeTimers = {}; // Stores the interval IDs for countdowns
const client = new Paho.MQTT.Client(HOST, PORT, CLIENT_ID);

// --- 2. UI GENERATION ---
window.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('relay-container');
    if (container) {
        relayNames.forEach((name, index) => {
            const i = index + 1;
            container.innerHTML += `
                <div id="card-${i}" class="relay-box">
                    <div class="relay-label">
                        <span>${name}</span>
                        <span id="badge-${i}" style="color:#94a3b8">OFF</span>
                    </div>
                    <div class="timer-row">
                        <label style="font-size:0.7rem; color:#94a3b8">AUTO-OFF (SEC):</label>
                        <input type="number" id="timer-input-${i}" value="0" min="0">
                        <span id="countdown-${i}" class="countdown"></span>
                    </div>
                    <div class="btn-group">
                        <button id="btn-on-${i}" class="btn btn-on" onclick="publishCommand(${i}, 'ON')">START</button>
                        <button id="btn-off-${i}" class="btn btn-inactive" onclick="publishCommand(${i}, 'OFF')">STOP</button>
                    </div>
                </div>
            `;
        });
    }
    
    document.getElementById('toggle-log-btn').addEventListener('click', function() {
        const log = document.getElementById('debug-log');
        const isVisible = log.style.display === 'block';
        log.style.display = isVisible ? 'none' : 'block';
        this.innerText = isVisible ? "SHOW SYSTEM LOG" : "HIDE SYSTEM LOG";
    });

    connectMQTT();
});

// --- 3. MQTT & TIMER LOGIC ---
function publishCommand(num, val) {
    if (!client.isConnected()) return;

    const message = new Paho.MQTT.Message(val);
    message.destinationName = `home/relay/${num}`;
    message.retained = true; 
    client.send(message);

    if (val === "ON") {
        const seconds = parseInt(document.getElementById(`timer-input-${num}`).value);
        if (seconds > 0) {
            startCountdown(num, seconds);
        }
    } else {
        stopCountdown(num); // Stop timer if manually turned off
    }
}

function startCountdown(num, seconds) {
    stopCountdown(num); // Clear existing if any
    
    let timeLeft = seconds;
    const display = document.getElementById(`countdown-${num}`);
    
    activeTimers[num] = setInterval(() => {
        timeLeft--;
        display.innerText = `⏱ ${timeLeft}s`;

        if (timeLeft <= 0) {
            publishCommand(num, "OFF");
            stopCountdown(num);
        }
    }, 1000);
}

function stopCountdown(num) {
    if (activeTimers[num]) {
        clearInterval(activeTimers[num]);
        delete activeTimers[num];
        document.getElementById(`countdown-${num}`).innerText = "";
    }
}

// --- 4. CORE MQTT FUNCTIONS ---
function connectMQTT() {
    client.connect({
        userName: USER, password: PASS, useSSL: true,
        onSuccess: () => {
            document.getElementById('status-bar').className = "status-pill online";
            document.getElementById('status-bar').innerText = "ONLINE";
            client.subscribe("home/relay/+/status");
            client.subscribe("home/relay/system/log");
        },
        onFailure: (err) => console.log("Fail:", err)
    });
}

client.onMessageArrived = (msg) => {
    const topic = msg.destinationName;
    const payload = msg.payloadString;

    if (topic.includes("/status")) {
        const i = topic.split('/')[2];
        const badge = document.getElementById(`badge-${i}`);
        const btnOn = document.getElementById(`btn-on-${i}`);
        const btnOff = document.getElementById(`btn-off-${i}`);

        badge.innerText = payload;
        if (payload === "ON") {
            badge.style.color = "#10b981";
            btnOn.className = "btn btn-inactive";
            btnOff.className = "btn btn-off";
        } else {
            badge.style.color = "#94a3b8";
            btnOn.className = "btn btn-on";
            btnOff.className = "btn btn-inactive";
            stopCountdown(i); // Sync: if external source turns it off, stop timer
        }
    }
};