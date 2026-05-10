import React, { useRef } from 'react';
import { DragHandle } from './DragHandle';

interface ResizablePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  autoExtend?: boolean;
  baseHeight?: string;
  isManuallyResized?: boolean;
  onDragResize?: () => void;
}

export const ResizablePanel = React.forwardRef<HTMLDivElement, ResizablePanelProps>(({ 
  children, 
  autoExtend = false, 
  baseHeight = '120px', 
  isManuallyResized = false, 
  className = '', 
  onDragResize,
  ...props 
}, ref) => {
  const localRef = useRef<HTMLDivElement>(null);
  const actualRef = (ref as React.RefObject<HTMLDivElement>) || localRef;

  const style: React.CSSProperties = {
    minHeight: baseHeight,
    position: 'relative',
    overflow: 'hidden',
    flex: autoExtend ? '1 1 auto' : (isManuallyResized ? 'none' : '1 1 0%'),
  };

  return (
    <div ref={actualRef} style={style} className={`flex flex-col pb-1 ${className}`} {...props}>
      {children}
      <DragHandle targetRef={actualRef} visible={!autoExtend} onManualResize={onDragResize} />
    </div>
  );
});
ResizablePanel.displayName = 'ResizablePanel';
