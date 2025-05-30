import React, { useCallback, useState } from "react";

import { Button, Options, Results, Select } from "./components";
import { BASE_CHARACTERS, LENGTHS, MORSE_CODES_MAP, SPECIAL_CHARACTER_SETS, SPEEDS } from "./constants";
import { usePlayer } from "./hooks";
import { MorseCharacter } from "./types";

import "./App.css";

function App() {
  const [speed, setSpeed] = useState(60);
  const [specialCharacters, setSpecialCharacters] = useState(SPECIAL_CHARACTER_SETS[0].value);
  const [length, setLength] = useState(125);
  const [message, setMessage] = useState<MorseCharacter[]>([]);

  const { currentGroup, numGroups, playing, startPlayback, stopPlayback, stopped } = usePlayer(speed, message);

  const generateNewSeries = useCallback(() => {

    const nextMessage = Array.from({ length }, () =>
      BASE_CHARACTERS.charAt(Math.floor(Math.random() * BASE_CHARACTERS.length))
    );

    const specialSet = new Set(specialCharacters);
    const specialCount = Math.floor(length / 125);
    const usedIndexes = new Set();
    for (let i = 0; i < specialCount; i++) {
      for (const specialCharacter of specialCharacters) {
        let index;
        do {
          index = Math.floor(Math.random() * length);
        } while (usedIndexes.has(index) || specialSet.has(message[index]));
        nextMessage[index] = specialCharacter;
        usedIndexes.add(index);
      }
    }

    setMessage(nextMessage.filter((character): character is MorseCharacter => Boolean(MORSE_CODES_MAP.get(character))));
  }, [specialCharacters, length]);

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
          id="specialcharacters"
          title="Erikoismerkit"
          onChange={(value) => setSpecialCharacters(value)}
          options={SPECIAL_CHARACTER_SETS}
          selected={String(specialCharacters)}
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
