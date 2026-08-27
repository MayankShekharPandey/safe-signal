# Safe Signal

Safe Signal is an on-device Chrome extension designed to detect potentially bullying or harmful text during user input. The system performs text classification locally within the browser using a fine-tuned BERT sequence-classification model converted to the ONNX format. This approach eliminates the requirement for a backend server during inference and helps preserve user privacy.

## System Workflow

The Safe Signal system follows the following processing pipeline:

```text
User Input
    |
    v
BERT WordPiece Tokenizer
    |
    v
Tokenized Input (Maximum Sequence Length: 128)
    |
    v
ONNX BERT Classification Model
    |
    v
Bullying Probability
    |
    v
Confidence Threshold (90%)
    |
    +--------------------+
    |                    |
    v                    v
Probability >= 90%    Probability < 90%
    |                    |
    v                    v
Warning Displayed     No Warning
```

## Features

* On-device text classification
* Local inference without transmission of user text to a server
* Fine-tuned BERT-based bullying detection
* ONNX-based browser inference
* Real-time analysis of user-entered text
* Warning notification for text classified with high bullying probability
* Chrome Extension implementation using Manifest V3

## Model Architecture

The extension uses a fine-tuned BERT sequence-classification model for binary text classification.

| Parameter               | Configuration            |
| ----------------------- | ------------------------ |
| Model Architecture      | BERT                     |
| Model Format            | ONNX                     |
| Classification Type     | Binary Classification    |
| Class 0                 | Not Bullying             |
| Class 1                 | Bullying                 |
| Maximum Sequence Length | 128 tokens               |
| Warning Threshold       | 90% bullying probability |
| Inference Environment   | Web Browser              |
| Inference Framework     | ONNX Runtime Web         |

The input text is first processed using a BERT WordPiece tokenizer. The resulting token sequence is limited to a maximum length of 128 tokens and subsequently passed to the ONNX-based BERT classification model. The model produces class probabilities, from which the probability associated with the bullying class is obtained.

If the predicted bullying probability is greater than or equal to 90%, the extension generates a warning notification. The 90% value represents the operational decision threshold of the prototype and should not be interpreted as the accuracy of the classification model.

## Technology Stack

The implementation uses the following technologies:

* Chrome Extension Manifest V3
* JavaScript
* BERT
* WordPiece Tokenization
* ONNX
* ONNX Runtime Web

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
```

## Deployment

The extension can be deployed locally using the Chrome Extensions interface. The user can enable Developer Mode in `chrome://extensions` and load the project directory using the "Load unpacked" option.

## Privacy and Security

Safe Signal performs inference locally within the user's browser. User-entered text is processed by the tokenizer and classification model without requiring transmission to an external server or backend API. Consequently, the system is designed to minimize the exposure of potentially sensitive user-generated content.

## Project Status

The current implementation is a prototype demonstrating browser-based, on-device bullying-text classification using a fine-tuned BERT model and ONNX Runtime Web. Further development can focus on improving classification performance, reducing inference latency, handling contextual and ambiguous language, and evaluating the system across diverse forms of harmful and bullying content.
