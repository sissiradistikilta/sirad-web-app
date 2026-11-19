import React, { useCallback, useState } from "react";

import { Button, Options, Results, Select } from "../components";
import { LENGTHS, CHARACTER_SETS, SPEEDS } from "../constants";
import { usePlayer } from "../hooks";
import { createMessage } from "../message";
import { MorseCharacter } from "../types";

function Receive() {
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
    setMessage(createMessage(characters, length));
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
    <>
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
    </>
  );
}

export default Receive;
