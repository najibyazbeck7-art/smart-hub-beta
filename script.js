/* =========================================
    MYCOTECH BETA - MASTER JAVASCRIPT
    =========================================
    Project: Remote Mushroom Lab Dashboard
    Logic: Action-Ready Button States + Settings Persistence
    =========================================
*/

// --- 1. CONFIGURATION & GLOBALS ---
let lastSignalTime = Date.now();
const HOST = "64b3984aead9464a9b1aa9c3f34080bb.s1.eu.hivemq.cloud";
const PORT = 8884; 
const USER = "najibyazbeck";
const PASS = "Zaqwsx123*";
const CLIENT_ID = "Mycotech_Beta_" + Math.random().toString(16).substr(2, 6);

let deferredPrompt;
let activeTimers = {}; 
const client = new Paho.MQTT.Client(HOST, PORT, CLIENT_ID);

// --- 2. PWA & SYSTEM ---

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => console.log("SW Active"));
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('install-pwa-btn');
    if (installBtn) installBtn.style.display = 'block';
});

async function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt = null;
    }
}

// --- 3. MQTT CONNECTION ---

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

client.onMessageArrived = (message) => {
    lastSignalTime = Date.now(); 
    const topic = message.destinationName;
    const payload = message.payloadString;

    if (topic.includes("/status")) {
        const id = topic.split('/')[2];
        writeLog(`FEEDBACK: ${getDeviceName(id)} is ${payload}`, "#94a3b8");
        updateRelayUI(id, payload);
    }
    
    if (topic.includes("/availability")) {
        updateStatus(payload, payload === "ONLINE" ? "online" : "offline");
        writeLog(`SYSTEM: ${payload}`, "#fbbf24");
    }
};

client.onConnectionLost = () => {
    updateStatus("OFFLINE", "offline");
    setTimeout(connectMQTT, 5000);
};

// --- 4. RELAY & TIMER LOGIC ---

function publishCommand(num, val) {
    if (!client.isConnected()) return;
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
        const display = document.getElementById(`countdown-${num}`);
        if(display) display.innerText = "";
    }
}

// --- 5. SETTINGS & PERSISTENCE ---

function toggleView() {
    const mainView = document.getElementById('main-view');
    const settingsView = document.getElementById('settings-view');
    const navBtn = document.getElementById('nav-btn');

    if (mainView.classList.contains('view-active')) {
        // Switching TO Settings
        mainView.classList.replace('view-active', 'view-hidden');
        settingsView.classList.replace('view-hidden', 'view-active');
        // Only show the X icon, no text
        navBtn.innerHTML = '<span class="gear-icon" style="color: #ef4444;">✖</span>'; 
        loadSettingsInputs();
    } else {
        // Switching BACK to Dashboard
        settingsView.classList.replace('view-active', 'view-hidden');
        mainView.classList.replace('view-hidden', 'view-active');
        // Only show the Gear icon, no text
        navBtn.innerHTML = '<span class="gear-icon">⚙️</span>'; 
    }
}

function loadSettingsInputs() {
    for (let i = 1; i <= 4; i++) {
        const saved = localStorage.getItem(`relay-name-${i}`);
        if (saved) document.getElementById(`name-input-${i}`).value = saved;
    }
    const logVis = localStorage.getItem('show-log-button') === 'true';
    document.getElementById('log-vis-checkbox').checked = logVis;
}

function saveAllSettings() {
    for (let i = 1; i <= 4; i++) {
        const val = document.getElementById(`name-input-${i}`).value;
        if (val) localStorage.setItem(`relay-name-${i}`, val);
    }
    const logVis = document.getElementById('log-vis-checkbox').checked;
    localStorage.setItem('show-log-button', logVis);
    
    applyNamesToDashboard();
    toggleView();
    writeLog("SYSTEM: Settings Saved", "#34d399");
}

function applyNamesToDashboard() {
    for (let i = 1; i <= 4; i++) {
        const savedName = localStorage.getItem(`relay-name-${i}`);
        if (savedName) {
            const label = document.querySelector(`.relay-box[data-relay="${i}"] .device-name`);
            if (label) label.innerText = savedName;
        }
    }
    const showLog = localStorage.getItem('show-log-button') === 'true';
    const logBtn = document.getElementById('toggle-log-btn');
    if (logBtn) logBtn.style.display = showLog ? 'block' : 'none';
}

// --- 6. UI UTILITIES ---

function getDeviceName(id) {
    return localStorage.getItem(`relay-name-${id}`) || `Relay ${id}`;
}

function updateRelayUI(id, state) {
    const badge = document.getElementById(`badge-${id}`);
    const btnOn = document.getElementById(`btn-on-${id}`);
    const btnOff = document.getElementById(`btn-off-${id}`);
    const box = badge.closest('.relay-box');
    
    badge.innerText = state;
    if (state === "ON") {
        box.classList.add('active');
        btnOn.className = "btn btn-inactive";
        btnOff.className = "btn btn-off";
    } else {
        box.classList.remove('active');
        btnOn.className = "btn btn-on";
        btnOff.className = "btn btn-inactive";
        stopTimer(id);
    }
}

function updateStatus(text, status) {
    const bar = document.getElementById('status-bar');
    if (!bar) return;
    bar.innerText = text;
    bar.className = (status === "online") ? 'status-pill is-online' : 'status-pill is-offline';
}

function writeLog(msg, color) {
    const logDiv = document.getElementById('debug-log');
    if (!logDiv) return;
    const time = new Date().toLocaleTimeString([], { hour12: false });
    logDiv.innerHTML += `<div><span class="log-time">[${time}]</span> <span style="color:${color}">${msg}</span></div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
}

// --- 7. INITIALIZATION ---

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('toggle-log-btn').onclick = function() {
        const log = document.getElementById('debug-log');
        const isHidden = log.style.display === 'none' || log.style.display === '';
        log.style.display = isHidden ? 'block' : 'none';
        this.innerText = isHidden ? "HIDE LOG" : "SHOW LOG";
    };

    applyNamesToDashboard();
    connectMQTT();
});

setInterval(() => {
    const elapsed = Math.round((Date.now() - lastSignalTime) / 1000);
    const display = document.getElementById('heartbeat-timer');
    if (display) {
        display.innerText = `Signal: ${elapsed}s ago`;
        display.style.color = elapsed > 30 ? "#ef4444" : "#94a3b8";
    }
}, 1000);
