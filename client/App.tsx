import React, { useCallback, useMemo, useState } from "react";

import { ConnectionStatus, Tabs } from "./components";
import { useApiConnection } from "./hooks";
import { Live, Receive, Send } from "./views";

import "./App.css";

const MODES = [
  { label: "Vastaanotto", value: "vastaanotto" },
  { label: "Anto", value: "anto" },
  { label: "Live", value: "live" }
];

interface Props {
  /** Whether live keying is in use. Without it there is no Live mode and no connection to the backend. */
  live?: boolean;
}

/** The mode is kept in the address (#anto), so that it survives a reload and can be linked to. */
const getMode = (modes: typeof MODES) =>
  modes.find(({ value }) => `#${value}` === window.location.hash)?.value ?? modes[0].value;

function App({ live = __LIVE_ENABLED__ }: Props) {
  const modes = useMemo(() => MODES.filter(({ value }) => live || value !== "live"), [live]);
  const [selected, setMode] = useState(() => getMode(modes));
  // A mode that is not in use is not shown, even if it was selected
  const mode = modes.some(({ value }) => value === selected) ? selected : modes[0].value;
  const api = useApiConnection(live ? __API_URL__ : "");
  const { connected } = api;

  const selectMode = useCallback((value: string) => {
    window.history.replaceState(null, "", value === MODES[0].value ? window.location.pathname : `#${value}`);
    setMode(value);
  }, []);

  return (
    <div className="App">
      <h1>
        SiRad Web
        {connected !== null && <ConnectionStatus connected={connected} />}
      </h1>
      <p>Harjoittele sähkötystä tietokoneellasi tai puhelimellasi.</p>
      <Tabs label="Harjoitus" onChange={selectMode} options={modes} selected={mode} />
      {mode === "anto" ? <Send /> : mode === "live" ? <Live api={api} /> : <Receive />}
    </div>
  );
}

export default App;
