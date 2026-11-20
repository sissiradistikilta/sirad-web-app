import React from "react";

import "./ConnectionStatus.css";

interface Props {
  connected: boolean;
}

/** A light that tells whether there is a connection to the backend: green when there is, red when not. */
function ConnectionStatus({ connected }: Props) {
  const label = connected ? "Yhteys palvelimeen" : "Ei yhteyttä palvelimeen";

  return (
    <span
      aria-label={label}
      className={`ConnectionStatus ConnectionStatus-${connected ? "connected" : "disconnected"}`}
      role="status"
      title={label}
    />
  );
}

export default ConnectionStatus;
