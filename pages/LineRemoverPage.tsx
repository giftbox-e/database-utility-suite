import React, { useState, useCallback, useRef, useEffect } from 'react';
import { safeSetLocalStorage } from '../lib/storage';
import { lineRemoverWorkerScript } from '../workers/lineRemoverScript';
import { CopyIcon, DownloadIcon, UploadIcon, LoadingSpinner, ProcessIcon } from '../components/Icons';
import { Tooltip } from '../components/Tooltip';
import { ExpandableDescription } from '../components/ExpandableDescription';
import { useSyncedResize } from '../hooks/useSyncedResize';
import { CodeEditor } from '../components/CodeEditor';
import { ResizablePanel } from '../components/ResizablePanel';
import { ConfirmModal } from '../components/ConfirmModal';

type Mode = 'remove' | 'maintain' | 'addText';
type AddPosition = 'start' | 'end' | 'before' | 'after';
type MatchMode = 'contains' | 'exact';

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

const LineRemoverPage: React.FC = () => {
    const [inputText, setInputText] = useState<string>(() => getInitialState('lineRemover_inputText', ''));
    const [inputFileName, setInputFileName] = useState<string>(() => getInitialState('lineRemover_inputFileName', 'processed_lines.txt'));
    const [keywordsText, setKeywordsText] = useState<string>(() => getInitialState('lineRemover_keywordsText', ''));
    const [replaceWithText, setReplaceWithText] = useState<string>(() => getInitialState('lineRemover_replaceWithText', ''));
    const [outputText, setOutputText] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [copyStatus, setCopyStatus] = useState<string>('Copy Output');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const keywordsFileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const { leftRef, rightRef, isManuallyResized } = useSyncedResize();

    const [mode, setMode] = useState<Mode>(() => getInitialState('lineRemover_mode', 'remove'));
    const [matchMode, setMatchMode] = useState<MatchMode>(() => getInitialState('lineRemover_matchMode', 'contains'));
    const [textToAdd, setTextToAdd] = useState<string>(() => getInitialState('lineRemover_textToAdd', ''));
    const [addPosition, setAddPosition] = useState<AddPosition>(() => getInitialState('lineRemover_addPosition', 'before'));

    const [removeAbove, setRemoveAbove] = useState<boolean>(() => getInitialState('lineRemover_removeAbove', false));
    const [linesAbove, setLinesAbove] = useState<string>(() => getInitialState('lineRemover_linesAbove', '1'));
    const [removeBelow, setRemoveBelow] = useState<boolean>(() => getInitialState('lineRemover_removeBelow', false));
    const [linesBelow, setLinesBelow] = useState<string>(() => getInitialState('lineRemover_linesBelow', '1'));

    const [maintainAbove, setMaintainAbove] = useState<boolean>(() => getInitialState('lineRemover_maintainAbove', false));
    const [linesToMaintainAbove, setLinesToMaintainAbove] = useState<string>(() => getInitialState('lineRemover_linesToMaintainAbove', '1'));
    const [maintainBelow, setMaintainBelow] = useState<boolean>(() => getInitialState('lineRemover_maintainBelow', false));
    const [linesToMaintainBelow, setLinesToMaintainBelow] = useState<string>(() => getInitialState('lineRemover_linesToMaintainBelow', '1'));

    const [autoExtendConfig, setAutoExtendConfig] = useState<boolean>(() => getInitialState('lineRemover_autoExtendConfig', false));
    const [autoExtendData, setAutoExtendData] = useState<boolean>(() => getInitialState('lineRemover_autoExtendData', false));
    const [isOutputEditable, setIsOutputEditable] = useState<boolean>(() => getInitialState('lineRemover_isOutputEditable', false));
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    // --- State Persistence Effects ---
    useEffect(() => { safeSetLocalStorage('lineRemover_inputText', inputText); }, [inputText]);
    useEffect(() => { safeSetLocalStorage('lineRemover_inputFileName', inputFileName); }, [inputFileName]);
    useEffect(() => { safeSetLocalStorage('lineRemover_keywordsText', keywordsText); }, [keywordsText]);
    useEffect(() => { safeSetLocalStorage('lineRemover_replaceWithText', replaceWithText); }, [replaceWithText]);
    useEffect(() => { safeSetLocalStorage('lineRemover_mode', mode); }, [mode]);
    useEffect(() => { safeSetLocalStorage('lineRemover_matchMode', matchMode); }, [matchMode]);
    useEffect(() => { safeSetLocalStorage('lineRemover_textToAdd', textToAdd); }, [textToAdd]);
    useEffect(() => { safeSetLocalStorage('lineRemover_addPosition', addPosition); }, [addPosition]);
    useEffect(() => { safeSetLocalStorage('lineRemover_removeAbove', removeAbove); }, [removeAbove]);
    useEffect(() => { safeSetLocalStorage('lineRemover_linesAbove', linesAbove); }, [linesAbove]);
    useEffect(() => { safeSetLocalStorage('lineRemover_removeBelow', removeBelow); }, [removeBelow]);
    useEffect(() => { safeSetLocalStorage('lineRemover_linesBelow', linesBelow); }, [linesBelow]);
    useEffect(() => { safeSetLocalStorage('lineRemover_maintainAbove', maintainAbove); }, [maintainAbove]);
    useEffect(() => { safeSetLocalStorage('lineRemover_linesToMaintainAbove', linesToMaintainAbove); }, [linesToMaintainAbove]);
    useEffect(() => { safeSetLocalStorage('lineRemover_maintainBelow', maintainBelow); }, [maintainBelow]);
    useEffect(() => { safeSetLocalStorage('lineRemover_linesToMaintainBelow', linesToMaintainBelow); }, [linesToMaintainBelow]);
    useEffect(() => { safeSetLocalStorage('lineRemover_autoExtendConfig', autoExtendConfig); }, [autoExtendConfig]);
    useEffect(() => { safeSetLocalStorage('lineRemover_autoExtendData', autoExtendData); }, [autoExtendData]);
    useEffect(() => { safeSetLocalStorage('lineRemover_isOutputEditable', isOutputEditable); }, [isOutputEditable]);



    const isReplaceMode = (mode === 'remove' || mode === 'maintain') && replaceWithText.trim() !== '';

    const executeProcess = useCallback(() => {
        setIsProcessing(true);
        setOutputText('');

        const workerBlob = new Blob([lineRemoverWorkerScript], { type: 'application/javascript' });
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
            replaceWithText,
            removeAbove,
            linesAbove: parseInt(linesAbove, 10),
            removeBelow,
            linesBelow: parseInt(linesBelow, 10),
            maintainAbove,
            linesToMaintainAbove: parseInt(linesToMaintainAbove, 10),
            maintainBelow,
            linesToMaintainBelow: parseInt(linesToMaintainBelow, 10),
            mode,
            matchMode,
            textToAdd,
            addPosition
        });
    }, [inputText, keywordsText, replaceWithText, removeAbove, linesAbove, removeBelow, linesBelow, maintainAbove, linesToMaintainAbove, maintainBelow, linesToMaintainBelow, mode, matchMode, textToAdd, addPosition]);

    const handleProcess = useCallback(() => {
        if (outputText.trim() !== '') {
            setIsConfirmModalOpen(true);
        } else {
            executeProcess();
        }
    }, [outputText, executeProcess]);

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
            setInputText(event.target?.result as string)
            setInputFileName(file.name);
        };
        reader.readAsText(file);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) readFile(e.target.files[0]);
    };

    const isProcessButtonDisabled = isProcessing || !inputText.trim() ||
        (!keywordsText.trim() && !(mode === 'addText' && (addPosition === 'start' || addPosition === 'end'))) ||
        (mode === 'remove' && removeAbove && (isNaN(parseInt(linesAbove)) || parseInt(linesAbove) < 1)) ||
        (mode === 'remove' && removeBelow && (isNaN(parseInt(linesBelow)) || parseInt(linesBelow) < 1)) ||
        (mode === 'maintain' && maintainAbove && (isNaN(parseInt(linesToMaintainAbove)) || parseInt(linesToMaintainAbove) < 0)) ||
        (mode === 'maintain' && maintainBelow && (isNaN(parseInt(linesToMaintainBelow)) || parseInt(linesToMaintainBelow) < 0)) ||
        (mode === 'addText' && !textToAdd.trim());



    return (
        <div className="w-full bg-gray-800 rounded-lg shadow-2xl p-4 sm:p-6 border border-gray-700 flex flex-col flex-grow min-h-0">
            <div className="flex-shrink-0 mb-6 p-3 sm:p-4 border border-gray-700 rounded-lg bg-gray-800">
                <div className="flex items-center space-x-2 mb-3">
                    <h2 className="text-xl font-bold text-white">Line Processor</h2>
                    <Tooltip text="A flexible tool for line-based operations." />

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
                            <Tooltip text="If enabled, the configuration boxes above (like Keywords, Replace With) will automatically expand their height to fit their content." />
                    </div>
                </div>

                <ExpandableDescription title="Remove, keep, or alter text lines containing specific keywords.">
                    <p>
                        A flexible tool for line-based operations. Provide keywords to target lines, then choose an action:
                    </p>
                    <p className="mt-2 text-indigo-300 font-medium">
                        <span className="font-bold underline">Important:</span> This tool ignores blocks and strictly targets individual lines of text.
                    </p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li><strong>Remove Lines:</strong> Delete lines containing keywords. You can also conditionally remove N lines above/below the keyword!</li>
                        <li><strong>Maintain Lines:</strong> Keep ONLY the lines containing keywords, and delete everything else in the file.</li>
                        <li><strong>Add Text:</strong> Insert custom text at the start, end, or specific position of lines that match the keywords.</li>
                    </ul>
                    <p className="pt-2 text-gray-300"><strong>Example:</strong> Use "Remove Lines" -&gt; Remove 1 Line Above when matching "Type: Trash" to remove both the item name and type lines.</p>
                </ExpandableDescription>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="flex flex-col">
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center space-x-2">
                                    <label htmlFor="keywords" className="block text-sm font-medium text-gray-300">Keywords</label>
                                    <Tooltip text="Enter one keyword or phrase per line. Any line in the input data containing one of these keywords will be targeted for processing." />
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
                                        <input type="radio" name="matchMode" value="contains" checked={matchMode === 'contains'} onChange={() => setMatchMode('contains')} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                                        <span>Contains</span>
                                    </label>
                                    <label className="flex items-center space-x-1 cursor-pointer">
                                        <input type="radio" name="matchMode" value="exact" checked={matchMode === 'exact'} onChange={() => setMatchMode('exact')} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                                        <span>Exact match</span>
                                    </label>
                                </div>
                            </div>
                            <ResizablePanel baseHeight="120px" autoExtend={autoExtendConfig} className="flex-1 min-h-0 border bg-[#101828] border-gray-600 rounded-md shadow-sm">
                                <CodeEditor
                                    value={keywordsText}
                                    onChange={(val) => setKeywordsText(val)}
                                    placeholder={"e.g.,\nDoram_High_Cape\nTwinhorn_Helm"}
                                    autoExtend={autoExtendConfig}
                                />
                            </ResizablePanel>
                        </div>

                        <div role="radiogroup" aria-labelledby="mode-label" className="flex flex-row flex-wrap items-center space-x-4 mt-4">
                            <div className="flex items-center space-x-2">
                                <span id="mode-label" className="text-sm font-medium text-gray-300">Operation Mode:</span>
                                <Tooltip text="- Remove: deletes matching lines (or replaces them if replacement text is provided). Example: remove all lines containing 'Type: Trash'.
- Maintain: keeps ONLY the matching lines, discarding all other un-matched lines.
- Add Text: appends custom text before or after the matching lines." />
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4">
                                <label title="Remove any line that contains a keyword." className="flex items-center space-x-2 text-gray-300 cursor-pointer">
                                    <input type="radio" name="mode" value="remove" checked={mode === 'remove'} onChange={() => setMode('remove')} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                                    <span>Remove</span>
                                </label>
                                <label title="Keep only lines that contain a keyword, removing all others." className="flex items-center space-x-2 text-gray-300 cursor-pointer">
                                    <input type="radio" name="mode" value="maintain" checked={mode === 'maintain'} onChange={() => setMode('maintain')} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                                    <span>Maintain</span>
                                </label>
                                <label title="Add text to any line that contains a keyword." className="flex items-center space-x-2 text-gray-300 cursor-pointer">
                                    <input type="radio" name="mode" value="addText" checked={mode === 'addText'} onChange={() => setMode('addText')} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                                    <span>Add Text</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {mode === 'remove' && (
                        <>
                            <div className={`space-y-4`}>
                                <fieldset>
                                    <legend className="text-sm font-medium text-gray-300 mb-2 flex items-center text-center justify-center space-x-2">
                                        <span>Top Line Removal</span>
                                        <Tooltip text="If enabled, removes a specified number of lines immediately preceding a line that contains a keyword." />
                                    </legend>
                                    <div className="flex items-center justify-center space-x-4">
                                        <label className="flex items-center space-x-2 text-gray-300 cursor-pointer"><input type="radio" name="removeAbove" checked={!removeAbove} onChange={() => setRemoveAbove(false)} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" /><span>No</span></label>
                                        <div className="flex items-center space-x-2">
                                            <label className="flex items-center space-x-2 text-gray-300 cursor-pointer"><input type="radio" name="removeAbove" checked={removeAbove} onChange={() => setRemoveAbove(true)} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" /><span>Yes</span></label>
                                            <input type="number" value={linesAbove} onChange={(e) => setLinesAbove(e.target.value)} min="1" aria-label="Number of lines to remove above" className="w-20 bg-gray-900 text-gray-300 border border-gray-600 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-700 disabled:opacity-50" disabled={!removeAbove} />
                                        </div>
                                    </div>
                                </fieldset>
                                <fieldset>
                                    <legend className="text-sm font-medium text-gray-300 mb-2 flex text-center items-center justify-center space-x-2">
                                        <span>Bottom Line Removal</span>
                                        <Tooltip text="If enabled, removes a specified number of lines immediately following a line that contains a keyword." />
                                    </legend>
                                    <div className="flex items-center justify-center space-x-4">
                                        <label className="flex items-center space-x-2 text-gray-300 cursor-pointer"><input type="radio" name="removeBelow" checked={!removeBelow} onChange={() => setRemoveBelow(false)} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" /><span>No</span></label>
                                        <div className="flex items-center space-x-2">
                                            <label className="flex items-center space-x-2 text-gray-300 cursor-pointer"><input type="radio" name="removeBelow" checked={removeBelow} onChange={() => setRemoveBelow(true)} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" /><span>Yes</span></label>
                                            <input type="number" value={linesBelow} onChange={(e) => setLinesBelow(e.target.value)} min="1" aria-label="Number of lines to remove below" className="w-20 bg-gray-900 text-gray-300 border border-gray-600 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-700 disabled:opacity-50" disabled={!removeBelow} />
                                        </div>
                                    </div>
                                </fieldset>
                            </div>
                            <div>
                                <div className="flex items-center space-x-2 mb-1">
                                    <label htmlFor="replace-with" className="block text-sm font-medium text-gray-300">Replace With (Optional)</label>
                                    <Tooltip text="If text is provided here, any line containing a keyword will be replaced with this text. If left empty, the line will be removed entirely." />
                                </div>
                                <ResizablePanel baseHeight="120px" autoExtend={autoExtendConfig} className="flex-1 min-h-0 border bg-[#101828] border-gray-600 rounded-md shadow-sm">
                                    <CodeEditor
                                        value={replaceWithText}
                                        onChange={(val) => setReplaceWithText(val)}
                                        placeholder="Leave empty to remove lines..."
                                        autoExtend={autoExtendConfig}
                                    />
                                </ResizablePanel>
                            </div>
                        </>
                    )}

                    {mode === 'maintain' && (
                        <>
                            <div className={`space-y-4`}>
                                <fieldset>
                                    <legend className="text-sm font-medium text-gray-300 mb-2 flex items-center text-center justify-center space-x-2">
                                        <span>Top Line Maintain</span>
                                        <Tooltip text="If enabled, keeps a specified number of lines immediately preceding a line that contains a keyword." />
                                    </legend>
                                    <div className="flex items-center justify-center space-x-4">
                                        <label className="flex items-center space-x-2 text-gray-300 cursor-pointer"><input type="radio" name="maintainAbove" checked={!maintainAbove} onChange={() => setMaintainAbove(false)} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" /><span>No</span></label>
                                        <div className="flex items-center space-x-2">
                                            <label className="flex items-center space-x-2 text-gray-300 cursor-pointer"><input type="radio" name="maintainAbove" checked={maintainAbove} onChange={() => setMaintainAbove(true)} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" /><span>Yes</span></label>
                                            <input type="number" value={linesToMaintainAbove} onChange={(e) => setLinesToMaintainAbove(e.target.value)} min="0" aria-label="Number of lines to maintain above" className="w-20 bg-gray-900 text-gray-300 border border-gray-600 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-700 disabled:opacity-50" disabled={!maintainAbove} />
                                        </div>
                                    </div>
                                </fieldset>
                                <fieldset>
                                    <legend className="text-sm font-medium text-gray-300 mb-2 flex text-center items-center justify-center space-x-2">
                                        <span>Bottom Line Maintain</span>
                                        <Tooltip text="If enabled, keeps a specified number of lines immediately following a line that contains a keyword." />
                                    </legend>
                                    <div className="flex items-center justify-center space-x-4">
                                        <label className="flex items-center space-x-2 text-gray-300 cursor-pointer"><input type="radio" name="maintainBelow" checked={!maintainBelow} onChange={() => setMaintainBelow(false)} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" /><span>No</span></label>
                                        <div className="flex items-center space-x-2">
                                            <label className="flex items-center space-x-2 text-gray-300 cursor-pointer"><input type="radio" name="maintainBelow" checked={maintainBelow} onChange={() => setMaintainBelow(true)} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" /><span>Yes</span></label>
                                            <input type="number" value={linesToMaintainBelow} onChange={(e) => setLinesToMaintainBelow(e.target.value)} min="0" aria-label="Number of lines to maintain below" className="w-20 bg-gray-900 text-gray-300 border border-gray-600 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-700 disabled:opacity-50" disabled={!maintainBelow} />
                                        </div>
                                    </div>
                                </fieldset>
                            </div>
                            <div>
                                <div className="flex items-center space-x-2 mb-1">
                                    <label htmlFor="replace-with-maintain" className="block text-sm font-medium text-gray-300">Replace With (Optional)</label>
                                    <Tooltip text="If text is provided here, any line that is NOT maintained (i.e., would have been removed) will be replaced with this text. If empty, non-maintained lines are removed." />
                                </div>
                                <ResizablePanel baseHeight="120px" autoExtend={autoExtendConfig} className="flex-1 min-h-0 border bg-[#101828] border-gray-600 rounded-md shadow-sm">
                                    <CodeEditor
                                        value={replaceWithText}
                                        onChange={(val) => setReplaceWithText(val)}
                                        placeholder="Leave empty to remove other lines..."
                                        autoExtend={autoExtendConfig}
                                    />
                                </ResizablePanel>
                            </div>
                        </>
                    )}

                    {mode === 'addText' && (
                        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
                            <div>
                                <div className="flex items-center space-x-2 mb-1">
                                    <label htmlFor="text-to-add" className="block text-sm font-medium text-gray-300">Text to Add</label>
                                    <Tooltip text="The text you want to insert into matching lines." />
                                </div>
                                <ResizablePanel baseHeight="120px" autoExtend={autoExtendConfig} className="flex-1 min-h-0 border bg-[#101828] border-gray-600 rounded-md shadow-sm">
                                    <CodeEditor
                                        value={textToAdd}
                                        onChange={(val) => setTextToAdd(val)}
                                        placeholder="e.g., // To be reviewed"
                                        autoExtend={autoExtendConfig}
                                    />
                                </ResizablePanel>
                            </div>
                            <div>
                                <div className="flex items-center space-x-2 mb-1">
                                    <label htmlFor="add-position" className="block text-sm font-medium text-gray-300">Position</label>
                                    <Tooltip text="Specifies where the new text should be inserted relative to the line or the keyword within it." />
                                </div>
                                <select id="add-position" value={addPosition} onChange={(e) => setAddPosition(e.target.value as AddPosition)} className="w-full bg-gray-900 text-gray-300 border border-gray-600 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                                    <option value="start">Start of Line</option>
                                    <option value="end">End of Line</option>
                                    <option value="before">Before Keyword</option>
                                    <option value="after">After Keyword</option>
                                </select>
                            </div>
                        </div>
                    )}

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
                            <Tooltip text="If enabled, the Input Data and Processed Output text boxes will automatically expand their height to fit the content." />
                            <button onClick={() => fileInputRef.current?.click()} className="flex items-center px-3 py-1.5 border border-gray-600 text-xs font-medium rounded-md text-gray-200 bg-[#1e293b] hover:bg-[#334155] transition-all">
                                <UploadIcon className="h-4 w-4 mr-2" /> Upload File
                            </button>
                        </div>
                        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept=".txt,.yaml,.yml,text/plain" />
                    </div>
                    <ResizablePanel
                        ref={leftRef as React.Ref<HTMLDivElement>}
                        baseHeight="120px"
                        autoExtend={autoExtendData}
                        isManuallyResized={isManuallyResized}
                        className={`flex-1 min-h-[120px] border rounded-md shadow-sm transition-all ${isDragging ? 'border-indigo-500 ring-2 ring-indigo-500' : 'border-gray-700'} bg-[#101828]`}
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
                    </ResizablePanel>
                </div>
                <div className="flex-1 flex flex-col min-h-0 min-w-[200px]">
                    <div className="flex-shrink-0 flex items-center justify-between mb-2">
                        <label htmlFor="output-text" className="block text-sm font-medium text-gray-300">Processed Output</label>
                        <div className="flex items-center space-x-2">
                            <input 
                                type="checkbox" 
                                id="output-editable"
                                checked={isOutputEditable} 
                                onChange={(e) => setIsOutputEditable(e.target.checked)} 
                                className="h-3.5 w-3.5 rounded bg-[#101828] border-gray-600 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                            />
                            <label htmlFor="output-editable" className="text-sm text-gray-400 cursor-pointer hover:text-gray-200 transition-colors">Editable</label>
                            <Tooltip text="If enabled, you can manually edit the processed output before copying or downloading it." />
                        </div>
                    </div>
                    <ResizablePanel ref={rightRef as React.Ref<HTMLDivElement>} baseHeight="120px" autoExtend={autoExtendData} isManuallyResized={isManuallyResized} className="flex-1 min-h-[120px] border bg-[#101828] border-gray-700 rounded-md shadow-sm">
                        <CodeEditor
                            value={outputText}
                            onChange={(val) => setOutputText(val)}
                            editable={isOutputEditable}
                            placeholder="Result will appear here after processing..."
                            autoExtend={autoExtendData}
                        />
                    </ResizablePanel>
                </div>
            </div>

            <div className="flex-shrink-0 mt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button onClick={handleProcess} disabled={isProcessButtonDisabled} className="w-full sm:w-auto flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                    {isProcessing ? <><LoadingSpinner />Processing...</> : <><ProcessIcon />Process Data</>}
                </button>
                <button onClick={handleCopy} disabled={!outputText} className="w-full sm:w-auto flex items-center justify-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-200 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                    <CopyIcon />{copyStatus}
                </button>
                <button onClick={handleDownload} disabled={!outputText} className="w-full sm:w-auto flex items-center justify-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-200 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                    <DownloadIcon />Download File
                </button>
            </div>
            
            <ConfirmModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={executeProcess}
                title="Overwrite Output?"
                message="The Processed Output box already contains text. Are you sure you want to process again? The current output will be completely replaced."
            />
        </div>
    );
};

export default LineRemoverPage;