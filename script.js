/* =========================================
    MYCOTECH BETA - MASTER JAVASCRIPT
    =========================================
    Project: Remote Mushroom Lab Dashboard
    Logic: MQTT Retained Names + Log Preservation
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

const GEAR_SVG = `<svg class="gear-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z"></path><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"></path></svg>`;
const CLOSE_SVG = `<svg class="gear-svg" style="color:#ef4444" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

// --- 2. PWA ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => console.log("SW Active"));
}

// --- 3. MQTT CONNECTION ---

function connectMQTT() {
    client.connect({
        userName: USER, password: PASS, useSSL: true,
        onSuccess: () => {
            updateStatus("ONLINE", "online");
            client.subscribe("home/relay/#"); 
            writeLog("Connected to Cloud Database", "#10b981");
        },
        onFailure: (err) => {
            updateStatus("FAILED", "offline");
            writeLog("Connection Error: " + err.errorMessage, "#ef4444");
            setTimeout(connectMQTT, 5000);
        }
    });
}

client.onMessageArrived = (message) => {
    lastSignalTime = Date.now(); 
    const topic = message.destinationName;
    const payload = message.payloadString;

    if (topic.includes("/status")) {
        const id = topic.split('/')[2];
        updateRelayUI(id, payload);
        writeLog(`Relay ${id} is now ${payload}`, "#94a3b8");
    }
    
    if (topic.includes("/name")) {
        const id = topic.split('/')[2];
        localStorage.setItem(`relay-name-${id}`, payload);
        applyNamesToDashboard();
    }

    if (topic.includes("/availability")) {
        updateStatus(payload, payload === "ONLINE" ? "online" : "offline");
        writeLog(`System Status: ${payload}`, "#fbbf24");
    }
};

client.onConnectionLost = (err) => {
    updateStatus("OFFLINE", "offline");
    writeLog("Connection Lost. Reconnecting...", "#ef4444");
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

// --- 5. SETTINGS & MQTT PERSISTENCE ---

function toggleView() {
    const mainView = document.getElementById('main-view');
    const settingsView = document.getElementById('settings-view');
    const navBtn = document.getElementById('nav-btn');

    if (mainView.classList.contains('view-active')) {
        mainView.classList.replace('view-active', 'view-hidden');
        settingsView.classList.replace('view-hidden', 'view-active');
        navBtn.innerHTML = CLOSE_SVG;
        loadSettingsInputs();
    } else {
        settingsView.classList.replace('view-active', 'view-hidden');
        mainView.classList.replace('view-hidden', 'view-active');
        navBtn.innerHTML = GEAR_SVG;
    }
}

function loadSettingsInputs() {
    for (let i = 1; i <= 4; i++) {
        const saved = localStorage.getItem(`relay-name-${i}`);
        if (saved) document.getElementById(`name-input-${i}`).value = saved;
    }
    const logVis = localStorage.getItem('show-log-button') !== 'false'; // Default to true
    document.getElementById('log-vis-checkbox').checked = logVis;
}

function saveAllSettings() {
    for (let i = 1; i <= 4; i++) {
        const val = document.getElementById(`name-input-${i}`).value;
        if (val) {
            localStorage.setItem(`relay-name-${i}`, val);
            if (client.isConnected()) {
                const nameMsg = new Paho.MQTT.Message(val);
                nameMsg.destinationName = `home/relay/${i}/name`;
                nameMsg.retained = true; 
                client.send(nameMsg);
            }
        }
    }
    const logVis = document.getElementById('log-vis-checkbox').checked;
    localStorage.setItem('show-log-button', logVis);
    
    applyNamesToDashboard();
    toggleView();
    writeLog("Configuration saved & synced", "#10b981");
}

function applyNamesToDashboard() {
    for (let i = 1; i <= 4; i++) {
        const savedName = localStorage.getItem(`relay-name-${i}`);
        if (savedName) {
            const labels = document.querySelectorAll(`.relay-box[data-relay="${i}"] .device-name`);
            labels.forEach(el => el.innerText = savedName);
        }
    }
    const savedLogSetting = localStorage.getItem('show-log-button');
    const showLog = savedLogSetting === null ? true : savedLogSetting === 'true';
    const logBtn = document.getElementById('toggle-log-btn');
    if (logBtn) logBtn.style.display = showLog ? 'block' : 'none';
}

// --- 6. UI UTILITIES ---

function writeLog(msg, color) {
    const logDiv = document.getElementById('debug-log');
    if (!logDiv) return;
    const time = new Date().toLocaleTimeString([], { hour12: false });
    logDiv.innerHTML += `<div><span class="log-time">[${time}]</span> <span style="color:${color}">${msg}</span></div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
}

function updateRelayUI(id, state) {
    const badge = document.getElementById(`badge-${id}`);
    const btnOn = document.getElementById(`btn-on-${id}`);
    const btnOff = document.getElementById(`btn-off-${id}`);
    const box = document.querySelector(`.relay-box[data-relay="${id}"]`);
    
    if(!badge || !box) return;

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
    if (bar) {
        bar.innerText = text;
        bar.className = (status === "online") ? 'status-pill is-online' : 'status-pill is-offline';
    }
}

// --- 7. INITIALIZATION ---

window.addEventListener('DOMContentLoaded', () => {
    const logBtn = document.getElementById('toggle-log-btn');
    const logDiv = document.getElementById('debug-log');

    if (logBtn && logDiv) {
        logBtn.onclick = function() {
            const isHidden = logDiv.style.display === 'none' || logDiv.style.display === '';
            logDiv.style.display = isHidden ? 'block' : 'none';
            this.innerText = isHidden ? "HIDE LOG" : "SHOW LOG";
            if (isHidden) logDiv.scrollTop = logDiv.scrollHeight;
        };
    }

    applyNamesToDashboard();
    connectMQTT();
});

setInterval(() => {
    const elapsed = Math.round((Date.now() - lastSignalTime) / 1000);
    const display = document.getElementById('heartbeat-timer');
    if (display) {
        display.innerText = `${elapsed}S AGO`;
        display.style.color = elapsed > 30 ? "#ef4444" : "#94a3b8";
    }
}, 1000);
