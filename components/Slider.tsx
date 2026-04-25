
import React from 'react';

interface SliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    disabled?: boolean;
    minLabel?: string;
    maxLabel?: string;
    hideInput?: boolean;
}

export const Slider: React.FC<SliderProps> = ({ 
    label, value, min, max, step = 1, onChange, disabled = false, 
    minLabel, maxLabel, hideInput = false 
}) => {
    const decimalPlaces = String(step).includes('.') ? String(step).split('.')[1].length : 0;
    const displayValue = value.toFixed(decimalPlaces);
    const hasRangeLabels = !!(minLabel || maxLabel);
    
    return (
        <div className={disabled ? 'opacity-50' : ''}>
            {hasRangeLabels ? (
                <>
                    <div className="hidden lg:flex justify-between items-center mb-1 gap-4">
                        {label && <label className="text-text flex-grow whitespace-nowrap">{label}</label>}
                        {!hideInput && (
                            <input
                                type="number"
                                min={min}
                                max={max}
                                step={step}
                                value={displayValue}
                                onChange={onChange}
                                disabled={disabled}
                                onWheel={(e) => (e.target as HTMLElement).blur()}
                                className="w-20 text-text bg-surface px-2 py-1 rounded border border-border focus:ring-1 focus:ring-primary focus:border-primary text-right disabled:cursor-not-allowed flex-shrink-0"
                            />
                        )}
                    </div>
                    <div className="lg:hidden flex items-center justify-between text-lg mb-1 px-1">
                        <span className="text-text-muted">{minLabel}</span>
                        {label && <label className="text-text text-center flex-1">{label}</label>}
                        <span className="text-text-muted">{maxLabel}</span>
                    </div>
                </>
            ) : (
                <div className="flex justify-between items-center mb-1 gap-4">
                    {label && <label className="text-text flex-grow whitespace-nowrap">{label}</label>}
                    {!hideInput && (
                        <input
                            type="number"
                            min={min}
                            max={max}
                            step={step}
                            value={displayValue}
                            onChange={onChange}
                            disabled={disabled}
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            className="w-20 text-text bg-surface px-2 py-1 rounded border border-border focus:ring-1 focus:ring-primary focus:border-primary text-right disabled:cursor-not-allowed flex-shrink-0"
                        />
                    )}
                </div>
            )}
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={onChange}
                disabled={disabled}
                className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-primary disabled:cursor-not-allowed"
            />
            {hasRangeLabels && (
                <div className="hidden lg:flex justify-between items-center text-lg text-text-muted mt-1 px-1">
                    <span>{minLabel}</span>
                    <span>{maxLabel}</span>
                </div>
            )}
        </div>
    );
};
