import React, { useCallback, useMemo, useState } from "react";

import { ConnectionOptions } from "./api/connection";
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
  /** The address of the backend, e.g. https://api.sirad.fi. */
  apiUrl?: string;
  /** The timing of the connection to the backend, if other than the default. */
  connection?: ConnectionOptions;
}

/** The mode is kept in the address (#anto), so that it survives a reload and can be linked to. */
const getMode = (modes: typeof MODES) =>
  modes.find(({ value }) => `#${value}` === window.location.hash)?.value ?? modes[0].value;

function App({ live = __LIVE_ENABLED__, apiUrl = __API_URL__, connection }: Props) {
  const modes = useMemo(() => MODES.filter(({ value }) => live || value !== "live"), [live]);
  const [selected, setMode] = useState(() => getMode(modes));
  // A mode that is not in use is not shown, even if it was selected
  const mode = modes.some(({ value }) => value === selected) ? selected : modes[0].value;
  const api = useApiConnection(live ? apiUrl : "", connection);
  const { connected } = api;

  const selectMode = useCallback(
    (value: string) => {
      // The address is built from the address of the page, not from a relative one: the page has a base
      // address (<base href="/">) that a relative address would be resolved against, and e.g. the preview
      // of a pull request (/pr-1/) would get the address of the main site.
      const { pathname, search } = window.location;
      window.history.replaceState(null, "", `${pathname}${search}${value === modes[0].value ? "" : `#${value}`}`);
      setMode(value);
    },
    [modes]
  );

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
