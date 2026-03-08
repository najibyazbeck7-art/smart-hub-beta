// --- 1. CONFIGURATION & GLOBALS ---
const HOST = "64b3984aead9464a9b1aa9c3f34080bb.s1.eu.hivemq.cloud";
const PORT = 8884; 
const USER = "najibyazbeck";
const PASS = "Zaqwsx123*";
// Random ID prevents one login from kicking the other out
const CLIENT_ID = "Mycotech_Beta_" + Math.random().toString(16).substr(2, 6);

const relayNames = ["Misting System", "Circulation Fan", "CO2 Exhaust", "Light Control"];
let activeTimers = {}; 
const client = new Paho.MQTT.Client(HOST, PORT, CLIENT_ID);

// --- 2. UI INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('relay-container');
    if (container) {
        container.innerHTML = ''; 
        relayNames.forEach((name, index) => {
            const i = index + 1;
            container.innerHTML += `
                <div id="card-${i}" class="relay-box">
                    <div class="relay-label">
                        <span>${name}</span>
                        <span id="badge-${i}" style="color:#94a3b8">OFFLINE</span>
                    </div>
                    <div class="timer-row">
                        <label style="font-size:0.7rem; color:#94a3b8">TIMER (SEC):</label>
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

    // Toggle Log Visibility
    const toggleBtn = document.getElementById('toggle-log-btn');
    if (toggleBtn) {
        toggleBtn.onclick = () => {
            const logDiv = document.getElementById('debug-log');
            const isHidden = logDiv.style.display === 'none' || logDiv.style.display === '';
            logDiv.style.display = isHidden ? 'block' : 'none';
            toggleBtn.innerText = isHidden ? "HIDE SYSTEM LOG" : "SHOW SYSTEM LOG";
        };
    }

    connectMQTT();
});

// --- 3. MQTT LOGIC ---
function connectMQTT() {
    console.log("Attempting to connect...");
    client.connect({
        userName: USER,
        password: PASS,
        useSSL: true,
        onSuccess: onConnect,
        onFailure: (err) => {
            updateStatus("CONNECTION FAILED", "offline");
            console.log(err);
        }
    });
}

function onConnect() {
    updateStatus("ONLINE", "online");
    // Subscribe to all necessary topics
    client.subscribe("home/relay/+/status");
    client.subscribe("home/relay/system/availability");
    client.subscribe("home/relay/system/log");
    
    writeLog("Connected to HiveMQ Cloud", "#10b981");
}

client.onConnectionLost = (responseObject) => {
    updateStatus("OFFLINE", "offline");
    writeLog("Connection Lost: " + responseObject.errorMessage, "#ef4444");
    setTimeout(connectMQTT, 5000); // Auto-reconnect
};

client.onMessageArrived = (message) => {
    const topic = message.destinationName;
    const payload = message.payloadString;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Handle System Logs (IP Address, Boot messages)
    if (topic === "home/relay/system/log") {
        writeLog(`SYSTEM: ${payload}`, "#3b82f6");
    }

    // Handle Relay Status Updates
    if (topic.includes("/status")) {
        const i = topic.split('/')[2];
        updateRelayUI(i, payload);
    }
    
    // Handle Availability
    if (topic.includes("availability")) {
        updateStatus(payload, payload === "ONLINE" ? "online" : "offline");
    }
};

// --- 4. COMMAND & TIMER ENGINE ---
function publishCommand(num, val) {
    if (!client.isConnected()) {
        writeLog("Error: Not connected to MQTT", "#ef4444");
        return;
    }

    const message = new Paho.MQTT.Message(val);
    message.destinationName = `home/relay/${num}`;
    message.retained = true; 
    client.send(message);

    if (val === "ON") {
        const seconds = parseInt(document.getElementById(`timer-input-${num}`).value);
        if (seconds > 0) {
            startTimer(num, seconds);
        }
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
        display.innerText = `⏳ ${timeLeft}s`;
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

// --- 5. HELPER FUNCTIONS ---
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
        stopTimer(id); // If it turns off, clear timer
    }
}

function updateStatus(text, className) {
    const bar = document.getElementById('status-bar');
    if (bar) {
        bar.innerText = text;
        bar.className = `status-pill ${className}`;
    }
}

function writeLog(msg, color) {
    const logDiv = document.getElementById('debug-log');
    if (logDiv) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        logDiv.innerHTML += `<div style="color:${color}">[${time}] ${msg}</div>`;
        logDiv.scrollTop = logDiv.scrollHeight;
    }
}