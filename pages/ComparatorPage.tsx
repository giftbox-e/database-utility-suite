import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { safeSetLocalStorage } from '../lib/storage';
import { AdvancedLinesDiffComputer, LinesDiff } from 'vscode-diff';
import { UploadIcon, DownloadIcon, CopyIcon, PencilAltIcon, ArrowRightIcon, ArrowLeftIcon } from '../components/Icons';
import { Tooltip } from '../components/Tooltip';
import { ExpandableDescription } from '../components/ExpandableDescription';
import { useSyncedResize } from '../hooks/useSyncedResize';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { EditorView } from '@codemirror/view';
import { ResizablePanel } from '../components/ResizablePanel';

type DiffLineType = 'common' | 'added' | 'removed';
type DiffViewLine = { type: DiffLineType | 'empty'; line: string };
type SelectionRange = { start: number; end: number } | null;

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

const EditorPanel: React.FC<{
    containerRef?: React.RefObject<HTMLDivElement>;
    content: string;
    onContentChange: (newContent: string) => void;
    onSelectionChange: (range: SelectionRange) => void;
    diffLines: DiffViewLine[];
    isDragging: boolean;
    setIsDragging: (isDragging: boolean) => void;
    dropHandler: (e: React.DragEvent<HTMLDivElement>) => void;
    onScroll: (scrollTop: number, scrollLeft: number) => void;
    setScrollTop: (top: number, left: number) => void;
    autoExtend: boolean;
    isManuallyResized: boolean;
}> = ({
    containerRef, content, onContentChange, onSelectionChange, diffLines, isDragging, setIsDragging,
    dropHandler, onScroll, setScrollTop, autoExtend, isManuallyResized
}) => {
        const highlightsRef = useRef<HTMLDivElement>(null);
        const lineNumbersRef = useRef<HTMLDivElement>(null);
        const editorWrapperRef = useRef<HTMLDivElement>(null);
        const lineCount = content.split('\n').length;
        const internalScrollRef = useRef(false);

        // Sync external scroll coming from the parent (the other editor)
        useEffect(() => {
            const handleParentScroll = (e: Event) => {
                const { top, left } = (e as CustomEvent).detail;
                if (editorWrapperRef.current) {
                    const scroller = editorWrapperRef.current.querySelector('.cm-scroller');
                    if (scroller) {
                        internalScrollRef.current = true;
                        if (scroller.scrollTop !== top) scroller.scrollTop = top;
                        if (scroller.scrollLeft !== left) scroller.scrollLeft = left;

                        if (highlightsRef.current) {
                            highlightsRef.current.scrollTop = scroller.scrollTop;
                            highlightsRef.current.scrollLeft = scroller.scrollLeft;
                        }
                        if (lineNumbersRef.current) {
                            lineNumbersRef.current.scrollTop = scroller.scrollTop;
                        }
                    }
                }
            };

            const currentRef = containerRef?.current || editorWrapperRef.current;
            currentRef?.addEventListener('sync-scroll', handleParentScroll as EventListener);
            return () => {
                currentRef?.removeEventListener('sync-scroll', handleParentScroll as EventListener);
            }
        }, []);

        const getLineClasses = (type: DiffViewLine['type']) => {
            switch (type) {
                case 'added': return 'bg-green-800/40';
                case 'removed': return 'bg-red-800/40';
                default: return '';
            }
        };

        return (
            <ResizablePanel
                ref={containerRef as any}
                autoExtend={autoExtend}
                isManuallyResized={isManuallyResized}
                className={`w-full border rounded-md shadow-sm font-mono text-sm flex ${isDragging ? 'border-indigo-500 ring-2 ring-indigo-500' : 'border-gray-700'} bg-transparent`}
                onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={dropHandler}
            >
                <div className="editor-content-wrapper flex-1 relative flex flex-col min-w-0 bg-[#101828]" ref={editorWrapperRef}>
                    <div ref={highlightsRef} className="highlights absolute inset-0 overflow-hidden pointer-events-none whitespace-pre leading-[22px] tracking-normal font-mono z-30 w-full min-w-max text-transparent" style={{ paddingTop: "4px" }}>
                        {diffLines.map((item, index) => (
                            <div key={index} className={`h-[22px] px-1 ${getLineClasses(item.type)}`}>
                                {item.line || '\u00A0'}
                            </div>
                        ))}
                        <div className="h-[22px]"></div>
                    </div>

                    <CodeMirror
                        theme="dark"
                        value={content}
                        onChange={(val) => onContentChange(val)}
                        height={autoExtend ? "auto" : undefined}
                        extensions={[
                            yaml(),
                            EditorView.theme({
                                "&": { backgroundColor: "transparent !important", color: "#e2e8f0 !important", display: "flex", flexDirection: "column", height: "100%" },
                                ".cm-content": { paddingTop: "4px", paddingBottom: "4px", color: "#e2e8f0 !important", minHeight: "100%", backgroundColor: "transparent !important" },
                                ".cm-scroller": { overflow: "auto", fontFamily: "inherit", fontSize: "14px", lineHeight: "22px", backgroundColor: "transparent !important", height: "100%" },
                                ".cm-line": { caretColor: "#528bff", padding: "0 4px", backgroundColor: "transparent !important" },
                                ".cm-cursor": { borderLeftColor: "#528bff", borderWidth: "2px" },
                                ".cm-selectionBackground, .cm-content ::selection": { backgroundColor: "#3e4451 !important" },
                                ".cm-gutters": { backgroundColor: "#101828 !important", color: "#64748b !important", borderRight: "1px solid #374151 !important", zIndex: "40" },
                                ".cm-activeLine": { backgroundColor: "transparent !important" },
                                ".cm-activeLineGutter": { backgroundColor: "rgba(255, 255, 255, 0.05) !important" },
                                "&.cm-editor.cm-focused": { outline: "none" }
                            }, { dark: true }),
                            EditorView.domEventHandlers({
                                scroll: (e, view) => {
                                    const scroller = e.target as HTMLElement;
                                    if (highlightsRef.current) {
                                        highlightsRef.current.scrollTop = scroller.scrollTop;
                                        highlightsRef.current.scrollLeft = scroller.scrollLeft;
                                    }
                                    if (lineNumbersRef.current) {
                                        lineNumbersRef.current.scrollTop = scroller.scrollTop;
                                    }
                                    if (internalScrollRef.current) {
                                        internalScrollRef.current = false;
                                        return;
                                    }
                                    onScroll(scroller.scrollTop, scroller.scrollLeft);
                                }
                            }),
                            EditorView.updateListener.of((update) => {
                                if (update.selectionSet && !update.focusChanged && !update.docChanged) {
                                    const range = update.state.selection.main;
                                    if (range.empty) {
                                        onSelectionChange(null);
                                    } else {
                                        const start = update.state.doc.lineAt(range.from).number - 1;
                                        const end = update.state.doc.lineAt(range.to).number - 1;
                                        onSelectionChange({ start, end });
                                    }
                                }
                            })
                        ]}
                        basicSetup={{
                            lineNumbers: true,
                            foldGutter: true,
                            highlightActiveLine: true,
                            highlightActiveLineGutter: true,
                            dropCursor: true,
                            allowMultipleSelections: true,
                            indentOnInput: true,
                            bracketMatching: true,
                        }}
                        className={`z-20 w-full text-sm font-mono overflow-hidden flex flex-col ${autoExtend ? 'flex-grow min-h-0 relative' : 'absolute inset-0 h-full w-full'}`}
                    />
                </div>
            </ResizablePanel>
        );
    };

const ComparatorPage: React.FC = () => {
    const { leftRef, rightRef, isManuallyResized } = useSyncedResize();
    const [fileAContent, setFileAContent] = useState<string>(() => getInitialState('comparator_fileAContent', ''));
    const [fileBContent, setFileBContent] = useState<string>(() => getInitialState('comparator_fileBContent', ''));
    const [fileAName, setFileAName] = useState<string>(() => getInitialState('comparator_fileAName', 'file_a.txt'));
    const [fileBName, setFileBName] = useState<string>(() => getInitialState('comparator_fileBName', 'file_b.txt'));
    const [diffResult, setDiffResult] = useState<LinesDiff | null>(null);

    const [isDraggingA, setIsDraggingA] = useState(false);
    const [isDraggingB, setIsDraggingB] = useState(false);
    const [autoExtendData, setAutoExtendData] = useState<boolean>(() => getInitialState('comparator_autoExtendData', false));
    const [realTimeComparison, setRealTimeComparison] = useState<boolean>(() => getInitialState('comparator_realTimeComparison', true));
    const [copyStatus, setCopyStatus] = useState('');
    const [selectionA, setSelectionA] = useState<SelectionRange>(null);
    const [selectionB, setSelectionB] = useState<SelectionRange>(null);

    const fileInputARef = useRef<HTMLInputElement>(null);
    const fileInputBRef = useRef<HTMLInputElement>(null);
    const scrollARef = leftRef as React.RefObject<HTMLDivElement>;
    const scrollBRef = rightRef as React.RefObject<HTMLDivElement>;
    const debounceTimeoutRef = useRef<number | null>(null);
    const isSyncingScroll = useRef(false);
    const diffComputer = useMemo(() => new AdvancedLinesDiffComputer(), []);

    useEffect(() => { safeSetLocalStorage('comparator_fileAContent', fileAContent); }, [fileAContent]);
    useEffect(() => { safeSetLocalStorage('comparator_fileBContent', fileBContent); }, [fileBContent]);
    useEffect(() => { safeSetLocalStorage('comparator_fileAName', fileAName); }, [fileAName]);
    useEffect(() => { safeSetLocalStorage('comparator_fileBName', fileBName); }, [fileBName]);
    useEffect(() => { safeSetLocalStorage('comparator_realTimeComparison', realTimeComparison); }, [realTimeComparison]);
    useEffect(() => { safeSetLocalStorage('comparator_autoExtendData', autoExtendData); }, [autoExtendData]);

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
        const viewA: DiffViewLine[] = aLines.map(line => ({ type: 'common', line }));
        const viewB: DiffViewLine[] = bLines.map(line => ({ type: 'common', line }));
        const minimap: DiffLineType[] = [];

        if (!diffResult) {
            return { viewA, viewB, minimap };
        }

        for (const change of diffResult.changes) {
            if (!change.originalRange.isEmpty) {
                for (let i = change.originalRange.startLineNumber; i < change.originalRange.endLineNumberExclusive; i++) {
                    if (viewA[i - 1]) viewA[i - 1].type = 'removed';
                }
            }
            if (!change.modifiedRange.isEmpty) {
                for (let i = change.modifiedRange.startLineNumber; i < change.modifiedRange.endLineNumberExclusive; i++) {
                    if (viewB[i - 1]) viewB[i - 1].type = 'added';
                }
            }
        }

        const maxLen = Math.max(viewA.length, viewB.length);
        for (let i = 0; i < maxLen; i++) {
            const aType = i < viewA.length ? viewA[i].type : 'common';
            const bType = i < viewB.length ? viewB[i].type : 'common';
            if (aType === 'removed') minimap.push('removed');
            else if (bType === 'added') minimap.push('added');
            else minimap.push('common');
        }

        return { viewA, viewB, minimap };
    }, [diffResult, fileAContent, fileBContent]);

    const readFile = (file: File, contentSetter: (content: string) => void, nameSetter: (name: string) => void) => { const reader = new FileReader(); reader.onload = (event) => { contentSetter(event.target?.result as string); nameSetter(file.name); }; reader.readAsText(file); };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setContent: (c: string) => void, setName: (n: string) => void) => { if (e.target.files?.[0]) readFile(e.target.files[0], setContent, setName); e.target.value = ''; };
    const handleDrop = (e: React.DragEvent<HTMLDivElement>, setContent: (c: string) => void, setName: (n: string) => void) => { e.preventDefault(); setIsDraggingA(false); setIsDraggingB(false); if (e.dataTransfer.files?.[0]) readFile(e.dataTransfer.files[0], setContent, setName); };

    const setScroll = useCallback((ref: React.RefObject<HTMLDivElement>, top: number, left: number) => {
        if (!ref.current) return;
        const event = new CustomEvent('sync-scroll', { detail: { top, left } });
        ref.current.dispatchEvent(event);
    }, []);

    const onScroll = (syncer: 'A' | 'B', top: number, left: number) => {
        if (isSyncingScroll.current) return;
        isSyncingScroll.current = true;
        const targetRef = syncer === 'A' ? scrollBRef : scrollARef;
        setScroll(targetRef, top, left);
        requestAnimationFrame(() => { isSyncingScroll.current = false; });
    };

    const handleApplyChanges = useCallback((source: 'A' | 'B', action: 'add' | 'overwrite') => {
        if (!diffResult) return;
        const sourceIsA = source === 'A';
        const sourceContent = sourceIsA ? fileAContent : fileBContent;
        const targetContent = sourceIsA ? fileBContent : fileAContent;
        const setTargetContent = sourceIsA ? setFileBContent : setFileAContent;

        const sourceSelection = sourceIsA ? selectionA : selectionB;
        const targetSelection = sourceIsA ? selectionB : selectionA;

        const targetLines = targetContent.split('\n');
        const sourceLines = sourceContent.split('\n');

        if (action === 'overwrite') {
            const sourceMap = new Map<string, string>();
            const sStart = sourceSelection ? sourceSelection.start : 0;
            const sEnd = sourceSelection ? sourceSelection.end : sourceLines.length - 1;

            for (let i = sStart; i <= sEnd; i++) {
                const line = sourceLines[i];
                if (line) {
                    const keyMatch = line.match(/^(\s*[^:]+:)/);
                    if (keyMatch) sourceMap.set(keyMatch[1], line);
                }
            }
            if (sourceMap.size === 0) return;

            let changed = false;
            const tStart = targetSelection ? targetSelection.start : 0;
            const tEnd = targetSelection ? targetSelection.end : targetLines.length - 1;

            for (let i = tStart; i <= tEnd; i++) {
                const line = targetLines[i];
                if (line) {
                    const keyMatch = line.match(/^(\s*[^:]+:)/);
                    if (keyMatch && sourceMap.has(keyMatch[1])) {
                        targetLines[i] = sourceMap.get(keyMatch[1])!;
                        changed = true;
                    }
                }
            }
            if (changed) setTargetContent(targetLines.join('\n'));
        } else if (action === 'add') {
            const changesToApply = diffResult.changes.filter(c => {
                const sRange = sourceIsA ? c.originalRange : c.modifiedRange;
                const tRange = sourceIsA ? c.modifiedRange : c.originalRange;

                if (!tRange.isEmpty) return false;

                const insertionPoint = tRange.startLineNumber - 1;
                if (sourceSelection) {
                    const srcStart = sRange.startLineNumber - 1;
                    const srcEnd = sRange.endLineNumberExclusive - 2;
                    if (srcEnd < sourceSelection.start || srcStart > sourceSelection.end) {
                        return false;
                    }
                }
                if (targetSelection) {
                    if (insertionPoint < targetSelection.start || insertionPoint > targetSelection.end + 1) {
                        return false;
                    }
                }
                return true;
            });

            if (changesToApply.length === 0) return;

            [...changesToApply].reverse().forEach(c => {
                const sRange = sourceIsA ? c.originalRange : c.modifiedRange;
                const tRange = sourceIsA ? c.modifiedRange : c.originalRange;
                const replacementLines = sourceLines.slice(sRange.startLineNumber - 1, sRange.endLineNumberExclusive - 1);
                targetLines.splice(tRange.startLineNumber - 1, 0, ...replacementLines);
            });
            setTargetContent(targetLines.join('\n'));
        }
    }, [diffResult, fileAContent, fileBContent, selectionA, selectionB]);

    const handleCopy = useCallback((content: string, panel: string) => { if (!content) return; navigator.clipboard.writeText(content).then(() => { setCopyStatus(`Copied Panel ${panel}`); setTimeout(() => setCopyStatus(''), 2000); }); }, []);

    return (
        <div className="w-full flex flex-col bg-gray-800 rounded-lg p-2 sm:p-4 shadow-2xl border border-gray-700 flex-grow min-h-0">
            <div className="flex items-center space-x-2 mb-2 px-2">
                <h2 className="text-xl font-bold text-white">Comparator (Inoperable)</h2>
                <Tooltip text={`Compare two versions of a file side-by-side.
Provides visual highlighting for added, removed, and modified lines with a unified diff feel.`} />

                <div className="ml-auto flex items-center">
                </div>
            </div>

            <ExpandableDescription title={<>Compare, sync, and merge differences between two files.</>}>
                <p>
                    A powerful diff tool to spot differences and merge changes. Drag and drop two files (A and B) or paste content to see side-by-side differences.
                </p>
                <p className="mt-2 text-indigo-300 font-medium">
                    <span className="font-bold underline">Important:</span> Only lines deleted (red) or added (green) can be synchronized.
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li><strong>Highlighting:</strong> Added lines are green (B), removed lines are red (A). Unchanged lines are gray.</li>
                    <li><strong>Sync Actions:</strong> Use the green arrows (<ArrowLeftIcon className="h-3 w-3 inline" /> / <ArrowRightIcon className="h-3 w-3 inline" />) to add missing lines across files. Use the orange pencil (<PencilAltIcon className="h-3 w-3 inline m-0" />) to overwrite lines with matching keys.</li>
                    <li><strong>Sub-selection:</strong> If you highlight specific text in either editor, the sync actions will only apply to the selected lines. Otherwise, it will apply to the entire file.</li>
                </ul>
            </ExpandableDescription>

            <header className="flex-shrink-0 p-3 mb-4 bg-gray-800 border border-gray-700 rounded-lg shadow-md">
                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                    <div className="flex items-center"><input type="checkbox" id="realtime-comparison" checked={realTimeComparison} onChange={(e) => setRealTimeComparison(e.target.checked)} className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer" /><label htmlFor="realtime-comparison" className="ml-2 text-sm font-medium text-gray-300 cursor-pointer">Real-time</label></div>
                    {!realTimeComparison && (<button onClick={handleCompare} className="px-3 py-1 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">Compare</button>)}
                    <span className="text-sm text-indigo-400 min-h-[20px] w-24 text-center truncate">{copyStatus}</span>
                    <div className="flex items-center gap-2 border-l border-gray-600 pl-3">
                        <Tooltip text="Add Missing Lines to A: Adds lines from B that don't exist in A. Applies to highlighted lines or whole file."><button onClick={() => handleApplyChanges('B', 'add')} className="p-2 rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors"><ArrowLeftIcon /></button></Tooltip>
                        <Tooltip text="Overwrite Lines in A: Overwrites lines in A with lines from B based on matching keys. Applies to highlighted lines or whole file."><button onClick={() => handleApplyChanges('B', 'overwrite')} className="p-2 rounded-md text-white bg-amber-600 hover:bg-amber-700 transition-colors"><PencilAltIcon className="h-5 w-5 m-0" /></button></Tooltip>
                        <Tooltip text="Overwrite Lines in B: Overwrites lines in B with lines from A based on matching keys. Applies to highlighted lines or whole file."><button onClick={() => handleApplyChanges('A', 'overwrite')} className="p-2 rounded-md text-white bg-amber-600 hover:bg-amber-700 transition-colors"><PencilAltIcon className="h-5 w-5 m-0" /></button></Tooltip>
                        <Tooltip text="Add Missing Lines to B: Adds lines from A that don't exist in B. Applies to highlighted lines or whole file."><button onClick={() => handleApplyChanges('A', 'add')} className="p-2 rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors"><ArrowRightIcon /></button></Tooltip>
                    </div>
                </div>
            </header>

            <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[1fr_auto_1fr] gap-4 pb-4 min-w-0">
                <div className="flex flex-col relative lg:min-h-0 min-w-0">
                    <div className="flex-shrink-0 flex justify-between items-center mb-2 px-1">
                        <h3 className="font-semibold text-gray-200 truncate">File A: <span className="text-gray-400 font-normal">{fileAName}</span></h3>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center space-x-2 text-sm text-gray-400 cursor-pointer hover:text-gray-200 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={autoExtendData}
                                    onChange={(e) => setAutoExtendData(e.target.checked)}
                                    className="h-3.5 w-3.5 rounded bg-[#101828] border-gray-600 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                                />
                                <span>Auto-Extend</span>
                            </label>
                            <div className="flex items-center gap-2">
                                <button onClick={() => fileInputARef.current?.click()} className="flex items-center px-2 py-1 border border-gray-600 text-xs font-medium rounded-md text-gray-200 bg-[#1e293b] hover:bg-[#334155] transition-colors"><UploadIcon className="h-4 w-4 mr-1" /> A</button>
                                <button onClick={() => handleCopy(fileAContent, 'A')} className="flex items-center px-2 py-1 border border-gray-600 text-xs font-medium rounded-md text-gray-200 bg-gray-800 hover:bg-gray-700 transition-colors"><CopyIcon /> A</button>
                                <button onClick={() => createDownload(fileAName, fileAContent)} className="flex items-center px-2 py-1 border border-gray-600 text-xs font-medium rounded-md text-gray-200 bg-gray-800 hover:bg-gray-700 transition-colors"><DownloadIcon /> A</button>
                                <input ref={fileInputARef} type="file" className="hidden" onChange={(e) => handleFileChange(e, setFileAContent, setFileAName)} />
                            </div>
                        </div>
                    </div>
                    <EditorPanel containerRef={scrollARef} content={fileAContent} onContentChange={setFileAContent} onSelectionChange={setSelectionA} diffLines={viewA} isDragging={isDraggingA} setIsDragging={setIsDraggingA} dropHandler={(e) => handleDrop(e, setFileAContent, setFileAName)} onScroll={(top, left) => onScroll('A', top, left)} setScrollTop={(top, left) => setScroll(scrollARef, top, left)} autoExtend={autoExtendData} isManuallyResized={isManuallyResized} />
                </div>

                <div className="hidden lg:block w-3 bg-gray-800 rounded-full overflow-hidden pointer-events-none self-center h-[calc(100%-20px)] border border-gray-700">
                    <div className="h-full w-full" style={{ transform: `scaleY(${Math.min(1, 500 / Math.max(1, minimap.length))})`, transformOrigin: 'top' }}>
                        {minimap.map((type, i) => (<div key={i} className={`w-full h-0.5 ${type === 'added' ? 'bg-green-500 opacity-80' : type === 'removed' ? 'bg-red-500 opacity-80' : 'bg-transparent'}`} />))}
                    </div>
                </div>

                <div className="flex flex-col relative lg:min-h-0 min-w-0">
                    <div className="flex-shrink-0 flex justify-between items-center mb-2 px-1">
                        <h3 className="font-semibold text-gray-200 truncate">File B: <span className="text-gray-400 font-normal">{fileBName}</span></h3>
                        <div className="flex items-center gap-2">
                            <button onClick={() => fileInputBRef.current?.click()} className="flex items-center px-2 py-1 border border-gray-600 text-xs font-medium rounded-md text-gray-200 bg-[#1e293b] hover:bg-[#334155] transition-colors"><UploadIcon className="h-4 w-4 mr-1" /> B</button>
                            <button onClick={() => handleCopy(fileBContent, 'B')} className="flex items-center px-2 py-1 border border-gray-600 text-xs font-medium rounded-md text-gray-200 bg-gray-800 hover:bg-gray-700 transition-colors"><CopyIcon /> B</button>
                            <button onClick={() => createDownload(fileBName, fileBContent)} className="flex items-center px-2 py-1 border border-gray-600 text-xs font-medium rounded-md text-gray-200 bg-gray-800 hover:bg-gray-700 transition-colors"><DownloadIcon /> B</button>
                            <input ref={fileInputBRef} type="file" className="hidden" onChange={(e) => handleFileChange(e, setFileBContent, setFileBName)} />
                        </div>
                    </div>
                    <EditorPanel containerRef={scrollBRef} content={fileBContent} onContentChange={setFileBContent} onSelectionChange={setSelectionB} diffLines={viewB} isDragging={isDraggingB} setIsDragging={setIsDraggingB} dropHandler={(e) => handleDrop(e, setFileBContent, setFileBName)} onScroll={(top, left) => onScroll('B', top, left)} setScrollTop={(top, left) => setScroll(scrollBRef, top, left)} autoExtend={autoExtendData} isManuallyResized={isManuallyResized} />
                </div>
            </div>
        </div>
    );
};

export default ComparatorPage;
