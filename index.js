class RGBColor {
    constructor(r, g, b) {
        this.r = Math.max(0, Math.min(255, r));
        this.g = Math.max(0, Math.min(255, g));
        this.b = Math.max(0, Math.min(255, b));
    }

    luminance() {
        return (0.299 * this.r + 0.587 * this.g + 0.114 * this.b) / 255;
    }

    toHex() {
        const toHex = (value) => {
            const hex = Math.round(value).toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        };

        return `#${toHex(this.r)}${toHex(this.g)}${toHex(this.b)}`;
    }
}

const BLACK = new RGBColor(0, 0, 0);
const RED = new RGBColor(0xff, 0, 0);
const WHITE = new RGBColor(0xff, 0xff, 0xff);

const DEFAULT_BACKGROUND = WHITE;
const DEFAULT_PALETTE = "palette/apollo.gpl";
const EMPTY_COLOR = DEFAULT_BACKGROUND;
const ERROR_COLOR = RED;
const HIGHLIGHT_SPAN_EMPTY = "highlight-span-empty";
const HIGHLIGHT_SPAN = "highlight-span";
const IPV4 = "ipv4";
const IPV6 = "ipv6";
const SPAN = "span";
const UNKNOWN = "unknown";

let palette = [];

function textColor(bgColor) {
    return bgColor.luminance() > 0.5 ? BLACK : WHITE;
}

function parseIPAddress(input) {
    if (input.includes(".") || /^[0-9]+$/.test(input)) {
        const textOctets = input.includes(".") ? input.split(".") : [input];

        const lastIndex = textOctets.length - 1;

        const groups = textOctets.map((text, i) => {
            const num = parseInt(text, 10);
            const validNum = !isNaN(num) && num >= 0 && num <= 255;
            const valid = i < 4 &&
                (validNum || (text === "" && i === lastIndex));

            return {
                num,
                text,
                valid,
            };
        });

        return {
            type: IPV4,
            groups,
        };
    }

    if (input.includes(":") || /^[0-9a-fA-F]+$/.test(input)) {
        const textGroups = input.includes(":") ? input.split(":") : [input];

        const lastIndex = textGroups.length - 1;
        // Allow one empty group.
        let seenEmpty = false;

        const groups = textGroups.map((text, i) => {
            const num = parseInt(text, 16);
            const validNum = !isNaN(num) && num >= 0 && num <= 0xffff;
            const valid = i < 16 &&
                (validNum || (text === "" && (!seenEmpty || i === lastIndex)));

            if (text === "") {
                seenEmpty = true;
            }

            return {
                num,
                text,
                valid,
            };
        });

        return {
            type: IPV6,
            groups,
        };
    }

    return {
        type: UNKNOWN,
        groups: [
            { num: 0, text: [input], valid: false },
        ],
    };
}

function updateHighlight() {
    const input = document.getElementById("ip-input").value.trim();
    const displayDiv = document.getElementById("highlight-display");
    displayDiv.innerHTML = "";

    if (!input) return;

    const { type, groups } = parseIPAddress(input);
    console.log(groups);

    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];

        let color = DEFAULT_BACKGROUND;
        let background = ERROR_COLOR;

        if (group.valid) {
            background = group.text === ""
                ? EMPTY_COLOR
                : palette[group.num % palette.length];
            color = textColor(background);
        }

        const span = document.createElement(SPAN);
        span.className = group.text === "" && group.valid
            ? HIGHLIGHT_SPAN_EMPTY
            : HIGHLIGHT_SPAN;
        span.style.background = background.toHex();
        span.style.color = color.toHex();
        span.textContent = group.text;

        displayDiv.appendChild(span);

        // Add a separator.
        if (i < groups.length - 1) {
            const separator = document.createElement(SPAN);
            separator.textContent = type === IPV4 ? "." : ":";
            displayDiv.appendChild(separator);
        }
    }
}

function downloadSVG() {
    // TODO.
}

function parseGimpPalette(text) {
    const palette = {
        name: "",
        columns: 0,
        colors: [],
    };

    const lines = text.split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    if (!lines[0].startsWith("GIMP Palette")) {
        throw new Error(
            'Invalid GIMP Palette file: missing "GIMP Palette" header',
        );
    }

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith("#")) {
            continue;
        }

        // Handle properties.
        if (line.includes(":")) {
            const [key, value] = line.split(":").map((part) => part.trim());

            if (key.toLowerCase() === "name") {
                palette.name = value;
            } else if (key.toLowerCase() === "columns") {
                palette.columns = parseInt(value) || 0;
            }

            continue;
        }

        // Handle color entries.
        const colorMatch = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s*(.*)$/);
        if (colorMatch) {
            const [_, r, g, b, name] = colorMatch;
            palette.colors.push({
                color: new RGBColor(parseInt(r), parseInt(g), parseInt(b)),
                name: name.trim() || `Color ${palette.colors.length + 1}`,
            });
        }
    }

    return palette;
}

async function loadDefaultPalette() {
    try {
        const response = await fetch(DEFAULT_PALETTE);
        if (!response.ok) {
            throw new Error(`Failed to load palette: ${response.status}`);
        }

        document.getElementById("palette-editor").value = await response.text();
        updatePalette();
    } catch (error) {
        console.error("Error loading palette:", error);
        document.getElementById("palette-error").textContent = error.message;
    }
}

function updatePalette() {
    const paletteEditor = document.getElementById("palette-editor");
    const paletteError = document.getElementById("palette-error");

    try {
        const newPalette = parseGimpPalette(paletteEditor.value).colors.map(
            (entry) => entry.color,
        );

        // Update the global.
        palette = newPalette;
        paletteError.textContent = "";
        updateHighlight();
    } catch (error) {
        paletteError.textContent = `Invalid palette: ${error.message}`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadDefaultPalette().then(() => {
        updateHighlight();
    });

    document.getElementById("ip-input").addEventListener(
        "input",
        updateHighlight,
    );
    document.getElementById("download-svg").addEventListener(
        "click",
        downloadSVG,
    );
    document.getElementById("update-palette").addEventListener(
        "click",
        updatePalette,
    );
    document.getElementById("reset-palette").addEventListener("click", () => {
        loadDefaultPalette().then(updateHighlight);
    });
});
