# Safe Signal

Safe Signal is an on-device Chrome extension that detects potentially bullying or harmful text while you type. Classification runs locally in the browser with a fine-tuned BERT sequence-classification model in ONNX format. User text is not sent to an external API.

## Why Reddit failed before

The original prototype loaded ONNX Runtime and the BERT model **inside the page content script**. That works on a local `test.html` page because there is no strict site CSP and script URLs resolve correctly.

On Reddit it failed for two independent reasons:

1. Reddit’s Content Security Policy blocks WebAssembly compilation (`wasm-unsafe-eval`). ONNX Runtime Web never finished initializing, `session` stayed `null`, and `predictBullying()` returned `null` with no warning.
2. In a content script, `document.currentScript` is empty, so ONNX Runtime could not find `libs/ort-wasm-simd-threaded.jsep.wasm` and tried to load it from `reddit.com` instead of the extension.

A local test file never hits either restriction, so the model appeared to work there.

## Current architecture

```text
Website (Reddit or other HTTP/HTTPS pages)
    |
    v
Content script (input, focus, MutationObserver, debounce)
    |
    v
Service worker (creates/keeps offscreen document)
    |
    v
Offscreen document (ONNX Runtime + tokenizer + BERT, loaded once)
    |
    v
Toxicity probability
    |
    v
Content script warning popup if score >= threshold
```

The content script only detects typing and shows UI. Inference always runs in the extension offscreen document, which uses the extension CSP and can load WASM.

## Model

| Parameter | Configuration |
| --- | --- |
| Architecture | BERT (`BertForSequenceClassification`) |
| Format | ONNX + external `.onnx.data` |
| Classes | 0 = not bullying, 1 = bullying |
| Max sequence length | 128 tokens |
| Default threshold | 0.90 (configurable in the popup) |
| Runtime | ONNX Runtime Web 1.29 (WebGPU, then WASM) |

## Project structure

```text
Safe-Signal/
├── manifest.json
├── config.js
├── content.js
├── background.js
├── offscreen.html
├── offscreen.js
├── model.js
├── tokenizer.js
├── popup.html
├── popup.js
├── test.html
├── model/
│   ├── safe_signal_bullying.onnx
│   ├── safe_signal_bullying.onnx.data
│   └── vocab.txt
└── libs/
    ├── ort.min.js
    ├── ort-wasm-simd-threaded.jsep.mjs
    └── ort-wasm-simd-threaded.jsep.wasm
```

## Install and test

There is no npm install step. The model and ONNX Runtime files are already in the repo.

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this project folder.
4. Wait for the first model load. The `.onnx.data` file is large (~438 MB), so the first initialization can take a while. Watch the **service worker** and **offscreen** consoles if needed.
5. Open [https://www.reddit.com](https://www.reddit.com) and start a comment or post.
6. Type safe text such as `I really liked your post.` — no warning should appear.
7. Type a clearly toxic insult (keep it non-graphic) and pause ~500 ms — a warning card should appear.

Optional engine test without Reddit:

1. Copy the extension ID from `chrome://extensions`.
2. Open `chrome-extension://<id>/test.html`.
3. Click **Run detection**.

## Debug logs

With **Enable debug logs** checked in the popup, the page console shows:

- `[CyberGuard] Content script loaded`
- `[CyberGuard] ML engine initialized`
- `[CyberGuard] Input detected`
- `[CyberGuard] Running inference` (offscreen console)
- `[CyberGuard] Prediction: toxic=0.91`
- `[CyberGuard] Warning displayed`

### BERT does not load

- `chrome://extensions` → Safe Signal → **Inspect views: Offscreen document**
- Look for tokenizer/model fetch errors or WASM errors
- Confirm `model/safe_signal_bullying.onnx`, `.onnx.data`, and `libs/ort-wasm-simd-threaded.jsep.wasm` exist

### Reddit is not detected

- On the Reddit tab, open DevTools → Console
- You must see `[CyberGuard] Content script loaded`
- If not, reload the extension, then reload Reddit
- Focus the comment box and look for `[CyberGuard] Editor focused` / `Input detected`

### Prediction does not return

- Inspect the **service worker** and **offscreen document**
- First-time load may still be reading the 438 MB weights
- After reload of the extension, refresh Reddit so the content script reconnects

### Popup does not appear

- Confirm a log line `Prediction: toxic=...` with a value at or above the popup threshold
- Safe text will not show a warning
- Only one warning card is shown at a time

### WebGPU fails

- This is expected on many machines
- The engine falls back to WASM automatically
- A complete failure means WASM also failed; check the offscreen console

## Privacy

Inference stays on-device. The extension does not send comment text to a remote model API. The warning UI uses `textContent` and does not inject unsanitized HTML.
