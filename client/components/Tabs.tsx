import React from "react";

import { Option } from "../types";

import "./Tabs.css";

interface Props {
  /** What the tabs choose between, for a screen reader. */
  label: string;
  onChange: (value: string) => void;
  options: Option[];
  selected: string;
}

function Tabs(props: Props) {
  const { label, onChange, options, selected } = props;

  return (
    <div aria-label={label} className="Tabs" role="tablist">
      {options.map(({ label: text, value }) => (
        <button
          aria-selected={value === selected}
          className="Tabs-tab"
          key={`tab-${value}`}
          onClick={() => onChange(value)}
          role="tab"
          type="button"
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export default Tabs;
