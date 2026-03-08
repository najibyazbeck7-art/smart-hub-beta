// --- CONFIG ---
let lastSignalTime = Date.now();
const HOST = "64b3984aead9464a9b1aa9c3f34080bb.s1.eu.hivemq.cloud";
const PORT = 8884; 
const USER = "najibyazbeck";
const PASS = "Zaqwsx123*";
const CLIENT_ID = "Mycotech_Beta_" + Math.random().toString(16).substr(2, 6);

// Updated device names for Mycotech Hub
const relayNames = ["Misting System", "Circulation Fan", "CO2 Exhaust", "Light Control"];
let activeTimers = {}; 
const client = new Paho.MQTT.Client(HOST, PORT, CLIENT_ID);

// --- UI SETUP ---
window.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('relay-container');
    container.innerHTML = ''; 
    
    relayNames.forEach((name, index) => {
        const i = index + 1;
        container.innerHTML += `
            <div class="relay-box">
                <div class="relay-label">
                    <span>${name}</span>
                    <span id="badge-${i}" class="state-indicator">OFF</span>
                </div>
                <div class="timer-row">
                    <label>SEC:</label>
                    <input type="number" id="timer-input-${i}" value="0" min="0">
                    <span id="countdown-${i}" class="countdown"></span>
                </div>
                <div class="btn-group">
                    <button id="btn-on-${i}" class="btn btn-inactive" onclick="publishCommand(${i}, 'ON')">ON</button>
                    <button id="btn-off-${i}" class="btn btn-off" onclick="publishCommand(${i}, 'OFF')">OFF</button>
                </div>
            </div>`;
    });

    document.getElementById('toggle-log-btn').onclick = function() {
        const log = document.getElementById('debug-log');
        const isHidden = log.style.display === 'none' || log.style.display === '';
        log.style.display = isHidden ? 'block' : 'none';
        this.innerText = isHidden ? "HIDE SYSTEM LOG" : "SHOW SYSTEM LOG";
    };

    connectMQTT();
});

// --- MQTT STATUS HANDLING ---
function updateStatus(text, status) {
    const bar = document.getElementById('status-bar');
    if (!bar) return;
    bar.innerText = text;
    if (status === "online") {
        bar.className = 'status-pill is-online';
    } else {
        bar.className = 'status-pill is-offline';
    }
}

function connectMQTT() {
    client.connect({
        userName: USER, password: PASS, useSSL: true,
        onSuccess: () => {
            updateStatus("ONLINE", "online");
            client.subscribe("home/relay/#");
            writeLog("Connected to HiveMQ Cloud", "#10b981");
        },
        onFailure: (err) => {
            updateStatus("FAILED", "offline");
            writeLog("Connection Error: " + err.errorMessage, "#ef4444");
        }
    });
}

// --- MESSAGE PROCESSING ---
client.onMessageArrived = (message) => {
    lastSignalTime = Date.now(); 
    const topic = message.destinationName;
    const payload = message.payloadString;

    if (topic.includes("/status")) {
        const id = topic.split('/')[2];
        writeLog(`FEEDBACK: ${relayNames[id-1]} is ${payload}`, "#94a3b8");
        updateRelayUI(id, payload);
    }
    
    if (topic.includes("/availability")) {
        updateStatus(payload, payload === "ONLINE" ? "online" : "offline");
        writeLog(`SYSTEM: ${payload}`, "#fbbf24");
    }
};

client.onConnectionLost = (res) => {
    updateStatus("OFFLINE", "offline");
    writeLog("Lost connection to broker", "#ef4444");
    setTimeout(connectMQTT, 5000);
};

// --- TIMER & COMMANDS ---
function publishCommand(num, val) {
    if (!client.isConnected()) {
        writeLog("OFFLINE: Cannot send command", "#ef4444");
        return;
    }

    const message = new Paho.MQTT.Message(val);
    message.destinationName = `home/relay/${num}`;
    message.retained = true; 
    client.send(message);

    writeLog(`SENT: ${relayNames[num-1]} -> ${val}`, "#3b82f6");

    if (val === "ON") {
        const seconds = parseInt(document.getElementById(`timer-input-${num}`).value);
        if (seconds > 0) startTimer(num, seconds);
    } else {
        stopTimer(num);
    }
}

function startTimer(num, seconds) {
    stopTimer(num);
    let timeLeft = seconds;
    const display = document.getElementById(`countdown-${num}`);
    
    writeLog(`TIMER: ${relayNames[num-1]} auto-off in ${seconds}s`, "#fbbf24");

    activeTimers[num] = setInterval(() => {
        timeLeft--;
        display.innerText = `⏱ ${timeLeft}s`;
        if (timeLeft <= 0) {
            publishCommand(num, "OFF");
            stopTimer(num);
        }
    }, 1000);
}

function stopTimer(num) {
    if (activeTimers[num]) {
        clearInterval(activeTimers[num]);
        delete activeTimers[num];
        document.getElementById(`countdown-${num}`).innerText = "";
    }
}

function updateRelayUI(id, state) {
    const badge = document.getElementById(`badge-${id}`);
    const btnOn = document.getElementById(`btn-on-${id}`);
    const btnOff = document.getElementById(`btn-off-${id}`);
    const box = badge.closest('.relay-box');

    if (!badge || !box) return;

    badge.innerText = state;

    if (state === "ON") {
        box.classList.add('active');
         btnOn.className = "btn btn-inactive"; // Dark
        btnOff.className = "btn btn-off"; // Red
    } else {
        box.classList.remove('active');
        btnOn.className = "btn btn-on"; // Green
        btnOff.className = "btn btn-inactive"; // Dark
        stopTimer(id);
    }
}

function writeLog(msg, color) {
    const logDiv = document.getElementById('debug-log');
    if (!logDiv) return;
    const time = new Date().toLocaleTimeString([], { hour12: false });
    logDiv.innerHTML += `<div><span class="log-time">[${time}]</span> <span style="color:${color}">${msg}</span></div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
}

// Heartbeat Loop
setInterval(() => {
    const elapsed = Math.round((Date.now() - lastSignalTime) / 1000);
    const display = document.getElementById('heartbeat-timer');
    if (display) {
        display.innerText = `Signal: ${elapsed}s ago`;
        display.style.color = elapsed > 30 ? "#ef4444" : "#94a3b8";
    }
}, 1000);
