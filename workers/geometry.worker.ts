
import { union } from '../utils/polygon-clipper';

type Point = [number, number];
type Ring = Point[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

const polygonArea = (poly: Ring): number => {
    let area = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        area += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
    }
    return Math.abs(area / 2);
};

self.onmessage = (e: MessageEvent<{ polygon: Polygon }>) => {
    try {
        const { polygon } = e.data;
        if (!polygon || polygon.length === 0 || polygon[0].length === 0) {
            throw new Error("Received empty polygon data from main thread.");
        }

        // Use the polygon clipping library to resolve self-intersections
        // A union with itself is a standard trick to clean up a complex polygon
        const result: MultiPolygon = union(polygon, polygon);

        if (!result || result.length === 0) {
            throw new Error("Polygon simplification resulted in an empty shape.");
        }

        // The result might be a MultiPolygon. Find the largest one (by area)
        // which will be the main outer shape.
        let largestPolygon: Ring = [];
        let maxArea = 0;

        result.forEach(polyGroup => {
            polyGroup.forEach(poly => {
                const area = polygonArea(poly);
                if (area > maxArea) {
                    maxArea = area;
                    largestPolygon = poly;
                }
            });
        });
        
        if (largestPolygon.length === 0) {
            throw new Error("Could not identify the main outer shape after simplification.");
        }

        // Convert the cleaned polygon points back to an SVG path 'd' string
        const finalPath = largestPolygon.map((p, i) => 
            `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`
        ).join(' ') + ' Z';
        
        self.postMessage({ pathData: finalPath });

    } catch (error) {
        console.error("Error in geometry worker:", error);
        self.postMessage({ error: error instanceof Error ? error.message : 'An unknown error occurred in the worker.' });
    }
};
