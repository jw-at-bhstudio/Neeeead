import React, { useMemo, useState } from "react";

type AxisKey = "numPoints" | "irregularity" | "complexity" | "roundness" | "strokeOffset";

interface FiveElementRadarControlProps {
    numPoints: number;
    setNumPoints: (value: number) => void;
    irregularity: number;
    setIrregularity: (value: number) => void;
    complexity: number;
    setComplexity: (value: number) => void;
    roundness: number;
    setRoundness: (value: number) => void;
    strokeOffset: number;
    setStrokeOffset: (value: number) => void;
}

const AXES: Array<{ key: AxisKey; label: string }> = [
    { key: "numPoints", label: "金" },
    { key: "irregularity", label: "火" },
    { key: "complexity", label: "木" },
    { key: "roundness", label: "水" },
    { key: "strokeOffset", label: "土" },
];

const VALUE_MIN_MAX: Record<AxisKey, { min: number; max: number; round?: boolean }> = {
    numPoints: { min: 3, max: 400, round: true },
    irregularity: { min: 0, max: 1 },
    complexity: { min: 0, max: 1 },
    roundness: { min: 0, max: 1 },
    strokeOffset: { min: 50, max: 1000, round: true },
};

function clamp01(value: number) {
    return Math.max(0, Math.min(1, value));
}

function normalize(value: number, min: number, max: number) {
    if (max <= min) return 0;
    return clamp01((value - min) / (max - min));
}

function denormalize(value01: number, min: number, max: number, round = false) {
    const raw = min + clamp01(value01) * (max - min);
    return round ? Math.round(raw) : Number(raw.toFixed(3));
}

export const FiveElementRadarControl: React.FC<FiveElementRadarControlProps> = ({
    numPoints,
    setNumPoints,
    irregularity,
    setIrregularity,
    complexity,
    setComplexity,
    roundness,
    setRoundness,
    strokeOffset,
    setStrokeOffset,
}) => {
    const [activeAxis, setActiveAxis] = useState<AxisKey | null>(null);
    const size = 220;
    const center = size / 2;
    const maxRadius = 82;

    const values01 = useMemo<Record<AxisKey, number>>(
        () => ({
            numPoints: normalize(numPoints, VALUE_MIN_MAX.numPoints.min, VALUE_MIN_MAX.numPoints.max),
            irregularity: normalize(irregularity, VALUE_MIN_MAX.irregularity.min, VALUE_MIN_MAX.irregularity.max),
            complexity: normalize(complexity, VALUE_MIN_MAX.complexity.min, VALUE_MIN_MAX.complexity.max),
            roundness: normalize(roundness, VALUE_MIN_MAX.roundness.min, VALUE_MIN_MAX.roundness.max),
            strokeOffset: normalize(strokeOffset, VALUE_MIN_MAX.strokeOffset.min, VALUE_MIN_MAX.strokeOffset.max),
        }),
        [numPoints, irregularity, complexity, roundness, strokeOffset]
    );

    const setByAxis = (axis: AxisKey, next01: number) => {
        const config = VALUE_MIN_MAX[axis];
        const next = denormalize(next01, config.min, config.max, config.round);
        if (axis === "numPoints") setNumPoints(next);
        if (axis === "irregularity") setIrregularity(next);
        if (axis === "complexity") setComplexity(next);
        if (axis === "roundness") setRoundness(next);
        if (axis === "strokeOffset") setStrokeOffset(next);
    };

    const axisVectors = AXES.map((_, index) => {
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / AXES.length;
        return { x: Math.cos(angle), y: Math.sin(angle) };
    });

    const webPoints = AXES.map((axis, index) => {
        const vec = axisVectors[index];
        const value = values01[axis.key];
        return `${center + vec.x * maxRadius * value},${center + vec.y * maxRadius * value}`;
    }).join(" ");

    const outerPoints = axisVectors
        .map((vec) => `${center + vec.x * maxRadius},${center + vec.y * maxRadius}`)
        .join(" ");

    const updateFromPointer = (axis: AxisKey, clientX: number, clientY: number, svg: SVGSVGElement) => {
        const rect = svg.getBoundingClientRect();
        const localX = clientX - rect.left;
        const localY = clientY - rect.top;
        const axisIndex = AXES.findIndex((item) => item.key === axis);
        const vec = axisVectors[axisIndex];
        const projection = ((localX - center) * vec.x + (localY - center) * vec.y) / maxRadius;
        setByAxis(axis, clamp01(projection));
    };

    return (
        <div className="rounded-[6px] border border-surface p-3 bg-bg/40">
            <div className="flex justify-center">
                <svg
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                    className="touch-none"
                    onPointerMove={(event) => {
                        if (!activeAxis) return;
                        updateFromPointer(activeAxis, event.clientX, event.clientY, event.currentTarget);
                    }}
                    onPointerUp={() => setActiveAxis(null)}
                    onPointerLeave={() => setActiveAxis(null)}
                >
                    <polygon points={outerPoints} fill="none" stroke="var(--color-border)" strokeWidth="1.5" />
                    {[0.25, 0.5, 0.75].map((ratio) => (
                        <polygon
                            key={ratio}
                            points={axisVectors
                                .map((vec) => `${center + vec.x * maxRadius * ratio},${center + vec.y * maxRadius * ratio}`)
                                .join(" ")}
                            fill="none"
                            stroke="var(--color-border)"
                            strokeWidth="1"
                            opacity="0.5"
                        />
                    ))}
                    {axisVectors.map((vec, index) => (
                        <line
                            key={AXES[index].key}
                            x1={center}
                            y1={center}
                            x2={center + vec.x * maxRadius}
                            y2={center + vec.y * maxRadius}
                            stroke="var(--color-border)"
                            strokeWidth="1"
                        />
                    ))}
                    <polygon points={webPoints} fill="var(--color-accent)" fillOpacity="0.18" stroke="var(--color-accent)" strokeWidth="2" />
                    {AXES.map((axis, index) => {
                        const vec = axisVectors[index];
                        const value = values01[axis.key];
                        const x = center + vec.x * maxRadius * value;
                        const y = center + vec.y * maxRadius * value;
                        const lx = center + vec.x * (maxRadius + 18);
                        const ly = center + vec.y * (maxRadius + 18);
                        return (
                            <g key={axis.key}>
                                <text
                                    x={lx}
                                    y={ly}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fill="var(--color-text)"
                                    fontSize="14"
                                >
                                    {axis.label}
                                </text>
                                <circle
                                    cx={x}
                                    cy={y}
                                    r={activeAxis === axis.key ? 7 : 6}
                                    fill="var(--color-accent)"
                                    stroke="var(--color-bg)"
                                    strokeWidth="2"
                                    onPointerDown={(event) => {
                                        event.currentTarget.setPointerCapture(event.pointerId);
                                        setActiveAxis(axis.key);
                                        updateFromPointer(axis.key, event.clientX, event.clientY, event.currentTarget.ownerSVGElement as SVGSVGElement);
                                    }}
                                />
                            </g>
                        );
                    })}
                </svg>
            </div>
            <div className="mt-2 grid grid-cols-5 gap-1 text-center">
                {AXES.map((axis) => (
                    <div key={axis.key} className="rounded border border-border/60 px-1 py-1">
                        <p className="text-text">{axis.label}</p>
                        <p className="text-lg text-text-muted">{values01[axis.key].toFixed(2)}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
