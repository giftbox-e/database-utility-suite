import React from 'react';
import { Modal } from './Modal';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    cancelButtonClassName?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
    isOpen, onClose, onConfirm, title, message, confirmText = 'Yes', cancelText = 'No',
    cancelButtonClassName = "px-4 py-2 text-sm font-medium border border-transparent text-white rounded-md bg-red-600 hover:bg-red-700 transition-colors"
}) => {
    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={title}
            actions={
                <>
                    <button onClick={onClose} className={cancelButtonClassName}>
                        {cancelText}
                    </button>
                    <button onClick={() => { onConfirm(); onClose(); }} className="px-4 py-2 text-sm font-medium border border-transparent text-white rounded-md bg-indigo-600 hover:bg-indigo-700 transition-colors">
                        {confirmText}
                    </button>
                </>
            }
        >
            <p className="text-sm text-gray-300">{message}</p>
        </Modal>
    );
};
