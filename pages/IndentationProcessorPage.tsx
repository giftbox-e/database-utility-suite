import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { safeSetLocalStorage } from '../lib/storage';
import { blockRemoverWorkerScript } from '../workers/blockRemoverScript';
import { CopyIcon, DownloadIcon, UploadIcon, LoadingSpinner, BlockRemoveIcon } from '../components/Icons';
import { Tooltip } from '../components/Tooltip';
import { ExpandableDescription } from '../components/ExpandableDescription';
import { useSyncedResize } from '../hooks/useSyncedResize';
import { CodeEditor } from '../components/CodeEditor';

type Mode = 'remove' | 'maintain' | 'addText';
type MatchMode = 'contains' | 'exact';
type IndentationFilterMode = 'none' | 'gt' | 'lt' | 'eq_remove' | 'eq_maintain';

// Helper to get state from localStorage or return a default value
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

const BlockRemoverPage: React.FC = () => {
    const [inputText, setInputText] = useState<string>(() => getInitialState('blockRemover_inputText', ''));
    const [inputFileName, setInputFileName] = useState<string>(() => getInitialState('blockRemover_inputFileName', 'processed_blocks.txt'));
    const [keywordsText, setKeywordsText] = useState<string>(() => getInitialState('blockRemover_keywordsText', ''));
    const [blockStartIdentifier, setBlockStartIdentifier] = useState<string>(() => getInitialState('blockRemover_blockStartIdentifier', ''));
    const [includeIdentifierString, setIncludeIdentifierString] = useState<boolean>(() => getInitialState('blockRemover_includeIdentifierString', false));
    const [replaceWithText, setReplaceWithText] = useState<string>(() => getInitialState('blockRemover_replaceWithText', ''));
    const [outputText, setOutputText] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [copyStatus, setCopyStatus] = useState<string>('Copy Output');
    const [mode, setMode] = useState<Mode>(() => getInitialState('blockRemover_mode', 'remove'));
    const [matchMode, setMatchMode] = useState<MatchMode>(() => getInitialState('blockRemover_matchMode', 'contains'));
    const fileInputRef = useRef<HTMLInputElement>(null);
    const keywordsFileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    
    const { leftRef, rightRef, isManuallyResized } = useSyncedResize();

    const [indentationFilterMode, setIndentationFilterMode] = useState<IndentationFilterMode>(() => getInitialState('blockRemover_indentationFilterMode', 'none'));
    const [indentationFilterValue, setIndentationFilterValue] = useState<string>(() => getInitialState('blockRemover_indentationFilterValue', '4'));
    
    const [textToAdd, setTextToAdd] = useState<string>(() => getInitialState('blockRemover_textToAdd', ''));
    const [addPosition, setAddPosition] = useState<'start' | 'end'>(() => getInitialState('blockRemover_addPosition', 'start'));
    const [addPositionOffset, setAddPositionOffset] = useState<number>(() => getInitialState('blockRemover_addPositionOffset', 0));
    const [invertAddTextCondition, setInvertAddTextCondition] = useState<boolean>(() => getInitialState('blockRemover_invertAddTextCondition', false));

    const [autoExtendConfig, setAutoExtendConfig] = useState<boolean>(() => getInitialState('blockRemover_autoExtendConfig', false));
    const [autoExtendData, setAutoExtendData] = useState<boolean>(() => getInitialState('blockRemover_autoExtendData', false));

    // --- State Persistence Effects ---
    useEffect(() => { safeSetLocalStorage('blockRemover_inputText', inputText); }, [inputText]);
    useEffect(() => { safeSetLocalStorage('blockRemover_inputFileName', inputFileName); }, [inputFileName]);
    useEffect(() => { safeSetLocalStorage('blockRemover_keywordsText', keywordsText); }, [keywordsText]);
    useEffect(() => { safeSetLocalStorage('blockRemover_blockStartIdentifier', blockStartIdentifier); }, [blockStartIdentifier]);
    useEffect(() => { safeSetLocalStorage('blockRemover_includeIdentifierString', includeIdentifierString); }, [includeIdentifierString]);
    useEffect(() => { safeSetLocalStorage('blockRemover_replaceWithText', replaceWithText); }, [replaceWithText]);
    useEffect(() => { safeSetLocalStorage('blockRemover_mode', mode); }, [mode]);
    useEffect(() => { safeSetLocalStorage('blockRemover_matchMode', matchMode); }, [matchMode]);
    useEffect(() => { safeSetLocalStorage('blockRemover_indentationFilterMode', indentationFilterMode); }, [indentationFilterMode]);
    useEffect(() => { safeSetLocalStorage('blockRemover_indentationFilterValue', indentationFilterValue); }, [indentationFilterValue]);
    useEffect(() => { safeSetLocalStorage('blockRemover_textToAdd', textToAdd); }, [textToAdd]);
    useEffect(() => { safeSetLocalStorage('blockRemover_addPosition', addPosition); }, [addPosition]);
    useEffect(() => { safeSetLocalStorage('blockRemover_addPositionOffset', addPositionOffset); }, [addPositionOffset]);
    useEffect(() => { safeSetLocalStorage('blockRemover_invertAddTextCondition', invertAddTextCondition); }, [invertAddTextCondition]);
    useEffect(() => { safeSetLocalStorage('blockRemover_autoExtendConfig', autoExtendConfig); }, [autoExtendConfig]);
    useEffect(() => { safeSetLocalStorage('blockRemover_autoExtendData', autoExtendData); }, [autoExtendData]);

    const getWrapperStyle = (baseHeightOrAutoExtend: string | boolean, autoExtendParam?: boolean): React.CSSProperties => {
        const autoExtend = typeof baseHeightOrAutoExtend === 'boolean' ? baseHeightOrAutoExtend : (autoExtendParam || false);
        const baseHeight = typeof baseHeightOrAutoExtend === 'string' ? baseHeightOrAutoExtend : '120px';
        if (autoExtend) return { minHeight: baseHeight, flex: '1 1 auto', position: 'relative' };
        if (isManuallyResized) return { minHeight: baseHeight, flex: 'none', resize: 'vertical', overflow: 'hidden', position: 'relative' };
        return { minHeight: baseHeight, flex: '1 1 0%', resize: 'vertical', overflow: 'hidden', position: 'relative' };
    };



    const calculatedIndentation = useMemo(() => {
        const match = blockStartIdentifier.match(/^(\s*)/);
        return match ? match[1].length : 0;
    }, [blockStartIdentifier]);

    const isIndentModeActive = indentationFilterMode !== 'none';

    const handleProcess = useCallback(() => {
        setIsProcessing(true);
        setOutputText('');

        const workerBlob = new Blob([blockRemoverWorkerScript], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(workerBlob);
        const worker = new Worker(workerUrl);

        worker.onmessage = (e) => {
            if (e.data.success) {
                setOutputText(e.data.data);
            } else {
                setOutputText(`An error occurred in the worker: ${e.data.error}`);
            }
            setIsProcessing(false);
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
        };

        worker.onerror = (e) => {
            console.error("Worker error:", e);
            setOutputText(`An error occurred during processing: ${e.message}`);
            setIsProcessing(false);
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
        };

        worker.postMessage({
            inputText,
            keywordsText,
            blockStartIdentifier,
            includeIdentifierString,
            replaceWithText,
            mode,
            matchMode,
            indentationFilterMode,
            indentationFilterValue: parseInt(indentationFilterValue, 10),
            textToAdd,
            addPosition,
            addPositionOffset,
            invertAddTextCondition,
        });
    }, [inputText, keywordsText, blockStartIdentifier, includeIdentifierString, replaceWithText, mode, matchMode, indentationFilterMode, indentationFilterValue, textToAdd, addPosition, addPositionOffset, invertAddTextCondition]);

    const handleCopy = useCallback(() => {
        if (!outputText) return;
        navigator.clipboard.writeText(outputText).then(() => {
            setCopyStatus('Copied!');
            setTimeout(() => setCopyStatus('Copy Output'), 2000);
        });
    }, [outputText]);

    const handleDownload = useCallback(() => {
        if (!outputText) return;
        const blob = new Blob([outputText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = inputFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [outputText, inputFileName]);

    const readFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            setInputText(event.target?.result as string);
            setInputFileName(file.name);
        };
        reader.readAsText(file);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) readFile(e.target.files[0]);
    };

    const isProcessButtonDisabled = useMemo(() => {
        if (isProcessing || !inputText.trim()) return true;
        
        if (isIndentModeActive) {
            return isNaN(parseInt(indentationFilterValue));
        }

        if (mode !== 'addText' && !keywordsText.trim()) {
            return true;
        }

        if (includeIdentifierString && !blockStartIdentifier.trim()) {
            return true;
        }

        if (mode === 'addText' && !textToAdd.trim()) {
            return true;
        }

        return false;
    }, [isProcessing, inputText, isIndentModeActive, indentationFilterValue, keywordsText, blockStartIdentifier, mode, textToAdd, includeIdentifierString]);

    return (
        <div className="w-full bg-gray-800 rounded-lg shadow-2xl p-4 sm:p-6 border border-gray-700 flex flex-col flex-grow min-h-0">
            <div className="flex-shrink-0 mb-6 p-3 sm:p-4 border border-gray-700 rounded-lg bg-gray-800">
                <div className="flex items-center space-x-2 mb-3">
                    <h2 className="text-xl font-bold text-white">Indentation Processor</h2>
                    <Tooltip text="Process data based strictly on its structural indentation, without parsing brackets. A 'block' is identified by a start line, and EVERYTHING under it with greater indentation is treated as ONE block UNTIL the next line with an equal or smaller indentation level." />
                    
                    <div className="ml-auto flex items-center gap-4">
                        <label className="flex items-center space-x-2 text-sm text-gray-300 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={autoExtendConfig} 
                                onChange={(e) => setAutoExtendConfig(e.target.checked)} 
                                className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span>Auto-Extend Config Boxes</span>
                        </label>
                    </div>
                </div>
                
                <ExpandableDescription title="Remove, keep, or alter entire blocks of data based on what they contain.">
                        <p>
                            Use <strong>Block Mode</strong> to handle structural chunks of related data based on indentation, or <strong>Indentation Filter</strong> to process lines purely based on indentation level.
                        </p>
                        <p className="mt-2 text-indigo-300 font-medium">
                            <span className="font-bold underline">Important:</span> The Indentation Processor strictly acknowledges indentation, not brackets or syntax parsing. Some databases do not use open/close brackets. If the block start is at an indentation level (e.g., 1), then everything with greater indentation (e.g., 2, 3, 4) will be included as ONE block, UNTIL the next line with an equal or smaller indentation level.
                        </p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li><strong>Block Start Identifier:</strong> Define what starts a block (e.g. <code>  - Id: </code>). A block contains this start line and all subsequent lines with greater indentation.</li>
                            <li><strong>Match Mode:</strong> Decide whether to keep or remove blocks based on whether they contain your Keywords.</li>
                            <li><strong>Indentation Filter Mode:</strong> (Alternative) Ignore blocks and just globally remove or keep lines that match a specific number of spaces.</li>
                        </ul>
                        <p className="pt-2 text-gray-300"><strong>Example:</strong> Remove all monster blocks if the block contains the keyword <code>Type: "Boss"</code>. Set the Block Start Identifier to something like <code>  - </code> or <code>  Monster:</code>.</p>
                </ExpandableDescription>
                
                <fieldset disabled={isIndentModeActive} className={`transition-opacity ${isIndentModeActive ? 'opacity-50' : 'opacity-100'}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div>
                            <div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                       <label htmlFor="block-start-identifier" className="text-sm font-medium text-gray-300">Block Start Identifier</label>
                                       <Tooltip text="The full line of text (including leading spaces) used to identify the beginning of a data block. The indentation of this line is critical for defining the block's scope." />
                                    </div>
                                     <div className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            id="include-string"
                                            checked={includeIdentifierString}
                                            onChange={(e) => setIncludeIdentifierString(e.target.checked)}
                                            className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                        <label htmlFor="include-string" className="text-sm text-gray-300 cursor-pointer whitespace-nowrap">
                                            Include String
                                        </label>
                                        <Tooltip text="If checked, the text content of the identifier must match the start of the line. If unchecked, any line with the same indentation level will be considered the start of a block." />
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    id="block-start-identifier"
                                    value={blockStartIdentifier}
                                    onChange={(e) => setBlockStartIdentifier(e.target.value)}
                                    className="w-full bg-gray-900 text-gray-300 border border-gray-600 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mt-1"
                                    placeholder="e.g.,   - Id:"
                                />
                            </div>
                             <p className="mt-1 text-sm font-semibold text-indigo-400">Indentation = {calculatedIndentation}</p>
                            <div role="radiogroup" aria-labelledby="mode-label" className="flex flex-row flex-wrap items-center space-x-4 mt-4">
                               <div className="flex items-center space-x-2">
                                    <span id="mode-label" className="text-sm font-medium text-gray-300">Operation Mode:</span>
                                    <Tooltip text="- Remove: completely deletes matching blocks (start line + all subsequent lines with greater indentation).
- Maintain: keeps ONLY matching blocks in the file, deleting all other unmatched blocks.
- Add Text: appends custom text to matching blocks, automatically adjusting to the block's indentation." />
                               </div>
                               <div className="flex flex-wrap items-center gap-x-4">
                                    <label title="Remove any block that contains a keyword." className="flex items-center space-x-2 text-gray-300 cursor-pointer">
                                        <input type="radio" name="mode" value="remove" checked={mode === 'remove'} onChange={() => setMode('remove')} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                                        <span>Remove</span>
                                    </label>
                                    <label title="Keep only the blocks that contain a keyword, removing all other blocks." className="flex items-center space-x-2 text-gray-300 cursor-pointer">
                                        <input type="radio" name="mode" value="maintain" checked={mode === 'maintain'} onChange={() => setMode('maintain')} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                                        <span>Maintain</span>
                                    </label>
                                    <label title="Add a block of text to blocks that match the keyword condition." className="flex items-center space-x-2 text-gray-300 cursor-pointer">
                                        <input type="radio" name="mode" value="addText" checked={mode === 'addText'} onChange={() => setMode('addText')} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                                        <span>Add Text</span>
                                    </label>
                               </div>
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center space-x-2">
                                    <label htmlFor="keywords" className="block text-sm font-medium text-gray-300">Keywords</label>
                                    <Tooltip text="Enter one keyword per line. The processor will check if any of these keywords exist within a data block to decide whether to perform the selected action." />
                                    <button onClick={() => keywordsFileInputRef.current?.click()} className="ml-2 flex items-center px-2 py-1 border border-gray-600 text-xs font-medium rounded-md text-gray-200 bg-gray-700 hover:bg-gray-600 transition-all">
                                        <UploadIcon className="h-3 w-3 mr-1" /> Upload
                                    </button>
                                    <input ref={keywordsFileInputRef} type="file" className="hidden" onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            const reader = new FileReader();
                                            reader.onload = (ev) => setKeywordsText(ev.target?.result as string);
                                            reader.readAsText(e.target.files[0]);
                                            if (keywordsFileInputRef.current) keywordsFileInputRef.current.value = '';
                                        }
                                    }} accept=".txt,.csv,text/plain" />
                                </div>
                                <div className="flex items-center space-x-3 text-sm text-gray-300">
                                    <label className="flex items-center space-x-1 cursor-pointer">
                                        <input type="radio" name="blockMatchMode" value="contains" checked={matchMode === 'contains'} onChange={() => setMatchMode('contains')} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500"/>
                                        <span>Contains</span>
                                    </label>
                                    <label className="flex items-center space-x-1 cursor-pointer">
                                        <input type="radio" name="blockMatchMode" value="exact" checked={matchMode === 'exact'} onChange={() => setMatchMode('exact')} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500"/>
                                        <span>Exact match</span>
                                    </label>
                                </div>
                            </div>
                            <div className="flex-1 flex flex-col min-h-0 border bg-[#101828] border-gray-600 rounded-md shadow-sm overflow-hidden" style={getWrapperStyle('120px', autoExtendConfig)}>
                                <CodeEditor 
                                    value={keywordsText} 
                                    onChange={(val) => setKeywordsText(val)} 
                                    placeholder={"e.g.,\nType: ShadowGear"}
                                    autoExtend={autoExtendConfig}
                                />
                            </div>
                        </div>
                        <div>
                            {mode === 'addText' ? (
                                <div className="space-y-3">
                                    <div>
                                        <div className="flex items-center space-x-2 mb-1">
                                            <label htmlFor="text-to-add" className="block text-sm font-medium text-gray-300">Text to Add</label>
                                            <Tooltip text="Enter the exact text you want to insert.
The tool automatically adds the block's base indentation to your text. Any additional indentation must be typed manually.
Example:   New_Key: true" />
                                        </div>
                                        <div className="flex-1 flex flex-col min-h-0 border bg-[#101828] border-gray-600 rounded-md shadow-sm overflow-hidden" style={getWrapperStyle('120px', autoExtendConfig)}>
                                            <CodeEditor
                                                value={textToAdd}
                                                onChange={(val) => setTextToAdd(val)}
                                                placeholder={"e.g.,\n  Scripts:\n    - SomeScript"}
                                                autoExtend={autoExtendConfig}
                                            />
                                        </div>
                                    </div>
                                    <div role="radiogroup" aria-labelledby="position-label" className="flex flex-wrap items-center gap-6">
                                        <div className="flex items-center space-x-2">
                                          <span id="position-label" className="text-sm font-medium text-gray-300">Add Position:</span>
                                          <Tooltip text="Choose where to insert the new text within the block. You can also specify a line offset." />
                                        </div>
                                        
                                        <div className="flex items-center space-x-2">
                                            <label title="Add the text immediately after the block's starting line." className="flex items-center space-x-2 text-gray-300 cursor-pointer">
                                                <input type="radio" name="addPosition" value="start" checked={addPosition === 'start'} onChange={() => setAddPosition('start')} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                                                <span className="text-sm">Start of block</span>
                                            </label>
                                            {addPosition === 'start' && (
                                                <div className="flex items-center space-x-2 ml-1">
                                                    <input 
                                                        id="add-position-offset-start"
                                                        type="number" 
                                                        min="0"
                                                        value={addPositionOffset} 
                                                        onChange={(e) => setAddPositionOffset(Math.max(0, parseInt(e.target.value) || 0))}
                                                        className="w-16 bg-gray-900 text-gray-300 border border-gray-600 rounded-md shadow-sm p-1 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                    />
                                                    <span className="text-sm text-gray-400">lines below</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <label title="Add the text at the very end of the block." className="flex items-center space-x-2 text-gray-300 cursor-pointer">
                                                <input type="radio" name="addPosition" value="end" checked={addPosition === 'end'} onChange={() => setAddPosition('end')} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                                                <span className="text-sm">End of block</span>
                                            </label>
                                            {addPosition === 'end' && (
                                                <div className="flex items-center space-x-2 ml-1">
                                                    <input 
                                                        id="add-position-offset-end"
                                                        type="number" 
                                                        min="0"
                                                        value={addPositionOffset} 
                                                        onChange={(e) => setAddPositionOffset(Math.max(0, parseInt(e.target.value) || 0))}
                                                        className="w-16 bg-gray-900 text-gray-300 border border-gray-600 rounded-md shadow-sm p-1 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                    />
                                                    <span className="text-sm text-gray-400">lines above</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center bg-[#1e293b] p-3 rounded-md border border-[#334155] mt-2">
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                id="invert-add-text-condition"
                                                checked={invertAddTextCondition}
                                                onChange={(e) => setInvertAddTextCondition(e.target.checked)}
                                                className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            />
                                            <label htmlFor="invert-add-text-condition" className="text-sm text-gray-300 cursor-pointer">
                                                Invert match condition
                                            </label>
                                            <Tooltip text="If checked, text will be added ONLY to blocks that DO NOT match." />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex items-center space-x-2 mb-1">
                                        <label htmlFor="replace-with" className="block text-sm font-medium text-gray-300">Replace With (Optional)</label>
                                        <Tooltip text="Leave empty to completely remove the block.
If text is provided, the matched block will be replaced with this text. The text will automatically inherit the block's base indentation.
Example: 
Insert line one
  Insert line two" />
                                    </div>
                                    <div className="flex-1 flex flex-col min-h-0 border bg-[#101828] border-gray-600 rounded-md shadow-sm overflow-hidden" style={getWrapperStyle('120px', autoExtendConfig)}>
                                        <CodeEditor 
                                            value={replaceWithText}
                                            onChange={(val) => setReplaceWithText(val)}
                                            placeholder={"e.g.\nInsert line one\n  Insert line two"}
                                            autoExtend={autoExtendConfig}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </fieldset>

                <div className="mt-6 pt-4 border-t border-gray-700 flex justify-center">
                    <div className="flex items-center gap-2">
                        <label htmlFor="indent-filter-mode" className="text-sm font-medium text-gray-300 whitespace-nowrap">Indentation Filter:</label>
                        <Tooltip text="This mode overrides the Block Processor. It processes the file line by line, removing or keeping lines based only on their indentation level." />
                        <select 
                            id="indent-filter-mode"
                            value={indentationFilterMode}
                            onChange={(e) => setIndentationFilterMode(e.target.value as IndentationFilterMode)}
                            className="w-full bg-gray-900 text-gray-300 border border-gray-600 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="none">None (Use Block Mode)</option>
                            <option value="gt">Remove: Indent &gt; X</option>
                            <option value="lt">Remove: Indent &lt; X</option>
                            <option value="eq_remove">Remove: Indent = X</option>
                            <option value="eq_maintain">Maintain: Indent = X</option>
                        </select>
                        <input
                            type="number"
                            value={indentationFilterValue}
                            onChange={(e) => setIndentationFilterValue(e.target.value)}
                            min="0"
                            aria-label="Indentation value"
                            className="w-24 bg-gray-900 text-gray-300 border border-gray-600 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-700 disabled:opacity-50"
                            disabled={!isIndentModeActive}
                        />
                    </div>
                </div>

            </div>

            <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6 pb-4">
                <div className="flex-1 flex flex-col min-h-0 min-w-[200px]">
                    <div className="flex-shrink-0 flex items-center justify-between mb-2">
                        <label htmlFor="input-text" className="block text-sm font-medium text-gray-300">Input Data</label>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center space-x-2 text-sm text-gray-400 cursor-pointer hover:text-gray-200 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={autoExtendData} 
                                    onChange={(e) => setAutoExtendData(e.target.checked)} 
                                    className="h-3.5 w-3.5 rounded bg-[#101828] border-gray-600 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                                />
                                <span>Auto-Extend Views</span>
                            </label>
                            <button onClick={() => fileInputRef.current?.click()} className="flex items-center px-3 py-1.5 border border-gray-600 text-xs font-medium rounded-md text-gray-200 bg-[#1e293b] hover:bg-[#334155] transition-all">
                                <UploadIcon className="h-4 w-4 mr-2" /> Upload File
                            </button>
                        </div>
                        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept=".txt,.yaml,.yml,text/plain" />
                    </div>
                    <div 
                        ref={leftRef}
                        className={`flex-1 flex flex-col min-h-[120px] border rounded-md shadow-sm transition-all ${isDragging ? 'border-indigo-500 ring-2 ring-indigo-500' : 'border-gray-700'} bg-[#101828]`}
                        style={getWrapperStyle(autoExtendData)}
                        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragOver={(e) => e.preventDefault()}
                        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                        onDrop={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                            if (e.dataTransfer.files?.[0]) readFile(e.dataTransfer.files[0]);
                        }}
                    >
                        <CodeEditor 
                            value={inputText} 
                            onChange={(val) => setInputText(val)} 
                            placeholder="Drag & drop a file, or paste your database content here..." 
                            autoExtend={autoExtendData}
                        />
                    </div>
                </div>
                <div className="flex-1 flex flex-col min-h-0 min-w-[200px]">
                     <label htmlFor="output-text" className="flex-shrink-0 block text-sm font-medium text-gray-300 mb-2">Processed Output</label>
                    <div ref={rightRef} className="flex-1 flex flex-col min-h-[120px] border bg-[#101828] border-gray-700 rounded-md shadow-sm" style={getWrapperStyle(autoExtendData)}>
                        <CodeEditor 
                            value={outputText} 
                            editable={false}
                            placeholder="Result will appear here after processing..." 
                            autoExtend={autoExtendData}
                        />
                    </div>
                </div>
            </div>
            
            <div className="flex-shrink-0 mt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button onClick={handleProcess} disabled={isProcessButtonDisabled} className="w-full sm:w-auto flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-pink-500 disabled:bg-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                    {isProcessing ? <><LoadingSpinner/>Processing...</> : <><BlockRemoveIcon/>Process Data</>}
                </button>
                <button onClick={handleCopy} disabled={!outputText} className="w-full sm:w-auto flex items-center justify-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-200 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                     <CopyIcon />{copyStatus}
                </button>
                <button onClick={handleDownload} disabled={!outputText} className="w-full sm:w-auto flex items-center justify-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-200 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                    <DownloadIcon />Download File
                </button>
            </div>
        </div>
    );
};

export default BlockRemoverPage;