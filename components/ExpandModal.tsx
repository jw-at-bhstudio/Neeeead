
import React, { useRef, useState, useEffect } from 'react';
import { Button } from './Button';
import { DownloadIcon, CopyIcon } from './icons';

interface ExpandModalProps {
    isOpen: boolean;
    onClose: () => void;
    isLoading: boolean;
    pathData: string | null;
    error: string | null;
    fillColor: string | null;
    viewBoxSize: number;
}

export const ExpandModal: React.FC<ExpandModalProps> = ({ isOpen, onClose, isLoading, pathData, error, fillColor, viewBoxSize }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const pathRef = useRef<SVGPathElement>(null);
    const [copyButtonText, setCopyButtonText] = useState('Copy SVG');
    const resolvedFillColor = useRef<string>('var(--color-accent)');
    const [transformState, setTransformState] = useState<{scale: number, tx: number, ty: number}>({ scale: 1, tx: 0, ty: 0 });

    useEffect(() => {
        if (!isOpen) {
            // Reset button text when modal is closed
            setTimeout(() => setCopyButtonText('Copy SVG'), 300);
            setTransformState({ scale: 1, tx: 0, ty: 0 });
            return;
        }

        // When the modal is open and the path is rendered, compute the actual color and BBox
        if (svgRef.current && pathData) {
            const pathElement = svgRef.current.querySelector('path');
            if (pathElement) {
                resolvedFillColor.current = window.getComputedStyle(pathElement).getPropertyValue('fill');
                
                // Calculate BBox for centering and scaling
                try {
                    const bbox = pathElement.getBBox();
                    if (bbox.width > 0 && bbox.height > 0) {
                        // For expanded shape, the stroke is already baked in, so we only need a small safety padding
                        const padding = 60;
                        const totalWidth = bbox.width + padding * 2;
                        const totalHeight = bbox.height + padding * 2;
                        
                        const scaleX = viewBoxSize / totalWidth;
                        const scaleY = viewBoxSize / totalHeight;
                        const scale = Math.min(scaleX, scaleY, 1);

                        const cx = bbox.x + bbox.width / 2;
                        const cy = bbox.y + bbox.height / 2;
                        const frameCx = viewBoxSize / 2;
                        const frameCy = viewBoxSize / 2;

                        setTransformState({
                            scale,
                            tx: frameCx - cx * scale,
                            ty: frameCy - cy * scale
                        });
                    }
                } catch (e) {
                    console.warn("Could not calculate BBox for expanded shape", e);
                }
            }
        }
    }, [isOpen, pathData, viewBoxSize]);

    const getSvgString = () => {
        if (!pathData) return '';
        // Construct the SVG string with the calculated transform applied to a group
        return `<svg viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(${transformState.tx}, ${transformState.ty}) scale(${transformState.scale})">
    <path d="${pathData}" fill="${resolvedFillColor.current}" />
  </g>
</svg>`;
    };
    
    const handleDownload = () => {
        const svgString = getSvgString();
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'expanded-shape.svg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleCopy = () => {
        const svgString = getSvgString();
        navigator.clipboard.writeText(svgString).then(() => {
            setCopyButtonText('Copied!');
            setTimeout(() => setCopyButtonText('Copy SVG'), 2000);
        }, (err) => {
            console.error('Failed to copy SVG: ', err);
            setCopyButtonText('Failed!');
            setTimeout(() => setCopyButtonText('Copy SVG'), 2000);
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-bg border border-surface p-6 rounded-lg w-full max-w-2xl space-y-4 relative" onClick={e => e.stopPropagation()}>
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 text-3xl font-light text-text-muted hover:text-text leading-none"
                    aria-label="Close"
                >
                    &times;
                </button>
                <h2 className="text-lg text-text">Expanded Shape</h2>
                <div className="aspect-square bg-black/20 border border-surface rounded p-4 flex items-center justify-center">
                    {isLoading ? (
                        <div className="text-center space-y-2">
                             <div className="w-8 h-8 border-4 border-surface border-t-primary rounded-full animate-spin mx-auto"></div>
                            <p className="text-text-muted">Calculating...</p>
                        </div>
                    ) : error ? (
                        <p className="text-alert text-center">{error}</p>
                    ) : pathData ? (
                        <svg
                            ref={svgRef}
                            viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
                            className="w-full h-full transition-transform duration-300"
                        >
                            <g transform={`translate(${transformState.tx}, ${transformState.ty}) scale(${transformState.scale})`}>
                                <path
                                    ref={pathRef}
                                    d={pathData}
                                    fill={fillColor || 'var(--color-accent)'}
                                    className="transition-all duration-300"
                                />
                            </g>
                        </svg>
                    ) : (
                         <p className="text-alert">Failed to generate expanded shape.</p>
                    )}
                </div>
                <div className="flex gap-3">
                    <Button onClick={handleDownload} variant="secondary" className="w-full" disabled={isLoading || !pathData || !!error}>
                        <DownloadIcon /> Download SVG
                    </Button>
                    <Button onClick={handleCopy} variant="secondary" className="w-full" disabled={isLoading || !pathData || !!error}>
                       <CopyIcon /> {copyButtonText}
                    </Button>
                </div>
            </div>
             <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in { animation: fade-in 0.2s ease-out; }
            `}</style>
        </div>
    );
};
