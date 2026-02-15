import React, { useEffect, useRef, useState } from 'react';
import './ConfirmDialog.css';

const ConfirmDialog = ({ message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel' }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const confirmButtonRef = useRef(null);

  useEffect(() => {
    // Auto-focus the confirm button
    if (confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }

    // Handle keyboard events
    const handleKeyDown = async (e) => {
      if (e.key === 'Enter' && !isProcessing) {
        e.preventDefault();
        e.stopPropagation();
        await handleConfirm();
      } else if (e.key === 'Escape' && !isProcessing) {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onCancel, isProcessing]);

  const handleConfirm = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await onConfirm();
    } catch (error) {
      console.error('Confirm dialog error:', error);
    }
    setIsProcessing(false);
  };

  return (
    <div className="confirm-overlay" onClick={!isProcessing ? onCancel : undefined}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-icon">⚠️</div>
        <div className="confirm-message">{message}</div>
        <div className="confirm-buttons">
          <button 
            className="confirm-cancel-btn" 
            onClick={onCancel}
            disabled={isProcessing}
          >
            {cancelText}
          </button>
          <button 
            ref={confirmButtonRef}
            className="confirm-ok-btn" 
            onClick={handleConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
