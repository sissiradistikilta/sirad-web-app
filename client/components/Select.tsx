import React from "react";

import { Option } from "../types";

import "./Select.css";

interface Props {
  disabled?: boolean;
  id: string;
  onChange: (value: string) => void;
  options: Option[];
  selected?: string;
  title: string;
}

function Select(props: Props) {
  const { disabled, id, onChange, options, selected, title } = props;

  return (
    <div className="Select">
      <label htmlFor={id}>{title}:</label>
      <select disabled={disabled} id={id} value={selected} onChange={(event) => onChange(event.currentTarget.value)}>
        {options.map(({ label, value }) => (
          <option key={`${id}-${value}`} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default Select;
