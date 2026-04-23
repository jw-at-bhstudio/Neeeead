export interface Range {
    min: number;
    max: number;
}

export interface PresetParams {
    vertices: Range;
    irregularity: Range;
    complexity: Range;
    strokeOffset: Range;
}

export type AppMode = 'viewer' | 'developer';
export type FitMode = 'A' | 'B'; // Maintained for backward compatibility, but effectively only B exists now

export interface QuizAnswerValues {
    numPoints: number;
    irregularity: number;
    complexity: number;
    strokeOffset: number;
    [key: string]: number; // Added index signature to fix TS error
}
