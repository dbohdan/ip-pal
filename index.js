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

const SVG_EMPTY_GROUP_WIDTH = 1;
const SVG_FONT_SIZE = 16;
const SVG_GROUP_WIDTH = 60;
const SVG_HEIGHT = 30;
const SVG_SEPARATOR_WIDTH = 20; // Width allocated for separators.

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

    if (/^\s*$/.test(input)) {
        return {
            type: UNKNOWN,
            groups: [],
        };
    }

    return {
        type: UNKNOWN,
        groups: [
            { num: 0, text: [input], valid: false },
        ],
    };
}

// Generate rendering data for an IP address.
function highlight(input) {
    const { type, groups } = parseIPAddress(input);
    const elements = [];

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

        const spanClass = group.text === "" && group.valid
            ? HIGHLIGHT_SPAN_EMPTY
            : HIGHLIGHT_SPAN;

        elements.push({
            background: background.toHex(),
            class: spanClass,
            color: color.toHex(),
            isSeparator: false,
            text: group.text,
        });

        // Add a separator if not the last element.
        if (i < groups.length - 1) {
            elements.push({
                text: type === IPV4 ? "." : ":",
                isSeparator: true,
            });
        }
    }

    return {
        type,
        elements,
    };
}

// Render the highlighting data to a DOM container.
function renderHighlightToDOM(data, container) {
    container.innerHTML = "";

    if (!data) {
        return;
    }

    for (elem of data.elements) {
        const span = document.createElement(SPAN);

        if (elem.isSeparator) {
            span.textContent = elem.text;
        } else {
            span.className = elem.class;
            span.style.background = elem.background;
            span.style.color = elem.color;
            span.textContent = elem.text;
        }

        container.appendChild(span);
    }
}

function updateHighlight() {
    const input = document.getElementById("ip-input").value.trim();
    const output = document.getElementById("highlight-display");

    const highlightData = highlight(input);
    console.log(highlightData);
    renderHighlightToDOM(highlightData, output);
}

function downloadSVG() {
    const input = document.getElementById("ip-input").value.trim();
    const highlightData = highlight(input);

    try {
        if (!highlightData) {
            throw new Error("no IP address");
        }

        let svgContent = "";
        let x = 0;

        for (const elem of highlightData.elements) {
            if (elem.isSeparator) {
                // Render the separator (e.g., ":").
                const textX = x + SVG_SEPARATOR_WIDTH / 2;
                const textY = SVG_HEIGHT / 2;

                svgContent +=
                    `<text x="${textX}" y="${textY}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="${SVG_FONT_SIZE}" fill="black">${elem.text}</text>`;
                x += SVG_SEPARATOR_WIDTH;
            } else if (elem.text === "") {
                // Render an empty group with a smaller width.
                const rectX = x;
                const rectY = 0;

                svgContent +=
                    `<rect x="${rectX}" y="${rectY}" width="${SVG_EMPTY_GROUP_WIDTH}" height="${SVG_HEIGHT}" fill="${elem.background}" />`;
                // No text is added for empty groups.
                x += SVG_EMPTY_GROUP_WIDTH;
            } else {
                // Render a regular group with full width.
                const rectX = x;
                const rectY = 0;
                svgContent +=
                    `<rect x="${rectX}" y="${rectY}" width="${SVG_GROUP_WIDTH}" height="${SVG_HEIGHT}" fill="${elem.background}" />`;

                const textX = x + SVG_GROUP_WIDTH / 2;
                const textY = SVG_HEIGHT / 2;

                svgContent +=
                    `<text x="${textX}" y="${textY}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="${SVG_FONT_SIZE}" fill="${elem.color}">${elem.text}</text>`;
                x += SVG_GROUP_WIDTH;
            }
        }

        svgDocument =
            `<svg width="${x}" height="${SVG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">${svgContent}</svg>`;

        // Download the file.
        const blob = new Blob([svgDocument], { type: "image/svg+xml" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `ip-${input.replace(/[\.:]/g, "-")}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    } catch (error) {
        document.getElementById("svg-error").textContent = error.message;
    }
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
        document.getElementById("palette-error").textContent = error.message;
    }
}

function updatePalette() {
    const paletteError = document.getElementById("palette-error");

    try {
        const paletteEditor = document.getElementById("palette-editor");
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
