// --- CONFIG ---
let lastSignalTime = Date.now();
const HOST = "64b3984aead9464a9b1aa9c3f34080bb.s1.eu.hivemq.cloud";
const PORT = 8884; 
const USER = "najibyazbeck";
const PASS = "Zaqwsx123*";
const CLIENT_ID = "Mycotech_Beta_" + Math.random().toString(16).substr(2, 6);

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    
    // Show your custom "Install" button (make sure you have this button in your HTML)
    const installBtn = document.getElementById('install-pwa-btn');
    if (installBtn) installBtn.style.display = 'block';
});


if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log("Service Worker Registered"));
}

async function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        writeLog(`Install prompt outcome: ${outcome}`, "#3b82f6");
        deferredPrompt = null;
    }
}


let activeTimers = {}; 
const client = new Paho.MQTT.Client(HOST, PORT, CLIENT_ID);

/**
 * HELPER: Reads the device name directly from the HTML span.
 * This allows you to rename things in index.html without touching JS.
 */
function getDeviceName(id) {
    const box = document.querySelector(`.relay-box[data-relay="${id}"]`);
    if (box) {
        const nameSpan = box.querySelector('.device-name');
        return nameSpan ? nameSpan.innerText : `Relay ${id}`;
    }
    return `Relay ${id}`;
}

// --- UI SETUP ---
window.addEventListener('DOMContentLoaded', () => {
    // We no longer regenerate the HTML here so that your manual edits in index.html stay.
    
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
        writeLog(`FEEDBACK: ${getDeviceName(id)} is ${payload}`, "#94a3b8");
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

function updateRelayUI(id, state) {
    const badge = document.getElementById(`badge-${id}`);
    const btnOn = document.getElementById(`btn-on-${id}`);
    const btnOff = document.getElementById(`btn-off-${id}`);
    if (!badge) return;
    const box = badge.closest('.relay-box');

    badge.innerText = state;

    if (state === "ON") {
        box.classList.add('active');
        // REVERSED: ON Button is Green, OFF Button is Dark
        btnOn.className = "btn btn-inactive"; 
        btnOff.className = "btn btn-off";
    } else {
        box.classList.remove('active');
        // REVERSED: OFF Button is Red, ON Button is Dark
        btnOn.className = "btn btn-on"; 
        btnOff.className = "btn btn-inactive";
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
