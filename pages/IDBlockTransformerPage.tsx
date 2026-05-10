import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { safeSetLocalStorage } from '../lib/storage';
import { idBlockTransformerScript } from '../workers/idBlockTransformerScript';
import { CopyIcon, DownloadIcon, ProcessIcon, UploadIcon, LoadingSpinner } from '../components/Icons';
import { Tooltip } from '../components/Tooltip';
import { ExpandableDescription } from '../components/ExpandableDescription';
import { useSyncedResize } from '../hooks/useSyncedResize';
import { CodeEditor } from '../components/CodeEditor';
import { ResizablePanel } from '../components/ResizablePanel';
import { ConfirmModal } from '../components/ConfirmModal';

type Condition = 'none' | '<' | '=' | '>';
type Operation = 'fixed' | 'increase' | 'decrease' | 'multiply' | 'divide';

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

const IDBlockTransformerPage: React.FC = () => {
    const [inputText, setInputText] = useState<string>(() => getInitialState('idblock_inputText', ''));
    const [inputFileName, setInputFileName] = useState<string>(() => getInitialState('idblock_inputFileName', 'transformed_database.txt'));
    const [outputText, setOutputText] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [copyStatus, setCopyStatus] = useState<string>('Copy Output');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const keywordsFileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    
    const { leftRef, rightRef, isManuallyResized } = useSyncedResize();
    
    const [keywordsText, setKeywordsText] = useState<string>(() => getInitialState('idblock_keywordsText', ''));
    const [blockStartFormat, setBlockStartFormat] = useState<string>(() => getInitialState('idblock_blockStartFormat', '[{ID}] = {'));
    
    const [applyToBlock, setApplyToBlock] = useState<boolean>(() => getInitialState('idblock_applyToBlock', false));
    const [sourceKey, setSourceKey] = useState<string>(() => getInitialState('idblock_sourceKey', ''));
    const [condition, setCondition] = useState<Condition>(() => getInitialState('idblock_condition', 'none'));
    const [includeIndentation, setIncludeIndentation] = useState<boolean>(() => getInitialState('idblock_includeIndentation', false));
    const [conditionValue, setConditionValue] = useState<string>(() => getInitialState('idblock_conditionValue', ''));
    const [targetKey, setTargetKey] = useState<string>(() => getInitialState('idblock_targetKey', ''));
    const [operation, setOperation] = useState<Operation>(() => getInitialState('idblock_operation', 'multiply'));
    const [operationValue, setOperationValue] = useState<string>(() => getInitialState('idblock_operationValue', ''));
    const [roundDecimals, setRoundDecimals] = useState<boolean>(() => getInitialState('idblock_roundDecimals', false));

const [mode, setMode] = useState<'transform' | 'remove' | 'maintain' | 'addText'>(() => getInitialState('idblock_mode', 'transform'));
    const [replaceWithText, setReplaceWithText] = useState<string>(() => getInitialState('idblock_replaceWithText', ''));
    const [textToAdd, setTextToAdd] = useState<string>(() => getInitialState('idblock_textToAdd', ''));
    const [addPosition, setAddPosition] = useState<'start' | 'end'>(() => getInitialState('idblock_addPosition', 'start'));
    const [addPositionOffset, setAddPositionOffset] = useState<number>(() => getInitialState('idblock_addPositionOffset', 0));
    const [invertAddTextCondition, setInvertAddTextCondition] = useState<boolean>(() => getInitialState('idblock_invertAddTextCondition', false));

    const [autoExtendConfig, setAutoExtendConfig] = useState<boolean>(() => getInitialState('idblock_autoExtendConfig', false));
    const [autoExtendData, setAutoExtendData] = useState<boolean>(() => getInitialState('idblock_autoExtendData', false));
    const [isOutputEditable, setIsOutputEditable] = useState<boolean>(() => getInitialState('idblock_isOutputEditable', false));
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    useEffect(() => { safeSetLocalStorage('idblock_mode', mode); }, [mode]);
    useEffect(() => { safeSetLocalStorage('idblock_replaceWithText', replaceWithText); }, [replaceWithText]);
    useEffect(() => { safeSetLocalStorage('idblock_textToAdd', textToAdd); }, [textToAdd]);
    useEffect(() => { safeSetLocalStorage('idblock_addPosition', addPosition); }, [addPosition]);
    useEffect(() => { safeSetLocalStorage('idblock_addPositionOffset', addPositionOffset); }, [addPositionOffset]);
    useEffect(() => { safeSetLocalStorage('idblock_invertAddTextCondition', invertAddTextCondition); }, [invertAddTextCondition]);

    useEffect(() => { safeSetLocalStorage('idblock_inputText', inputText); }, [inputText]);
    useEffect(() => { safeSetLocalStorage('idblock_inputFileName', inputFileName); }, [inputFileName]);
    useEffect(() => { safeSetLocalStorage('idblock_keywordsText', keywordsText); }, [keywordsText]);
    useEffect(() => { safeSetLocalStorage('idblock_blockStartFormat', blockStartFormat); }, [blockStartFormat]);
    useEffect(() => { safeSetLocalStorage('idblock_applyToBlock', applyToBlock); }, [applyToBlock]);
    useEffect(() => { safeSetLocalStorage('idblock_sourceKey', sourceKey); }, [sourceKey]);
    useEffect(() => { safeSetLocalStorage('idblock_condition', condition); }, [condition]);
    useEffect(() => { safeSetLocalStorage('idblock_includeIndentation', includeIndentation); }, [includeIndentation]);
    useEffect(() => { safeSetLocalStorage('idblock_conditionValue', conditionValue); }, [conditionValue]);
    useEffect(() => { safeSetLocalStorage('idblock_targetKey', targetKey); }, [targetKey]);
    useEffect(() => { safeSetLocalStorage('idblock_operation', operation); }, [operation]);
    useEffect(() => { safeSetLocalStorage('idblock_operationValue', operationValue); }, [operationValue]);
    useEffect(() => { safeSetLocalStorage('idblock_roundDecimals', roundDecimals); }, [roundDecimals]);
    useEffect(() => { safeSetLocalStorage('idblock_autoExtendConfig', autoExtendConfig); }, [autoExtendConfig]);
    useEffect(() => { safeSetLocalStorage('idblock_autoExtendData', autoExtendData); }, [autoExtendData]);
    useEffect(() => { safeSetLocalStorage('idblock_isOutputEditable', isOutputEditable); }, [isOutputEditable]);


    useEffect(() => {
        if (!applyToBlock) {
            setTargetKey(sourceKey);
        }
    }, [sourceKey, applyToBlock]);

    const executeProcess = useCallback(() => {
        setIsProcessing(true);
        setOutputText('');

        const workerBlob = new Blob([idBlockTransformerScript], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(workerBlob);
        const worker = new Worker(workerUrl);

        worker.onmessage = (e) => {
            if(e.data.success) {
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
            blockStartFormat,
            applyToBlock,
            includeIndentation,
            sourceKey,
            condition,
            conditionValue: parseFloat(conditionValue),
            targetKey,
            operation,
            operationValue: parseFloat(operationValue),
            roundDecimals,
            mode,
            replaceWithText,
            textToAdd,
            addPosition,
            addPositionOffset,
            invertAddTextCondition
        });

    }, [inputText, keywordsText, blockStartFormat, applyToBlock, includeIndentation, sourceKey, condition, conditionValue, targetKey, operation, operationValue, roundDecimals, mode, replaceWithText, textToAdd, addPosition, addPositionOffset, invertAddTextCondition]);

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
            setInputText(event.target?.result as string);
            setInputFileName(file.name);
        };
        reader.readAsText(file);
    };
    
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) readFile(e.target.files[0]);
    };

    const isProcessButtonDisabled = isProcessing || !inputText.trim() || !keywordsText.trim() || 
        (mode === 'transform' && (!sourceKey.trim() || (applyToBlock && !targetKey.trim()) || (condition !== 'none' && isNaN(parseFloat(conditionValue))) || isNaN(parseFloat(operationValue)))) ||
        (mode === 'addText' && !textToAdd.trim());

    const calculatedIndentation = useMemo(() => {
        const match = blockStartFormat.match(/^(\s*)/);
        return match ? match[1].length : 0;
    }, [blockStartFormat]);

    return (
        <div className="w-full bg-gray-800 rounded-lg shadow-2xl p-4 sm:p-6 border border-gray-700 flex flex-col flex-grow min-h-0">
            <div className="flex-shrink-0 mb-6 p-3 sm:p-4 border border-gray-700 rounded-lg bg-gray-800">
                <div className="flex items-center space-x-2 mb-3">
                    <h2 className="text-xl font-bold text-white">{`{ID}`} Block Processor</h2>
                    <Tooltip text="Find specific blocks using a list of IDs and process them (transform values, remove, maintain, or add text)." />
                    
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
                <ExpandableDescription title="Isolate blocks by their IDs to transform values, remove them, or add new text.">
                        <p>
                            This tool isolates specific data blocks by matching their IDs. You can perform mathematical transformations on values within those blocks, entirely remove them, keep exclusively the matched blocks, or inject new text into them.
                        </p>
                        <p className="mt-2 text-indigo-300 font-medium">
                            <span className="font-bold underline">Important:</span> A block starts when its "Block Start Format" is found. The block encompasses ALL text until the very next occurrence of the "Block Start Format" (regardless of indentation).
                        </p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li><strong>Target IDs:</strong> List the Block IDs you want to target (one per line).</li>
                            <li><strong>Block Start Format:</strong> Define how the ID appears. Use <code>{`{ID}`}</code> as a placeholder for the ID (e.g., <code>[{`{ID}`}] = {`{`}</code>).</li>
                            <li><strong>Operation Mode:</strong> Choose between Transform Values, Remove, Maintain, or Add Text.</li>
                        </ul>
                        <p className="pt-2 text-gray-300"><strong>Example:</strong> Target IDs "1001", "1002". Increase "HP:" by 100 only when their "Level:" is &gt; 10. Or remove blocks 1001 and 1002 entirely.</p>
                </ExpandableDescription>

                <div className="space-y-4">
                    {mode === 'transform' && (
                        <div className="flex items-center space-x-2 p-2 rounded-md bg-gray-900/50">
                            <input
                                type="checkbox"
                                id="apply-to-block"
                                checked={applyToBlock}
                                onChange={(e) => setApplyToBlock(e.target.checked)}
                                className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <label htmlFor="apply-to-block" className="text-sm font-medium text-gray-200 cursor-pointer">
                                Apply a calculation to a target key only if a condition is met within the same data block
                            </label>
                            <Tooltip text="Enable to conditionally modify a DIFFERENT key (Target Key) based on the Source Key's value. If disabled, transformations are applied directly to the Source Key." />
                        </div>
                    )}

                    <div className={`grid grid-cols-1 md:grid-cols-2 ${mode === 'transform' ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-4`}>
                        {/* Targeting Configuration */}
                        <div className="space-y-4 p-3 rounded-md border border-gray-700">
                             <div>
                                <div className="flex items-center space-x-2 mb-1">
                                    <label htmlFor="keywords-text" className="block text-sm font-medium text-gray-300">
                                        Target IDs / Keywords
                                    </label>
                                    <Tooltip text="List of specific Block IDs you want to target, separated by line breaks. Only the blocks matching these IDs will be processed." />
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
                                <ResizablePanel baseHeight="120px" autoExtend={autoExtendConfig} className="flex-1 min-h-0 border bg-[#101828] border-gray-600 rounded-md shadow-sm">
                                    <CodeEditor
                                        value={keywordsText}
                                        onChange={(val) => setKeywordsText(val)}
                                        placeholder={"e.g.\n22526\n22527"}
                                        autoExtend={autoExtendConfig}
                                    />
                                </ResizablePanel>
                            </div>
                            <div>
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-2">
                                    <div className="flex items-center space-x-2">
                                        <label htmlFor="block-format" className="block text-sm font-medium text-gray-300">Block Start Format</label>
                                        <Tooltip text="How the ID appears at the start of a block. Use {ID} to represent the keyword." />
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            id="include-indentation"
                                            checked={includeIndentation}
                                            onChange={(e) => setIncludeIndentation(e.target.checked)}
                                            className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                        <label htmlFor="include-indentation" className="text-sm text-gray-300 cursor-pointer">Include Indentation</label>
                                        <Tooltip text="If checked, the exact leading spaces of the Block Start Format must match the line's indentation. Any lines underneath with greater indentation are considered part of the block." />
                                    </div>
                                </div>
                                <input type="text" id="block-format" value={blockStartFormat} onChange={(e) => setBlockStartFormat(e.target.value)} placeholder="e.g. [{ID}] = {" className="w-full bg-gray-900 text-gray-300 placeholder:text-gray-500 border border-gray-600 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                                {includeIndentation && (
                                    <p className="mt-1 text-sm font-semibold text-indigo-400">Indentation = {calculatedIndentation}</p>
                                )}
                                <div role="radiogroup" aria-labelledby="mode-label" className="flex flex-row flex-wrap items-center space-x-4 mt-4">
                                   <div className="flex items-center space-x-2">
                                        <span id="mode-label" className="text-sm font-medium text-gray-300">Operation Mode:</span>
                                        <Tooltip text="- Transform: applies mathematical operations to keys. Isolates transformations to ONLY apply within the targeted block.
- Remove: completely deletes matching blocks (from the Block Start Format until the very next occurrence of the format).
- Maintain: exclusively keeps the blocks that match the provided Target IDs. Un-matched blocks are removed.
- Add Text: appends custom text to matching blocks." />
                                   </div>
                                   <div className="flex flex-wrap items-center gap-x-4">
                                        <label title="Applies mathematical operations to specific keys within the targeted blocks." className="flex items-center space-x-2 text-gray-300 cursor-pointer">
                                            <input type="radio" name="mode" value="transform" checked={mode === 'transform'} onChange={() => setMode('transform')} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                                            <span>Transform Values</span>
                                        </label>
                                        <label title="Deletes or replaces the blocks that match the provided Target IDs." className="flex items-center space-x-2 text-gray-300 cursor-pointer">
                                            <input type="radio" name="mode" value="remove" checked={mode === 'remove'} onChange={() => setMode('remove')} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                                            <span>Remove</span>
                                        </label>
                                        <label title="Keeps ONLY the blocks that match the provided Target IDs, and removes or replaces all other blocks." className="flex items-center space-x-2 text-gray-300 cursor-pointer">
                                            <input type="radio" name="mode" value="maintain" checked={mode === 'maintain'} onChange={() => setMode('maintain')} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                                            <span>Maintain</span>
                                        </label>
                                        <label title="Inserts custom text at the start or end of the targeted blocks." className="flex items-center space-x-2 text-gray-300 cursor-pointer">
                                            <input type="radio" name="mode" value="addText" checked={mode === 'addText'} onChange={() => setMode('addText')} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                                            <span>Add Text</span>
                                        </label>
                                   </div>
                                </div>
                            </div>
                        </div>

                        {mode === 'transform' && (
                            <>
                                {/* Condition Configuration */}
                                <div className="space-y-4 p-3 rounded-md border border-gray-700">
                                     <div>
                                        <div className="flex items-center space-x-2">
                                            <label htmlFor="source-key" className="block text-sm font-medium text-gray-300 mb-1">Source / Condition Key</label>
                                            <Tooltip text="The key to modify, or use for condition checking. Example: 'Base Level '" />
                                        </div>
                                        <input type="text" id="source-key" value={sourceKey} onChange={(e) => setSourceKey(e.target.value)} placeholder="e.g., Base Level " className="w-full bg-gray-900 text-gray-300 placeholder:text-gray-500 border border-gray-600 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                                    </div>
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <label htmlFor="condition" className="block text-sm font-medium text-gray-300 mb-1">Condition</label>
                                            <Tooltip text="The condition that the Source Key's value must meet for the transformation to occur." />
                                        </div>
                                        <select id="condition" value={condition} onChange={(e) => setCondition(e.target.value as Condition)} className="w-full bg-gray-900 text-gray-300 border border-gray-600 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                                            <option value="none">None</option>
                                            <option value="<">Less than (&lt;)</option>
                                            <option value="=">Equal to (=)</option>
                                            <option value=">">Greater than (&gt;)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <label htmlFor="condition-value" className="block text-sm font-medium text-gray-300 mb-1">Condition Value</label>
                                            <Tooltip text="Value to check against." />
                                        </div>
                                        <input type="number" id="condition-value" value={conditionValue} onChange={(e) => setConditionValue(e.target.value)} disabled={condition === 'none'} placeholder="e.g., 150" className="w-full bg-gray-900 text-gray-300 placeholder:text-gray-500 border border-gray-600 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-700 disabled:opacity-50" />
                                    </div>
                                </div>

                                {/* Operation Configuration */}
                                <div className="space-y-4 p-3 rounded-md border border-gray-700">
                                     <div>
                                        <div className="flex items-center space-x-2">
                                            <label htmlFor="target-key" className="block text-sm font-medium text-gray-300 mb-1">Target Key</label>
                                            <Tooltip text="The line identifier whose value will be changed instead of the Source Key. Example: 'HP: '" />
                                        </div>
                                        <input type="text" id="target-key" value={targetKey} onChange={(e) => setTargetKey(e.target.value)} disabled={!applyToBlock} placeholder="e.g., HP: " className="w-full bg-gray-900 text-gray-300 placeholder:text-gray-500 border border-gray-600 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-700 disabled:opacity-50" />
                                    </div>
                                     <div>
                                        <div className="flex items-center space-x-2 mb-1">
                                            <label htmlFor="operation" className="block text-sm font-medium text-gray-300">Operation</label>
                                            <Tooltip text="Select the mathematical operation to apply to the Target Key's value (e.g., increase or multiply by the operation value)." />
                                        </div>
                                        <select id="operation" value={operation} onChange={(e) => setOperation(e.target.value as Operation)} className="w-full bg-gray-900 text-gray-300 border border-gray-600 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                                            <option value="fixed">Change to Fixed Value</option>
                                            <option value="increase">Increase by Fixed Value</option>
                                            <option value="decrease">Decrease by Fixed Value</option>
                                            <option value="multiply">Multiplier</option>
                                            <option value="divide">Divider</option>
                                        </select>
                                    </div>
                                     <div>
                                        <div className="flex items-center space-x-2 mb-1">
                                            <label htmlFor="operation-value" className="block text-sm font-medium text-gray-300">Operation Value</label>
                                            <Tooltip text="The numerical value to use for the selected operation." />
                                        </div>
                                        <input type="number" id="operation-value" value={operationValue} onChange={(e) => setOperationValue(e.target.value)} step="0.1" placeholder="e.g., 1.5" className="w-full bg-gray-900 text-gray-300 placeholder:text-gray-500 border border-gray-600 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                                    </div>
                                    {(operation === 'multiply' || operation === 'divide') && (
                                        <div className="flex items-center space-x-2 mt-4">
                                            <input
                                                type="checkbox"
                                                id="round-decimals"
                                                checked={roundDecimals}
                                                onChange={(e) => setRoundDecimals(e.target.checked)}
                                                className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            />
                                            <label htmlFor="round-decimals" className="text-sm font-medium text-gray-200 cursor-pointer">
                                                Round decimals
                                            </label>
                                            <Tooltip text="Check this to round the resulting calculation to the nearest whole number." />
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                        {(mode === 'remove' || mode === 'maintain') && (
                            <div className="space-y-4 p-3 rounded-md border border-gray-700">
                                <div>
                                    <div className="flex items-center space-x-2 mb-1">
                                        <label htmlFor="replace-with" className="block text-sm font-medium text-gray-300">Replace With (Optional)</label>
                                        <Tooltip text={`Leave empty to completely remove the block.
If text is provided, the matched block will be replaced with this exact text. The text will automatically inherit the block's base indentation.
Example: 
Insert line one
  Insert line two`} />
                                    </div>
                                    <ResizablePanel baseHeight="120px" autoExtend={autoExtendConfig} className="flex-1 min-h-0 border bg-[#101828] border-gray-600 rounded-md shadow-sm">
                                        <CodeEditor 
                                            value={replaceWithText} 
                                            onChange={(val) => setReplaceWithText(val)} 
                                            placeholder={"e.g.\nInsert line one\n  Insert line two"} 
                                            autoExtend={autoExtendConfig}
                                        />
                                    </ResizablePanel>
                                </div>
                            </div>
                        )}
                        {mode === 'addText' && (
                            <div className="space-y-4 p-3 rounded-md border border-gray-700">
                                <div className="flex flex-col space-y-4">
                                    <div>
                                        <div className="flex items-center space-x-2 mb-1">
                                            <label htmlFor="text-to-add" className="block text-sm font-medium text-gray-300">Text to Add</label>
                                            <Tooltip text="Enter the exact text you want to insert.
The tool automatically adds the block's base indentation to your text. Any additional indentation must be typed manually.
Example:   Is_MVP: true" />
                                        </div>
                                        <ResizablePanel baseHeight="120px" autoExtend={autoExtendConfig} className="flex-1 min-h-0 border bg-[#101828] border-gray-600 rounded-md shadow-sm">
                                            <CodeEditor 
                                                value={textToAdd} 
                                                onChange={(val) => setTextToAdd(val)} 
                                                placeholder={"e.g.\n  Is_MVP: true"} 
                                                autoExtend={autoExtendConfig}
                                            />
                                        </ResizablePanel>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-6">
                                        <div className="flex items-center gap-2">
                                            <label className="text-sm font-medium text-gray-300">Add Position:</label>
                                            <Tooltip text="Where to insert the text relative to the block. You can optionally add a line offset to insert it further inside the block." />
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input type="radio" name="addPosition" value="start" checked={addPosition === 'start'} onChange={() => setAddPosition('start')} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                                                <span className="text-sm text-gray-300">Start of block</span>
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
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input type="radio" name="addPosition" value="end" checked={addPosition === 'end'} onChange={() => setAddPosition('end')} className="h-4 w-4 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                                                <span className="text-sm text-gray-300">End of block</span>
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
                                    <div className="flex items-center space-x-2 pt-2 border-t border-gray-700">
                                         <input
                                            type="checkbox"
                                            id="invert-add-condition"
                                            checked={invertAddTextCondition}
                                            onChange={(e) => setInvertAddTextCondition(e.target.checked)}
                                            className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                         />
                                         <label htmlFor="invert-add-condition" className="text-sm text-gray-300 cursor-pointer">
                                             Invert match condition
                                         </label>
                                         <Tooltip text="If checked, text will be added ONLY to blocks that DO NOT match." />
                                    </div>
                                </div>
                            </div>
                        )}
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
                            <Tooltip text="If enabled, the Input Data and Processed Output text boxes will automatically expand their height to fit the content." />
                            <button onClick={() => fileInputRef.current?.click()} className="flex items-center px-3 py-1.5 border border-gray-600 text-xs font-medium rounded-md text-gray-200 bg-[#1e293b] hover:bg-[#334155] transition-all">
                                <UploadIcon className="h-4 w-4 mr-2" /> Upload File
                            </button>
                        </div>
                        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept=".txt,.yaml,.yml,.conf,text/plain" />
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
            
            <div className="flex-shrink-0 mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button onClick={handleProcess} disabled={isProcessButtonDisabled} className="w-full sm:w-auto flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                    {isProcessing ? <><LoadingSpinner/>Processing...</> : <><ProcessIcon/>Process Data</>}
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

export default IDBlockTransformerPage;
