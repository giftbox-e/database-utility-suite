import React, { useMemo } from 'react';
import CodeMirror, { Extension } from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { EditorView } from '@codemirror/view';

interface CodeEditorProps {
    value: string;
    onChange?: (value: string) => void;
    editable?: boolean;
    placeholder?: string;
    className?: string;
    autoExtend?: boolean;
    extensions?: Extension[];
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ 
    value, 
    onChange, 
    editable = true, 
    placeholder, 
    className = '', 
    autoExtend = false,
    extensions = []
}) => {
    const customTheme = useMemo(() => EditorView.theme({
        "&": {
            backgroundColor: "transparent !important",
            color: "#e2e8f0 !important",
            display: "flex",
            flexDirection: "column",
            height: "100%"
        },
        ".cm-content": { paddingTop: "8px", paddingBottom: "8px", minHeight: "100%" },
        ".cm-scroller": { fontFamily: "inherit", fontSize: "14px", lineHeight: "22px", overflow: "auto", backgroundColor: "transparent !important", height: "100%" },
        ".cm-gutters": { 
            backgroundColor: "#101828 !important", 
            color: "#64748b !important",
            borderRight: "1px solid #374151 !important",
        },
        ".cm-activeLine": {
            backgroundColor: "rgba(255, 255, 255, 0.05) !important"
        },
        ".cm-activeLineGutter": {
            backgroundColor: "rgba(255, 255, 255, 0.05) !important"
        },
        ".cm-line": { padding: "0 4px" },
        "&.cm-editor.cm-focused": { outline: "none" }
    }, { dark: true }), [autoExtend]);

    return (
        <CodeMirror
            theme="dark"
            value={value}
            onChange={onChange}
            editable={editable}
            placeholder={placeholder}
            height={autoExtend ? "auto" : "100%"}
            extensions={[...extensions, yaml(), customTheme]}
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
            className={`min-w-0 text-sm flex flex-col ${autoExtend ? 'flex-grow min-h-0' : 'absolute inset-0 h-full w-full'} ${className}`}
            style={{ backgroundColor: '#101828' }}
        />
    );
};
