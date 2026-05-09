import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { safeSetLocalStorage } from '../lib/storage';
import { transformerWorkerScript } from '../workers/transformerScript';
import { CopyIcon, DownloadIcon, ProcessIcon, UploadIcon, LoadingSpinner } from '../components/Icons';
import { Tooltip } from '../components/Tooltip';
import { ExpandableDescription } from '../components/ExpandableDescription';
import { useSyncedResize } from '../hooks/useSyncedResize';
import { CodeEditor } from '../components/CodeEditor';

type Condition = 'none' | '<' | '=' | '>';
type Operation = 'fixed' | 'increase' | 'decrease' | 'multiply' | 'divide';

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

const TransformerPage: React.FC = () => {
    const [inputText, setInputText] = useState<string>(() => getInitialState('transformer_inputText', ''));
    const [inputFileName, setInputFileName] = useState<string>(() => getInitialState('transformer_inputFileName', 'transformed_database.txt'));
    const [outputText, setOutputText] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [copyStatus, setCopyStatus] = useState<string>('Copy Output');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    
    const { leftRef, rightRef, isManuallyResized } = useSyncedResize();
    
    const [applyToBlock, setApplyToBlock] = useState<boolean>(() => getInitialState('transformer_applyToBlock', false));
    const [sourceKey, setSourceKey] = useState<string>(() => getInitialState('transformer_sourceKey', ''));
    const [includeString, setIncludeString] = useState<boolean>(() => getInitialState('transformer_includeString', true));
    const [condition, setCondition] = useState<Condition>(() => getInitialState('transformer_condition', 'none'));
    const [conditionValue, setConditionValue] = useState<string>(() => getInitialState('transformer_conditionValue', ''));
    const [targetKey, setTargetKey] = useState<string>(() => getInitialState('transformer_targetKey', ''));
    const [operation, setOperation] = useState<Operation>(() => getInitialState('transformer_operation', 'multiply'));
    const [operationValue, setOperationValue] = useState<string>(() => getInitialState('transformer_operationValue', ''));
    const [roundDecimals, setRoundDecimals] = useState<boolean>(() => getInitialState('transformer_roundDecimals', false));
    const [autoExtendData, setAutoExtendData] = useState<boolean>(() => getInitialState('transformer_autoExtendData', false));

    // --- State Persistence Effects ---
    useEffect(() => { safeSetLocalStorage('transformer_inputText', inputText); }, [inputText]);
    useEffect(() => { safeSetLocalStorage('transformer_inputFileName', inputFileName); }, [inputFileName]);
    useEffect(() => { safeSetLocalStorage('transformer_applyToBlock', applyToBlock); }, [applyToBlock]);
    useEffect(() => { safeSetLocalStorage('transformer_sourceKey', sourceKey); }, [sourceKey]);
    useEffect(() => { safeSetLocalStorage('transformer_includeString', includeString); }, [includeString]);
    useEffect(() => { safeSetLocalStorage('transformer_condition', condition); }, [condition]);
    useEffect(() => { safeSetLocalStorage('transformer_conditionValue', conditionValue); }, [conditionValue]);
    useEffect(() => { safeSetLocalStorage('transformer_targetKey', targetKey); }, [targetKey]);
    useEffect(() => { safeSetLocalStorage('transformer_operation', operation); }, [operation]);
    useEffect(() => { safeSetLocalStorage('transformer_operationValue', operationValue); }, [operationValue]);
    useEffect(() => { safeSetLocalStorage('transformer_roundDecimals', roundDecimals); }, [roundDecimals]);
    useEffect(() => { safeSetLocalStorage('transformer_autoExtendData', autoExtendData); }, [autoExtendData]);

    const getWrapperStyle = (baseHeightOrAutoExtend: string | boolean, autoExtendParam?: boolean): React.CSSProperties => {
        const autoExtend = typeof baseHeightOrAutoExtend === 'boolean' ? baseHeightOrAutoExtend : (autoExtendParam || false);
        const baseHeight = typeof baseHeightOrAutoExtend === 'string' ? baseHeightOrAutoExtend : '120px';
        if (autoExtend) return { minHeight: baseHeight, flex: '1 1 auto', position: 'relative' };
        if (isManuallyResized) return { minHeight: baseHeight, flex: 'none', resize: 'vertical', overflow: 'hidden', position: 'relative' };
        return { minHeight: baseHeight, flex: '1 1 0%', resize: 'vertical', overflow: 'hidden', position: 'relative' };
    };


    const calculatedIndentation = useMemo(() => {
        if (!applyToBlock) return 0;
        const match = sourceKey.match(/^(\s*)/);
        return match ? match[1].length : 0;
    }, [sourceKey, applyToBlock]);

    // Sync target key with source key when not in block mode
    useEffect(() => {
        if (!applyToBlock) {
            setTargetKey(sourceKey);
        }
    }, [sourceKey, applyToBlock]);

    const handleProcess = useCallback(() => {
        setIsProcessing(true);
        setOutputText('');

        const workerBlob = new Blob([transformerWorkerScript], { type: 'application/javascript' });
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
            applyToBlock,
            sourceKey,
            includeString,
            condition,
            conditionValue: parseFloat(conditionValue),
            targetKey,
            operation,
            operationValue: parseFloat(operationValue),
            roundDecimals
        });

    }, [inputText, applyToBlock, sourceKey, includeString, condition, conditionValue, targetKey, operation, operationValue, roundDecimals]);

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

    const isProcessButtonDisabled = isProcessing || !inputText.trim() || !sourceKey.trim() || (applyToBlock && !targetKey.trim()) || 
        (condition !== 'none' && isNaN(parseFloat(conditionValue))) || isNaN(parseFloat(operationValue));

    return (
        <div className="w-full bg-gray-800 rounded-lg shadow-2xl p-4 sm:p-6 border border-gray-700 flex flex-col flex-grow min-h-0">
            <div className="flex-shrink-0 mb-6 p-3 sm:p-4 border border-gray-700 rounded-lg bg-gray-800">
                <div className="flex items-center space-x-2 mb-3">
                    <h2 className="text-xl font-bold text-white">Transformer</h2>
                    <Tooltip text={`Perform mathematical operations on specific keys.\nYou can conditionally filter which blocks get transformed using the Source Key.\nThis tool supports both basic line-by-line editing and indentation-based block editing.`} />
                    
                    <div className="ml-auto flex items-center">
                    </div>
                </div>

                <ExpandableDescription title="Modify numerical values based on conditions.">
                        <p>
                            Modify numerical values based on conditions, either line-by-line or within structured data blocks.
                            This tool can operate on an entire block of data (determined by indentation) or on individual lines.
                        </p>
                        <p className="mt-2 text-indigo-300 font-medium">
                            <span className="font-bold underline">Line-by-line Mode (Default):</span> Applies operations individually per line.
                            <br/><span className="font-bold underline">Block Mode (Apply to Block):</span> Modifies target keys inside a block if the block itself meets a condition based on the Source Key.
                            <br/><span className="font-bold underline">Important:</span> A block is defined by the first line containing the Source Key and continues until it encounters a line with indentation less than or equal to the starting line. The Start Key must be uniquely identifiable.
                        </p>
                        <ul className="list-disc pl-5 space-y-1 mt-2">
                            <li><strong>Source Key:</strong> The identifier to look for (e.g. <code>Level: </code>).</li>
                            <li><strong>Condition:</strong> Only change values when the source meets this condition.</li>
                            <li><strong>Target Key:</strong> (Only in Block mode) Instead of modifying the Source Key, modify this different key inside the same block when the condition is met.</li>
                            <li><strong>Operation:</strong> Set to a fixed value or perform math operations.</li>
                        </ul>
                        <p className="pt-2 text-gray-300"><strong>Example:</strong> Increase "HP: " (Target Key) by 100 on every block where "Class: " (Source Key) is equal to 5.</p>
                </ExpandableDescription>

                <div className="space-y-4">
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
                        <Tooltip text="Enable to process data in blocks based on indentation, ideal for structured data like YAML. If disabled, transformations are applied on a line-by-line basis." />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Column 1: Source & Condition */}
                        <div className="space-y-4 p-3 rounded-md border border-gray-700">
                             <div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <label htmlFor="source-key" className="block text-sm font-medium text-gray-300 mb-1">Source Key</label>
                                        <Tooltip text="The line identifier used to find the value for the condition check. Can also be the target for transformation if not in block mode. Example: 'Level: '" />
                                    </div>
                                    {applyToBlock && (
                                         <div className="flex items-center space-x-2">
                                            <Tooltip text="If checked, the text of the Source Key must match the start of a line (after indentation). If unchecked, only the indentation level is used to identify the start of a block." />
                                            <input type="checkbox" id="include-string" checked={includeString} onChange={(e) => setIncludeString(e.target.checked)} className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"/>
                                            <label htmlFor="include-string" className="text-xs text-gray-300 cursor-pointer whitespace-nowrap">Include String</label>
                                        </div>
                                    )}
                                </div>
                                <input type="text" id="source-key" value={sourceKey} onChange={(e) => setSourceKey(e.target.value)} placeholder="e.g., Level: " className="w-full bg-gray-900 text-gray-300 border border-gray-600 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                                {applyToBlock && <p className="mt-1 text-sm font-semibold text-indigo-400">Indentation = {calculatedIndentation}</p>}
                            </div>
                            <div>
                                <div className="flex items-center space-x-2">
                                    <label htmlFor="condition" className="block text-sm font-medium text-gray-300 mb-1">Condition</label>
                                    <Tooltip text="The condition that the Source Key's value must meet for the transformation to occur. Select 'None' to transform every match." />
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
                                    <Tooltip text="The numerical value to compare against the Source Key's value." />
                                </div>
                                <input type="number" id="condition-value" value={conditionValue} onChange={(e) => setConditionValue(e.target.value)} placeholder="e.g., 10" disabled={condition === 'none'} className="w-full bg-gray-900 text-gray-300 border border-gray-600 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-700 disabled:opacity-50" />
                            </div>
                        </div>

                        {/* Column 2: Target */}
                        <div className="space-y-4 p-3 rounded-md border border-gray-700">
                             <div>
                                <div className="flex items-center space-x-2">
                                    <label htmlFor="target-key" className="block text-sm font-medium text-gray-300 mb-1">Target Key</label>
                                    <Tooltip text="The line identifier whose value will be changed if the condition is met. When not in block mode, this is automatically the same as the Source Key." />
                                </div>
                                <input type="text" id="target-key" value={targetKey} onChange={(e) => setTargetKey(e.target.value)} placeholder="e.g., Attack: " disabled={!applyToBlock} className="w-full bg-gray-900 text-gray-300 border border-gray-600 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-700 disabled:opacity-50" />
                            </div>
                        </div>

                        {/* Column 3: Operation */}
                        <div className="space-y-4 p-3 rounded-md border border-gray-700">
                             <div>
                                <div className="flex items-center space-x-2">
                                    <label htmlFor="operation" className="block text-sm font-medium text-gray-300 mb-1">Operation</label>
                                    <Tooltip text={`- Fixed Value: Overwrite the target key's value entirely.\n- Increase/Decrease: Add or subtract a specific number from the original value.\n- Multipy/Divide: Scale the original value by a numerical factor.`} />
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
                                <div className="flex items-center space-x-2">
                                    <label htmlFor="operation-value" className="block text-sm font-medium text-gray-300 mb-1">Operation Value</label>
                                    <Tooltip text="The numerical value to use for the selected operation (e.g., the value to multiply by)." />
                                </div>
                                <input type="number" id="operation-value" value={operationValue} onChange={(e) => setOperationValue(e.target.value)} step="0.1" placeholder="e.g., 1.2" className="w-full bg-gray-900 text-gray-300 border border-gray-600 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                            </div>
                            {(operation === 'multiply' || operation === 'divide') && (
                                <div className="flex items-center space-x-2">
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
                                    <Tooltip text="If checked, the result of the calculation will be rounded to the nearest whole number." />
                                </div>
                            )}
                        </div>
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
                <button onClick={handleProcess} disabled={isProcessButtonDisabled} className="w-full sm:w-auto flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                    {isProcessing ? <><LoadingSpinner/>Processing...</> : <><ProcessIcon/>Transform Data</>}
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

export default TransformerPage;