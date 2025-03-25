import React, { useCallback, useState } from "react";

import { Button, Options, Results, Select } from "./components";
import { CHARACTER_SETS, LENGTHS, MORSE_CODES_MAP, SPEEDS } from "./constants";
import { usePlayer } from "./hooks";
import { MorseCharacter } from "./types";

import "./App.css";

function App() {
  const [speed, setSpeed] = useState(60);
  const [characters, setCharacters] = useState(CHARACTER_SETS[0].value);
  const [length, setLength] = useState(250);
  const [message, setMessage] = useState<MorseCharacter[]>([]);

  const { currentGroup, numGroups, playing, startPlayback, stopPlayback, stopped } = usePlayer(speed, message);

  const generateNewSeries = useCallback(() => {
    const nextMessage = Array.from({ length }, () =>
      characters.charAt(Math.floor(Math.random() * characters.length))
    ).filter((character): character is MorseCharacter => Boolean(MORSE_CODES_MAP.get(character)));
    setMessage(nextMessage);
  }, [characters, length]);

  return (
    <div className="App">
      <h1>SiRad Web</h1>
      <p>Harjoittele sähkötystä tietokoneellasi tai puhelimellasi.</p>
      <Options>
        <Select
          id="speed"
          title="Nopeus"
          onChange={(value) => setSpeed(Number(value))}
          options={SPEEDS.map((value) => ({
            label: `${value} merkkiä/min`,
            value: String(value)
          }))}
          selected={String(speed)}
        />
        <Select
          id="characters"
          title="Merkistö"
          onChange={(value) => setCharacters(value)}
          options={CHARACTER_SETS}
          selected={String(characters)}
        />
        <Select
          id="length"
          title="Pituus"
          onChange={(value) => setLength(Number(value))}
          options={LENGTHS.map((value) => ({
            label: `${value} merkkiä (${Math.round(value / 5)} ryhmää)`,
            value: String(value)
          }))}
          selected={String(length)}
        />
      </Options>
      <Button disabled={playing} onClick={generateNewSeries}>
        Uusi sarja
      </Button>
      <Button disabled={playing || message.length === 0} onClick={startPlayback}>
        Toista
      </Button>
      <Button disabled={!playing} onClick={stopPlayback}>
        Pysäytä
      </Button>
      {!playing && !stopped && message.length > 0 && <p>Sarja valmis toistettavaksi.</p>}
      {playing && !stopped && message.length > 0 && (
        <p>
          Toistetaan sarjaa {currentGroup} / {numGroups} ...
        </p>
      )}
      {!playing && stopped && message.length > 0 && <Results message={message} />}
    </div>
  );
}

export default App;
