import React, { useCallback, useState } from "react";

import { Tabs } from "./components";
import { Receive, Send } from "./views";

import "./App.css";

const MODES = [
  { label: "Vastaanotto", value: "vastaanotto" },
  { label: "Anto", value: "anto" }
];

/** The mode is kept in the address (#anto), so that it survives a reload and can be linked to. */
const getMode = () => MODES.find(({ value }) => `#${value}` === window.location.hash)?.value ?? MODES[0].value;

function App() {
  const [mode, setMode] = useState(getMode);

  const selectMode = useCallback((value: string) => {
    window.history.replaceState(null, "", value === MODES[0].value ? window.location.pathname : `#${value}`);
    setMode(value);
  }, []);

  return (
    <div className="App">
      <h1>SiRad Web</h1>
      <p>Harjoittele sähkötystä tietokoneellasi tai puhelimellasi.</p>
      <Tabs label="Harjoitus" onChange={selectMode} options={MODES} selected={mode} />
      {mode === "anto" ? <Send /> : <Receive />}
    </div>
  );
}

export default App;
