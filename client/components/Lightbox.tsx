import React from "react";
import "./Lightbox.css";

interface LightboxProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
}

export default function Lightbox({ open, onClose, children, title }: LightboxProps) {
  if (!open) return null;
  return (
    <div className="LightboxOverlay" tabIndex={-1} onClick={onClose}>
      <div className="LightboxContent" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="Lightbox-close" aria-label="Sulje asetukset">
          ×
        </button>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
