importScripts("config.js");

let offscreenReady = null;

async function hasOffscreenDocument() {
    if (chrome.offscreen.hasDocument) {
        return chrome.offscreen.hasDocument();
    }

    const contexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"]
    });

    return contexts.length > 0;
}

async function ensureOffscreen() {
    if (offscreenReady) {
        await offscreenReady;
        return;
    }

    if (await hasOffscreenDocument()) {
        return;
    }

    offscreenReady = chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["WORKERS", "BLOBS"],
        justification: "Run on-device ONNX BERT inference without page CSP restrictions."
    }).catch(async (error) => {
        if (await hasOffscreenDocument()) {
            return;
        }
        throw error;
    });

    try {
        await offscreenReady;
        safeSignalLog("Offscreen document created");
    } finally {
        offscreenReady = null;
    }
}

async function sendToOffscreen(message) {
    await ensureOffscreen();
    const settings = await loadSafeSignalSettings();

    let lastError = null;
    for (let attempt = 0; attempt < 25; attempt += 1) {
        try {
            const response = await chrome.runtime.sendMessage({
                ...message,
                settings: settings,
                target: "offscreen"
            });
            if (response !== undefined) {
                return response;
            }
        } catch (error) {
            lastError = error;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
        await ensureOffscreen();
    }

    throw lastError || new Error("Offscreen engine did not respond.");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.target !== "background") {
        return;
    }

    if (message.type === "ENSURE_ENGINE" || message.type === "PREDICT") {
        sendToOffscreen(message)
            .then(sendResponse)
            .catch((error) => {
                safeSignalError("Background message failed", error);
                sendResponse({
                    ok: false,
                    error: error && error.message ? error.message : String(error)
                });
            });
        return true;
    }
});

chrome.runtime.onInstalled.addListener(() => {
    ensureOffscreen().catch((error) => {
        safeSignalError("Could not create offscreen document on install", error);
    });
});
