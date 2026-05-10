import React, { useCallback, useEffect, useRef } from 'react';

interface DragHandleProps {
  targetRef: React.RefObject<HTMLElement | null>;
  onManualResize?: () => void;
  visible?: boolean;
}

export const DragHandle: React.FC<DragHandleProps> = ({ targetRef, onManualResize, visible = true }) => {
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const handlePointerDown = useCallback((e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => {
    if (!targetRef.current) return;
    
    isDragging.current = true;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    startY.current = clientY;
    startHeight.current = targetRef.current.getBoundingClientRect().height;
    
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [targetRef]);

  useEffect(() => {
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current || !targetRef.current) return;
      if ('touches' in e && e.cancelable) {
          e.preventDefault();
      }
      
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const deltaY = clientY - startY.current;
      const newHeight = Math.max(startHeight.current + deltaY, 60);
      
      targetRef.current.style.height = `${newHeight}px`;
      targetRef.current.style.flex = 'none'; 
      
      if (onManualResize) onManualResize();
    };

    const handlePointerUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [targetRef, onManualResize]);

  if (!visible) return null;

  return (
    <div
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown}
      className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center z-[60] group bg-transparent hover:bg-gray-700/50 transition-colors"
      style={{ touchAction: 'none' }}
    >
      <div className="w-full h-[2px] bg-gray-700/50 group-hover:bg-indigo-500 transition-colors flex items-center justify-center relative">
         <div className="absolute bg-[#1e293b] rounded-md border border-gray-600 px-2 h-[14px] text-gray-400 group-hover:text-indigo-400 group-hover:border-indigo-500 flex items-center justify-center shadow-lg transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="8 9 12 5 16 9"></polyline>
                <polyline points="8 15 12 19 16 15"></polyline>
            </svg>
         </div>
      </div>
    </div>
  );
};
