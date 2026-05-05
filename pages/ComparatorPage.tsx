
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { AdvancedLinesDiffComputer, LinesDiff } from 'vscode-diff';
import { UploadIcon, DownloadIcon, CopyIcon, PencilAltIcon, ArrowRightIcon, ArrowLeftIcon } from '../components/Icons';
import { Tooltip } from '../components/Tooltip';

type DiffLineType = 'common' | 'added' | 'removed';
type DiffViewLine = { type: DiffLineType | 'empty'; line: string };
type SelectionRange = { start: number; end: number } | null; // 0-based, inclusive

// --- Helper Functions ---
const createDownload = (filename: string, content: string) => {
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
};

const getInitialState = <T,>(key: string, defaultValue: T): T => {
    try {
        const item = localStorage.getItem(key);
        if (item) {
            const parsed = JSON.parse(item);
            if (typeof parsed === typeof defaultValue) {
                return parsed;
            }
        }
        return defaultValue;
    } catch (error) {
        console.error(error);
        return defaultValue;
    }
};


// --- Editor Panel Component ---
const EditorPanel: React.FC<{
    content: string;
    onContentChange: (newContent: string) => void;
    onSelectionChange: (range: SelectionRange) => void;
    diffLines: DiffViewLine[];
    isDragging: boolean;
    setIsDragging: (isDragging: boolean) => void;
    dropHandler: (e: React.DragEvent<HTMLDivElement>) => void;
    onScroll: (e: React.UIEvent<HTMLTextAreaElement>) => void;
    setScrollTop: (top: number, left: number) => void;
}> = ({
    content, onContentChange, onSelectionChange, diffLines, isDragging, setIsDragging,
    dropHandler, onScroll, setScrollTop
}) => {
    const highlightsRef = useRef<HTMLDivElement>(null);
    const lineNumbersRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLTextAreaElement>(null);
    const lineCount = content.split('\n').length;
    
    // This effect is crucial for synchronizing scroll positions from the parent
    useEffect(() => {
        const handleParentScroll = (e: Event) => {
            const { top, left } = (e as CustomEvent).detail;
             if (editorRef.current) {
                if (editorRef.current.scrollTop !== top) editorRef.current.scrollTop = top;
                if (editorRef.current.scrollLeft !== left) editorRef.current.scrollLeft = left;
            }
        };

        const currentEditorRef = editorRef.current;
        currentEditorRef?.addEventListener('sync-scroll', handleParentScroll);
        return () => {
            currentEditorRef?.removeEventListener('sync-scroll', handleParentScroll);
        }
    }, []);

    const syncScrollFromEditor = (e: React.UIEvent<HTMLTextAreaElement>) => {
        const editor = e.currentTarget;
        if (highlightsRef.current) {
            highlightsRef.current.scrollTop = editor.scrollTop;
            highlightsRef.current.scrollLeft = editor.scrollLeft;
        }
        if (lineNumbersRef.current) {
            lineNumbersRef.current.scrollTop = editor.scrollTop;
        }
        onScroll(e);
    };

    const handleSelect = (e: React.UIEvent<HTMLTextAreaElement>) => {
        const textarea = e.currentTarget;
        const { selectionStart, selectionEnd } = textarea;
        if (selectionStart === selectionEnd) {
            onSelectionChange(null);
            return;
        }

        const textUpToStart = content.substring(0, selectionStart);
        const textUpToEnd = content.substring(0, selectionEnd);
        const startLine = textUpToStart.split('\n').length - 1;
        const endLine = textUpToEnd.split('\n').length - 1;
        onSelectionChange({ start: startLine, end: endLine });
    };

    const getLineClasses = (type: DiffViewLine['type']) => {
        switch (type) {
            case 'added': return 'bg-green-800/40';
            case 'removed': return 'bg-red-800/40';
            default: return '';
        }
    };
    
    const placeholder = 'Drag & drop a file, or paste your database content here...';
    const showPlaceholder = content.length === 0;

    return (
        <div 
            className={`w-full h-full bg-gray-900 border rounded-md shadow-sm font-mono text-sm flex overflow-hidden ${isDragging ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-700'}`}
            onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={dropHandler}
        >
            <div ref={lineNumbersRef} className="line-numbers w-12 text-right pr-4 text-gray-500 bg-gray-900 select-none overflow-y-hidden pt-2 leading-5">
                {Array.from({ length: Math.max(lineCount,1) }, (_, i) => (
                    <div key={i} className="h-5">{i + 1}</div>
                ))}
            </div>
            <div className="editor-content-wrapper flex-1 relative">
                {showPlaceholder && (
                    <div className="absolute top-2 left-2 text-gray-500 pointer-events-none z-10">
                        {placeholder}
                    </div>
                )}
                <div ref={highlightsRef} className="highlights absolute inset-0 overflow-hidden pointer-events-none p-2 whitespace-pre leading-5">
                    {diffLines.map((item, index) => (
                        <div key={index} className={`h-5 ${getLineClasses(item.type)}`}>
                            {/* Use a non-breaking space to ensure the div has height even for empty lines */}
                            {item.line || '\u00A0'}
                        </div>
                    ))}
                    {/* Add a filler div to ensure scrolling is consistent with textarea */}
                    <div className="h-5"></div>
                </div>
                <textarea
                    ref={editorRef}
                    value={content}
                    onChange={(e) => onContentChange(e.target.value)}
                    onScroll={syncScrollFromEditor}
                    onSelect={handleSelect}
                    spellCheck="false"
                    className="editor-textarea absolute inset-0 w-full h-full p-2 bg-transparent text-transparent caret-white resize-none border-none outline-none overflow-auto whitespace-pre font-mono text-sm leading-5"
                />
            </div>
        </div>
    );
};

// --- Main Comparator Page Component ---
const ComparatorPage: React.FC = () => {
    const [fileAContent, setFileAContent] = useState<string>(() => getInitialState('comparator_fileAContent', ''));
    const [fileBContent, setFileBContent] = useState<string>(() => getInitialState('comparator_fileBContent', ''));
    const [fileAName, setFileAName] = useState<string>(() => getInitialState('comparator_fileAName', 'file_a.txt'));
    const [fileBName, setFileBName] = useState<string>(() => getInitialState('comparator_fileBName', 'file_b.txt'));
    const [diffResult, setDiffResult] = useState<LinesDiff | null>(null);

    const [isDraggingA, setIsDraggingA] = useState(false);
    const [isDraggingB, setIsDraggingB] = useState(false);
    const [realTimeComparison, setRealTimeComparison] = useState<boolean>(() => getInitialState('comparator_realTimeComparison', true));
    const [copyStatus, setCopyStatus] = useState('');
    const [selectionA, setSelectionA] = useState<SelectionRange>(null);
    const [selectionB, setSelectionB] = useState<SelectionRange>(null);

    const fileInputARef = useRef<HTMLInputElement>(null);
    const fileInputBRef = useRef<HTMLInputElement>(null);
    const scrollARef = useRef<HTMLTextAreaElement>(null);
    const scrollBRef = useRef<HTMLTextAreaElement>(null);
    const debounceTimeoutRef = useRef<number | null>(null);
    const isSyncingScroll = useRef(false);
    const diffComputer = useMemo(() => new AdvancedLinesDiffComputer(), []);

    // --- State Persistence Effects ---
    useEffect(() => { localStorage.setItem('comparator_fileAContent', JSON.stringify(fileAContent)); }, [fileAContent]);
    useEffect(() => { localStorage.setItem('comparator_fileBContent', JSON.stringify(fileBContent)); }, [fileBContent]);
    useEffect(() => { localStorage.setItem('comparator_fileAName', JSON.stringify(fileAName)); }, [fileAName]);
    useEffect(() => { localStorage.setItem('comparator_fileBName', JSON.stringify(fileBName)); }, [fileBName]);
    useEffect(() => { localStorage.setItem('comparator_realTimeComparison', JSON.stringify(realTimeComparison)); }, [realTimeComparison]);

    // --- Comparison Logic ---
    const handleCompare = useCallback(() => {
        const result = diffComputer.computeDiff(fileAContent.split('\n'), fileBContent.split('\n'), {
            ignoreTrimWhitespace: true,
            computeMoves: false,
            maxComputationTimeMs: 5000,
        });
        setDiffResult(result);
    }, [fileAContent, fileBContent, diffComputer]);

    useEffect(() => {
        if (!realTimeComparison) { setDiffResult(null); return; }
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = window.setTimeout(handleCompare, 250);
        return () => { if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current) };
    }, [fileAContent, fileBContent, realTimeComparison, handleCompare]);

    const { viewA, viewB, minimap } = useMemo(() => {
        const aLines = fileAContent.split('\n');
        const bLines = fileBContent.split('\n');
        const viewA: DiffViewLine[] = [];
        const viewB: DiffViewLine[] = [];
        const minimap: DiffLineType[] = [];

        if (!diffResult) {
            const len = Math.max(aLines.length, bLines.length);
            for (let i = 0; i < len; i++) {
                viewA.push({ type: 'common', line: aLines[i] ?? '' });
                viewB.push({ type: 'common', line: bLines[i] ?? '' });
            }
            return { viewA, viewB, minimap };
        }

        let lastOriginalLine = 1;
        let lastModifiedLine = 1;

        for (const change of diffResult.changes) {
            const originalStart = change.originalRange.startLineNumber;
            const modifiedStart = change.modifiedRange.startLineNumber;
            const unchangedLineCount = originalStart - lastOriginalLine;

            for (let i = 0; i < unchangedLineCount; i++) {
                viewA.push({ type: 'common', line: aLines[lastOriginalLine + i - 1] });
                viewB.push({ type: 'common', line: bLines[lastModifiedLine + i - 1] });
                minimap.push('common');
            }

            const oLen = change.originalRange.length;
            const mLen = change.modifiedRange.length;
            const maxLen = Math.max(oLen, mLen);

            for (let i = 0; i < maxLen; i++) {
                const oLine = i < oLen ? aLines[originalStart + i - 1] : undefined;
                const mLine = i < mLen ? bLines[modifiedStart + i - 1] : undefined;
                if (oLine !== undefined) {
                    viewA.push({ type: 'removed', line: oLine });
                    minimap.push('removed');
                } else { viewA.push({ type: 'empty', line: '' }); }
                if (mLine !== undefined) {
                    viewB.push({ type: 'added', line: mLine });
                    if (oLine === undefined) minimap.push('added');
                } else { viewB.push({ type: 'empty', line: '' }); }
            }
            lastOriginalLine = change.originalRange.endLineNumberExclusive;
            lastModifiedLine = change.modifiedRange.endLineNumberExclusive;
        }

        while (lastOriginalLine <= aLines.length) {
            viewA.push({ type: 'common', line: aLines[lastOriginalLine - 1] });
            viewB.push({ type: 'common', line: bLines[lastModifiedLine - 1] });
            minimap.push('common');
            lastOriginalLine++;
            lastModifiedLine++;
        }
        return { viewA, viewB, minimap };
    }, [diffResult, fileAContent, fileBContent]);

    // --- File Handling ---
    const readFile = (file: File, contentSetter: (content: string) => void, nameSetter: (name: string) => void) => { const reader = new FileReader(); reader.onload = (event) => { contentSetter(event.target?.result as string); nameSetter(file.name); }; reader.readAsText(file); };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setContent: (c: string) => void, setName: (n: string) => void) => { if (e.target.files?.[0]) readFile(e.target.files[0], setContent, setName); e.target.value = ''; };
    const handleDrop = (e: React.DragEvent<HTMLDivElement>, setContent: (c: string) => void, setName: (n: string) => void) => { e.preventDefault(); setIsDraggingA(false); setIsDraggingB(false); if (e.dataTransfer.files?.[0]) readFile(e.dataTransfer.files[0], setContent, setName); };

    // --- UI Actions ---
    const setScroll = useCallback((ref: React.RefObject<HTMLTextAreaElement>, top: number, left: number) => {
        if (!ref.current) return;
        const event = new CustomEvent('sync-scroll', { detail: { top, left } });
        ref.current.dispatchEvent(event);
    }, []);
    
    const onScroll = (syncer: 'A' | 'B', e: React.UIEvent<HTMLTextAreaElement>) => {
        if (isSyncingScroll.current) return;
        isSyncingScroll.current = true;
        const targetRef = syncer === 'A' ? scrollBRef : scrollARef;
        setScroll(targetRef, e.currentTarget.scrollTop, e.currentTarget.scrollLeft);
        requestAnimationFrame(() => { isSyncingScroll.current = false; });
    };

    const handleApplyChanges = useCallback((source: 'A' | 'B', mode: 'add' | 'overwrite') => {
        if (!diffResult) return;
        const sourceIsA = source === 'A';
        const sourceContent = sourceIsA ? fileAContent : fileBContent;
        const targetContent = sourceIsA ? fileBContent : fileAContent;
        const setTargetContent = sourceIsA ? setFileBContent : setFileAContent;
        const sourceSelection = sourceIsA ? selectionA : selectionB;
        const sourceLines = sourceContent.split('\n');

        if (mode === 'add') {
            const linesToAdd = new Set<string>();
            const changes = diffResult.changes.filter(c => {
                const isDeletionFromSource = sourceIsA ? !c.originalRange.isEmpty && c.modifiedRange.isEmpty : c.originalRange.isEmpty && !c.modifiedRange.isEmpty;
                if (!isDeletionFromSource) return false;
                const sourceRange = sourceIsA ? c.originalRange : c.modifiedRange;
                return !sourceSelection || (sourceRange.startLineNumber - 1 <= sourceSelection.end && sourceRange.endLineNumberExclusive - 1 > sourceSelection.start);
            });
            changes.forEach(c => {
                const sourceRange = sourceIsA ? c.originalRange : c.modifiedRange;
                for (let i = sourceRange.startLineNumber; i < sourceRange.endLineNumberExclusive; i++) {
                    linesToAdd.add(sourceLines[i - 1]);
                }
            });
            if (linesToAdd.size > 0) {
                setTargetContent((targetContent.trim() ? targetContent + '\n' : '') + [...linesToAdd].join('\n'));
            }
        } else { // overwrite
            const linesToProcess = sourceSelection ? sourceLines.slice(sourceSelection.start, sourceSelection.end + 1) : sourceLines;
            const sourceMap = new Map<string, string>();
            linesToProcess.forEach(line => {
                const keyMatch = line.match(/^(\s*[^:]+:)/);
                if (keyMatch) sourceMap.set(keyMatch[1], line);
            });
            if (sourceMap.size === 0) return;
            const targetLines = targetContent.split('\n');
            const newTargetLines = targetLines.map(line => {
                const keyMatch = line.match(/^(\s*[^:]+:)/);
                return (keyMatch && sourceMap.has(keyMatch[1])) ? sourceMap.get(keyMatch[1])! : line;
            });
            setTargetContent(newTargetLines.join('\n'));
        }
    }, [diffResult, fileAContent, fileBContent, selectionA, selectionB]);

    const handleCopy = useCallback((content: string, panel: string) => { if (!content) return; navigator.clipboard.writeText(content).then(() => { setCopyStatus(`Copied Panel ${panel}`); setTimeout(() => setCopyStatus(''), 2000); }); }, []);

    return (
        <div className="flex flex-col h-full bg-gray-800 rounded-lg p-2 sm:p-4 shadow-2xl border border-gray-700">
            <div className="flex items-center space-x-2 mb-2 px-2">
                <h2 className="text-xl font-bold text-white">Comparator</h2>
                <Tooltip text="Compare two versions of a file side-by-side." />
            </div>

            <details className="flex-shrink-0 group bg-gray-900/40 border border-gray-700/50 rounded-lg mb-4">
                <summary className="flex cursor-pointer items-center justify-between p-3 text-sm font-medium text-gray-300 hover:text-white transition-colors">
                    <span>Compare, sync, and merge differences between two files. <span className="text-indigo-400">See more...</span></span>
                    <span className="ml-4 flex-shrink-0 transform transition-transform duration-200 group-open:rotate-180">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </span>
                </summary>
                <div className="p-3 pt-0 text-sm text-gray-400 space-y-2 border-t border-gray-700/50 mt-1">
                    <p>
                        A powerful diff tool to spot differences and merge changes. Drag and drop two files (A and B) or paste content to see side-by-side differences.
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Highlighting:</strong> Added lines are green (B), removed lines are red (A). Unchanged lines are gray.</li>
                        <li><strong>Sync Actions:</strong> Use the green arrows (<ArrowLeftIcon className="h-3 w-3 inline" /> / <ArrowRightIcon className="h-3 w-3 inline" />) to add missing lines across files. Use the orange pencil (<PencilAltIcon className="h-3 w-3 inline m-0" />) to overwrite lines with matching keys.</li>
                        <li><strong>Sub-selection:</strong> If you highlight specific text in either editor, the sync actions will only apply to the selected lines. Otherwise, it will apply to the entire file.</li>
                    </ul>
                </div>
            </details>

            <header className="flex-shrink-0 p-3 mb-2 bg-gray-800 border border-gray-700 rounded-lg shadow-md">
                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                    <div className="flex items-center"><input type="checkbox" id="realtime-comparison" checked={realTimeComparison} onChange={(e) => setRealTimeComparison(e.target.checked)} className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer" /><label htmlFor="realtime-comparison" className="ml-2 text-sm font-medium text-gray-300 cursor-pointer">Real-time</label></div>
                    {!realTimeComparison && (<button onClick={handleCompare} className="px-3 py-1 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">Compare</button>)}
                    <span className="text-sm text-indigo-400 min-h-[20px] w-32 text-center">{copyStatus}</span>
                    <Tooltip text="Add Missing Lines to A: Adds lines from B that don't exist in A. Applies to highlighted lines or whole file."><button onClick={() => handleApplyChanges('B', 'add')} className="p-2 rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors"><ArrowLeftIcon /></button></Tooltip>
                    <Tooltip text="Overwrite Lines in A: Overwrites lines in A with lines from B based on matching keys. Applies to highlighted lines or whole file."><button onClick={() => handleApplyChanges('B', 'overwrite')} className="p-2 rounded-md text-white bg-amber-600 hover:bg-amber-700 transition-colors"><PencilAltIcon className="h-5 w-5 m-0" /></button></Tooltip>
                    <Tooltip text="Overwrite Lines in B: Overwrites lines in B with lines from A based on matching keys. Applies to highlighted lines or whole file."><button onClick={() => handleApplyChanges('A', 'overwrite')} className="p-2 rounded-md text-white bg-amber-600 hover:bg-amber-700 transition-colors"><PencilAltIcon className="h-5 w-5 m-0" /></button></Tooltip>
                    <Tooltip text="Add Missing Lines to B: Adds lines from A that don't exist in B. Applies to highlighted lines or whole file."><button onClick={() => handleApplyChanges('A', 'add')} className="p-2 rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors"><ArrowRightIcon /></button></Tooltip>
                </div>
            </header>

            <div className="flex-grow flex flex-col lg:grid lg:grid-cols-[1fr_auto_1fr] gap-4 min-h-0 overflow-y-auto lg:overflow-hidden">
                <div className="flex flex-col min-h-0 flex-1 lg:flex-auto min-h-[300px] lg:min-h-0">
                    <div className="flex-shrink-0 flex justify-between items-center mb-2 px-1">
                        <h3 className="font-semibold text-gray-200 truncate">File A: <span className="text-gray-400 font-normal">{fileAName}</span></h3>
                        <div className="flex items-center gap-2">
                             <button onClick={() => fileInputARef.current?.click()} className="flex items-center px-2 py-1 border border-gray-600 text-xs font-medium rounded-md text-gray-200 bg-gray-700 hover:bg-gray-600 transition-colors"><UploadIcon className="h-4 w-4 mr-1" /> A</button>
                             <button onClick={() => handleCopy(fileAContent, 'A')} className="flex items-center px-2 py-1 border border-gray-600 text-xs font-medium rounded-md text-gray-200 bg-gray-700 hover:bg-gray-600 transition-colors"><CopyIcon /> A</button>
                             <button onClick={() => createDownload(fileAName, fileAContent)} className="flex items-center px-2 py-1 border border-gray-600 text-xs font-medium rounded-md text-gray-200 bg-gray-700 hover:bg-gray-600 transition-colors"><DownloadIcon /> A</button>
                             <input ref={fileInputARef} type="file" className="hidden" onChange={(e) => handleFileChange(e, setFileAContent, setFileAName)} />
                        </div>
                    </div>
                    <EditorPanel content={fileAContent} onContentChange={setFileAContent} onSelectionChange={setSelectionA} diffLines={viewA} isDragging={isDraggingA} setIsDragging={setIsDraggingA} dropHandler={(e) => handleDrop(e, setFileAContent, setFileAName)} onScroll={(e) => onScroll('A', e)} setScrollTop={(top, left) => setScroll(scrollARef, top, left)} />
                </div>
                <div className="hidden lg:block w-2.5 bg-gray-800 rounded-full overflow-hidden pointer-events-none self-center h-[calc(100%-20px)]">
                    <div className="h-full" style={{ transform: `scaleY(${Math.min(1, 500 / minimap.length)})`}}>
                    {minimap.map((type, i) => ( <div key={i} className={`h-0.5 ${ type === 'added' ? 'bg-green-500' : type === 'removed' ? 'bg-red-500' : 'bg-transparent' }`} /> ))}
                    </div>
                </div>
                <div className="flex flex-col min-h-0 flex-1 lg:flex-auto min-h-[300px] lg:min-h-0 pb-4 lg:pb-0">
                     <div className="flex-shrink-0 flex justify-between items-center mb-2 px-1">
                        <h3 className="font-semibold text-gray-200 truncate">File B: <span className="text-gray-400 font-normal">{fileBName}</span></h3>
                        <div className="flex items-center gap-2">
                             <button onClick={() => fileInputBRef.current?.click()} className="flex items-center px-2 py-1 border border-gray-600 text-xs font-medium rounded-md text-gray-200 bg-gray-700 hover:bg-gray-600 transition-colors"><UploadIcon className="h-4 w-4 mr-1" /> B</button>
                             <button onClick={() => handleCopy(fileBContent, 'B')} className="flex items-center px-2 py-1 border border-gray-600 text-xs font-medium rounded-md text-gray-200 bg-gray-700 hover:bg-gray-600 transition-colors"><CopyIcon /> B</button>
                             <button onClick={() => createDownload(fileBName, fileBContent)} className="flex items-center px-2 py-1 border border-gray-600 text-xs font-medium rounded-md text-gray-200 bg-gray-700 hover:bg-gray-600 transition-colors"><DownloadIcon /> B</button>
                             <input ref={fileInputBRef} type="file" className="hidden" onChange={(e) => handleFileChange(e, setFileBContent, setFileBName)} />
                        </div>
                    </div>
                    <EditorPanel content={fileBContent} onContentChange={setFileBContent} onSelectionChange={setSelectionB} diffLines={viewB} isDragging={isDraggingB} setIsDragging={setIsDraggingB} dropHandler={(e) => handleDrop(e, setFileBContent, setFileBName)} onScroll={(e) => onScroll('B', e)} setScrollTop={(top, left) => setScroll(scrollBRef, top, left)} />
                </div>
            </div>
        </div>
    );
};

export default ComparatorPage;
