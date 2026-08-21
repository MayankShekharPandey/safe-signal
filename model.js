function predictBullying(text) {
    const bullyingWords = [
        "stupid",
        "idiot",
        "loser",
        "moron",
        "dumb",
        "ugly",
        "hate you"
    ];

    text = text.toLowerCase();

    for (let word of bullyingWords) {
        if (text.includes(word)) {
            return 1;
        }
    }

    return 0;
}