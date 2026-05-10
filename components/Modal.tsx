import React, { ReactNode } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    actions?: ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, actions }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md flex flex-col border border-gray-700 max-h-full">
                <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-700 font-sans">
                    <h3 className="text-lg font-bold text-white">{title}</h3>
                    <button 
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="p-4 text-gray-300 font-sans text-sm overflow-y-auto custom-scrollbar">
                    {children}
                </div>
                {actions && (
                    <div className="px-4 py-3 bg-gray-900/50 flex justify-end gap-3 flex-wrap flex-shrink-0 rounded-b-lg">
                        {actions}
                    </div>
                )}
            </div>
        </div>
    );
};