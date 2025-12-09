import React, { useCallback, useState } from "react";

import { Button, Options, Results, Select } from "./components";
import { ALPHABETS, LENGTHS, CHARACTER_SETS, SPEEDS, NUMBERS } from "./constants";
import { usePlayer } from "./hooks";
import { MorseCharacter } from "./types";

import "./App.css";
import { filterToMorse } from "./utils";

function App() {
  const [characterSpeed, setCharacterSpeed] = useState(60);
  const [effectiveSpeed, setEffectiveSpeed] = useState(0);
  const [characters, setCharacters] = useState(CHARACTER_SETS[0].value);
  const [length, setLength] = useState(125);
  const [message, setMessage] = useState<MorseCharacter[]>([]);

  const { currentGroup, numGroups, playing, startPlayback, stopPlayback, stopped } = usePlayer(
    characterSpeed,
    effectiveSpeed,
    message
  );

  const generateNewSeries = useCallback(() => {
    // In case it's numbers only, we'll make message from numbers
    if (characters === NUMBERS) {
      const nextMessage = Array.from({ length }, () => NUMBERS.charAt(Math.floor(Math.random() * NUMBERS.length)));
      setMessage(nextMessage.filter(filterToMorse));
      return;
    }

    // Otherwise, we start with alphabets
    const nextMessage = Array.from({ length }, () => ALPHABETS.charAt(Math.floor(Math.random() * ALPHABETS.length)));

    // If it's only alphabets, we're done
    if (characters === ALPHABETS) {
      setMessage(nextMessage.filter(filterToMorse));
      return;
    }

    // Otherwise, we need to insert special characters
    const specialSet = new Set(characters.substring(ALPHABETS.length));
    const specialCount = Math.floor(length / 125);
    const usedIndexes = new Set();
    for (let i = 0; i < specialCount; i++) {
      for (const specialCharacter of characters) {
        let index;
        do {
          index = Math.floor(Math.random() * length);
        } while (usedIndexes.has(index) || specialSet.has(message[index]));
        nextMessage[index] = specialCharacter;
        usedIndexes.add(index);
      }
    }

    setMessage(nextMessage.filter(filterToMorse));
  }, [characters, length]);

  return (
    <div className="App">
      <h1>SiRad Web</h1>
      <p>Harjoittele sähkötystä tietokoneellasi tai puhelimellasi.</p>
      <Options>
        <Select
          disabled={playing}
          id="characterSpeed"
          title="Merkkien nopeus"
          onChange={(value) => setCharacterSpeed(Number(value))}
          options={SPEEDS.map((value) => ({
            label: `${value} merkkiä/min`,
            value: String(value)
          }))}
          selected={String(characterSpeed)}
        />
        <Select
          disabled={playing}
          id="effectiveSpeed"
          title="Tehollinen nopeus"
          onChange={(value) => setEffectiveSpeed(Number(value))}
          options={[
            {
              label: "Sama kuin merkkien nopeus",
              value: "0"
            },
            ...SPEEDS.map((value) => ({
              label: `${value} merkkiä/min`,
              value: String(value)
            }))
          ]}
          selected={String(effectiveSpeed)}
        />
      </Options>
      <Options>
        <Select
          disabled={playing}
          id="characters"
          title="Merkit"
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
