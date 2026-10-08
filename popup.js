const statusEl = document.getElementById("status");
const thresholdEl = document.getElementById("threshold");
const thresholdValueEl = document.getElementById("thresholdValue");
const debounceEl = document.getElementById("debounce");
const debounceValueEl = document.getElementById("debounceValue");
const debugEl = document.getElementById("debug");

function setStatus(text) {
    statusEl.textContent = text;
}

async function initPopup() {
    const settings = await loadSafeSignalSettings();

    thresholdEl.value = Math.round(settings.toxicityThreshold * 100);
    thresholdValueEl.textContent = Number(settings.toxicityThreshold).toFixed(2);
    debounceEl.value = settings.debounceMs;
    debounceValueEl.textContent = settings.debounceMs;
    debugEl.checked = Boolean(settings.debug);

    chrome.runtime.sendMessage(
        { target: "background", type: "ENSURE_ENGINE" },
        (response) => {
            if (chrome.runtime.lastError) {
                setStatus("Error");
                return;
            }
            setStatus(response && response.ok ? "Active" : "Model error");
        }
    );
}

thresholdEl.addEventListener("input", () => {
    const value = Number(thresholdEl.value) / 100;
    thresholdValueEl.textContent = value.toFixed(2);
    chrome.storage.local.set({ toxicityThreshold: value });
});

debounceEl.addEventListener("input", () => {
    const value = Number(debounceEl.value);
    debounceValueEl.textContent = value;
    chrome.storage.local.set({ debounceMs: value });
});

debugEl.addEventListener("change", () => {
    chrome.storage.local.set({ debug: debugEl.checked });
});

initPopup();
