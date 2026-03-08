// --- CONFIG ---
const HOST = "64b3984aead9464a9b1aa9c3f34080bb.s1.eu.hivemq.cloud";
const PORT = 8884; 
const USER = "najibyazbeck";
const PASS = "Zaqwsx123*";
const CLIENT_ID = "Mycotech_Beta_" + Math.random().toString(16).substr(2, 6);

const relayNames = ["Misting System 1", "Circulation Fan 2", "CO2 Exhaust 3", "Light Control 4"];
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
                    <span id="badge-${i}" style="color:#94a3b8">OFF</span>
                </div>
                <div class="timer-row">
                    <label style="font-size:0.7rem; color:#94a3b8">SEC:</label>
                    <input type="number" id="timer-input-${i}" value="0" min="0">
                    <span id="countdown-${i}" class="countdown"></span>
                </div>
                <div class="btn-group">
                    <button id="btn-on-${i}" class="btn btn-on" onclick="publishCommand(${i}, 'ON')">ON</button>
                    <button id="btn-off-${i}" class="btn btn-inactive" onclick="publishCommand(${i}, 'OFF')">OFF</button>
                </div>
            </div>`;
    });

    document.getElementById('toggle-log-btn').onclick = function() {
        const log = document.getElementById('debug-log');
        const isHidden = log.style.display === 'none' || log.style.display === '';
        log.style.display = isHidden ? 'block' : 'none';
        this.innerText = isHidden ? "HIDE LOG" : "SHOW LOG";
    };

    connectMQTT();
});

// --- MQTT STATUS HANDLING ---
function updateStatus(text, status) {
    const bar = document.getElementById('status-bar');
    if (!bar) return;
    bar.innerText = text;
    if (status === "online") {
        bar.classList.add('is-online');
        bar.classList.remove('is-offline');
    } else {
        bar.classList.add('is-offline');
        bar.classList.remove('is-online');
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
    const topic = message.destinationName;
    const payload = message.payloadString;

    // 1. Handle Relay Status Updates from ESP32
    if (topic.includes("/status")) {
        const id = topic.split('/')[2];
        writeLog(`FEEDBACK: ${relayNames[id-1]} is physically ${payload}`, "#94a3b8");
        updateRelayUI(id, payload);
    }
    
    // 2. Handle Availability (Last Will)
    if (topic.includes("/availability")) {
        updateStatus(payload, payload === "ONLINE" ? "online" : "offline");
        writeLog(`SYSTEM: Device is now ${payload}`, "#fbbf24");
    }

    // 3. Handle Boot Logs (If you reset the ESP32)
    if (topic.includes("/log")) {
        writeLog(`BOOT DATA: ${payload}`, "#3b82f6");
    }
};

client.onConnectionLost = (res) => {
    updateStatus("OFFLINE", "offline");
    writeLog("Dashboard disconnected from Broker", "#ef4444");
    setTimeout(connectMQTT, 5000);
};

// --- TIMER & COMMANDS ---
function publishCommand(num, val) {
    if (!client.isConnected()) {
        writeLog("CANNOT SEND: MQTT Disconnected", "#ef4444");
        return;
    }

    const message = new Paho.MQTT.Message(val);
    message.destinationName = `home/relay/${num}`;
    message.retained = true; 
    client.send(message);

    // LOG THE OUTGOING COMMAND
    writeLog(`COMMAND: Turn ${relayNames[num-1]} ${val}`, "#f8fafc");

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
    
    writeLog(`TIMER: ${relayNames[num-1]} set for ${seconds}s auto-off`, "#fbbf24");

    activeTimers[num] = setInterval(() => {
        timeLeft--;
        display.innerText = `⏱ ${timeLeft}s`;
        if (timeLeft <= 0) {
            writeLog(`TIMER EXPIRED: Shutting down ${relayNames[num-1]}`, "#ef4444");
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
    if (!badge) return;

    badge.innerText = state;
    if (state === "ON") {
        badge.style.color = "#10b981";
        btnOn.className = "btn btn-inactive";
        btnOff.className = "btn btn-off";
    } else {
        badge.style.color = "#94a3b8";
        btnOn.className = "btn btn-on";
        btnOff.className = "btn btn-inactive";
        stopTimer(id);
    }
}

function writeLog(msg, color) {
    const logDiv = document.getElementById('debug-log');
    if (!logDiv) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    logDiv.innerHTML += `<div style="color:${color}">[${time}] ${msg}</div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
}