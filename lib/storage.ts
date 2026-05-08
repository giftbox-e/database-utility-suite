export const safeSetLocalStorage = (key: string, value: any) => {
    try {
        const stringified = JSON.stringify(value);
        // Do not save to localStorage if it's too large (e.g., > 1MB)
        // 1MB is approx 1,000,000 characters. We'll be conservative with 100,000 to save quota.
        if (stringified.length > 500000) {
            console.warn(`Value for ${key} is too large to safely store in localStorage, skipping.`);
            return;
        }
        localStorage.setItem(key, stringified);
    } catch (error) {
        console.error(`Failed to execute safeSetLocalStorage for ${key}:`, error);
    }
};
