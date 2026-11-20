import React from "react";

import "./HfpSwitch.css";

interface Props {
  /** Whether the user wants the microphone reserved. */
  on: boolean;
  /** Whether the microphone is reserved at the moment. */
  active: boolean;
  /** The microphone could not be reserved, e.g. the user did not allow it. */
  failed: boolean;
  onChange: (on: boolean) => void;
}

/**
 * An experiment: a switch that reserves the microphone, to make a Bluetooth headset change to its mode
 * for calls (HFP), which can have a shorter delay.
 *
 * It looks like a button with its label and a small switch in it, to tell it apart from the switch of the
 * connection. The light in the knob is green when the microphone is reserved, red when it could not be
 * (or is being asked for), and grey when the switch is off.
 */
function HfpSwitch({ on, active, failed, onChange }: Props) {
  const status = !on
    ? "HFP on pois päältä"
    : active
      ? "HFP on päällä: mikrofoni on varattu"
      : failed
        ? "Mikrofonia ei saatu varattua"
        : "Varataan mikrofonia…";

  return (
    <span className="HfpSwitch">
      <button
        aria-checked={on}
        aria-label="HFP"
        className={`HfpSwitch-button${on ? " HfpSwitch-on" : ""}${on && !active ? " HfpSwitch-waiting" : ""}`}
        onClick={() => onChange(!on)}
        role="switch"
        title={`${status}. Kokeilu: mikrofonin varaaminen vaihtaa Bluetooth-kuulokkeet puhelutilaan, jossa viive voi olla lyhyempi.`}
        type="button"
      >
        <span className="HfpSwitch-label">HFP</span>
        <span className="HfpSwitch-track">
          <span className="HfpSwitch-knob" />
        </span>
      </button>
      {/* For a screen reader: whether the microphone is reserved */}
      <span className="HfpSwitch-status" role="status">
        {status}
      </span>
    </span>
  );
}

export default HfpSwitch;
