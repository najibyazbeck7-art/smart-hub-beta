// --- 1. CONFIGURATION & GLOBALS ---
const HOST = "64b3984aead9464a9b1aa9c3f34080bb.s1.eu.hivemq.cloud";
const PORT = 8884; 
const USER = "najibyazbeck";
const PASS = "Zaqwsx123*";
const CLIENT_ID = "WebDash_" + Math.random().toString(16).substr(2, 6);

let lastSeen = null;
let deferredPrompt;
const bannerId = 'install-banner';
const client = new Paho.MQTT.Client(HOST, PORT, CLIENT_ID);

// --- 2. CORE UTILITIES ---
function getNow() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function log(msg, color="#10b981") {
    const div = document.getElementById('debug-log');
    if (div) {
        div.innerHTML += `<div><span class="log-time">[${getNow()}]</span><span style="color:${color}"> ${msg}</span></div>`;
        div.scrollTop = div.scrollHeight;
    }
}

// --- 3. UI GENERATION & INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    // Generate Relay Cards
    const container = document.getElementById('relay-container');
    if (container) {
        container.innerHTML = ''; 
        for(let i=1; i<=4; i++) {
            container.innerHTML += `
                <div id="card-${i}" class="relay-box">
                    <div class="relay-label">
                        <span>Relay ${i}</span>
                        <span id="badge-${i}" class="state-indicator">OFF</span>
                    </div>
                    <div id="time-${i}" class="relay-time">Last action: Never</div>
                    <div class="btn-group">
                        <button id="btn-on-${i}" class="btn btn-action-on" onclick="publishCommand(${i}, 'ON')">ON</button>
                        <button id="btn-off-${i}" class="btn btn-inactive" onclick="publishCommand(${i}, 'OFF')">OFF</button>
                    </div>
                </div>
            `;
        }
    }

    // Toggle Log Visibility Logic
    const toggleLogBtn = document.getElementById('toggle-log-btn');
    const logWindow = document.getElementById('debug-log');
    if (toggleLogBtn && logWindow) {
        toggleLogBtn.addEventListener('click', () => {
            const isVisible = logWindow.classList.toggle('visible');
            toggleLogBtn.innerText = isVisible ? "HIDE LOG" : "SHOW LOG";
            if (isVisible) logWindow.scrollTop = logWindow.scrollHeight;
        });
    }
    
    log("UI Initialized. Ready.");
    connectMQTT();
});

// --- 4. MQTT LOGIC ---
client.onConnectionLost = (err) => {
    const bar = document.getElementById('status-bar');
    // Using the new 'status-pill' class for the compact design
    if (bar) {
        bar.className = "status-pill offline";
        bar.innerText = "OFFLINE";
    }
    log("Connection Lost: " + err.errorMessage, "red");
    setTimeout(connectMQTT, 5000);
};

client.onMessageArrived = (msg) => {
    const topic = msg.destinationName;
    const payload = msg.payloadString;
    const currentTime = getNow();
    lastSeen = Date.now();

    if (topic === "home/relay/system/availability") {
        const bar = document.getElementById('status-bar');
        if (bar) {
            bar.innerText = payload;
            bar.className = (payload === "ONLINE") ? "status-pill online" : "status-pill offline";
        }
        log(`System: ${payload}`);
    } 
    else if (topic.includes("/status")) {
        const relayId = topic.split('/')[2];
        const badge = document.getElementById(`badge-${relayId}`);
        const card = document.getElementById(`card-${relayId}`);
        const btnOn = document.getElementById(`btn-on-${relayId}`);
        const btnOff = document.getElementById(`btn-off-${relayId}`);
        const timeLabel = document.getElementById(`time-${relayId}`);
        
        if (badge) {
            badge.innerText = payload;
            timeLabel.innerText = `Last action: ${currentTime}`;

            if (payload === "ON") {
                badge.style.color = "#10b981";
                card.classList.add('active');
                btnOn.className = "btn btn-inactive";
                btnOff.className = "btn btn-action-off";
            } else {
                badge.style.color = "#94a3b8";
                card.classList.remove('active');
                btnOn.className = "btn btn-action-on";
                btnOff.className = "btn btn-inactive";
            }
        }
    }
};

function connectMQTT() {
    log("Connecting...");
    client.connect({
        userName: USER, password: PASS, useSSL: true,
        onSuccess: () => {
            log("Connected");
            client.subscribe("home/relay/+/status");
            client.subscribe("home/relay/system/availability");
        },
        onFailure: (err) => log("MQTT Fail: " + JSON.stringify(err), "red")
    });
}

function publishCommand(num, val) {
    if (!client.isConnected()) return;
    const message = new Paho.MQTT.Message(val);
    message.destinationName = `home/relay/${num}`;
    message.retained = true; 
    client.send(message);
    log(`Sent: Relay ${num} ${val}`, "#3b82f6");
}

// --- 5. PWA INSTALLATION LOGIC ---
function createInstallBanner() {
    if (document.getElementById(bannerId)) return;
    const banner = document.createElement('div');
    banner.id = bannerId;
    banner.style = "display:none; background:#3b82f6; color:white; padding:12px; position:fixed; top:0; left:0; width:100%; z-index:9999; text-align:center; font-weight:bold; box-shadow:0 4px 10px rgba(0,0,0,0.3);";
    banner.innerHTML = `
        Install Mycotech Hub? 
        <button onclick="triggerInstall()" style="margin-left:15px; background:white; color:#3b82f6; border:none; padding:5px 12px; border-radius:5px; font-weight:bold; cursor:pointer;">ADD</button>
        <button onclick="this.parentElement.style.display='none'" style="margin-left:10px; background:transparent; color:white; border:1px solid white; padding:2px 8px; border-radius:5px; cursor:pointer;">X</button>
    `;
    document.body.prepend(banner);
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    createInstallBanner();
    document.getElementById(bannerId).style.display = 'block';
});

async function triggerInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
        document.getElementById(bannerId).style.display = 'none';
    }
    deferredPrompt = null;
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js', { scope: './' });
}

// --- 6. HEARTBEAT MONITOR ---
setInterval(() => {
    if (lastSeen) {
        const seconds = Math.floor((Date.now() - lastSeen) / 1000);
        const timer = document.getElementById('heartbeat-timer');
        if (timer) {
            timer.innerText = `Signal: ${seconds}s ago`;
            timer.style.color = (seconds > 30) ? "#ef4444" : "#94a3b8";
        }
    }
}, 1000);
