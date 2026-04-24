
interface CardGenerationParams {
    svgElement: SVGSVGElement;
    creatureName: string;
    shareLine: string;
    authorName: string;
    soundMimic: string;
    bgColor?: string;
    traits: {
        confidant: number;
        actionStyle: number;
        innerWorld: number;
        socialStyle: number;
    };
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1440; // 3:4 Aspect Ratio
const QR_CODE_SRC = "/media/Neeeead-website-QR-code.svg";
const CARD_TEXT_PRIMARY = "#FDF1F1";
const CARD_TEXT_MUTED = "#929292";
const CARD_TEXT_ACCENT = "lab(65 -35 -55)";

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function drawSegmentedLine(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    leftText: string,
    rightText: string,
    leftColor: string,
    rightColor: string
) {
    ctx.fillStyle = leftColor;
    ctx.fillText(leftText, x, y);
    const leftWidth = ctx.measureText(leftText).width;
    ctx.fillStyle = rightColor;
    ctx.fillText(rightText, x + leftWidth, y);
}

function getCssPxVar(name: string, fallback: number) {
    if (typeof window === "undefined") return fallback;
    const raw = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function createCanvasFont(weight: 500 | 700, size: number) {
    return `${weight} ${size}px 'IBM Plex Mono', 'IBM Plex Sans SC', sans-serif`;
}

async function loadTintedSvgImage(svgPath: string, color: string): Promise<HTMLImageElement> {
    const source = await loadImage(svgPath);
    const canvas = document.createElement("canvas");
    canvas.width = source.naturalWidth || 256;
    canvas.height = source.naturalHeight || 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Cannot create QR tint canvas");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const tintedUrl = canvas.toDataURL("image/png");
    return loadImage(tintedUrl);
}

export const generateShareCard = (params: CardGenerationParams): Promise<string> => {
    return new Promise(async (resolve, reject) => {
        try {
            // Ensure custom fonts are loaded before drawing on the canvas
            await Promise.all([
                document.fonts.load(createCanvasFont(700, getCssPxVar("--text-4xl", 64))),
                document.fonts.load(createCanvasFont(500, getCssPxVar("--text-2xl", 24))),
                document.fonts.load(createCanvasFont(500, getCssPxVar("--text-xl", 18))),
            ]);
        } catch (e) {
            console.warn('Font loading failed, canvas text might not render correctly.', e);
        }

        const { svgElement, creatureName, shareLine, authorName, soundMimic, bgColor = '#020E0E', traits } = params;

        const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
        const toBucket = (n: number) => Math.min(5, Math.floor(clamp01(n) * 6));
        const getTendency = (n: number, left: string, right: string) => (clamp01(n) >= 0.5 ? right : left);

        const confidantLevel = ["超超超少", "超少", "略少", "略多", "超多", "超超超多"];
        const actionLevel = ["极限", "大多数时候", "偶尔", "偶尔", "大多数时候", "极限"];
        const innerLevel = ["太纯粹了有点单线", "看和谁比", "偏纠结", "偏纯粹", "看和谁比", "太丰富了戏精"];
        const socialLevel = ["完全没心眼儿", "有话说话", "相对", "相对", "无懈可击", "全都是心眼儿"];

        const canvas = document.createElement('canvas');
        canvas.width = CARD_WIDTH;
        canvas.height = CARD_HEIGHT;
        
        // Request a display-p3 color space context for the canvas if supported
        // This is the optimal solution for web: it allows drawing with wide gamut colors
        // and exports a PNG with the correct color profile embedded (in modern browsers like Safari/Chrome).
        let ctx: CanvasRenderingContext2D | null = null;
        try {
            ctx = canvas.getContext('2d', { colorSpace: 'display-p3' });
        } catch (e) {
            console.warn('display-p3 color space not supported by this browser, falling back to sRGB');
            ctx = canvas.getContext('2d');
        }

        if (!ctx) {
            return reject(new Error('Could not get canvas context'));
        }

        // 1. Draw Background
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

        // 2. Prepare and draw SVG
        // Clone the SVG to avoid modifying the original
        const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
        const path = svgClone.querySelector('path');
        
        // We use the same LAB color defined in our CSS.
        // Modern browsers will parse this in SVG and draw it correctly into the P3 canvas.
        const IDEAL_ACCENT_COLOR = CARD_TEXT_ACCENT;

        // Replace CSS variable with the correct hex code for export
        if (path) {
            if (path.getAttribute('fill') === 'var(--color-accent)') {
                path.setAttribute('fill', IDEAL_ACCENT_COLOR);
            }
            if (path.getAttribute('stroke') === 'var(--color-accent)') {
                path.setAttribute('stroke', IDEAL_ACCENT_COLOR);
            }
        }

        const svgString = new XMLSerializer().serializeToString(svgClone);
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();

        img.onload = async () => {
            // --- Layout Constants ---
            const MARGIN = 40;
            const IMG_SIZE = 1000;
            const LINE_HEIGHT_NORMAL = 1.25;
            const LINE_HEIGHT_DISPLAY = 1.15;
            const TITLE_SIZE = getCssPxVar("--text-4xl", 64);
            const BODY_SIZE = getCssPxVar("--text-2xl", 24);
            const bodyLineHeight = BODY_SIZE * LINE_HEIGHT_NORMAL;
            const contentWidth = CARD_WIDTH - MARGIN * 2; // keep margins unchanged
            const colWidth = contentWidth / 4;
            const bottomBlockBottomY = CARD_HEIGHT - MARGIN;

            // --- 2. Draw SVG Shape ---
            ctx.drawImage(img, MARGIN, MARGIN, IMG_SIZE, IMG_SIZE);
            URL.revokeObjectURL(url);

            // --- 3. Draw Text Information ---
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';

            // Top: name + share line, left-top and full-width
            ctx.font = createCanvasFont(700, TITLE_SIZE);
            const titleTopY = 1070;
            const titlePrefix = "这只叫「";
            const titleSuffix = "」，";
            ctx.fillStyle = CARD_TEXT_PRIMARY;
            ctx.fillText(titlePrefix, MARGIN, titleTopY);
            const prefixWidth = ctx.measureText(titlePrefix).width;
            ctx.fillStyle = CARD_TEXT_ACCENT;
            ctx.fillText(creatureName, MARGIN + prefixWidth, titleTopY);
            const nameWidth = ctx.measureText(creatureName).width;
            ctx.fillStyle = CARD_TEXT_PRIMARY;
            ctx.fillText(titleSuffix, MARGIN + prefixWidth + nameWidth, titleTopY);
            ctx.fillText(shareLine, MARGIN, titleTopY + TITLE_SIZE * LINE_HEIGHT_DISPLAY);

            // Bottom section uses 4 columns (2 / 1 / 1)
            const traitsX = MARGIN;
            const traitsWidth = colWidth * 2;
            const middleX = MARGIN + colWidth * 2;
            const rightX = MARGIN + colWidth * 4;

            ctx.font = createCanvasFont(500, BODY_SIZE);
            ctx.fillStyle = CARD_TEXT_PRIMARY;

            // Sound overlay: bottom-right edge of creature area, aligned on one baseline
            const soundText = soundMimic || "哇呜";
            const soundY = MARGIN + IMG_SIZE - 12;
            const leftQuote = '"';
            const rightQuote = '"';
            const leftQuoteWidth = ctx.measureText(leftQuote).width;
            const soundWidth = ctx.measureText(soundText).width;
            const rightQuoteWidth = ctx.measureText(rightQuote).width;
            const soundBlockWidth = leftQuoteWidth + soundWidth + rightQuoteWidth;
            const soundStartX = MARGIN + IMG_SIZE - 12 - soundBlockWidth;

            ctx.textAlign = "left";
            ctx.textBaseline = "bottom";
            ctx.fillStyle = CARD_TEXT_PRIMARY;
            ctx.fillText(leftQuote, soundStartX, soundY);
            ctx.fillStyle = CARD_TEXT_ACCENT;
            ctx.fillText(soundText, soundStartX + leftQuoteWidth, soundY);
            ctx.fillStyle = CARD_TEXT_PRIMARY;
            ctx.fillText(rightQuote, soundStartX + leftQuoteWidth + soundWidth, soundY);

            // Left 3 columns: traits block, left-bottom aligned
            ctx.textAlign = "left";
            ctx.textBaseline = "bottom";
            const trait4Y = bottomBlockBottomY;
            const trait3Y = trait4Y - bodyLineHeight;
            const trait2Y = trait3Y - bodyLineHeight;
            const trait1Y = trait2Y - bodyLineHeight;
            const traitTitleY = trait1Y - bodyLineHeight;
            ctx.fillStyle = CARD_TEXT_PRIMARY;
            ctx.fillText("物种习性", traitsX, traitTitleY, traitsWidth);
            drawSegmentedLine(
                ctx,
                traitsX,
                trait1Y,
                `知己 / ${getTendency(traits.confidant, "少而精", "广而多")} - `,
                confidantLevel[toBucket(traits.confidant)],
                CARD_TEXT_PRIMARY,
                CARD_TEXT_MUTED
            );
            drawSegmentedLine(
                ctx,
                traitsX,
                trait2Y,
                `行事 / ${getTendency(traits.actionStyle, "计划派", "随性派")} - `,
                actionLevel[toBucket(traits.actionStyle)],
                CARD_TEXT_PRIMARY,
                CARD_TEXT_MUTED
            );
            drawSegmentedLine(
                ctx,
                traitsX,
                trait3Y,
                `内心 / ${getTendency(traits.innerWorld, "简单纯粹", "丰富纠结")} - `,
                innerLevel[toBucket(traits.innerWorld)],
                CARD_TEXT_PRIMARY,
                CARD_TEXT_MUTED
            );
            drawSegmentedLine(
                ctx,
                traitsX,
                trait4Y,
                `处世 / ${getTendency(traits.socialStyle, "坦率直接", "圆融周到")} - `,
                socialLevel[toBucket(traits.socialStyle)],
                CARD_TEXT_PRIMARY,
                CARD_TEXT_MUTED
            );

            // --- 4. Draw QR Code ---
            const qrSize = 160;
            const qrX = rightX - qrSize;
            const qrY = bottomBlockBottomY - qrSize;
            try {
                const qrImage = await loadTintedSvgImage(QR_CODE_SRC, CARD_TEXT_PRIMARY);
                ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
            } catch (error) {
                console.warn("QR code SVG load failed, fallback to placeholder", error);
                ctx.fillStyle = '#020E0E';
                ctx.fillRect(qrX, qrY, qrSize, qrSize);
                ctx.strokeStyle = CARD_TEXT_PRIMARY;
                ctx.strokeRect(qrX, qrY, qrSize, qrSize);
            }

            // Middle 1 column text: bottom aligned, same body size, muted color
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.font = createCanvasFont(500, BODY_SIZE);
            ctx.fillStyle = CARD_TEXT_MUTED;
            const middleTextX = middleX + 8;
            ctx.fillText(`创作者 ${authorName}`, middleTextX, bottomBlockBottomY - bodyLineHeight * 2);
            ctx.fillText("© 2026 四百盒子社区", middleTextX, bottomBlockBottomY - bodyLineHeight);
            ctx.fillText("设计 @ 不含观点", middleTextX, bottomBlockBottomY);

            // --- 6. Return Data URL ---
            const dataUrl = canvas.toDataURL('image/png');
            resolve(dataUrl);
        };

        img.onerror = (err) => {
            URL.revokeObjectURL(url);
            reject(err);
        };
        
        img.src = url;
    });
};
