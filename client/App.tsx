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
  // The settings of the latest playback, shown with the message
  const [played, setPlayed] = useState({ characterSpeed, effectiveSpeed });

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

  const play = useCallback(() => {
    setPlayed({ characterSpeed, effectiveSpeed });
    startPlayback();
  }, [characterSpeed, effectiveSpeed, startPlayback]);

  // The effective speed only has an effect when it is slower than the character speed
  const farnsworth = played.effectiveSpeed > 0 && played.effectiveSpeed < played.characterSpeed;
  const caption =
    `${played.characterSpeed} merkkiä/min` + (farnsworth ? `, tehollinen ${played.effectiveSpeed} merkkiä/min` : "");

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
          disabled={playing}
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
      <div className="App-buttons">
        <Button disabled={playing} onClick={generateNewSeries}>
          Uusi sarja
        </Button>
        <Button disabled={playing || message.length === 0} onClick={play}>
          Toista
        </Button>
        <Button disabled={!playing} onClick={stopPlayback}>
          Pysäytä
        </Button>
      </div>
      {!playing && message.length === 0 && <p className="App-status">Aloita luomalla uusi sarja.</p>}
      {!playing && !stopped && message.length > 0 && <p className="App-status">Sarja valmis toistettavaksi.</p>}
      {playing && !stopped && message.length > 0 && (
        <div className="App-status">
          <p>{currentGroup === 0 ? "Toisto alkaa" : `Toistetaan ryhmää ${currentGroup} / ${numGroups}`}</p>
          <div
            aria-label="Toiston eteneminen"
            aria-valuemax={numGroups}
            aria-valuemin={0}
            aria-valuenow={currentGroup}
            className="App-progress"
            role="progressbar"
          >
            <div className="App-progress-bar" style={{ width: `${(currentGroup / numGroups) * 100}%` }} />
          </div>
        </div>
      )}
      {!playing && stopped && message.length > 0 && <Results caption={caption} message={message} />}
    </div>
  );
}

export default App;
