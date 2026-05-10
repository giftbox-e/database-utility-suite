import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { safeSetLocalStorage } from '../lib/storage';
import { blockRemoverWorkerScript } from '../workers/blockRemoverScript';
import { CopyIcon, DownloadIcon, UploadIcon, LoadingSpinner, BlockRemoveIcon } from '../components/Icons';
import { Tooltip } from '../components/Tooltip';
import { ExpandableDescription } from '../components/ExpandableDescription';
import { useSyncedResize } from '../hooks/useSyncedResize';
import { ResizablePanel } from '../components/ResizablePanel';

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
    const [invertAddTextCondition, setInvertAddTextCondition] = useState<boolean>(() => getInitialState('blockRemover_invertAddTextCondition', false));

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
    useEffect(() => { safeSetLocalStorage('blockRemover_invertAddTextCondition', invertAddTextCondition); }, [invertAddTextCondition]);



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
            invertAddTextCondition,
        });
    }, [inputText, keywordsText, blockStartIdentifier, includeIdentifierString, replaceWithText, mode, matchMode, indentationFilterMode, indentationFilterValue, textToAdd, addPosition, invertAddTextCondition]);

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
                    <h2 className="text-xl font-bold text-white">Block / Indentation Processor</h2>
                    <Tooltip text="Process data based on its structural indentation or semantic elements." />
                </div>
                
                <ExpandableDescription title="Remove, keep, or alter entire blocks of data based on what they contain.">
                        <p>
                            Use <strong>Block Mode</strong> to handle structural chunks of related data, or <strong>Indentation Filter</strong> to process lines purely based on indentation level.
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Block Start Identifier:</strong> Define what starts a block (e.g. <code>  - Id: </code>). Any lines underneath with *greater* indentation will be considered part of the block.</li>
                            <li><strong>Match Mode:</strong> Decide whether to keep or remove blocks based on whether they contain your Keywords.</li>
                            <li><strong>Indentation Filter Mode:</strong> (Alternative) Ignore blocks and just globally remove, maintain, or add text to all lines that match a specific number of spaces.</li>
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
                            <div role="radiogroup" aria-labelledby="mode-label" className="flex flex-col space-y-2 mt-4">
                               <div className="flex items-center space-x-2">
                                    <span id="mode-label" className="text-sm font-medium text-gray-300">Block Mode:</span>
                                    <Tooltip text="Choose the action to perform on blocks that match the keyword criteria." />
                               </div>
                               <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
                            <ResizablePanel baseHeight="160px" className="border border-gray-600 rounded-md shadow-sm bg-gray-900 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                                <textarea
                                    id="keywords"
                                    value={keywordsText}
                                    onChange={(e) => setKeywordsText(e.target.value)}
                                    placeholder="e.g.,&#10;Type: ShadowGear"
                                    className="w-full h-full bg-transparent text-gray-300 p-2 font-mono text-sm resize-none outline-none"
                                    spellCheck="false"
                                />
                            </ResizablePanel>
                        </div>
                        <div>
                            {mode === 'addText' ? (
                                <div className="space-y-3">
                                    <div>
                                        <div className="flex items-center space-x-2 mb-1">
                                            <label htmlFor="text-to-add" className="block text-sm font-medium text-gray-300">Text to Add</label>
                                            <Tooltip text="Enter the text (can be multiple lines) to add to matching blocks. It will be automatically indented relative to the block." />
                                        </div>
                                        <ResizablePanel baseHeight="100px" className="border border-gray-600 rounded-md shadow-sm bg-gray-900 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                                            <textarea
                                                id="text-to-add"
                                                value={textToAdd}
                                                onChange={(e) => setTextToAdd(e.target.value)}
                                                className="w-full h-full bg-transparent text-gray-300 p-2 font-mono text-sm resize-none outline-none"
                                                placeholder="e.g.,&#10;  Scripts:&#10;    - SomeScript"
                                            />
                                        </ResizablePanel>
                                    </div>
                                    <div role="radiogroup" aria-labelledby="position-label" className="flex items-center space-x-4">
                                        <div className="flex items-center space-x-2">
                                          <span id="position-label" className="text-sm font-medium text-gray-300">Position:</span>
                                          <Tooltip text="Choose where to insert the new text within the block." />
                                        </div>
                                        <label title="Add the text immediately after the block's starting line." className="flex items-center space-x-2 text-gray-300 cursor-pointer">
                                            <input type="radio" name="addPosition" value="start" checked={addPosition === 'start'} onChange={() => setAddPosition('start')} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                                            <span>Start</span>
                                        </label>
                                        <label title="Add the text at the very end of the block." className="flex items-center space-x-2 text-gray-300 cursor-pointer">
                                            <input type="radio" name="addPosition" value="end" checked={addPosition === 'end'} onChange={() => setAddPosition('end')} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                                            <span>End</span>
                                        </label>
                                    </div>
                                    <div className="flex items-center space-x-2 pt-1">
                                        <Tooltip text="Invert the logic. If checked, text will be added ONLY to blocks that DO NOT contain any of the specified keywords." />
                                        <input
                                            type="checkbox"
                                            id="invert-add-text-condition"
                                            checked={invertAddTextCondition}
                                            onChange={(e) => setInvertAddTextCondition(e.target.checked)}
                                            className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                        <label htmlFor="invert-add-text-condition" className="text-sm text-gray-300 cursor-pointer">
                                            Apply to blocks that DO NOT contain keywords
                                        </label>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex items-center space-x-2 mb-1">
                                        <label htmlFor="replace-with" className="block text-sm font-medium text-gray-300">Replace With (Optional)</label>
                                        <Tooltip text="If text is provided, the entire block will be replaced with this text (preserving the block's initial indentation). If left empty, the block will be removed entirely." />
                                    </div>
                                    <ResizablePanel baseHeight="160px" className="border border-gray-600 rounded-md shadow-sm bg-gray-900 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                                        <textarea
                                            id="replace-with"
                                            value={replaceWithText}
                                            onChange={(e) => setReplaceWithText(e.target.value)}
                                            placeholder="Leave empty to remove block..."
                                            className="w-full h-full bg-transparent text-gray-300 p-2 font-mono text-sm resize-none outline-none"
                                            spellCheck="false"
                                        />
                                    </ResizablePanel>
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

            <div className="flex-1 min-h-[400px] lg:min-h-[300px] flex flex-col lg:flex-row gap-6 pb-4">
                <div className="flex-1 flex flex-col min-w-[200px]">
                    <div className="flex-shrink-0 flex items-center justify-between mb-2">
                        <label htmlFor="input-text" className="block text-sm font-medium text-gray-300">Input Data</label>
                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center px-3 py-1.5 border border-gray-600 text-xs font-medium rounded-md text-gray-200 bg-gray-700 hover:bg-gray-600 transition-all">
                            <UploadIcon className="h-4 w-4 mr-2" /> Upload File
                        </button>
                        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept=".txt,.yaml,.yml,text/plain" />
                    </div>
                    <ResizablePanel 
                        ref={leftRef as React.Ref<HTMLDivElement>} 
                        baseHeight="400px" 
                        isManuallyResized={isManuallyResized} 
                        className={`flex-grow border rounded-md shadow-sm bg-gray-900 transition-all ${isDragging ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-600'}`}
                    >
                        <textarea 
                            id="input-text" 
                            value={inputText} 
                            onChange={(e) => setInputText(e.target.value)} 
                            placeholder="Drag & drop a file, or paste your database content here..." 
                            className="w-full h-full bg-transparent text-gray-300 p-4 font-mono text-sm resize-none outline-none focus:ring-0" 
                            spellCheck="false"
                            onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragOver={(e) => e.preventDefault()}
                            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDragging(false);
                                if (e.dataTransfer.files?.[0]) readFile(e.dataTransfer.files[0]);
                            }}
                        />
                    </ResizablePanel>
                </div>
                <div className="flex-1 flex flex-col min-w-[200px]">
                     <label htmlFor="output-text" className="flex-shrink-0 block text-sm font-medium text-gray-300 mb-2">Processed Output</label>
                    <ResizablePanel 
                        ref={rightRef as React.Ref<HTMLDivElement>} 
                        baseHeight="400px" 
                        isManuallyResized={isManuallyResized} 
                        className="flex-grow border border-gray-600 bg-gray-900 rounded-md shadow-sm"
                    >
                        <textarea id="output-text" value={outputText} readOnly placeholder="Result will appear here after processing..." className="w-full h-full bg-transparent text-gray-300 p-4 font-mono text-sm resize-none outline-none focus:ring-0" spellCheck="false" />
                    </ResizablePanel>
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