
import React from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Konfirmasi',
  cancelText = 'Batal',
  isDestructive = false,
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 bg-black bg-opacity-40 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-8 shadow-xl max-w-sm w-full animate-in zoom-in-95 duration-300">
        <h3 className="text-2xl font-black text-slate-800 mb-4">{title}</h3>
        <p className="text-slate-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`px-6 py-3 rounded-xl text-white font-bold transition ${
              isDestructive ? 'bg-red-600 hover:bg-red-700 shadow-md shadow-red-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
