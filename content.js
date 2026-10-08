const SKIP_INPUT_TYPES = new Set([
    "button",
    "checkbox",
    "color",
    "date",
    "datetime-local",
    "file",
    "hidden",
    "image",
    "month",
    "number",
    "password",
    "radio",
    "range",
    "reset",
    "submit",
    "time",
    "week"
]);

const editorTimers = new WeakMap();
const lastQueuedText = new WeakMap();
const attachedEditors = new WeakSet();
const observedRoots = new WeakSet();
let focusedTextObserver = null;

let warningOverlay = null;
let dismissedText = "";
let latestRequestId = 0;
let settingsReady = loadSafeSignalSettings();

safeSignalLog("Content script loaded");

chrome.runtime.sendMessage(
    { target: "background", type: "ENSURE_ENGINE" },
    (response) => {
        if (chrome.runtime.lastError) {
            safeSignalError("Could not reach ML engine", chrome.runtime.lastError.message);
            return;
        }
        if (response && response.ok) {
            safeSignalLog("ML engine initialized");
        } else {
            safeSignalError("ML engine not ready", response && response.error);
        }
    }
);

listenSafeSignalSettings();

function isOurUi(node) {
    return Boolean(node && node.closest && node.closest("#safe-signal-warning"));
}

function isTextInput(element) {
    if (!element || element.nodeType !== 1) {
        return false;
    }

    const tag = element.tagName;
    if (tag === "TEXTAREA") {
        return !element.readOnly && !element.disabled;
    }

    if (tag === "INPUT") {
        const type = (element.getAttribute("type") || "text").toLowerCase();
        return !SKIP_INPUT_TYPES.has(type) && !element.readOnly && !element.disabled;
    }

    return false;
}

function isEditable(element) {
    if (!element || element.nodeType !== 1 || isOurUi(element)) {
        return false;
    }
    if (isTextInput(element)) {
        return true;
    }
    return Boolean(element.isContentEditable);
}

function getEditorRoot(element) {
    if (!element || element.nodeType !== 1) {
        return null;
    }

    if (isTextInput(element)) {
        return element;
    }

    if (element.isContentEditable) {
        const root = element.closest("[contenteditable='true'], [contenteditable='']");
        return root || element;
    }

    return null;
}

function editorFromEvent(event) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];

    for (const node of path) {
        if (node && node.nodeType === 1) {
            const editor = getEditorRoot(node);
            if (editor) {
                return editor;
            }
        }
    }

    return getEditorRoot(event.target);
}

function getText(element) {
    if (!element) {
        return "";
    }

    if (isTextInput(element)) {
        return element.value || "";
    }

    if (element.isContentEditable) {
        return (element.innerText || element.textContent || "").replace(/\u00a0/g, " ");
    }

    return "";
}

function scheduleAnalysis(editor) {
    const text = getText(editor).trim();

    if (text.length < SafeSignalConfig.MIN_TEXT_LENGTH) {
        dismissedText = "";
        removeWarning();
        return;
    }

    if (text === lastQueuedText.get(editor)) {
        return;
    }

    lastQueuedText.set(editor, text);

    const previousTimer = editorTimers.get(editor);
    if (previousTimer) {
        clearTimeout(previousTimer);
    }

    const timer = setTimeout(() => {
        analyzeText(editor, text);
    }, SafeSignalConfig.DEBOUNCE_MS);

    editorTimers.set(editor, timer);
    safeSignalLog("Input detected");
}

async function analyzeText(editor, text) {
    await settingsReady;

    const currentText = getText(editor).trim();
    if (currentText !== text) {
        return;
    }

    const requestId = ++latestRequestId;

    chrome.runtime.sendMessage(
        {
            target: "background",
            type: "PREDICT",
            text: text,
            requestId: requestId
        },
        (response) => {
            if (chrome.runtime.lastError) {
                safeSignalError("Prediction did not return", chrome.runtime.lastError.message);
                return;
            }

            if (requestId !== latestRequestId) {
                return;
            }

            if (getText(editor).trim() !== text) {
                return;
            }

            if (!response || !response.ok) {
                safeSignalError("Prediction failed", response && response.error);
                return;
            }

            safeSignalLog("Prediction: toxic=" + Number(response.probability).toFixed(2));

            if (response.toxic) {
                if (text === dismissedText) {
                    return;
                }
                showWarning(editor);
            } else {
                dismissedText = "";
                removeWarning();
            }
        }
    );
}

function showWarning(editor) {
    if (warningOverlay) {
        safeSignalLog("Warning already visible");
        return;
    }

    warningOverlay = document.createElement("div");
    warningOverlay.id = "safe-signal-warning";
    warningOverlay.setAttribute("role", "dialog");
    warningOverlay.setAttribute("aria-live", "polite");

    Object.assign(warningOverlay.style, {
        position: "fixed",
        right: "16px",
        bottom: "16px",
        zIndex: "2147483647",
        maxWidth: "360px",
        width: "calc(100% - 32px)",
        background: "#ffffff",
        color: "#222222",
        borderRadius: "12px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.28)",
        fontFamily: "Arial, sans-serif",
        border: "1px solid #e0e0e0",
        overflow: "hidden"
    });

    const body = document.createElement("div");
    Object.assign(body.style, {
        padding: "18px 18px 8px"
    });

    const title = document.createElement("div");
    title.textContent = "Potentially harmful language";
    Object.assign(title.style, {
        fontSize: "16px",
        fontWeight: "bold",
        marginBottom: "8px"
    });

    const message = document.createElement("div");
    message.textContent = "Your message may contain harmful or offensive language. Please consider rephrasing it.";
    Object.assign(message.style, {
        fontSize: "14px",
        lineHeight: "1.45",
        color: "#555555"
    });

    body.appendChild(title);
    body.appendChild(message);

    const footer = document.createElement("div");
    Object.assign(footer.style, {
        display: "flex",
        justifyContent: "flex-end",
        gap: "8px",
        padding: "12px"
    });

    const continueButton = document.createElement("button");
    continueButton.type = "button";
    continueButton.textContent = "Continue";
    styleActionButton(continueButton, false);

    const rephraseButton = document.createElement("button");
    rephraseButton.type = "button";
    rephraseButton.textContent = "Rephrase";
    styleActionButton(rephraseButton, true);

    continueButton.addEventListener("click", function () {
        dismissedText = getText(editor).trim();
        removeWarning();
    });

    rephraseButton.addEventListener("click", function () {
        dismissedText = "";
        removeWarning();
        try {
            editor.focus();
        } catch (error) {
            safeSignalWarn("Could not focus editor", error);
        }
    });

    footer.appendChild(continueButton);
    footer.appendChild(rephraseButton);
    warningOverlay.appendChild(body);
    warningOverlay.appendChild(footer);

    (document.documentElement || document.body).appendChild(warningOverlay);
    safeSignalLog("Warning displayed");
}

function styleActionButton(button, primary) {
    Object.assign(button.style, {
        padding: "8px 12px",
        border: primary ? "none" : "1px solid #cfcfcf",
        borderRadius: "6px",
        background: primary ? "#1769e0" : "#ffffff",
        color: primary ? "#ffffff" : "#333333",
        fontSize: "13px",
        fontWeight: "bold",
        cursor: "pointer"
    });
}

function removeWarning() {
    if (warningOverlay) {
        warningOverlay.remove();
        warningOverlay = null;
    }
}

function attachEditor(element) {
    const editor = getEditorRoot(element);
    if (!editor || attachedEditors.has(editor) || isOurUi(editor)) {
        return;
    }

    attachedEditors.add(editor);
    editor.addEventListener("input", onEditorEvent);
    editor.addEventListener("keyup", onEditorEvent);
    editor.addEventListener("beforeinput", onEditorEvent);
}

function onEditorEvent(event) {
    const editor = editorFromEvent(event);
    if (!editor) {
        return;
    }
    scheduleAnalysis(editor);
}

function walkForEditors(root) {
    if (!root) {
        return;
    }

    if (root.nodeType === 1 && isEditable(root)) {
        attachEditor(root);
    }

    if (root.querySelectorAll) {
        root.querySelectorAll("textarea, input, [contenteditable='true'], [contenteditable='']").forEach(attachEditor);
    }

    walkShadowRoots(root);
}

function walkShadowRoots(root) {
    if (!root.querySelectorAll) {
        return;
    }

    const elements = root.querySelectorAll("*");
    for (const element of elements) {
        if (element.shadowRoot) {
            observeRoot(element.shadowRoot);
            walkForEditors(element.shadowRoot);
        }
    }
}

function observeRoot(root) {
    if (!root || observedRoots.has(root)) {
        return;
    }

    observedRoots.add(root);

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1 || node.nodeType === 11) {
                    walkForEditors(node);
                }
            }
        }
    });

    observer.observe(root, {
        childList: true,
        subtree: true
    });
}

function onDocumentEvent(event) {
    const editor = editorFromEvent(event);
    if (!editor) {
        return;
    }
    attachEditor(editor);
    scheduleAnalysis(editor);
}

document.addEventListener("input", onDocumentEvent, true);
document.addEventListener("beforeinput", onDocumentEvent, true);
document.addEventListener("keyup", onDocumentEvent, true);
document.addEventListener("focusin", function (event) {
    const editor = editorFromEvent(event);
    if (editor) {
        attachEditor(editor);
        watchFocusedEditor(editor);
        safeSignalLog("Editor focused");
    }
}, true);

function watchFocusedEditor(editor) {
    if (focusedTextObserver) {
        focusedTextObserver.disconnect();
        focusedTextObserver = null;
    }

    if (!editor.isContentEditable) {
        return;
    }

    focusedTextObserver = new MutationObserver(function () {
        scheduleAnalysis(editor);
    });

    focusedTextObserver.observe(editor, {
        characterData: true,
        childList: true,
        subtree: true
    });
}

observeRoot(document.documentElement);
walkForEditors(document);

window.addEventListener("pagehide", removeWarning);
