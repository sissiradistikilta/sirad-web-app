import React, { useState, useRef, useEffect } from "react";

import { Option } from "../types";

import "./Select.css";

import Button from "./Button";

interface Props {
  id: string;
  onChange: (value: string) => void;
  options: Option[];
  selected?: string;
  title: string;
}

function Select(props: Props) {
  const { id, onChange, options, selected, title } = props;
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleSelect = (value: string) => {
    onChange(value);
    setOpen(false);
  };

  useEffect(() => {
    if (open && dropdownRef.current) {
      dropdownRef.current.scrollTop = 0;
    }
  }, [open]);

  return (
    <div className="Select" ref={containerRef}>
      <Button
        type="button"
        className="select-button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        lcd={options.find((o) => o.value === selected)?.shortLabel ?? ""}
      >
        {title}
        <span className={`lcd-arrow${open ? " open" : ""}`} aria-hidden="true">
          &#9654;
        </span>
      </Button>
      {open && (
        <div className="lcd-dropdown" role="listbox" ref={dropdownRef}>
          {options.map(({ label, value }) => (
            <div
              key={`${id}-${value}`}
              className={`lcd-option${selected === value ? " selected" : ""}`}
              onMouseDown={() => handleSelect(value)}
              tabIndex={-1}
              role="option"
              aria-selected={selected === value}
            >
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Select;
