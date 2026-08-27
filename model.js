let session = null;

async function loadModel() {
    try {
        const modelUrl = chrome.runtime.getURL(
            "model/safe_signal_bullying.onnx"
        );

        const dataUrl = chrome.runtime.getURL(
            "model/safe_signal_bullying.onnx.data"
        );

        session = await ort.InferenceSession.create(
            modelUrl,
            {
                executionProviders: ["wasm"],

                externalData: [
                    {
                        path: "safe_signal_bullying.onnx.data",
                        data: await fetch(dataUrl).then(
                            response => response.arrayBuffer()
                        )
                    }
                ]
            }
        );

    } catch (error) {
        console.error("Safe Signal model failed to load:", error);
    }
}

async function predictBullying(text) {

    if (!session) {
        return null;
    }

    try {
        const result = tokenize(text);

        const inputIds = new ort.Tensor(
            "int64",
            BigInt64Array.from(
                result.inputIds.map(id => BigInt(id))
            ),
            [1, 128]
        );

        const attentionMask = new ort.Tensor(
            "int64",
            BigInt64Array.from(
                result.attentionMask.map(id => BigInt(id))
            ),
            [1, 128]
        );

        const outputs = await session.run({
            input_ids: inputIds,
            attention_mask: attentionMask
        });

        const logits = outputs.logits.data;

        // Softmax
        const exp0 = Math.exp(logits[0]);
        const exp1 = Math.exp(logits[1]);

        const sum = exp0 + exp1;

        const bullyingProbability = exp1 / sum;

        // Conservative threshold
        return bullyingProbability >= 0.90 ? 1 : 0;

    } catch (error) {
        console.error("Safe Signal prediction failed:", error);
        return null;
    }
}

loadModel();