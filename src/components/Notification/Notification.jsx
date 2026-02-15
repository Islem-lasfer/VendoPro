import React, { useEffect, useRef } from 'react';
import './Notification.css';

const Notification = ({ message, type = 'info', onClose }) => {
  const okButtonRef = useRef(null);

  useEffect(() => {
    // Auto-focus the OK button
    if (okButtonRef.current) {
      okButtonRef.current.focus();
    }

    // Auto-close success messages after 6 seconds
    if (type === 'success') {
      const timer = setTimeout(() => {
        onClose();
      }, 6000);
      return () => clearTimeout(timer);
    }

    // Handle keyboard events
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [type, onClose]);

  return (
    <div className="notification-overlay" onClick={onClose}>
      <div className={`notification-box notification-${type}`} onClick={(e) => e.stopPropagation()}>
        <div className="notification-message">{message}</div>
        <button 
          ref={okButtonRef}
          className="notification-ok-btn" 
          onClick={onClose}
        >
          OK
        </button>
      </div>
    </div>
  );
};

export default Notification;
