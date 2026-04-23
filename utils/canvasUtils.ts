
interface CardGenerationParams {
    svgElement: SVGSVGElement;
    name: string;
    authorName: string;
    bgColor?: string;
    stats: {
        vertices: number;
        irregularity: number;
        complexity: number;
        strokeOffset: number;
    };
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1440; // 3:4 Aspect Ratio

export const generateShareCard = (params: CardGenerationParams): Promise<string> => {
    return new Promise(async (resolve, reject) => {
        try {
            // Ensure custom fonts are loaded before drawing on the canvas
            await Promise.all([
                document.fonts.load("bold 64px 'Noto Sans SC'"),
                document.fonts.load("bold 24px 'Noto Sans SC'"),
                document.fonts.load("400 24px 'Noto Sans SC'"),
                document.fonts.load("400 20px 'IBM Plex Mono'"),
                document.fonts.load("400 18px 'IBM Plex Mono'"),
                document.fonts.load("400 16px 'IBM Plex Mono'"),
            ]);
        } catch (e) {
            console.warn('Font loading failed, canvas text might not render correctly.', e);
        }

        const { svgElement, name, authorName, bgColor = '#020E0E', stats } = params;

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
        const IDEAL_ACCENT_COLOR = 'lab(65 -35 -55)';

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

        img.onload = () => {
            // --- Layout Constants ---
            const MARGIN = 40;
            const IMG_SIZE = 1000;
            
            // --- 1. Draw Image Area Background/Border ---
            ctx.strokeStyle = '#4B4B4B';
            ctx.lineWidth = 1;
            ctx.strokeRect(MARGIN, MARGIN, IMG_SIZE, IMG_SIZE);

            // --- 2. Draw SVG Shape ---
            ctx.drawImage(img, MARGIN, MARGIN, IMG_SIZE, IMG_SIZE);
            URL.revokeObjectURL(url);

            // --- 3. Draw Text Information ---
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';

            // Name
            ctx.fillStyle = '#FDF1F1';
            ctx.font = "bold 64px 'Noto Sans SC', sans-serif";
            ctx.fillText(name, MARGIN, 1070);

            // Creator & ID
            ctx.font = "400 24px 'Noto Sans SC', sans-serif";
            ctx.fillStyle = '#929292';
            ctx.fillText(`创作者: ${authorName}  |  盒子居民编号: #000`, MARGIN, 1150);

            // Sound
            ctx.fillStyle = '#FDF1F1';
            ctx.fillText(`声音拟态: 哇呜`, MARGIN, 1190);

            // Traits section
            ctx.font = "bold 24px 'Noto Sans SC', sans-serif";
            ctx.fillText(`物种习性`, MARGIN, 1250);

            ctx.font = "400 20px 'IBM Plex Mono', monospace";
            ctx.fillStyle = '#929292';
            ctx.fillText(`[知己圈] Vertices: ${stats.vertices}`, MARGIN, 1290);
            ctx.fillText(`[行事风格] Irregularity: ${stats.irregularity}`, MARGIN, 1320);

            ctx.fillText(`[内心纠结] Complexity: ${stats.complexity}`, MARGIN + 360, 1290);
            ctx.fillText(`[社交外壳] Stroke: ${stats.strokeOffset}`, MARGIN + 360, 1320);

            // --- 4. Draw QR Code Placeholder ---
            const qrSize = 160;
            const qrX = CARD_WIDTH - MARGIN - qrSize;
            const qrY = 1160;
            
            ctx.fillStyle = '#020E0E';
            ctx.fillRect(qrX, qrY, qrSize, qrSize);
            ctx.strokeStyle = '#4B4B4B';
            ctx.strokeRect(qrX, qrY, qrSize, qrSize);
            
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#4B4B4B';
            ctx.font = "400 18px 'IBM Plex Mono', monospace";
            ctx.fillText('QR CODE', qrX + qrSize / 2, qrY + qrSize / 2);

            // --- 5. Draw Copyright ---
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.font = "400 16px 'IBM Plex Mono', monospace";
            ctx.fillStyle = '#4B4B4B';
            ctx.fillText('© 2025~2026 四百盒子社区 & 不含观点', CARD_WIDTH / 2, CARD_HEIGHT - MARGIN);

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
