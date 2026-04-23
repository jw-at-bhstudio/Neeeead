"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ParamControls } from '../components/ParamControls';
import { SvgCanvas } from '../components/SvgCanvas';
import { generatePoints, createSmoothPath, Point } from '../utils/geometry';
import { PresetParams, AppMode, FitMode, QuizAnswerValues } from '../utils/types';
import { INVALID_MESSAGES, EYE_PROMPTS } from '../utils/copywriting';
import { Button } from '../components/Button';
import { Slider } from '../components/Slider';
import { generateShareCard } from '../utils/canvasUtils';
import { ExpandModal } from '../components/ExpandModal';
import brandPresetConfig from '../brandPreset.json';

const CANVAS_SIZE = 1800;

// --- BEGIN INLINED WEB WORKER CODE ---
// This code is bundled directly into the app to avoid cross-origin errors.
// It uses a robust raster-to-vector approach for the "Expand Shape" feature.
const workerCode = `
// A robust implementation for converting an SVG path stroke into a filled outline.
// It works by rendering the path with its stroke onto an OffscreenCanvas, then
// tracing the resulting pixels to generate a clean vector outline. This avoids
// the geometric complexities and floating-point errors of manual path offsetting.

self.onmessage = (e) => {
    try {
        const { pathData, strokeOffset, canvasSize } = e.data;
        if (!pathData || strokeOffset <= 0) {
            self.postMessage({ error: 'Invalid path or stroke width.' });
            return;
        }

        // 1. Render the stroked path to an OffscreenCanvas.
        // We need a canvas larger than the original to prevent clipping during stroke rendering.
        // We use a 3x multiplier to be absolutely safe for very large stroke offsets.
        const padding = strokeOffset;
        const workerCanvasSize = canvasSize + padding * 2;
        const canvas = new OffscreenCanvas(workerCanvasSize, workerCanvasSize);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
             self.postMessage({ error: 'Could not create OffscreenCanvas context.' });
            return;
        }

        // Shift everything to the center of the enlarged canvas
        ctx.translate(padding, padding);

        ctx.fillStyle = 'black';
        // Fill rect needs to cover the entire shifted canvas
        ctx.fillRect(-padding, -padding, workerCanvasSize, workerCanvasSize);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = strokeOffset;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        const path = new Path2D(pathData);
        ctx.stroke(path);

        const imageData = ctx.getImageData(0, 0, workerCanvasSize, workerCanvasSize);
        const pixels = imageData.data;
        
        const isSolid = (x, y) => {
            if (x < 0 || y < 0 || x >= workerCanvasSize || y >= workerCanvasSize) return false;
            // Check the red channel (since we drew white on black)
            return pixels[(y * workerCanvasSize + x) * 4] > 128;
        };

        // 2. Find the first solid pixel to start tracing from.
        let startPoint = null;
        for (let y = 0; y < workerCanvasSize; y++) {
            for (let x = 0; x < workerCanvasSize; x++) {
                if (isSolid(x, y)) {
                    startPoint = { x, y };
                    break;
                }
            }
            if (startPoint) break;
        }

        if (!startPoint) {
            self.postMessage({ pathData: '' }); // Nothing was drawn
            return;
        }

        // 3. Trace the contour of the shape.
        // This is a Moore-Neighbor contour tracing algorithm.
        const contour = [];
        let currentPoint = startPoint;
        let direction = 0; // 0: N, 1: NE, 2: E, ..., 7: NW

        const dx = [0, 1, 1, 1, 0, -1, -1, -1];
        const dy = [-1, -1, 0, 1, 1, 1, 0, -1];

        do {
            contour.push(currentPoint);
            
            // Look for the next solid pixel, starting from the direction after we came from
            const startSearchDir = (direction + 6) % 8; // Look left first
            let foundNext = false;
            for (let i = 0; i < 8; i++) {
                const searchDir = (startSearchDir + i) % 8;
                const nextX = currentPoint.x + dx[searchDir];
                const nextY = currentPoint.y + dy[searchDir];

                if (isSolid(nextX, nextY)) {
                    currentPoint = { x: nextX, y: nextY };
                    direction = searchDir;
                    foundNext = true;
                    break;
                }
            }
            if (!foundNext) {
                break; // Should not happen on a closed contour
            }

        } while (currentPoint.x !== startPoint.x || currentPoint.y !== startPoint.y);
        
        if (contour.length === 0) {
             throw new Error("Contour tracing failed to find any points.");
        }
        
        // 4. Simplify the pixelated path using Ramer-Douglas-Peucker algorithm.
        // This reduces the number of points significantly while preserving the shape.
        const simplify = (points, tolerance) => {
            if (points.length < 3) return points;
            
            let dmax = 0;
            let index = 0;
            const end = points.length - 1;

            for (let i = 1; i < end; i++) {
                const d = perpendicularDistance(points[i], points[0], points[end]);
                if (d > dmax) {
                    index = i;
                    dmax = d;
                }
            }
            
            if (dmax > tolerance) {
                const recResults1 = simplify(points.slice(0, index + 1), tolerance);
                const recResults2 = simplify(points.slice(index, end + 1), tolerance);
                return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
            } else {
                return [points[0], points[end]];
            }
        };
        
        const perpendicularDistance = (p, p1, p2) => {
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            if (dx === 0 && dy === 0) {
                return Math.sqrt(Math.pow(p.x - p1.x, 2) + Math.pow(p.y - p1.y, 2));
            }
            const num = Math.abs(dy * p.x - dx * p.y + p2.x * p1.y - p2.y * p1.x);
            const den = Math.sqrt(dx * dx + dy * dy);
            return num / den;
        };
        
        // A tolerance of 2 pixels gives a good balance of detail and smoothness.
        const simplifiedContour = simplify(contour, 2.0);

        // 5. Convert the final points to an SVG path data string.
        // Important: we must translate the points back by -padding so they align
        // with the original coordinate system.
        const finalPath = simplifiedContour.map((p, i) =>
            \`\${i === 0 ? 'M' : 'L'} \${(p.x - padding).toFixed(2)} \${(p.y - padding).toFixed(2)}\`
        ).join(' ') + ' Z';
        
        self.postMessage({ pathData: finalPath });

    } catch (error) {
        console.error("Error in geometry worker:", error);
        self.postMessage({ error: error instanceof Error ? error.message : 'An unknown error occurred in the worker.' });
    }
};
`;
// --- END INLINED WEB WORKER CODE ---

// --- BEGIN VALIDITY WORKER CODE ---
const validityWorkerCode = `
self.onmessage = (e) => {
    try {
        const { pathData, strokeOffset, canvasSize } = e.data;
        if (!pathData) {
            self.postMessage({ isValid: true });
            return;
        }

        const scale = 0.2; // Downscale to 1/5th for fast pixel analysis
        const scaledCanvasSize = Math.floor(canvasSize * scale);
        const padding = Math.ceil(strokeOffset * scale);
        const workerCanvasSize = scaledCanvasSize + padding * 2;
        
        const canvas = new OffscreenCanvas(workerCanvasSize, workerCanvasSize);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
             self.postMessage({ isValid: true });
            return;
        }

        ctx.translate(padding, padding);
        ctx.scale(scale, scale);

        ctx.fillStyle = 'black';
        ctx.fillRect(-padding/scale, -padding/scale, workerCanvasSize/scale, workerCanvasSize/scale);
        
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = strokeOffset;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        const path = new Path2D(pathData);
        ctx.fill(path, 'nonzero');
        ctx.stroke(path);

        const imageData = ctx.getImageData(0, 0, workerCanvasSize, workerCanvasSize);
        const pixels = imageData.data;
        const width = workerCanvasSize;
        const height = workerCanvasSize;
        const totalPixels = width * height;

        const state = new Uint8Array(totalPixels);
        let totalSolid = 0;
        let firstSolidIdx = -1;

        for (let i = 0; i < totalPixels; i++) {
            if (pixels[i * 4] > 128) {
                state[i] = 1;
                totalSolid++;
                if (firstSolidIdx === -1) firstSolidIdx = i;
            }
        }

        if (totalSolid === 0) {
            self.postMessage({ isValid: true });
            return;
        }

        let filledSolid = 0;
        const queue = [firstSolidIdx];
        state[firstSolidIdx] = 2;

        let head = 0;
        while (head < queue.length) {
            const idx = queue[head++];
            filledSolid++;
            
            const x = idx % width;
            const y = Math.floor(idx / width);

            if (x > 0 && state[idx - 1] === 1) { state[idx - 1] = 2; queue.push(idx - 1); }
            if (x < width - 1 && state[idx + 1] === 1) { state[idx + 1] = 2; queue.push(idx + 1); }
            if (y > 0 && state[idx - width] === 1) { state[idx - width] = 2; queue.push(idx - width); }
            if (y < height - 1 && state[idx + width] === 1) { state[idx + width] = 2; queue.push(idx + width); }
        }

        if (filledSolid < totalSolid) {
            self.postMessage({ isValid: false, reason: 'fragments' });
            return;
        }

        let outsideTransparent = 0;
        const tQueue = [];

        for (let x = 0; x < width; x++) {
            if (state[x] === 0) { state[x] = 3; tQueue.push(x); }
            const bottomIdx = (height - 1) * width + x;
            if (state[bottomIdx] === 0) { state[bottomIdx] = 3; tQueue.push(bottomIdx); }
        }
        for (let y = 1; y < height - 1; y++) {
            const leftIdx = y * width;
            if (state[leftIdx] === 0) { state[leftIdx] = 3; tQueue.push(leftIdx); }
            const rightIdx = y * width + width - 1;
            if (state[rightIdx] === 0) { state[rightIdx] = 3; tQueue.push(rightIdx); }
        }

        let tHead = 0;
        while (tHead < tQueue.length) {
            const idx = tQueue[tHead++];
            outsideTransparent++;

            const x = idx % width;
            const y = Math.floor(idx / width);

            if (x > 0 && state[idx - 1] === 0) { state[idx - 1] = 3; tQueue.push(idx - 1); }
            if (x < width - 1 && state[idx + 1] === 0) { state[idx + 1] = 3; tQueue.push(idx + 1); }
            if (y > 0 && state[idx - width] === 0) { state[idx - width] = 3; tQueue.push(idx - width); }
            if (y < height - 1 && state[idx + width] === 0) { state[idx + width] = 3; tQueue.push(idx + width); }
        }

        const totalTransparent = totalPixels - totalSolid;
        if (outsideTransparent < totalTransparent) {
            self.postMessage({ isValid: false, reason: 'holes' });
            return;
        }

        self.postMessage({ isValid: true });

    } catch (error) {
        console.error("Error in validity worker:", error);
        self.postMessage({ isValid: true }); 
    }
};
`;
// --- END VALIDITY WORKER CODE ---

type AppState = 'welcome' | 'quiz' | 'playground';

const quizSteps = [
    { param: 'numPoints', question: '你的‘知己圈’更接近...', info: "知己多少", minLabel: '少而精', maxLabel: '广而多' },
    { param: 'irregularity', question: '一个完美的周末，你更倾向于？', info: "行事风格", minLabel: '按计划行事，效率第一', maxLabel: '跟着感觉走，享受意外' },
    { param: 'complexity', question: '面对内心不同的声音时，你通常？', info: "内心世界", minLabel: '很快做出决定，目标明确', maxLabel: '反复思量，时常纠结' },
    { param: 'strokeOffset', question: '你的社交风格更偏向...', info: "处世态度", minLabel: '坦率直接', maxLabel: '圆融周到' },
];

const App: React.FC = () => {
    // App flow state
    const [appState, setAppState] = useState<AppState>('welcome');
    const [quizStep, setQuizStep] = useState(0);
    const [mode, setMode] = useState<AppMode>('viewer');
    const [fitMode, setFitMode] = useState<FitMode>('B');

    // Normalized 0-1 values from quiz/viewer controls
    const [quizAnswers, setQuizAnswers] = useState<QuizAnswerValues>({
        numPoints: 0.5,
        irregularity: 0.5,
        complexity: 0.5,
        strokeOffset: 0.5,
    });

    // Mapped generation parameters
    const [numPoints, setNumPoints] = useState(8);
    const [irregularity, setIrregularity] = useState(0.5);
    const [complexity, setComplexity] = useState(0);
    const [roundness, setRoundness] = useState(0); // Hardcoded for brand aesthetic
    const [strokeOffset, setStrokeOffset] = useState(360);
    
    // Style parameters (now fixed)
    const strokeColor = 'var(--color-accent)';
    const backgroundColor = '#020E0E';
    
    // Generation state
    const [points, setPoints] = useState<Point[]>([]);
    const [pathData, setPathData] = useState('');
    const [seed, setSeed] = useState(() => Math.random());
    const [showHandles, setShowHandles] = useState(false);
    const [isGeneratingCard, setIsGeneratingCard] = useState(false);
    const [showAuthorModal, setShowAuthorModal] = useState(false);
    const [authorName, setAuthorName] = useState('');
    const [copyButtonText, setCopyButtonText] = useState('Copy SVG');
    const [eyes, setEyes] = useState<Point[]>([]);
    const [isDesktop, setIsDesktop] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(min-width: 1024px)').matches;
    });

    // Expand feature state
    const [showExpandModal, setShowExpandModal] = useState(false);
    const [isExpanding, setIsExpanding] = useState(false);
    const [expandedPathData, setExpandedPathData] = useState<string | null>(null);
    const [expandError, setExpandError] = useState<string | null>(null);

    // Validation state
    const [isValidShape, setIsValidShape] = useState<boolean>(true);
    const [validationMessage, setValidationMessage] = useState<string>("");
    const [isValidating, setIsValidating] = useState<boolean>(false);
    const [isAutoFixing, setIsAutoFixing] = useState<boolean>(false);

    // Card Preview State
    const [generatedCardUrl, setGeneratedCardUrl] = useState<string | null>(null);
    const [cardDownloadName, setCardDownloadName] = useState<string>("");

    const svgRef = useRef<SVGSVGElement>(null);
    const workerRef = useRef<Worker | null>(null);
    const workerUrlRef = useRef<string | null>(null);
    const validityWorkerRef = useRef<Worker | null>(null);
    const validityWorkerUrlRef = useRef<string | null>(null);

    // EFFECT: Map normalized answers to actual generation parameters
    useEffect(() => {
        const lerp = (min: number, max: number, val: number) => min * (1 - val) + max * val;

        const mappedNumPoints = Math.round(lerp(brandPresetConfig.vertices.min, brandPresetConfig.vertices.max, quizAnswers.numPoints));
        const mappedIrregularity = lerp(brandPresetConfig.irregularity.min, brandPresetConfig.irregularity.max, quizAnswers.irregularity);
        const mappedComplexity = lerp(brandPresetConfig.complexity.min, brandPresetConfig.complexity.max, quizAnswers.complexity);
        const mappedStrokeOffset = Math.round(lerp(brandPresetConfig.strokeOffset.min, brandPresetConfig.strokeOffset.max, quizAnswers.strokeOffset));

        setNumPoints(mappedNumPoints);
        setIrregularity(mappedIrregularity);
        setComplexity(mappedComplexity);
        setStrokeOffset(mappedStrokeOffset);
        setRoundness(0); // Keep brand aesthetic
    }, [quizAnswers]);
    
    // EFFECT: Generate points when parameters change
    useEffect(() => {
        const newPoints = generatePoints(numPoints, irregularity, complexity, CANVAS_SIZE, CANVAS_SIZE, seed);
        setPoints(newPoints);
    }, [numPoints, irregularity, complexity, seed]);

    const triggerValidation = useCallback((path: string, currentStrokeOffset: number) => {
        if (!path || currentStrokeOffset < 0) {
            setIsValidShape(true);
            return;
        }
        
        setIsValidating(true);
        
        if (validityWorkerRef.current) {
            validityWorkerRef.current.terminate();
            if (validityWorkerUrlRef.current) {
                URL.revokeObjectURL(validityWorkerUrlRef.current);
                validityWorkerUrlRef.current = null;
            }
        }

        const blob = new Blob([validityWorkerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        validityWorkerUrlRef.current = workerUrl;
        
        const worker = new Worker(workerUrl);
        validityWorkerRef.current = worker;

        worker.onmessage = (e) => {
            const { isValid } = e.data;
            setIsValidShape(isValid);
            if (!isValid) {
                setValidationMessage(prev => prev || INVALID_MESSAGES[Math.floor(Math.random() * INVALID_MESSAGES.length)]);
            } else {
                setValidationMessage("");
            }
            setIsValidating(false);
            worker.terminate();
            validityWorkerRef.current = null;
            URL.revokeObjectURL(workerUrl);
            validityWorkerUrlRef.current = null;
        };
        
        worker.postMessage({ pathData: path, strokeOffset: currentStrokeOffset, canvasSize: CANVAS_SIZE });
    }, []);

    // EFFECT: Create smooth path when points change
    useEffect(() => {
        if (points.length > 0) {
            const path = createSmoothPath(points, roundness);
            setPathData(path);
            triggerValidation(path, strokeOffset);
        } else {
            setPathData('');
            setIsValidShape(true);
        }
    }, [points, roundness, strokeOffset, triggerValidation]);

    // EFFECT: Auto-Fix Loop
    useEffect(() => {
        if (isAutoFixing) {
            if (isValidShape) {
                setIsAutoFixing(false);
            } else if (!isValidating) {
                if (strokeOffset >= 1000) {
                    setIsAutoFixing(false); // Maxed out, can't fix
                    return;
                }
                const timer = setTimeout(() => {
                    if (mode === 'viewer') {
                        setQuizAnswers(prev => {
                            if (prev.strokeOffset < 1.0) {
                                return { ...prev, strokeOffset: Math.min(1.0, prev.strokeOffset + 0.05) };
                            }
                            return prev;
                        });
                        // If we are maxed out on the slider, force the absolute value higher
                        if (quizAnswers.strokeOffset >= 1.0) {
                            setStrokeOffset(prev => Math.min(1000, prev + 25));
                        }
                    } else {
                        setStrokeOffset(prev => Math.min(1000, prev + 25));
                    }
                }, 50); // Small delay to allow render and feel smooth
                return () => clearTimeout(timer);
            }
        }
    }, [isAutoFixing, isValidShape, isValidating, strokeOffset, mode]);
    
    // Clean up worker on component unmount
    useEffect(() => {
        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
            }
            if (workerUrlRef.current) {
                URL.revokeObjectURL(workerUrlRef.current);
            }
            if (validityWorkerRef.current) {
                validityWorkerRef.current.terminate();
            }
            if (validityWorkerUrlRef.current) {
                URL.revokeObjectURL(validityWorkerUrlRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 1024px)');
        const syncLayoutMode = () => setIsDesktop(mediaQuery.matches);
        syncLayoutMode();
        mediaQuery.addEventListener('change', syncLayoutMode);
        return () => mediaQuery.removeEventListener('change', syncLayoutMode);
    }, []);

    const handleRegenerate = useCallback(() => {
        setSeed(Math.random());
        // setEyes([]); // Remove this to keep eyes when tweaking
    }, []);
    
    const handleRandomize = useCallback(() => {
        // We want Randomize to always generate a nice shape in viewer mode
        // In viewer mode, we randomize the 0-1 quiz answers, not the raw params
        if (mode === 'viewer') {
            setQuizAnswers({
                numPoints: Math.random(),
                irregularity: Math.random(),
                complexity: Math.random(),
                strokeOffset: Math.random(),
            });
        } else {
            // Dev randomize uses full range
            setNumPoints(Math.floor(Math.random() * (400 - 3 + 1)) + 3);
            setIrregularity(Math.random());
            setComplexity(Math.random());
            setRoundness(Math.random());
            setStrokeOffset(Math.floor(Math.random() * (1000 - 50 + 1)) + 50);
        }
        setSeed(Math.random());
        // setEyes([]); // Remove this to keep eyes when randomizing
    }, [mode]);

    const handleStartOver = () => {
        setAppState('welcome');
        setQuizStep(0);
        // Reset quiz answers to get a new random shape within brand preset
        setQuizAnswers({
            numPoints: Math.random(),
            irregularity: Math.random(),
            complexity: Math.random(),
            strokeOffset: Math.random(),
        });
        setSeed(Math.random());
        setEyes([]);
    };

    const handleGenerateCard = () => {
        if (!svgRef.current) return;
        setShowAuthorModal(true);
    };

    const handleCopySVG = useCallback(() => {
        if (!svgRef.current || !pathData) return;
        
        const portableColor = 'lab(65 -35 -55)';
        const eyesSvgString = eyes.map(eye => 
            `<circle cx="${eye.x.toFixed(2)}" cy="${eye.y.toFixed(2)}" r="45" fill="#000000" />`
        ).join('\n');

        const svgString = `<svg viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}" xmlns="http://www.w3.org/2000/svg">
<path d="${pathData}" fill="${portableColor}" stroke="${portableColor}" stroke-width="${strokeOffset}" stroke-linejoin="round" stroke-linecap="round" />
${eyesSvgString}
</svg>`;

        navigator.clipboard.writeText(svgString).then(() => {
            setCopyButtonText('Copied!');
            setTimeout(() => setCopyButtonText('Copy SVG'), 2000);
        }, (err) => {
            console.error('Failed to copy SVG: ', err);
            setCopyButtonText('Failed!');
            setTimeout(() => setCopyButtonText('Copy SVG'), 2000);
        });
    }, [pathData, strokeOffset, eyes]);


    const handleExpandShape = useCallback(async () => {
        if (!pathData || strokeOffset <= 0) {
            console.warn("Cannot expand a shape with no path or stroke.");
            return;
        }
        setShowExpandModal(true);
        setIsExpanding(true);
        setExpandedPathData(null);
        setExpandError(null);

        if (workerRef.current) {
            workerRef.current.terminate();
             if (workerUrlRef.current) {
                URL.revokeObjectURL(workerUrlRef.current);
                workerUrlRef.current = null;
            }
        }

        try {
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            workerUrlRef.current = workerUrl;
            
            const worker = new Worker(workerUrl);
            workerRef.current = worker;

            worker.onmessage = (e: MessageEvent<{ pathData?: string; error?: string }>) => {
                if (e.data.error) {
                    console.error("Worker failed to expand shape:", e.data.error);
                    setExpandError(e.data.error);
                } else {
                    setExpandedPathData(e.data.pathData || null);
                }
                setIsExpanding(false);
                worker.terminate();
                workerRef.current = null;
                URL.revokeObjectURL(workerUrl);
                workerUrlRef.current = null;
            };

            worker.onerror = (e) => {
                console.error("An error occurred in the geometry worker:", e.message);
                setExpandError("A critical error occurred during shape calculation.");
                setIsExpanding(false);
                worker.terminate();
                workerRef.current = null;
                URL.revokeObjectURL(workerUrl);
                workerUrlRef.current = null;
            };

            worker.postMessage({ pathData, strokeOffset, canvasSize: CANVAS_SIZE });

        } catch (error) {
            console.error("Failed to initiate shape expansion:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            setExpandError(errorMessage);
            setIsExpanding(false);
        }
    }, [pathData, strokeOffset]);
    
    // UI interaction states
    const [eyeErrorMsg, setEyeErrorMsg] = useState<string | null>(null);
    const [currentEyePrompt, setCurrentEyePrompt] = useState("");

    useEffect(() => {
        const count = Math.min(eyes.length, 3) as 0 | 1 | 2 | 3;
        const prompts = EYE_PROMPTS[count];
        setCurrentEyePrompt(prompts[Math.floor(Math.random() * prompts.length)]);
    }, [eyes.length]);

    const handleCanvasClick = (event: React.MouseEvent<SVGSVGElement>, innerPoint: { x: number, y: number }) => {
        if (eyes.length >= 3 || !svgRef.current || !isValidShape) return;

        // Clear any previous error message immediately on a new click
        setEyeErrorMsg(null);

        // We now receive the perfectly mapped inner coordinates directly from SvgCanvas
        const checkPoint = innerPoint;

        // 1. Check for overlapping (minimum distance check in raw coordinates)
        const EYE_RADIUS = 45;
        const MIN_DISTANCE = EYE_RADIUS * 2 + 10; // Eyes should be at least a little apart
        
        const isOverlapping = eyes.some(eye => {
            const dx = eye.x - checkPoint.x;
            const dy = eye.y - checkPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < MIN_DISTANCE;
        });

        if (isOverlapping) {
            setEyeErrorMsg("眼睛挤在一起了");
            return;
        }

        // 2. Pixel-perfect boundary check using Offscreen Canvas
        // Instead of relying on math approximations with stroke widths which fail
        // on sharp corners, we actually draw the shape and check the pixels where
        // the eye is trying to be placed.
        const canvas = document.createElement('canvas');
        // We only need a small bounding box around the eye to check
        const CHECK_SIZE = EYE_RADIUS * 2;
        canvas.width = CHECK_SIZE;
        canvas.height = CHECK_SIZE;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        if (ctx && pathData) {
            // Translate context so the center of the canvas corresponds to the click point
            ctx.translate(-checkPoint.x + EYE_RADIUS, -checkPoint.y + EYE_RADIUS);
            
            const path2d = new Path2D(pathData);
            
            // Draw the exact shape as it appears (solid)
            ctx.fillStyle = 'white';
            ctx.fill(path2d, 'nonzero');
            
            if (strokeOffset > 0) {
                ctx.strokeStyle = 'white';
                ctx.lineWidth = strokeOffset;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                ctx.stroke(path2d);
            }
            
            // Now check the pixels. We want to ensure that a circle of EYE_RADIUS
            // around the center is entirely white (solid).
            // We check a few key points on the circumference of the eye.
            const imageData = ctx.getImageData(0, 0, CHECK_SIZE, CHECK_SIZE).data;
            
            // Helper to check if a local canvas pixel is white
            const isSolid = (lx: number, ly: number) => {
                if (lx < 0 || lx >= CHECK_SIZE || ly < 0 || ly >= CHECK_SIZE) return false;
                const i = (Math.floor(ly) * CHECK_SIZE + Math.floor(lx)) * 4;
                return imageData[i] > 128; // Check Red channel
            };

            // Check center
            let isInside = isSolid(EYE_RADIUS, EYE_RADIUS);
            
            // Check circumference at 8 points (every 45 degrees)
            if (isInside) {
                for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
                    // Check slightly inside the radius to allow touching the very edge
                    const testRadius = EYE_RADIUS - 5; 
                    const lx = EYE_RADIUS + Math.cos(angle) * testRadius;
                    const ly = EYE_RADIUS + Math.sin(angle) * testRadius;
                    if (!isSolid(lx, ly)) {
                        isInside = false;
                        break;
                    }
                }
            }
                             
            if (!isInside) {
                setEyeErrorMsg("眼睛掉出去了");
                return;
            }
        }

        setEyes(prevEyes => [...prevEyes, { x: checkPoint.x, y: checkPoint.y }]);
    };

    const handleConfirmCardGeneration = async (name: string) => {
        if (!svgRef.current) return;
        setShowAuthorModal(false);
        setIsGeneratingCard(true);
        const finalName = name || '匿名';
        setCardDownloadName(finalName);
        try {
            const dataUrl = await generateShareCard({
                svgElement: svgRef.current,
                name: "我的捏物",
                authorName: finalName,
                bgColor: backgroundColor,
                stats: {
                    vertices: numPoints,
                    irregularity: Number(irregularity.toFixed(2)),
                    complexity: Number(complexity.toFixed(2)),
                    strokeOffset: strokeOffset
                }
            });
            setGeneratedCardUrl(dataUrl);
        } catch (error) {
            console.error("Failed to generate personality card:", error);
        } finally {
            setIsGeneratingCard(false);
            setAuthorName('');
        }
    };

    if (appState === 'welcome') {
        return (
            <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-center p-4 space-y-8">
                <div className="space-y-2">
                    <h1 className="text-[24pt] text-text">盒中捏物</h1>
                    <p className="text-4xl font-black tracking-widest text-primary">Neeeead!!!</p>
                </div>
                <p className="max-w-md text-text-muted">
                    欢迎来到「盒中捏物」，一个可以捏出你内心形状的小玩具。
                    准备好开始一场自我探索之旅了吗？
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                    <Button onClick={() => setAppState('quiz')} className="w-48">
                        开始探索
                    </Button>
                    <Button onClick={() => { setMode('developer'); setAppState('playground'); }} variant="secondary" className="w-48">
                        高级模式
                    </Button>
                </div>
                <footer className="absolute bottom-6 text-xs text-surface space-y-1">
                    <p>© 2025 四百盒子社区</p>
                    <p>设计 嘉文@不含观点°</p>
                </footer>
            </div>
        );
    }
    
    if (appState === 'quiz') {
        const step = quizSteps[quizStep];
        const value = quizAnswers[step.param as keyof QuizAnswerValues];
        const setValue = (newValue: number) => setQuizAnswers(prev => ({ ...prev, [step.param]: newValue }));

        return (
            <div className="min-h-screen bg-bg flex items-center justify-center p-8">
                <div className="w-full max-w-2xl space-y-8">
                    <div className="text-center space-y-2">
                        <p className="text-lg text-text-muted">{step.info}</p>
                        <h2 className="text-2xl text-text">{step.question}</h2>
                    </div>
                    <div className="py-9 px-[6px] border border-surface rounded-lg">
                        <Slider 
                            label=""
                            value={value}
                            onChange={(e) => setValue(Number(e.target.value))}
                            min={0}
                            max={1}
                            step={0.01}
                            minLabel={step.minLabel}
                            maxLabel={step.maxLabel}
                            hideInput
                        />
                    </div>
                    <div className="relative flex justify-center items-center mt-8">
                         <div className="absolute left-0">
                             <Button onClick={() => quizStep > 0 && setQuizStep(quizStep - 1)} variant="secondary" disabled={quizStep === 0}>
                                上一步
                            </Button>
                         </div>
                        <div className="flex items-center gap-2">
                            {quizSteps.map((_, i) => (
                                <div key={i} className={`w-2 h-2 rounded-full ${i === quizStep ? 'bg-primary' : 'bg-surface'}`}></div>
                            ))}
                        </div>
                        <div className="absolute right-0">
                            {quizStep < quizSteps.length - 1 ? (
                                <Button onClick={() => setQuizStep(quizStep + 1)}>
                                    下一步
                                </Button>
                            ) : (
                                <Button onClick={() => { setMode('viewer'); setAppState('playground'); }}>
                                    查看我的捏物
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const canvasContent = (
        <div className="relative w-full aspect-square max-w-[90vh] max-h-[90vh]">
            <SvgCanvas
                svgRef={svgRef}
                pathData={pathData}
                points={points}
                eyes={eyes}
                onPointsChange={setPoints}
                onCanvasClick={handleCanvasClick}
                onRemoveEye={(index) => setEyes(prev => prev.filter((_, i) => i !== index))}
                fillColor={strokeColor}
                strokeColor={strokeColor}
                strokeOffset={strokeOffset}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                showHandles={showHandles}
                fitMode={fitMode}
            />
            {(eyeErrorMsg || isValidShape) && (
                <div
                    className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full text-sm shadow-lg pointer-events-none transition-colors duration-300 ${
                        eyeErrorMsg
                            ? 'bg-red-900/80 text-red-200 animate-bounce'
                            : 'bg-primary/90 text-bg'
                    }`}
                >
                    {eyeErrorMsg ?? currentEyePrompt}
                </div>
            )}
        </div>
    );

    return (
        <>
            {/* 
              Mobile Layout: The outer div is no longer col-reverse. ParamControls handles the mobile canvas slot.
              Desktop Layout: lg:flex-row puts <ParamControls> LEFT and <main> RIGHT.
            */}
            <div className="h-screen flex flex-col lg:flex-row bg-bg overflow-hidden lg:p-[60px] lg:justify-between transition-colors duration-300" style={{ backgroundColor }}>
                <ParamControls
                    mode={mode} setMode={setMode}
                    fitMode={fitMode} setFitMode={setFitMode}
                    // Viewer params (normalized)
                    quizAnswers={quizAnswers}
                    setQuizAnswers={setQuizAnswers}
                    // Dev params (direct)
                    numPoints={numPoints} setNumPoints={setNumPoints}
                    irregularity={irregularity} setIrregularity={setIrregularity}
                    complexity={complexity} setComplexity={setComplexity}
                    roundness={roundness} setRoundness={setRoundness}
                    strokeOffset={strokeOffset} setStrokeOffset={setStrokeOffset}
                    // Actions
                    onRegenerate={handleRegenerate}
                    onRandomize={handleRandomize}
                    onRetakeQuiz={() => { setQuizStep(quizSteps.length - 1); setAppState('quiz'); }}
                    onGenerateCard={handleGenerateCard}
                    isGeneratingCard={isGeneratingCard}
                    onStartOver={handleStartOver}
                    // Dev specific
                    showHandles={showHandles} setShowHandles={setShowHandles}
                    onExpand={handleExpandShape}
                    onCopySVG={handleCopySVG}
                    copyButtonText={copyButtonText}
                    // Eyes
                    eyes={eyes}
                    onRemoveEyes={() => setEyes([])}
                    // Validation
                    isValidShape={isValidShape}
                    validationMessage={validationMessage}
                    onAutoFix={() => setIsAutoFixing(true)}
                    isAutoFixing={isAutoFixing}
                    // Mobile Canvas Injection
                    canvasSlot={isDesktop ? null : canvasContent}
                    // For save feature
                    seed={seed}
                    pathData={pathData}
                />
                {/* Desktop Canvas Container (render only on desktop to avoid duplicate SVG refs) */}
                {isDesktop && (
                    <main className="hidden lg:flex flex-1 items-center justify-end p-4 lg:p-0 transition-colors duration-300 bg-transparent">
                        {canvasContent}
                    </main>
                )}
            </div>
            {showAuthorModal && (
                 <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-bg border border-surface p-8 rounded-lg w-full max-w-sm space-y-6 relative">
                        <button 
                            onClick={() => { setShowAuthorModal(false); setAuthorName(''); }} 
                            className="absolute top-4 right-4 text-2xl font-light text-text-muted hover:text-text leading-none"
                            aria-label="Close"
                        >
                            &times;
                        </button>
                        <div className="text-center space-y-2">
                            <h2 className="text-lg text-text">署上你的名字</h2>
                            <p className="text-sm text-text-muted">为你的「捏物」留下创作者信息。</p>
                        </div>
                        <input
                            type="text"
                            value={authorName}
                            onChange={(e) => setAuthorName(e.target.value)}
                            placeholder="输入你的名字或保持匿名"
                            className="w-full text-text bg-surface px-3 py-2 rounded border border-border focus:ring-1 focus:ring-primary focus:border-primary text-center"
                            aria-label="Author's name"
                        />
                        <div className="flex flex-col gap-3">
                            <Button onClick={() => handleConfirmCardGeneration(authorName || '匿名')} className="w-full">
                                确认并生成卡片
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            <ExpandModal
                isOpen={showExpandModal}
                onClose={() => setShowExpandModal(false)}
                isLoading={isExpanding}
                pathData={expandedPathData}
                error={expandError}
                fillColor={strokeColor}
                viewBoxSize={CANVAS_SIZE}
            />

            {generatedCardUrl && (
                <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-4 lg:p-8 backdrop-blur-sm">
                    <button 
                        onClick={() => setGeneratedCardUrl(null)} 
                        className="absolute top-6 right-6 text-4xl font-light text-text-muted hover:text-text leading-none transition-colors"
                        aria-label="Close"
                    >
                        &times;
                    </button>
                    <div className="relative h-[70vh] lg:h-[80vh] max-w-full flex-shrink-0 flex justify-center items-center">
                        <img 
                            src={generatedCardUrl} 
                            alt="生成的捏物卡片" 
                            className="h-full object-contain rounded-lg shadow-2xl ring-1 ring-white/10" 
                        />
                    </div>
                    <div className="mt-8 flex flex-col sm:flex-row gap-4 items-center">
                        <Button 
                            onClick={() => {
                                const link = document.createElement('a');
                                link.href = generatedCardUrl;
                                link.download = `我的捏物-${cardDownloadName}.png`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }} 
                            className="w-48 shadow-lg shadow-primary/20"
                        >
                            下载卡片
                        </Button>
                        <Button 
                            onClick={() => setGeneratedCardUrl(null)} 
                            variant="secondary" 
                            className="w-48"
                        >
                            返回修改
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
};

export default App;
