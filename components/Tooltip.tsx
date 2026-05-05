import React, { useState, useRef } from 'react';

export const InfoIcon: React.FC<{ className?: string }> = ({ className = "h-4 w-4 text-gray-400 hover:text-gray-200 transition-colors" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
    </svg>
);

export const Tooltip: React.FC<{ text: string; children?: React.ReactNode }> = ({ text, children }) => {
    const [visible, setVisible] = useState(false);
    const [style, setStyle] = useState<React.CSSProperties>({});
    const wrapperRef = useRef<HTMLDivElement>(null);

    const handleMouseEnter = () => {
        if (wrapperRef.current) {
            const rect = wrapperRef.current.getBoundingClientRect();
            
            // Heuristic to check if tooltip should be displayed below
            const shouldShowBelow = rect.top < 100;

            let newStyle: React.CSSProperties = {
                position: 'fixed',
                left: `${rect.left + rect.width / 2}px`,
                zIndex: 50,
            };

            if (shouldShowBelow) {
                newStyle.top = `${rect.bottom + 8}px`; // 8px margin below
                newStyle.transform = 'translateX(-50%)';
            } else {
                newStyle.top = `${rect.top - 8}px`; // 8px margin above
                newStyle.transform = 'translate(-50%, -100%)';
            }
            setStyle(newStyle);
            setVisible(true);
        }
    };
    
    const handleMouseLeave = () => {
        setVisible(false);
    };

    // This check ensures that on initial render (before any hover), the tooltip div
    // is taken out of the document flow and does not affect the layout.
    const isPositioned = style.position === 'fixed';

    return (
        <div 
            ref={wrapperRef} 
            className="flex items-center"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children || <InfoIcon />}
            <div 
                style={style}
                className={`w-64 p-2 text-xs text-white bg-gray-900 border border-gray-600 rounded-md shadow-lg transition-opacity duration-300 pointer-events-none ${visible ? 'opacity-100' : 'opacity-0'} ${!isPositioned ? 'absolute' : ''}`}
            >
                {text}
            </div>
        </div>
    );
};
