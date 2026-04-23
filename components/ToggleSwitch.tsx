
import React from 'react';

interface ToggleSwitchProps {
    id: string;
    label: string;
    checked: boolean;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ id, label, checked, onChange }) => {
    const justifyContentClass = label ? 'justify-between' : 'justify-center';
    
    return (
        <label htmlFor={id} className={`flex items-center ${justifyContentClass} cursor-pointer`}>
            {label && <span className="text-text mr-4">{label}</span>}
            <div className="relative">
                <input id={id} type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
                <div className={`block w-14 h-8 rounded-full transition-colors ${checked ? 'bg-primary/20' : 'bg-surface'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-text w-6 h-6 rounded-full transition-transform ${checked ? 'transform translate-x-6 bg-primary' : ''}`}></div>
            </div>
        </label>
    );
};
