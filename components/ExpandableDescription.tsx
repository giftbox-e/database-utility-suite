import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export const ExpandableDescription: React.FC<{
    title: React.ReactNode;
    children: React.ReactNode;
}> = ({ title, children }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div 
            onClick={() => setIsOpen(!isOpen)}
            className={`bg-gray-900/40 border border-gray-700/50 rounded-lg mb-4 cursor-pointer group transition-colors hover:bg-gray-800/40 ${isOpen ? 'p-3' : 'px-3 py-2'}`}
        >
            {!isOpen ? (
                <div className="flex items-center justify-start text-sm font-medium text-gray-300 gap-1 w-full overflow-hidden">
                    <div className="truncate min-w-0 shrink">{title}</div>
                    <div className="flex-shrink-0 text-gray-500">...</div>
                    <div className="flex-shrink-0 inline-flex items-center gap-1 text-indigo-400 group-hover:text-indigo-300 transition-colors select-none font-medium whitespace-nowrap">
                        Read More <ChevronDown size={14} strokeWidth={2.5} />
                    </div>
                </div>
            ) : (
                <div className="text-sm">
                    <div className="space-y-2 text-gray-400">
                        {children}
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-700/50 flex justify-start">
                        <div className="inline-flex items-center gap-1 text-indigo-400 group-hover:text-indigo-300 transition-colors select-none font-medium">
                            Read Less <ChevronUp size={14} strokeWidth={2.5} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
