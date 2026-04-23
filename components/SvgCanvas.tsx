
import React, { useState, useEffect, useRef } from 'react';
import { Point } from '../utils/geometry';
import { FitMode } from '../utils/types';

interface SvgCanvasProps {
    svgRef: React.RefObject<SVGSVGElement | null>;
    pathData: string;
    points: Point[];
    eyes: Point[];
    onPointsChange: (points: Point[]) => void;
    onCanvasClick: (event: React.MouseEvent<SVGSVGElement>, innerPoint: Point) => void;
    onRemoveEye?: (index: number) => void;
    fillColor: string | null;
    strokeColor: string | null;
    strokeOffset: number;
    width: number;
    height: number;
    showHandles: boolean;
    fitMode: FitMode;
}

export const SvgCanvas: React.FC<SvgCanvasProps> = ({ 
    svgRef, 
    pathData, 
    points,
    eyes,
    onPointsChange, 
    onCanvasClick,
    onRemoveEye,
    fillColor, 
    strokeColor, 
    strokeOffset, 
    width, 
    height,
    showHandles,
    fitMode,
}) => {
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    const pathRef = useRef<SVGPathElement>(null);
    const [transformState, setTransformState] = useState<{scale: number, tx: number, ty: number}>({ scale: 1, tx: 0, ty: 0 });

    useEffect(() => {
        if (fitMode === 'A' || !pathRef.current || !pathData) {
            setTransformState({ scale: 1, tx: 0, ty: 0 });
            return;
        }

        // Mode B: Calculate BBox and scale
        try {
            // getBBox of path gets the geometry bounds without stroke
            let bbox = pathRef.current.getBBox();
            
            // However, SVG getBBox() for paths with cubic beziers can sometimes 
            // return a box that doesn't fully encompass extreme control points.
            // To be absolutely safe, we also calculate the bounding box of our raw points.
            if (points && points.length > 0) {
                const minX = Math.min(...points.map(p => p.x));
                const maxX = Math.max(...points.map(p => p.x));
                const minY = Math.min(...points.map(p => p.y));
                const maxY = Math.max(...points.map(p => p.y));
                
                // Merge the two bounding boxes to get the absolute maximum bounds
                bbox = {
                    x: Math.min(bbox.x, minX),
                    y: Math.min(bbox.y, minY),
                    width: Math.max(bbox.x + bbox.width, maxX) - Math.min(bbox.x, minX),
                    height: Math.max(bbox.y + bbox.height, maxY) - Math.min(bbox.y, minY)
                } as DOMRect;
            }

            if (bbox.width === 0 || bbox.height === 0) return;

            // BBox of geometry doesn't include stroke, so we add stroke padding
            // Plus an extra safety margin to account for bezier curve overshoots beyond control points
            const padding = (strokeOffset / 2) + 60; // stroke + larger safety margin
            const totalWidth = bbox.width + padding * 2;
            const totalHeight = bbox.height + padding * 2;
            
            // Calculate scale to fit within canvas width/height
            const scaleX = width / totalWidth;
            const scaleY = height / totalHeight;
            const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down to fit

            // Calculate center of geometry
            const cx = bbox.x + bbox.width / 2;
            const cy = bbox.y + bbox.height / 2;
            
            // Canvas center
            const frameCx = width / 2;
            const frameCy = height / 2;

            // We want to scale around the geometry center, then move it to frame center
            // Transform formula: translate(frameCx - cx*scale, frameCy - cy*scale) scale(scale)
            setTransformState({
                scale,
                tx: frameCx - cx * scale,
                ty: frameCy - cy * scale
            });
        } catch (e) {
            // getBBox might throw if SVG is not rendered yet
            console.warn("Could not calculate BBox", e);
        }
    }, [pathData, strokeOffset, width, height, fitMode]);

    const clientToInner = (clientX: number, clientY: number, svgElement?: SVGSVGElement): Point => {
        const targetSvg = svgElement ?? svgRef.current;
        if (!targetSvg) return { x: 0, y: 0 };
        
        // 1. Get the most reliable SVG point mapping via native matrix
        const pt = targetSvg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const ctm = targetSvg.getScreenCTM();
        if (!ctm) return { x: 0, y: 0 };
        const svgPoint = pt.matrixTransform(ctm.inverse());

        // 2. Map SVG viewport coordinates to inner path coordinates 
        // by applying the exact inverse of our explicit React transform state.
        if (fitMode === 'B') {
            return {
                x: (svgPoint.x - transformState.tx) / transformState.scale,
                y: (svgPoint.y - transformState.ty) / transformState.scale
            };
        }
        return { x: svgPoint.x, y: svgPoint.y };
    };
    
    const handlePointMouseDown = (index: number) => {
        setDraggingIndex(index);
    };

    useEffect(() => {
        const handleWindowMouseMove = (e: MouseEvent) => {
            if (draggingIndex === null || !svgRef.current) return;
            const newPos = clientToInner(e.clientX, e.clientY);
            const newPoints = points.map((p, i) => i === draggingIndex ? { x: newPos.x, y: newPos.y } : p);
            onPointsChange(newPoints);
        };

        const handleWindowMouseUp = () => {
            setDraggingIndex(null);
        };

        if (draggingIndex !== null) {
            window.addEventListener('mousemove', handleWindowMouseMove);
            window.addEventListener('mouseup', handleWindowMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
        };
    }, [draggingIndex, points, onPointsChange, svgRef, width, height, fitMode, transformState]);

    const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
        if (onCanvasClick && svgRef.current) {
            // We pass the raw mouse event, and the perfectly mapped inner coordinate
            const innerPoint = clientToInner(e.clientX, e.clientY, e.currentTarget);
            onCanvasClick(e, innerPoint);
        }
    };

    return (
        <div className="w-full h-full border border-surface rounded-[6px] p-[6px]">
            <svg
                ref={svgRef}
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-full cursor-crosshair transition-transform duration-300"
                xmlns="http://www.w3.org/2000/svg"
                onClick={handleCanvasClick}
            >
                <g transform={`translate(${transformState.tx}, ${transformState.ty}) scale(${transformState.scale})`}>
                    <path
                        ref={pathRef}
                        d={pathData}
                        fill={fillColor ?? 'none'}
                        stroke={strokeOffset > 0 ? (strokeColor ?? 'var(--color-accent)') : 'none'}
                        strokeWidth={strokeOffset}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        className="transition-all duration-300"
                    />

                    {eyes.map((eye, index) => (
                        <circle
                            key={`eye-${index}-${eye.x}-${eye.y}`}
                            cx={eye.x}
                            cy={eye.y}
                            r={45}
                            fill="#000000"
                            className="cursor-pointer transition-transform hover:scale-110"
                            style={{ transformOrigin: `${eye.x}px ${eye.y}px` }}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onRemoveEye) onRemoveEye(index);
                            }}
                        />
                    ))}

                    {showHandles && points.map((point, index) => (
                        <circle
                            key={`handle-${index}-${point.x}-${point.y}`}
                            cx={point.x}
                            cy={point.y}
                            r={25}
                            fill="rgba(253, 241, 241, 0.3)"
                            stroke="#FDF1F1"
                            strokeWidth="3"
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                handlePointMouseDown(index);
                            }}
                            style={{ cursor: 'move' }}
                        />
                    ))}
                </g>
            </svg>
        </div>
    );
};
