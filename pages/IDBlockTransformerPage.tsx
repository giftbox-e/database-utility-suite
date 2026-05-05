import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { idBlockTransformerScript } from '../workers/idBlockTransformerScript';
import { CopyIcon, DownloadIcon, ProcessIcon, UploadIcon, LoadingSpinner } from '../components/Icons';
import { Tooltip } from '../components/Tooltip';
import { ExpandableDescription } from '../components/ExpandableDescription';
import { useSyncedResize } from '../hooks/useSyncedResize';

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
    const [isDragging, setIsDragging] = useState(false);
    
    const { leftRef, rightRef } = useSyncedResize();
    
    const [keywordsText, setKeywordsText] = useState<string>(() => getInitialState('idblock_keywordsText', ''));
    const [blockStartFormat, setBlockStartFormat] = useState<string>(() => getInitialState('idblock_blockStartFormat', '[{ID}] = {'));
    
    const [applyToBlock, setApplyToBlock] = useState<boolean>(() => getInitialState('idblock_applyToBlock', false));
    const [sourceKey, setSourceKey] = useState<string>(() => getInitialState('idblock_sourceKey', ''));
    const [condition, setCondition] = useState<Condition>(() => getInitialState('idblock_condition', 'none'));
    const [includeIndentation, setIncludeIndentation] = useState<boolean>(() => getInitialState('idblock_includeIndentation', false));
    const [conditionValue, setConditionValue] = useState<string>(() => getInitialState('idblock_conditionValue', ''));
    const [targetKey, setTargetKey] = useState<string>(() => getInitialState('idblock_targetKey', ''));
    const [operation, setOperation] = useState<Operation>(() => getInitialState('idblock_operation', 'fixed'));
    const [operationValue, setOperationValue] = useState<string>(() => getInitialState('idblock_operationValue', ''));
    const [roundDecimals, setRoundDecimals] = useState<boolean>(() => getInitialState('idblock_roundDecimals', false));

    useEffect(() => { localStorage.setItem('idblock_inputText', JSON.stringify(inputText)); }, [inputText]);
    useEffect(() => { localStorage.setItem('idblock_inputFileName', JSON.stringify(inputFileName)); }, [inputFileName]);
    useEffect(() => { localStorage.setItem('idblock_keywordsText', JSON.stringify(keywordsText)); }, [keywordsText]);
    useEffect(() => { localStorage.setItem('idblock_blockStartFormat', JSON.stringify(blockStartFormat)); }, [blockStartFormat]);
    useEffect(() => { localStorage.setItem('idblock_applyToBlock', JSON.stringify(applyToBlock)); }, [applyToBlock]);
    useEffect(() => { localStorage.setItem('idblock_sourceKey', JSON.stringify(sourceKey)); }, [sourceKey]);
    useEffect(() => { localStorage.setItem('idblock_condition', JSON.stringify(condition)); }, [condition]);
    useEffect(() => { localStorage.setItem('idblock_includeIndentation', JSON.stringify(includeIndentation)); }, [includeIndentation]);
    useEffect(() => { localStorage.setItem('idblock_conditionValue', JSON.stringify(conditionValue)); }, [conditionValue]);
    useEffect(() => { localStorage.setItem('idblock_targetKey', JSON.stringify(targetKey)); }, [targetKey]);
    useEffect(() => { localStorage.setItem('idblock_operation', JSON.stringify(operation)); }, [operation]);
    useEffect(() => { localStorage.setItem('idblock_operationValue', JSON.stringify(operationValue)); }, [operationValue]);
    useEffect(() => { localStorage.setItem('idblock_roundDecimals', JSON.stringify(roundDecimals)); }, [roundDecimals]);

    useEffect(() => {
        if (!applyToBlock) {
            setTargetKey(sourceKey);
        }
    }, [sourceKey, applyToBlock]);

    const handleProcess = useCallback(() => {
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
            roundDecimals
        });

    }, [inputText, keywordsText, blockStartFormat, applyToBlock, includeIndentation, sourceKey, condition, conditionValue, targetKey, operation, operationValue, roundDecimals]);

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

    const isProcessButtonDisabled = isProcessing || !inputText.trim() || !keywordsText.trim() || !sourceKey.trim() || (applyToBlock && !targetKey.trim()) || 
        (condition !== 'none' && isNaN(parseFloat(conditionValue))) || isNaN(parseFloat(operationValue));

    const calculatedIndentation = useMemo(() => {
        const match = blockStartFormat.match(/^(\s*)/);
        return match ? match[1].length : 0;
    }, [blockStartFormat]);

    return (
        <div className="bg-gray-800 rounded-lg shadow-2xl p-4 sm:p-6 border border-gray-700 flex flex-col flex-grow min-h-max">
            <div className="flex-shrink-0 mb-6 p-3 sm:p-4 border border-gray-700 rounded-lg bg-gray-800">
                <div className="flex items-center space-x-2 mb-3">
                    <h2 className="text-xl font-bold text-white">ID Block Transformer</h2>
                    <Tooltip text="Find specific blocks using a list of IDs and transform values inside them." />
                </div>
                <ExpandableDescription title="Isolate blocks by their IDs to calculate target values.">
                        <p>
                            This tool allows you to isolate specific data blocks by their IDs and apply a calculated transformation exclusively within those blocks. Perfect for updating levels, stats, or values in specific YAML/JSON blocks without affecting the rest of the file.
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Target IDs:</strong> List the Block IDs you want to target (one per line).</li>
                            <li><strong>Source / Condition Key:</strong> The line identifier you want to modify (or check conditions against).</li>
                            <li><strong>Target Key:</strong> (Only if enabled) Instead of modifying the Source Key, modify this different key inside the same block when the condition is met.</li>
                        </ul>
                        <p className="pt-2 text-gray-300"><strong>Example:</strong> Target IDs "1001", "1002". Increase "HP:" (Target Key) by 100 only when their "Level:" (Source Key) is &gt; 10.</p>
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
                        <Tooltip text="Enable to conditionally modify a DIFFERENT key (Target Key) based on the Source Key's value. If disabled, transformations are applied directly to the Source Key." />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Targeting Configuration */}
                        <div className="space-y-4 p-3 rounded-md border border-gray-700">
                             <div>
                                <div className="flex items-center space-x-2 mb-1">
                                    <label htmlFor="keywords-text" className="block text-sm font-medium text-gray-300">
                                        Target IDs / Keywords
                                    </label>
                                    <Tooltip text="List of specific Block IDs you want to target, separated by line breaks. Only the blocks matching these IDs will be processed." />
                                </div>
                                <textarea
                                    id="keywords-text"
                                    value={keywordsText}
                                    onChange={(e) => setKeywordsText(e.target.value)}
                                    placeholder="e.g.&#10;22526&#10;22527"
                                    className="w-full bg-gray-900 text-gray-300 placeholder:text-gray-500 border border-gray-600 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 h-24 resize-y"
                                />
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
                            </div>
                        </div>

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
                                <input type="number" id="operation-value" value={operationValue} onChange={(e) => setOperationValue(e.target.value)} step="0.1" placeholder="e.g., 100" className="w-full bg-gray-900 text-gray-300 placeholder:text-gray-500 border border-gray-600 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
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
                        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept=".txt,.yaml,.yml,.conf,text/plain" />
                    </div>
                        <textarea 
                            ref={leftRef}
                            id="input-text" 
                            value={inputText} 
                            onChange={(e) => setInputText(e.target.value)} 
                            placeholder="Drag & drop a file, or paste your database content here..." 
                            className={`flex-grow w-full bg-gray-900 text-gray-300 placeholder:text-gray-500 border rounded-md shadow-sm p-4 font-mono text-sm focus:ring-2 focus:ring-indigo-500 transition-all resize-y ${isDragging ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-600'}`} 
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
                </div>
                <div className="flex-1 flex flex-col min-w-[200px]">
                     <label htmlFor="output-text" className="flex-shrink-0 block text-sm font-medium text-gray-300 mb-2">Processed Output</label>
                    <textarea ref={rightRef} id="output-text" value={outputText} readOnly placeholder="Result will appear here after processing..." className="flex-grow w-full bg-gray-900 text-gray-300 placeholder:text-gray-500 border border-gray-600 rounded-md shadow-sm p-4 font-mono text-sm resize-y" spellCheck="false" />
                </div>
            </div>
            
            <div className="flex-shrink-0 mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
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

export default IDBlockTransformerPage;
