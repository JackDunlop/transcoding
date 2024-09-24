import React from 'react';
import './Modal.css'; // You need to create this CSS file

export default function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null; // Do not render the modal if isOpen is false

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Optional close button */}
        <button className="modal-close-button" onClick={onClose}>×</button>
        {children}
      </div>
    </div>
  );
}