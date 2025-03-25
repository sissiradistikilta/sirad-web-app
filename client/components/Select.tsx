import React from "react";

import { Option } from "../types";

import "./Select.css";

interface Props {
  id: string;
  onChange: (value: string) => void;
  options: Option[];
  selected?: string;
  title: string;
}

function Select(props: Props) {
  const { id, onChange, options, selected, title } = props;

  return (
    <div className="Select">
      <label htmlFor={id}>{title}:</label>
      <select id={id} value={selected} onChange={(event) => onChange(event.currentTarget.value)}>
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
