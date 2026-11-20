import React, { useCallback, useEffect, useMemo, useState } from "react";

import { ConnectionOptions } from "./api/connection";
import { ConnectionSwitch, HfpSwitch, Tabs } from "./components";
import { canHoldMicrophone, useApiConnection, useMicrophoneHold } from "./hooks";
import { readConnectionPreference, writeConnectionPreference } from "./preferences";
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
  /** The start of the hash of the commit of the build, shown to tell the previews of pull requests apart. */
  commit?: string;
}

/** The mode is kept in the address (#anto), so that it survives a reload and can be linked to. */
const getMode = (modes: typeof MODES) =>
  modes.find(({ value }) => `#${value}` === window.location.hash)?.value ?? modes[0].value;

function App({ live = __LIVE_ENABLED__, apiUrl = __API_URL__, connection, commit = __COMMIT__ }: Props) {
  const modes = useMemo(() => MODES.filter(({ value }) => live || value !== "live"), [live]);
  const [selected, setMode] = useState(() => getMode(modes));
  // A mode that is not in use is not shown, even if it was selected
  const mode = modes.some(({ value }) => value === selected) ? selected : modes[0].value;
  // The connection to the backend is on unless the user switches it off
  const [online, setOnline] = useState(readConnectionPreference);
  const backend = live && Boolean(apiUrl);
  const api = useApiConnection(backend && online ? apiUrl : "", connection);

  // An experiment: reserving the microphone makes a Bluetooth headset use its mode for calls (HFP).
  // It is off each time the page is opened.
  const [hfp, setHfp] = useState(false);
  const microphone = useMicrophoneHold(hfp);

  const switchConnection = useCallback((on: boolean) => {
    writeConnectionPreference(on);
    setOnline(on);
  }, []);

  // The address does not keep pointing to a mode that is not in use, e.g. #live without live keying
  useEffect(() => {
    const { hash, pathname, search } = window.location;
    if (hash && !modes.some(({ value }) => `#${value}` === hash)) {
      window.history.replaceState(null, "", `${pathname}${search}`);
    }
  }, [modes]);

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
        <span className="App-indicators">
          {commit && (
            <span className="App-commit" title="Version commit">
              {commit}
            </span>
          )}
          {canHoldMicrophone() && (
            <HfpSwitch active={microphone.active} failed={microphone.error !== null} on={hfp} onChange={setHfp} />
          )}
          {backend && <ConnectionSwitch connected={api.connected === true} on={online} onChange={switchConnection} />}
        </span>
      </h1>
      <p>Harjoittele sähkötystä tietokoneellasi tai puhelimellasi.</p>
      <Tabs label="Harjoitus" onChange={selectMode} options={modes} selected={mode} />
      {mode === "anto" ? <Send /> : mode === "live" ? <Live api={api} off={backend && !online} /> : <Receive />}
    </div>
  );
}

export default App;
