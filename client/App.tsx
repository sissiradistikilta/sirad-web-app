import React, { useCallback, useState } from "react";

import { Button, Results, Select } from "./components";
import { ALPHABETS, LENGTHS, CHARACTER_SETS, SPEEDS, NUMBERS } from "./constants";
import { usePlayer } from "./hooks";
import { MorseCharacter } from "./types";

import "./App.css";
import { filterToMorse } from "./utils";
import Logo from "./components/Logo";
import Lightbox from "./components/Lightbox";

function App() {
  const [speed, setSpeed] = useState(60);
  const [characters, setCharacters] = useState(CHARACTER_SETS[0].value);
  const [length, setLength] = useState(125);
  const [message, setMessage] = useState<MorseCharacter[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { currentGroup, numGroups, playing, startPlayback, stopPlayback, stopped } = usePlayer(speed, message);

  const generateNewSeries = useCallback(() => {
    stopPlayback();
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
  }, [characters, length, stopPlayback]);

  return (
    <div className="App">
      <div className="App-header">
        <div className="App-logo">
          <Logo />
          <h1 className="App-logo-title">SiRad Web</h1>
        </div>
        <div className="App-maincol">
          <div className="App-buttons">
            <Button
              disabled={playing}
              onClick={() => setSettingsOpen(true)}
              lcd={[
                `${speed.toString()} cpm`,
                CHARACTER_SETS.find((o) => o.value === characters)?.shortLabel,
                `${length} (${Math.round(length / 5)})`
              ].join(" * ")}
            >
              Asetukset
            </Button>
            <Button disabled={playing} onClick={generateNewSeries}>
              Uusi sarja
            </Button>
            <Button disabled={playing || message.length === 0} onClick={startPlayback}>
              Toista
            </Button>
            <Button disabled={!playing} onClick={stopPlayback}>
              Pysäytä
            </Button>
          </div>
        </div>
      </div>
      <div className="App-content">
        {message.length === 0 && <p>Harjoittele sähkötystä tietokoneellasi tai puhelimellasi.</p>}
        {!playing && !stopped && message.length > 0 && <p>Sarja valmis toistettavaksi.</p>}
        {playing && !stopped && message.length > 0 && (
          <p>
            Toistetaan sarjaa {currentGroup} / {numGroups} ...
          </p>
        )}
        {!playing && stopped && message.length > 0 && <Results message={message} />}
      </div>
      <Lightbox open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Asetukset">
        <Select
          id="speed"
          title="Nopeus"
          onChange={(value) => setSpeed(Number(value))}
          options={SPEEDS.map((value) => ({
            label: `${value} merkkiä minuutissa`,
            shortLabel: `${value} cpm`,
            value: String(value)
          }))}
          selected={String(speed)}
        />
        <Select
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
            label: `${value} (${Math.round(value / 5)} ryhmää)`,
            shortLabel: `${value} (${Math.round(value / 5)})`,
            value: String(value)
          }))}
          selected={String(length)}
        />
      </Lightbox>
    </div>
  );
}

export default App;
