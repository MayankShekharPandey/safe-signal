let warningOverlay = null;
let lastText = "";
let predictionTimer = null;

document.addEventListener("input", function (event) {

    const element = event.target;

    if (
        element.tagName !== "TEXTAREA" &&
        element.tagName !== "INPUT" &&
        !element.isContentEditable
    ) {
        return;
    }

    const text = getText(element).trim();

    if (text.length < 3) {
        removeWarning();
        return;
    }

    if (text === lastText) {
        return;
    }

    lastText = text;

    clearTimeout(predictionTimer);

    predictionTimer = setTimeout(async () => {

        const result = await predictBullying(text);

        if (result === 1) {
            showWarning();
        } else if (result === 0) {
            removeWarning();
        }

    }, 500);
});


function getText(element) {

    if (
        element.tagName === "TEXTAREA" ||
        element.tagName === "INPUT"
    ) {
        return element.value || "";
    }

    if (element.isContentEditable) {
        return element.innerText || element.textContent || "";
    }

    return "";
}


function showWarning() {

    if (warningOverlay) {
        return;
    }

    warningOverlay = document.createElement("div");

    warningOverlay.style.position = "fixed";
    warningOverlay.style.top = "0";
    warningOverlay.style.left = "0";
    warningOverlay.style.width = "100vw";
    warningOverlay.style.height = "100vh";
    warningOverlay.style.background = "rgba(0, 0, 0, 0.45)";
    warningOverlay.style.display = "flex";
    warningOverlay.style.justifyContent = "center";
    warningOverlay.style.alignItems = "center";
    warningOverlay.style.zIndex = "2147483647";

    const popup = document.createElement("div");

    popup.style.width = "420px";
    popup.style.maxWidth = "90%";
    popup.style.background = "#ffffff";
    popup.style.borderRadius = "14px";
    popup.style.boxShadow = "0 10px 40px rgba(0,0,0,0.35)";
    popup.style.textAlign = "center";
    popup.style.fontFamily = "Arial, sans-serif";
    popup.style.overflow = "hidden";

    const content = document.createElement("div");

    content.style.padding = "35px 30px 30px";

    const icon = document.createElement("div");

    icon.innerHTML = "!";

    icon.style.width = "58px";
    icon.style.height = "58px";
    icon.style.border = "4px solid #e53935";
    icon.style.borderRadius = "50%";
    icon.style.margin = "0 auto 20px";
    icon.style.display = "flex";
    icon.style.alignItems = "center";
    icon.style.justifyContent = "center";
    icon.style.color = "#e53935";
    icon.style.fontSize = "36px";
    icon.style.fontWeight = "bold";
    icon.style.boxSizing = "border-box";

    const title = document.createElement("div");

    title.innerText = "This message may be hurtful.";

    title.style.fontSize = "22px";
    title.style.fontWeight = "bold";
    title.style.color = "#222";
    title.style.marginBottom = "12px";

    const message = document.createElement("div");

    message.innerText = "Please consider rephrasing it.";

    message.style.fontSize = "17px";
    message.style.color = "#555";
    message.style.lineHeight = "1.5";

    content.appendChild(icon);
    content.appendChild(title);
    content.appendChild(message);

    const footer = document.createElement("div");

    footer.style.borderTop = "1px solid #e5e5e5";
    footer.style.padding = "18px";

    const button = document.createElement("button");

    button.innerText = "OK";

    button.style.width = "150px";
    button.style.padding = "12px";
    button.style.border = "none";
    button.style.borderRadius = "6px";
    button.style.background = "#1769e0";
    button.style.color = "white";
    button.style.fontSize = "16px";
    button.style.fontWeight = "bold";
    button.style.cursor = "pointer";

    button.addEventListener("click", function () {
        removeWarning();
    });

    footer.appendChild(button);

    popup.appendChild(content);
    popup.appendChild(footer);

    warningOverlay.appendChild(popup);

    document.body.appendChild(warningOverlay);
}


function removeWarning() {

    if (warningOverlay) {
        warningOverlay.remove();
        warningOverlay = null;
    }
}