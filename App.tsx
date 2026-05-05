import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import TransformerPage from './pages/TransformerPage';
import ComparatorPage from './pages/ComparatorPage';
import LineRemoverPage from './pages/LineRemoverPage';
import BlockRemoverPage from './pages/BlockRemoverPage';
import IDBlockTransformerPage from './pages/IDBlockTransformerPage';
import { Modal } from './components/Modal';
import { Menu, X } from 'lucide-react';

const App: React.FC = () => {
    const location = useLocation();
    const [isClearPageModalOpen, setIsClearPageModalOpen] = useState(false);
    const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    
    // Welcome popup state
    const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
    const [doNotShowAgain, setDoNotShowAgain] = useState(false);

    useEffect(() => {
        const hideWelcome = localStorage.getItem('hideWelcomeModal');
        if (!hideWelcome) {
            setIsWelcomeModalOpen(true);
        }
    }, []);

    const handleCloseWelcomeModal = () => {
        if (doNotShowAgain) {
            localStorage.setItem('hideWelcomeModal', 'true');
        }
        setIsWelcomeModalOpen(false);
    };
    
    const activeNavItemClasses = "bg-indigo-600 text-white";
    const inactiveNavItemClasses = "text-gray-300 hover:bg-gray-700 hover:text-white";

    const getPrefixByPath = (path: string) => {
        if (path.startsWith('/transformer')) return 'transformer_';
        if (path.startsWith('/comparator')) return 'comparator_';
        if (path.startsWith('/line-processor')) return 'lineRemover_';
        if (path.startsWith('/block-processor')) return 'blockRemover_';
        if (path.startsWith('/id-block-transformer')) return 'idblock_';
        return '';
    };

    const confirmClearPageCache = () => {
        const prefix = getPrefixByPath(location.pathname);
        if (prefix) {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
            window.location.reload();
        }
        setIsClearPageModalOpen(false);
    };

    const confirmClearAllCache = () => {
        localStorage.clear();
        window.location.reload();
    };

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            const keysToCheck = [
                'transformer_inputText',
                'comparator_fileAContent',
                'comparator_fileBContent',
                'lineRemover_inputText',
                'lineRemover_keywordsText',
                'blockRemover_inputText',
                'blockRemover_keywordsText',
                'idblock_inputText',
                'idblock_keywordsText',
                'transformer_sourceKey',
                'transformer_targetKey'
            ];

            const hasUnsavedChanges = keysToCheck.some(key => {
                try {
                    const item = localStorage.getItem(key);
                    if (!item) return false;
                    const parsed = JSON.parse(item);
                    return (typeof parsed === 'string') ? parsed.trim() !== '' : false;
                } catch {
                    return false;
                }
            });

            if (hasUnsavedChanges) {
                event.preventDefault();
                event.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);

    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    return (
        <div className="bg-gray-900 text-gray-200 font-sans flex flex-col min-h-screen w-full">
            <header className="flex-shrink-0 bg-gray-800/90 px-4 py-3 border-b border-gray-700/50 backdrop-blur-md z-30">
                <div className="mx-auto flex flex-wrap items-center justify-between gap-4">
                    <div className='shrink-0'>
                        <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                            Database Utility Suite
                        </h1>
                        <p className="hidden md:block text-xs text-gray-400 mt-0.5">
                           A versatile tool for YAML-like database files.
                        </p>
                    </div>

                    {/* Mobile Menu Toggle */}
                    <div className="xl:hidden shrink-0">
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="p-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-md transition-colors"
                        >
                            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>

                    <nav className="hidden xl:flex flex-1 justify-center w-full mx-4 min-w-0">
                        <div className="w-full max-w-4xl flex justify-between items-center bg-gray-900/50 p-1 rounded-lg border border-gray-700 overflow-x-auto min-w-0">
                            <NavLink to="/transformer" className={({ isActive }) => `flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 whitespace-nowrap text-center ${isActive ? activeNavItemClasses : inactiveNavItemClasses}`}>
                                Transformer
                            </NavLink>
                            <NavLink to="/line-processor" className={({ isActive }) => `flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 whitespace-nowrap text-center ${isActive ? activeNavItemClasses : inactiveNavItemClasses}`}>
                                Line Processor
                            </NavLink>
                            <NavLink to="/block-processor" className={({ isActive }) => `flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 whitespace-nowrap text-center ${isActive ? activeNavItemClasses : inactiveNavItemClasses}`}>
                                Block Processor
                            </NavLink>
                            <NavLink to="/id-block-transformer" className={({ isActive }) => `flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 whitespace-nowrap text-center ${isActive ? activeNavItemClasses : inactiveNavItemClasses}`}>
                                ID Block Transformer
                            </NavLink>
                            <NavLink to="/comparator" className={({ isActive }) => `flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 whitespace-nowrap text-center ${isActive ? activeNavItemClasses : inactiveNavItemClasses}`}>
                                Comparator
                            </NavLink>
                        </div>
                    </nav>
                    <div className="hidden xl:flex shrink-0 items-center space-x-2">
                        <button 
                            onClick={() => setIsClearPageModalOpen(true)}
                            className="px-3 py-1.5 text-xs font-semibold text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-md border border-gray-600 transition-colors whitespace-nowrap"
                        >
                            Clear Page Cache
                        </button>
                        <button 
                            onClick={() => setIsClearAllModalOpen(true)}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-md border border-red-500 transition-colors whitespace-nowrap"
                        >
                            Clear All Cache
                        </button>
                    </div>
                </div>

                {/* Mobile Menu Dropdown */}
                {isMobileMenuOpen && (
                    <div className="xl:hidden mt-4 pb-2 space-y-3">
                        <nav className="flex flex-col space-y-1 bg-gray-900/50 p-2 rounded-lg border border-gray-700">
                            <NavLink to="/transformer" className={({ isActive }) => `block px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${isActive ? activeNavItemClasses : inactiveNavItemClasses}`}>
                                Transformer
                            </NavLink>
                            <NavLink to="/line-processor" className={({ isActive }) => `block px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${isActive ? activeNavItemClasses : inactiveNavItemClasses}`}>
                                Line Processor
                            </NavLink>
                            <NavLink to="/block-processor" className={({ isActive }) => `block px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${isActive ? activeNavItemClasses : inactiveNavItemClasses}`}>
                                Block Processor
                            </NavLink>
                            <NavLink to="/id-block-transformer" className={({ isActive }) => `block px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${isActive ? activeNavItemClasses : inactiveNavItemClasses}`}>
                                Block ID Transformer
                            </NavLink>
                            <NavLink to="/comparator" className={({ isActive }) => `block px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${isActive ? activeNavItemClasses : inactiveNavItemClasses}`}>
                                Comparator
                            </NavLink>
                        </nav>
                        <div className="flex flex-col space-y-2">
                            <button 
                                onClick={() => { setIsClearPageModalOpen(true); setIsMobileMenuOpen(false); }}
                                className="w-full text-left px-3 py-2 text-sm font-semibold text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-md border border-gray-600 transition-colors"
                            >
                                Clear Page Cache
                            </button>
                            <button 
                                onClick={() => { setIsClearAllModalOpen(true); setIsMobileMenuOpen(false); }}
                                className="w-full text-left px-3 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-md border border-red-500 transition-colors"
                            >
                                Clear All Cache
                            </button>
                        </div>
                    </div>
                )}
            </header>
            
            <main className="flex-grow flex flex-col w-full px-2 sm:px-4 md:px-6 lg:px-8 mb-6">
                <div className="w-full flex-grow flex flex-col pt-4 sm:pt-6 pr-1">
                    <Routes>
                        <Route path="/" element={<Navigate to="/transformer" replace />} />
                        <Route path="/transformer" element={<TransformerPage />} />
                        <Route path="/comparator" element={<ComparatorPage />} />
                        <Route path="/line-processor" element={<LineRemoverPage />} />
                        <Route path="/block-processor" element={<BlockRemoverPage />} />
                        <Route path="/id-block-transformer" element={<IDBlockTransformerPage />} />
                    </Routes>
                    <footer className="w-full pb-3 pt-6 text-center text-xs text-gray-500 flex-shrink-0">
                        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                            <span>Created by <a href="https://github.com/giftbox-e/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white hover:underline transition-colors">giftbox-e</a></span>
                            <span className="hidden sm:inline">|</span>
                            <span>If this suite helps you, <a href="https://paypal.me/GiftBoxStudio" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white hover:underline transition-colors">consider buying me a coffee ☕</a></span>
                        </p>
                    </footer>
                </div>
            </main>

            <Modal 
                isOpen={isClearPageModalOpen} 
                onClose={() => setIsClearPageModalOpen(false)} 
                title="Clear Page Cache"
                actions={
                    <>
                        <button className="px-4 py-2 text-sm text-gray-300 hover:text-white" onClick={() => setIsClearPageModalOpen(false)}>Cancel</button>
                        <button className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md" onClick={confirmClearPageCache}>Clear Cache</button>
                    </>
                }
            >
                <p>Are you sure you want to clear the cache for the current page? This will reset your inputs and settings for this tool only.</p>
            </Modal>

            <Modal 
                isOpen={isClearAllModalOpen} 
                onClose={() => setIsClearAllModalOpen(false)} 
                title="Clear All Cache"
                actions={
                    <>
                        <button className="px-4 py-2 text-sm text-gray-300 hover:text-white" onClick={() => setIsClearAllModalOpen(false)}>Cancel</button>
                        <button className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md" onClick={confirmClearAllCache}>Clear All</button>
                    </>
                }
            >
                <p>Are you sure you want to clear all cache? This will reset all your inputs and preferences across all pages, including the welcome popup preference.</p>
            </Modal>

            <Modal 
                isOpen={isWelcomeModalOpen} 
                onClose={handleCloseWelcomeModal} 
                title="Welcome to Database Utility Suite"
                actions={
                    <>
                        <button className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium" onClick={handleCloseWelcomeModal}>Get Started</button>
                    </>
                }
            >
                <div className="space-y-4">
                    <p>
                        This suite provides a collection of powerful tools for processing, modifying, and comparing YAML-like database files commonly used in game servers and configuration files.
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Transformer:</strong> Apply basic mathematical operations to specific keys.</li>
                        <li><strong>Line Processor:</strong> Remove, retain, or comment out specific lines based on keywords.</li>
                        <li><strong>Block Processor:</strong> Manage entire blocks of data depending on their content.</li>
                        <li><strong>Block ID Transformer:</strong> Pinpoint blocks by ID and transform their internal values conditionally.</li>
                        <li><strong>Comparator:</strong> Compare two versions of a database file to easily spot the differences.</li>
                    </ul>
                    <p className="text-gray-400">
                        Everything runs locally in your browser. Your data is not sent anywhere. We use local browser cache to save your current inputs so you don't lose work when navigating.
                    </p>
                    
                    <div className="text-sm mt-4 border-t border-gray-700/50 pt-4 text-center">
                        Created by <a href="https://github.com/giftbox-e/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline transition-colors font-medium">giftbox-e</a>. <br />
                        If this suite saves you some time, <br />
                        consider <a href="https://paypal.me/GiftBoxStudio" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline transition-colors font-medium">buying me a coffee ☕</a>!
                    </div>

                    <div className="pt-2 flex items-center justify-center gap-2">
                        <input 
                            type="checkbox" 
                            id="dontShowAgain" 
                            checked={doNotShowAgain} 
                            onChange={(e) => setDoNotShowAgain(e.target.checked)}
                            className="rounded bg-gray-900 border-gray-600 text-indigo-500 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                        />
                        <label htmlFor="dontShowAgain" className="cursor-pointer select-none text-gray-300">Do not show this again.</label>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default App;
