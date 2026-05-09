import { useEffect, useRef, useState } from 'react';

export function useSyncedResize<T extends HTMLElement = HTMLElement>() {
    const leftRef = useRef<T>(null);
    const rightRef = useRef<T>(null);
    const [isManuallyResized, setIsManuallyResized] = useState(false);
    const isManuallyResizedRef = useRef(false);

    useEffect(() => {
        const left = leftRef.current;
        const right = rightRef.current;
        if (!left || !right) return;

        let syncing = false;

        const observer = new MutationObserver((mutations) => {
            if (syncing || window.innerWidth < 1024) return;
            
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const target = mutation.target as HTMLTextAreaElement | HTMLDivElement;
                    const other = target === left ? right : left;
                    
                    if (target.style.height && target.style.height !== other.style.height) {
                        syncing = true;
                        other.style.height = target.style.height;
                        if (!isManuallyResizedRef.current) {
                            isManuallyResizedRef.current = true;
                            setIsManuallyResized(true);
                        }
                        setTimeout(() => { syncing = false; }, 0);
                    }
                }
            }
        });

        observer.observe(left, { attributes: true, attributeFilter: ['style'] });
        observer.observe(right, { attributes: true, attributeFilter: ['style'] });

        const handleResize = () => {
            if (!left || !right) return;
            
            if (window.innerWidth < 1024) {
                left.style.height = '';
                right.style.height = '';
                if (isManuallyResizedRef.current) {
                    isManuallyResizedRef.current = false;
                    setIsManuallyResized(false);
                }
            } else if (isManuallyResizedRef.current) {
                const parent = left.parentElement;
                if (parent) {
                    const parentRect = parent.getBoundingClientRect();
                    const leftRect = left.getBoundingClientRect();
                    
                    if (parentRect.bottom > leftRect.bottom + 15) {
                        left.style.height = '';
                        right.style.height = '';
                        isManuallyResizedRef.current = false;
                        setIsManuallyResized(false);
                    }
                }
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // Initial check

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return { leftRef, rightRef, isManuallyResized };
}
