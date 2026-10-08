let session = null;
let modelLoadPromise = null;

function configureOrtRuntime() {
    if (typeof ort === "undefined") {
        throw new Error("ONNX Runtime is not available.");
    }

    ort.env.wasm.wasmPaths = chrome.runtime.getURL("libs/");
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
}

async function tryCreateSession(modelBytes, externalData, providers) {
    return ort.InferenceSession.create(modelBytes, {
        executionProviders: providers,
        graphOptimizationLevel: "all",
        externalData: [
            {
                path: "safe_signal_bullying.onnx.data",
                data: externalData
            }
        ]
    });
}

async function initializeModel() {
    if (session) {
        return session;
    }

    if (modelLoadPromise) {
        return modelLoadPromise;
    }

    modelLoadPromise = (async () => {
        configureOrtRuntime();
        await loadTokenizer();

        const modelUrl = chrome.runtime.getURL("model/safe_signal_bullying.onnx");
        const dataUrl = chrome.runtime.getURL("model/safe_signal_bullying.onnx.data");

        const [modelResponse, dataResponse] = await Promise.all([
            fetch(modelUrl),
            fetch(dataUrl)
        ]);

        if (!modelResponse.ok) {
            throw new Error("Could not fetch ONNX model");
        }
        if (!dataResponse.ok) {
            throw new Error("Could not fetch ONNX external data");
        }

        const modelBytes = new Uint8Array(await modelResponse.arrayBuffer());
        const externalData = await dataResponse.arrayBuffer();

        const canWebGpu = typeof navigator !== "undefined" && Boolean(navigator.gpu);
        if (canWebGpu) {
            try {
                safeSignalLog("Trying WebGPU execution provider");
                session = await tryCreateSession(
                    modelBytes.slice(),
                    externalData.slice(0),
                    ["webgpu"]
                );
                safeSignalLog("Model loaded with WebGPU");
                return session;
            } catch (error) {
                safeSignalWarn("WebGPU unavailable, falling back to WASM", error);
            }
        } else {
            safeSignalLog("WebGPU not available, using WASM");
        }

        session = await tryCreateSession(modelBytes, externalData, ["wasm"]);
        safeSignalLog("Model loaded with WASM", {
            inputs: session.inputNames,
            outputs: session.outputNames
        });
        return session;
    })();

    try {
        return await modelLoadPromise;
    } catch (error) {
        modelLoadPromise = null;
        session = null;
        throw error;
    }
}

function softmaxToxicProbability(logits) {
    const logit0 = Number(logits[0]);
    const logit1 = Number(logits[1]);
    const maxLogit = Math.max(logit0, logit1);
    const exp0 = Math.exp(logit0 - maxLogit);
    const exp1 = Math.exp(logit1 - maxLogit);
    return exp1 / (exp0 + exp1);
}

async function predictBullying(text) {
    if (!session) {
        throw new Error("Model session is not ready.");
    }

    const clipped = text.length > SafeSignalConfig.MAX_TEXT_LENGTH
        ? text.slice(0, SafeSignalConfig.MAX_TEXT_LENGTH)
        : text;

    const result = tokenize(clipped);
    const feeds = {};

    const tensors = {
        input_ids: result.inputIds,
        attention_mask: result.attentionMask,
        token_type_ids: result.tokenTypeIds
    };

    for (const name of session.inputNames) {
        const values = tensors[name];
        if (!values) {
            continue;
        }
        feeds[name] = new ort.Tensor(
            "int64",
            BigInt64Array.from(values.map((id) => BigInt(id))),
            [1, 128]
        );
    }

    const outputs = await session.run(feeds);
    const outputName = session.outputNames[0];
    const logits = outputs[outputName].data;
    const probability = softmaxToxicProbability(logits);
    const threshold = SafeSignalConfig.TOXICITY_THRESHOLD;
    const toxic = probability >= threshold;

    return {
        probability,
        threshold,
        toxic,
        label: toxic ? 1 : 0
    };
}
