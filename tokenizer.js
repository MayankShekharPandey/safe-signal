let vocab = null;

async function loadTokenizer() {
    const vocabUrl = chrome.runtime.getURL(
        "model/vocab.txt"
    );

    const response = await fetch(vocabUrl);

    if (!response.ok) {
        throw new Error("Could not load vocab.txt");
    }

    const text = await response.text();

    vocab = new Map();

    const lines = text.split(/\r?\n/);

    lines.forEach((token, index) => {
        if (token !== "") {
            vocab.set(token, index);
        }
    });
}

function basicTokenize(text) {
    text = text.toLowerCase();

    return text.match(/[a-z0-9]+|[^a-z0-9\s]/g) || [];
}

function wordPieceTokenize(word) {

    if (vocab.has(word)) {
        return [word];
    }

    const tokens = [];

    let start = 0;

    while (start < word.length) {

        let end = word.length;
        let current = null;

        while (start < end) {

            let piece = word.substring(start, end);

            if (start > 0) {
                piece = "##" + piece;
            }

            if (vocab.has(piece)) {
                current = piece;
                break;
            }

            end--;
        }

        if (current === null) {
            return ["[UNK]"];
        }

        tokens.push(current);

        start = end;
    }

    return tokens;
}

function tokenize(text) {

    if (!vocab) {
        throw new Error("Tokenizer has not been loaded.");
    }

    const basicTokens = basicTokenize(text);

    let wordPieces = [];

    for (const word of basicTokens) {
        wordPieces.push(...wordPieceTokenize(word));
    }

    const tokens = [
        "[CLS]",
        ...wordPieces,
        "[SEP]"
    ];

    const maxLength = 128;

    const finalTokens = tokens.slice(0, maxLength);

    const inputIds = finalTokens.map(token => {
        return vocab.has(token)
            ? vocab.get(token)
            : vocab.get("[UNK]");
    });

    while (inputIds.length < maxLength) {
        inputIds.push(vocab.get("[PAD]"));
    }

    const attentionMask = inputIds.map((id, index) => {
        return index < finalTokens.length ? 1 : 0;
    });

    return {
        inputIds,
        attentionMask
    };
}

loadTokenizer();