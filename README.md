# Safe Signal

Safe Signal is an on-device Chrome extension that detects potentially bullying or harmful text while a user is typing.

## How it works

User types text
→ BERT tokenizer
→ ONNX BERT model
→ Bullying probability
→ Warning popup if confidence is 90% or higher

## Features

- On-device text classification
- No text sent to a server
- BERT-based bullying detection
- Browser-based ONNX inference
- Warning popup for potentially harmful messages

## Technology

- Chrome Extension (Manifest V3)
- JavaScript
- ONNX Runtime Web
- BERT
- WordPiece tokenizer

## Project Structure

```text
Safe-Signal/
├── manifest.json
├── content.js
├── model.js
├── tokenizer.js
├── popup.html
├── popup.js
├── test.html
│
├── model/
│   ├── safe_signal_bullying.onnx
│   ├── safe_signal_bullying.onnx.data
│   └── vocab.txt
│
└── libs/
    ├── ort.min.js
    ├── ort-wasm-simd-threaded.jsep.mjs
    └── ort-wasm-simd-threaded.jsep.wasm