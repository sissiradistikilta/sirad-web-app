import React from "react";

import "./ConnectionSwitch.css";

interface Props {
  /** Whether the user wants the connection to the backend. */
  on: boolean;
  /** Whether there is a connection at the moment. */
  connected: boolean;
  onChange: (on: boolean) => void;
}

const STATES = {
  connected: "Yhteys palvelimeen",
  disconnected: "Ei yhteyttä palvelimeen",
  off: "Yhteys palvelimeen on pois päältä"
};

/**
 * A switch for the connection to the backend, with a light in its knob: green when there is a connection,
 * red when there is not, and grey when the connection is switched off.
 */
function ConnectionSwitch({ on, connected, onChange }: Props) {
  const state = !on ? "off" : connected ? "connected" : "disconnected";

  return (
    <span className="ConnectionSwitch">
      <button
        aria-checked={on}
        aria-label="Yhteys palvelimeen"
        className={`ConnectionSwitch-button ConnectionSwitch-${state}`}
        onClick={() => onChange(!on)}
        role="switch"
        title={`${STATES[state]}. ${on ? "Kytke pois päältä" : "Kytke päälle"} painamalla.`}
        type="button"
      >
        <span className="ConnectionSwitch-knob" />
      </button>
      {/* For a screen reader: what the colour of the light tells */}
      <span className="ConnectionSwitch-status" role="status">
        {STATES[state]}
      </span>
    </span>
  );
}

export default ConnectionSwitch;
