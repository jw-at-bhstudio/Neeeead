
export interface Point {
  x: number;
  y: number;
}

// Simple pseudo-random number generator for seeded randomness
const mulberry32 = (a: number) => {
    return () => {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

/**
 * Generates a set of random points to define the base polygon shape.
 * @param numPoints - The number of vertices.
 * @param irregularity - A factor (0-1) for how irregular the radius is.
 * @param complexity - A factor (0-1) for how much to fold the shape.
 * @param width - The width of the canvas.
 * @param height - The height of the canvas.
 * @param seed - An optional seed for the random number generator.
 * @returns An array of points.
 */
export const generatePoints = (numPoints: number, irregularity: number, complexity: number, width: number, height: number, seed?: number): Point[] => {
    const random = seed ? mulberry32(seed * 1000) : Math.random;

    const points: Point[] = [];
    const centerX = width / 2;
    const centerY = height / 2;
    
    const baseRadius = Math.min(width, height) * 0.3;

    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;
        
        const randomDisplacementFactor = Math.pow(random(), 3) * (random() < 0.5 ? -1 : 1);
        const radiusDisplacement = baseRadius * irregularity * randomDisplacementFactor;
        const radius = baseRadius + radiusDisplacement;

        points.push({
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle),
        });
    }

    const avgX = points.reduce((sum, p) => sum + p.x, 0) / numPoints;
    const avgY = points.reduce((sum, p) => sum + p.y, 0) / numPoints;
    points.sort((a, b) => {
        return Math.atan2(a.y - avgY, a.x - avgX) - Math.atan2(b.y - avgY, b.x - avgX);
    });

    if (complexity > 0) {
        const numSwaps = Math.floor(points.length * complexity * 0.5);
        for (let i = 0; i < numSwaps; i++) {
            const idx1 = Math.floor(random() * points.length);
            const idx2 = Math.floor(random() * points.length);
            if (idx1 !== idx2) {
                [points[idx1], points[idx2]] = [points[idx2], points[idx1]];
            }
        }
    }

    return points;
};

const controlPoint = (current: Point, previous: Point, next: Point, reverse: boolean, tension: number): Point => {
    const p = previous || current;
    const n = next || current;
    const angle = Math.atan2(n.y - p.y, n.x - p.x) + (reverse ? Math.PI : 0);
    const length = Math.sqrt(Math.pow(n.x - p.x, 2) + Math.pow(n.y - p.y, 2)) * tension;
    
    return {
        x: current.x + Math.cos(angle) * length,
        y: current.y + Math.sin(angle) * length,
    };
};

export const createSmoothPath = (points: Point[], roundness: number): string => {
    if (points.length === 0) return '';
    if (points.length < 3) {
        return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}` + points.slice(1).map(p => ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('');
    }

    // For non-curvy shapes, create a clean polygon path with 'Z' to close.
    // This avoids the redundant final point and creates cleaner SVG code.
    if (roundness < 0.01) {
        return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}` +
               points.slice(1).map(p => ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('') +
               ' Z';
    }

    // For curvy shapes, we must calculate the full path to ensure a smooth closure.
    const tension = roundness * 0.33; 

    let pathData = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

    for (let i = 0; i < points.length; i++) {
        const p0 = points[i];
        const p1 = points[(i + 1) % points.length];
        const pPrev = points[i === 0 ? points.length - 1 : i - 1];
        const pNext = points[(i + 2) % points.length];

        const cp1 = controlPoint(p0, pPrev, p1, false, tension);
        const cp2 = controlPoint(p1, p0, pNext, true, tension);

        pathData += ` C ${cp1.x.toFixed(2)},${cp1.y.toFixed(2)} ${cp2.x.toFixed(2)},${cp2.y.toFixed(2)} ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`;
    }

    return pathData + ' Z';
};
