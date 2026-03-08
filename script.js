// --- 1. CONFIG ---
const HOST = "64b3984aead9464a9b1aa9c3f34080bb.s1.eu.hivemq.cloud";
const PORT = 8884; 
const USER = "najibyazbeck";
const PASS = "Zaqwsx123*";
const CLIENT_ID = "Beta_Dash_" + Math.random().toString(16).substr(2, 6);

const relayNames = ["Misting System", "Circulation Fan", "CO2 Exhaust", "Light Control"];
let activeTimers = {}; 
const client = new Paho.MQTT.Client(HOST, PORT, CLIENT_ID);

// --- 2. UI GENERATION ---
window.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('relay-container');
    container.innerHTML = ''; 
    relayNames.forEach((name, index) => {
        const i = index + 1;
        container.innerHTML += `
            <div class="relay-box">
                <div class="relay-label">
                    <span>${name}</span>
                    <span id="badge-${i}" style="color:#94a3b8">OFFLINE</span>
                </div>
                <div class="timer-row">
                    <input type="number" id="timer-input-${i}" value="0" style="width:50px">
                    <span id="countdown-${i}" style="color:#fbbf24; font-size:0.8rem"></span>
                </div>
                <div class="btn-group">
                    <button id="btn-on-${i}" class="btn btn-on" onclick="publishCommand(${i}, 'ON')">ON</button>
                    <button id="btn-off-${i}" class="btn btn-off" onclick="publishCommand(${i}, 'OFF')">OFF</button>
                </div>
            </div>`;
    });

    const logBtn = document.getElementById('toggle-log-btn');
    logBtn.onclick = () => {
        const log = document.getElementById('debug-log');
        log.style.display = (log.style.display === 'none' || log.style.display === '') ? 'block' : 'none';
    };

    connectMQTT();
});

// --- 3. MQTT CONNECT ---
function connectMQTT() {
    client.connect({
        userName: USER, password: PASS, useSSL: true,
        onSuccess: () => {
            document.getElementById('status-bar').className = "status-pill online";
            document.getElementById('status-bar').innerText = "ONLINE";
            // Subscribe to EVERYTHING under home/relay to be safe
            client.subscribe("home/relay/#");
            writeLog("Connected & Subscribed to #", "#10b981");
        },
        onFailure: (err) => writeLog("Connection Failed: " + err.errorMessage, "#ef4444")
    });
}

// --- 4. MESSAGE HANDLING (The Fix) ---
client.onMessageArrived = (message) => {
    const topic = message.destinationName;
    const payload = message.payloadString;
    
    // LOG EVERY MESSAGE IMMEDIATELY
    writeLog(`Topic: ${topic} | Msg: ${payload}`, "#3b82f6");

    // Handle System Log
    if (topic.endsWith("/log")) {
        // Log is already handled by the writeLog above
    }

    // Handle Availability
    if (topic.endsWith("/availability")) {
        document.getElementById('status-bar').innerText = payload;
    }

    // Handle Relay Status (Matches home/relay/1/status)
    if (topic.includes("/status")) {
        const parts = topic.split('/');
        const i = parts[2]; // Gets the "1" from "home/relay/1/status"
        updateUI(i, payload);
    }
};

// --- 5. TIMER & COMMANDS ---
function publishCommand(num, val) {
    const message = new Paho.MQTT.Message(val);
    message.destinationName = `home/relay/${num}`;
    message.retained = true; 
    client.send(message);

    if (val === "ON") {
        const sec = parseInt(document.getElementById(`timer-input-${num}`).value);
        if (sec > 0) startTimer(num, sec);
    } else {
        stopTimer(num);
    }
}

function startTimer(num, sec) {
    stopTimer(num);
    let timeLeft = sec;
    activeTimers[num] = setInterval(() => {
        timeLeft--;
        document.getElementById(`countdown-${num}`).innerText = timeLeft + "s";
        if (timeLeft <= 0) {
            publishCommand(num, "OFF");
            stopTimer(num);
        }
    }, 1000);
}

function stopTimer(num) {
    clearInterval(activeTimers[num]);
    document.getElementById(`countdown-${num}`).innerText = "";
}

function updateUI(i, state) {
    const badge = document.getElementById(`badge-${i}`);
    if (badge) {
        badge.innerText = state;
        badge.style.color = (state === "ON") ? "#10b981" : "#94a3b8";
    }
}

function writeLog(msg, color) {
    const logDiv = document.getElementById('debug-log');
    logDiv.innerHTML += `<div style="color:${color}">[${new Date().toLocaleTimeString()}] ${msg}</div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
}