import React, { useState } from "react";

import { MorseKey } from "../components";
import { Api, useLive } from "../hooks";
import { DEFAULT_FREQUENCY, formatFrequency, parseFrequency } from "../live";

import "./Live.css";

interface Props {
  api: Api;
  /** The user has switched the connection to the backend off. */
  off?: boolean;
}

interface LampProps {
  label: string;
  name: "rx" | "tx";
  on: boolean;
}

function Lamp({ label, name, on }: LampProps) {
  return (
    <span
      aria-label={`${label}: ${on ? "päällä" : "pois"}`}
      className={`Live-lamp Live-lamp-${name}${on ? " Live-lamp-on" : ""}`}
      role="img"
    >
      {name.toUpperCase()}
    </span>
  );
}

function getStatus(api: Api, off: boolean, frequency: number | null, live: ReturnType<typeof useLive>) {
  if (off) {
    return "Yhteys palvelimeen on pois päältä. Kytke se päälle oikean yläkulman kytkimestä, niin voit käyttää livesähkötystä.";
  }
  if (api.connected === null) return "Livesähkötys tarvitsee palvelimen, eikä sen osoitetta ole määritetty.";
  if (!api.connected) return "Ei yhteyttä palvelimeen. Yhteyttä yritetään uudelleen.";
  if (frequency === null) return "Anna taajuus väliltä 1,5–30 MHz, enintään 100 Hz:n tarkkuudella.";
  if (!live.channel) return "Siirrytään taajuudelle…";
  if (live.receiving) return "Taajuudella sähkötetään. Voit sähköttää, kun taajuus vapautuu.";

  const others = live.channel.users - 1;
  if (others === 0) return "Taajuudella ei ole muita.";
  return others === 1 ? "Taajuudella on yksi muu." : `Taajuudella on ${others} muuta.`;
}

/**
 * Live keying: those who are on the same frequency hear the keying of each other.
 * Only one can key at a time, so the key is disabled while someone else is keying.
 */
function Live({ api, off = false }: Props) {
  const [text, setText] = useState(formatFrequency(DEFAULT_FREQUENCY));
  const frequency = parseFrequency(text);
  const live = useLive(api, frequency);

  return (
    <div className="Live">
      <div className="Live-radio">
        <div className="Live-frequency">
          <label htmlFor="liveFrequency">Taajuus (MHz)</label>
          <input
            aria-invalid={frequency === null}
            autoComplete="off"
            id="liveFrequency"
            inputMode="decimal"
            maxLength={7}
            onChange={(event) => setText(event.target.value)}
            value={text}
          />
        </div>
        <div className="Live-lamps">
          <Lamp label="Vastaanotto" name="rx" on={live.receiving} />
          <Lamp label="Lähetys" name="tx" on={live.transmitting} />
        </div>
      </div>
      <p aria-live="polite" className="App-status">
        {getStatus(api, off, frequency, live)}
      </p>
      <p className="Live-help">
        Samalla taajuudella olevat kuulevat toistensa sähkötyksen. Vain yksi voi sähköttää kerrallaan.
      </p>
      <MorseKey
        disabled={!live.channel || live.receiving}
        down={live.keyIsDown}
        onDown={live.keyDown}
        onUp={live.keyUp}
      />
    </div>
  );
}

export default Live;
