import { useEffect, useRef } from 'react';

export function useSyncedResize<T extends HTMLElement = HTMLElement>() {
    const leftRef = useRef<T>(null);
    const rightRef = useRef<T>(null);

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
                        setTimeout(() => { syncing = false; }, 0);
                    }
                }
            }
        });

        observer.observe(left, { attributes: true, attributeFilter: ['style'] });
        observer.observe(right, { attributes: true, attributeFilter: ['style'] });

        const handleResize = () => {
            if (window.innerWidth < 1024) {
                left.style.height = '';
                right.style.height = '';
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // Initial check

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return { leftRef, rightRef };
}
