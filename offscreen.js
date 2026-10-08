let enginePromise = null;
let inferenceQueue = Promise.resolve();
const predictionCache = new Map();

function cacheGet(text) {
    return predictionCache.get(text);
}

function cacheSet(text, result) {
    if (predictionCache.has(text)) {
        predictionCache.delete(text);
    }
    predictionCache.set(text, result);
    if (predictionCache.size > SafeSignalConfig.CACHE_SIZE) {
        const oldest = predictionCache.keys().next().value;
        predictionCache.delete(oldest);
    }
}

async function ensureEngine(settings) {
    applySafeSignalSettings(settings);

    if (!enginePromise) {
        enginePromise = (async () => {
            safeSignalLog("ML engine initializing");
            await initializeModel();
            safeSignalLog("ML engine initialized");
            return { ok: true, ready: true };
        })().catch((error) => {
            enginePromise = null;
            throw error;
        });
    }

    return enginePromise;
}

function classify(probability) {
    const threshold = SafeSignalConfig.TOXICITY_THRESHOLD;
    const toxic = probability >= threshold;
    return {
        probability,
        threshold,
        toxic,
        label: toxic ? 1 : 0
    };
}

async function runPredict(text, settings) {
    await ensureEngine(settings);

    const cached = cacheGet(text);
    if (cached) {
        const result = classify(cached.probability);
        safeSignalLog("Cache hit", { toxic: result.toxic });
        return { ok: true, cached: true, ...result };
    }

    safeSignalLog("Running inference");
    const raw = await predictBullying(text);
    cacheSet(text, { probability: raw.probability });
    const result = classify(raw.probability);
    safeSignalLog("Prediction: toxic=" + result.probability.toFixed(2), result);
    return { ok: true, cached: false, ...result };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.target !== "offscreen") {
        return;
    }

    if (message.type === "ENSURE_ENGINE") {
        ensureEngine(message.settings)
            .then((result) => sendResponse(result))
            .catch((error) => {
                safeSignalError("ML engine failed to initialize", error);
                sendResponse({
                    ok: false,
                    ready: false,
                    error: error && error.message ? error.message : String(error)
                });
            });
        return true;
    }

    if (message.type === "PREDICT") {
        const text = typeof message.text === "string" ? message.text : "";
        inferenceQueue = inferenceQueue
            .then(() => runPredict(text, message.settings))
            .catch((error) => {
                safeSignalError("Inference failed", error);
                return {
                    ok: false,
                    error: error && error.message ? error.message : String(error)
                };
            });

        inferenceQueue.then(sendResponse);
        return true;
    }
});

ensureEngine().catch((error) => {
    safeSignalError("Startup engine load failed", error);
});
