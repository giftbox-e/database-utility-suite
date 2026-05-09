export const safeSetLocalStorage = (key: string, value: any) => {
    try {
        const stringified = JSON.stringify(value);
        localStorage.setItem(key, stringified);
    } catch (error) {
        console.error(`Failed to execute safeSetLocalStorage for ${key}. This is likely due to the browser's 5MB localStorage limit being exceeded:`, error);
    }
};
