
import React from 'react';

interface PresetRangeControlProps {
    label: string;
    minVal: number;
    maxVal: number;
    onMinChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onMaxChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    step?: number;
    minLimit?: number;
    maxLimit?: number;
}

export const PresetRangeControl: React.FC<PresetRangeControlProps> = ({ 
    label, 
    minVal, 
    maxVal, 
    onMinChange, 
    onMaxChange, 
    step = 1, 
    minLimit, 
    maxLimit 
}) => {
    const inputClasses = "w-full text-text bg-surface px-2 py-1 rounded border border-border focus:ring-1 focus:ring-primary focus:border-primary text-center";
    
    return (
        <div>
            <label className="block text-text mb-1">{label}</label>
            <div className="flex items-center justify-between gap-2">
                <input 
                    type="number" 
                    value={minVal} 
                    onChange={onMinChange} 
                    step={step} 
                    min={minLimit} 
                    max={maxLimit} 
                    onWheel={e => (e.target as HTMLElement).blur()} 
                    className={inputClasses} 
                    aria-label={`${label} minimum`}
                />
                <span className="text-border">-</span>
                <input 
                    type="number" 
                    value={maxVal} 
                    onChange={onMaxChange} 
                    step={step} 
                    min={minLimit} 
                    max={maxLimit} 
                    onWheel={e => (e.target as HTMLElement).blur()} 
                    className={inputClasses}
                    aria-label={`${label} maximum`}
                />
            </div>
        </div>
    );
};