// --- 1. CONFIGURATION ---
const HOST = "64b3984aead9464a9b1aa9c3f34080bb.s1.eu.hivemq.cloud";
const PORT = 8884; 
const USER = "najibyazbeck";
const PASS = "Zaqwsx123*";
const CLIENT_ID = "Mycotech_Beta_" + Math.random().toString(16).substr(2, 6);

const relayNames = ["Misting System", "Circulation Fan", "CO2 Exhaust", "Light Control"];
let activeTimers = {}; 
const client = new Paho.MQTT.Client(HOST, PORT, CLIENT_ID);

// --- 2. UI INITIALIZATION ---
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
                    <label style="font-size:0.7rem; color:#94a3b8">AUTO-OFF (SEC):</label>
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
        this.innerText = isHidden ? "HIDE SYSTEM LOG" : "SHOW SYSTEM LOG";
    };

    connectMQTT();
});

// --- 3. MQTT CONNECT & STATUS ---
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

function updateStatus(text, status) {
    const bar = document.getElementById('status-bar');
    if (!bar) return;
    bar.innerText = text;
    if (status === "online") {
        bar.classList.add('online-bg');
        bar.classList.remove('offline-bg');
    } else {
        bar.classList.add('offline-bg');
        bar.classList.remove('online-bg');
    }
}

// --- 4. MESSAGE HANDLING ---
client.onMessageArrived = (message) => {
    const topic = message.destinationName;
    const payload = message.payloadString;

    if (topic.includes("/status")) {
        const i = topic.split('/')[2];
        updateRelayUI(i, payload);
    }
    
    if (topic.includes("/availability")) {
        updateStatus(payload, payload === "ONLINE" ? "online" : "offline");
    }

    if (topic.includes("/log")) {
        writeLog(`SYSTEM: ${payload}`, "#3b82f6");
    }
};

client.onConnectionLost = (res) => {
    updateStatus("OFFLINE", "offline");
    writeLog("Connection Lost: " + res.errorMessage, "#ef4444");
    setTimeout(connectMQTT, 5000);
};

// --- 5. TIMER ENGINE ---
function publishCommand(num, val) {
    const message = new Paho.MQTT.Message(val);
    message.destinationName = `home/relay/${num}`;
    message.retained = true; 
    client.send(message);

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

// --- 6. HELPERS ---
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
    const time = new Date().toLocaleTimeString();
    logDiv.innerHTML += `<div style="color:${color}">[${time}] ${msg}</div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
}