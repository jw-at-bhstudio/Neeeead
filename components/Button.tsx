
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({ children, className, variant = 'primary', ...props }) => {
    const baseClasses = 'flex items-center justify-center gap-2 px-4 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

    const variantClasses = {
        primary: 'bg-primary text-bg hover:opacity-90 focus:ring-primary',
        secondary: 'bg-surface text-text hover:bg-border focus:ring-border',
    };

    return (
        <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
            {children}
        </button>
    );
};