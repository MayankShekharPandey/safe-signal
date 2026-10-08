const SafeSignalConfig = {
    TOXICITY_THRESHOLD: 0.90,
    DEBOUNCE_MS: 500,
    MIN_TEXT_LENGTH: 3,
    MAX_TEXT_LENGTH: 4000,
    CACHE_SIZE: 64,
    DEBUG: true
};

function safeSignalLog(message, extra) {
    if (!SafeSignalConfig.DEBUG) {
        return;
    }
    if (extra !== undefined) {
        console.log("[CyberGuard]", message, extra);
    } else {
        console.log("[CyberGuard]", message);
    }
}

function safeSignalWarn(message, extra) {
    if (extra !== undefined) {
        console.warn("[CyberGuard]", message, extra);
    } else {
        console.warn("[CyberGuard]", message);
    }
}

function safeSignalError(message, extra) {
    if (extra !== undefined) {
        console.error("[CyberGuard]", message, extra);
    } else {
        console.error("[CyberGuard]", message);
    }
}

async function loadSafeSignalSettings() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        return {
            toxicityThreshold: SafeSignalConfig.TOXICITY_THRESHOLD,
            debounceMs: SafeSignalConfig.DEBOUNCE_MS,
            debug: SafeSignalConfig.DEBUG
        };
    }

    const stored = await chrome.storage.local.get({
        toxicityThreshold: SafeSignalConfig.TOXICITY_THRESHOLD,
        debounceMs: SafeSignalConfig.DEBOUNCE_MS,
        debug: SafeSignalConfig.DEBUG
    });

    SafeSignalConfig.TOXICITY_THRESHOLD = Number(stored.toxicityThreshold);
    SafeSignalConfig.DEBOUNCE_MS = Number(stored.debounceMs);
    SafeSignalConfig.DEBUG = Boolean(stored.debug);

    if (!Number.isFinite(SafeSignalConfig.TOXICITY_THRESHOLD)) {
        SafeSignalConfig.TOXICITY_THRESHOLD = 0.90;
    }
    if (!Number.isFinite(SafeSignalConfig.DEBOUNCE_MS)) {
        SafeSignalConfig.DEBOUNCE_MS = 500;
    }

    return stored;
}

function applySafeSignalSettings(settings) {
    if (!settings || typeof settings !== "object") {
        return;
    }

    if (settings.toxicityThreshold !== undefined) {
        const threshold = Number(settings.toxicityThreshold);
        if (Number.isFinite(threshold)) {
            SafeSignalConfig.TOXICITY_THRESHOLD = threshold;
        }
    }

    if (settings.debounceMs !== undefined) {
        const debounceMs = Number(settings.debounceMs);
        if (Number.isFinite(debounceMs)) {
            SafeSignalConfig.DEBOUNCE_MS = debounceMs;
        }
    }

    if (settings.debug !== undefined) {
        SafeSignalConfig.DEBUG = Boolean(settings.debug);
    }
}

function listenSafeSignalSettings(callback) {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.onChanged) {
        return;
    }

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") {
            return;
        }

        const next = {};
        if (changes.debug) {
            next.debug = changes.debug.newValue;
        }
        if (changes.debounceMs) {
            next.debounceMs = changes.debounceMs.newValue;
        }
        if (changes.toxicityThreshold) {
            next.toxicityThreshold = changes.toxicityThreshold.newValue;
        }

        applySafeSignalSettings(next);
        if (typeof callback === "function") {
            callback(next);
        }
    });
}
