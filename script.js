/* =========================================
    MYCOTECH BETA - MASTER JAVASCRIPT
    =========================================
    Project: Remote Mushroom Lab Dashboard
    Logic: Action-Ready Button States
    Connection: HiveMQ Cloud (MQTT)
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

// --- 2. PWA INSTALLATION & SHARING ---

// Capture the browser's install prompt
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('install-pwa-btn');
    if (installBtn) installBtn.style.display = 'block';
});

// Hide the install link once installed
window.addEventListener('appinstalled', () => {
    const installBtn = document.getElementById('install-pwa-btn');
    if (installBtn) installBtn.style.display = 'none';
    deferredPrompt = null;
    writeLog("SYSTEM: Mycotech Dashboard installed", "#10b981");
});

// Function linked to your "+ Install App" header link
async function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        writeLog(`Install prompt: ${outcome}`, "#3b82f6");
        deferredPrompt = null;
    }
}

// Function linked to your "Share Dashboard" header link
async function shareDashboard() {
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Mycotech Beta',
                text: 'Mushroom Lab Remote Control',
                url: window.location.href
            });
        } catch (err) {
            writeLog("Share closed", "#94a3b8");
        }
    } else {
        writeLog("Sharing not supported on this browser", "#ef4444");
    }
}

// Register Service Worker for PWA compliance
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log("Service Worker Active"));
}

// --- 3. MQTT CONNECTION & HANDLING ---

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

    // Handle feedback from ESP32 (Current State)
    if (topic.includes("/status")) {
        const id = topic.split('/')[2];
        writeLog(`FEEDBACK: ${getDeviceName(id)} is ${payload}`, "#94a3b8");
        updateRelayUI(id, payload);
    }
    
    // Handle LWT (Last Will and Testament) availability
    if (topic.includes("/availability")) {
        updateStatus(payload, payload === "ONLINE" ? "online" : "offline");
        writeLog(`SYSTEM: ${payload}`, "#fbbf24");
    }
};

client.onConnectionLost = (res) => {
    updateStatus("OFFLINE", "offline");
    writeLog("Lost connection to broker", "#ef4444");
    setTimeout(connectMQTT, 5000); // Auto-reconnect
};

// --- 4. RELAY COMMANDS & TIMER LOGIC ---

function publishCommand(num, val) {
    if (!client.isConnected()) {
        writeLog("OFFLINE: Cannot send command", "#ef4444");
        return;
    }
    const message = new Paho.MQTT.Message(val);
    message.destinationName = `home/relay/${num}`;
    message.retained = true; 
    client.send(message);

    writeLog(`SENT: ${getDeviceName(num)} -> ${val}`, "#3b82f6");

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
    writeLog(`TIMER: ${getDeviceName(num)} auto-off in ${seconds}s`, "#fbbf24");

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

// --- 5. UI UPDATES & UTILITIES ---

function updateRelayUI(id, state) {
    const badge = document.getElementById(`badge-${id}`);
    const btnOn = document.getElementById(`btn-on-${id}`);
    const btnOff = document.getElementById(`btn-off-${id}`);
    if (!badge || !btnOn || !btnOff) return;
    
    const box = badge.closest('.relay-box');
    badge.innerText = state;

    if (state === "ON") {
        box.classList.add('active'); 
        // Logic: Device is ON, so the ON button is dimmed and OFF is bright red
        btnOn.className = "btn btn-inactive"; 
        btnOff.className = "btn btn-off"; 
    } else {
        box.classList.remove('active'); 
        // Logic: Device is OFF, so the OFF button is dimmed and ON is bright green
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

function getDeviceName(id) {
    const box = document.querySelector(`.relay-box[data-relay="${id}"]`);
    if (box) {
        const nameSpan = box.querySelector('.device-name');
        return nameSpan ? nameSpan.innerText : `Relay ${id}`;
    }
    return `Relay ${id}`;
}

function writeLog(msg, color) {
    const logDiv = document.getElementById('debug-log');
    if (!logDiv) return;
    const time = new Date().toLocaleTimeString([], { hour12: false });
    logDiv.innerHTML += `<div><span class="log-time">[${time}]</span> <span style="color:${color}">${msg}</span></div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
}

// --- 6. INITIALIZATION ---

window.addEventListener('DOMContentLoaded', () => {
    // Log toggle button logic
    document.getElementById('toggle-log-btn').onclick = function() {
        const log = document.getElementById('debug-log');
        const isHidden = log.style.display === 'none' || log.style.display === '';
        log.style.display = isHidden ? 'block' : 'none';
        this.innerText = isHidden ? "HIDE SYSTEM LOG" : "SHOW SYSTEM LOG";
    };

    connectMQTT();
});

// Heartbeat Loop (updates "Signal: X seconds ago")
setInterval(() => {
    const elapsed = Math.round((Date.now() - lastSignalTime) / 1000);
    const display = document.getElementById('heartbeat-timer');
    if (display) {
        display.innerText = `Signal: ${elapsed}s ago`;
        display.style.color = elapsed > 30 ? "#ef4444" : "#94a3b8";
    }
}, 1000);
