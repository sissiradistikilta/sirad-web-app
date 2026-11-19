import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { markAnswer, parseAnswer } from "../answer";
import { AnswerInput, Button, Options, Results, Select } from "../components";
import { LENGTHS, CHARACTER_SETS, RECEIVE_MODES, SPEEDS } from "../constants";
import { usePlayer } from "../hooks";
import { createMessage } from "../message";
import { MorseCharacter } from "../types";

import "./Receive.css";

function Receive() {
  const [characterSpeed, setCharacterSpeed] = useState(60);
  const [effectiveSpeed, setEffectiveSpeed] = useState(0);
  const [characters, setCharacters] = useState(CHARACTER_SETS[0].value);
  const [length, setLength] = useState(125);
  // An exam is the default: the message must not be shown by accident
  const [mode, setMode] = useState("koe-paperi");
  const [message, setMessage] = useState<MorseCharacter[]>([]);
  // The settings of the latest playback, shown with the message
  const [played, setPlayed] = useState({ characterSpeed, effectiveSpeed });

  const { currentCharacter, currentGroup, numGroups, playing, startPlayback, stopPlayback, stopped } = usePlayer(
    characterSpeed,
    effectiveSpeed,
    message
  );

  // An exam on a keyboard: the answer is the text of a text field, written during and after the playback
  const keyboard = mode === "koe-nappaimisto";
  const answerField = useRef<HTMLInputElement>(null);
  const [answerText, setAnswerText] = useState("");
  const [answering, setAnswering] = useState(false);
  const answers = useMemo(() => parseAnswer(answerText, message.length), [answerText, message.length]);

  const generateNewSeries = useCallback(() => {
    setMessage(createMessage(characters, length));
    setAnswerText("");
  }, [characters, length]);

  const play = useCallback(() => {
    setPlayed({ characterSpeed, effectiveSpeed });
    if (keyboard) {
      // A phone only opens its keyboard when the focus is given in the press of a button
      if (answerField.current) answerField.current.value = "";
      answerField.current?.focus({ preventScroll: true });
      setAnswerText("");
      setAnswering(true);
    }
    startPlayback();
  }, [characterSpeed, effectiveSpeed, keyboard, startPlayback]);

  const stop = useCallback(() => {
    stopPlayback();
    setAnswering(false);
  }, [stopPlayback]);

  // The exam is over when the last character is written after the end of the playback
  useEffect(() => {
    if (answering && !playing && message.length > 0 && answers.length >= message.length) setAnswering(false);
  }, [answering, playing, answers.length, message.length]);

  // The keyboard of a phone closes when the exam is over
  useEffect(() => {
    if (!answering) answerField.current?.blur();
  }, [answering]);

  // The answer of the latest exam on a keyboard is checked against the message
  const checked = keyboard && !answering && !playing && stopped;
  const marks = useMemo(() => markAnswer(message, answers), [message, answers]);

  // No settings can be changed during the playback or the writing of the answer
  const busy = playing || answering;

  // The effective speed only has an effect when it is slower than the character speed
  const farnsworth = played.effectiveSpeed > 0 && played.effectiveSpeed < played.characterSpeed;
  const caption =
    `${played.characterSpeed} merkkiä/min` + (farnsworth ? `, tehollinen ${played.effectiveSpeed} merkkiä/min` : "");

  // In the practice mode the message is in sight all the time, in an exam only after the playback
  const practice = mode === "harjoittelu";

  return (
    <div className={`Receive${answering ? " Receive-answering" : ""}`}>
      <Options>
        <Select
          disabled={busy}
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
          disabled={busy}
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
          disabled={busy}
          id="characters"
          title="Merkit"
          onChange={(value) => setCharacters(value)}
          options={CHARACTER_SETS}
          selected={String(characters)}
        />
        <Select
          disabled={busy}
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
      <Options>
        <Select
          disabled={busy}
          id="mode"
          title="Tila"
          onChange={(value) => setMode(value)}
          options={RECEIVE_MODES}
          selected={mode}
        />
      </Options>
      <div className="App-buttons">
        <Button disabled={busy} onClick={generateNewSeries}>
          Uusi sarja
        </Button>
        <Button disabled={busy || message.length === 0} onClick={play}>
          Toista
        </Button>
        <Button disabled={!busy} onClick={stop}>
          {answering && !playing ? "Valmis" : "Pysäytä"}
        </Button>
      </div>
      {!playing && message.length === 0 && <p className="App-status">Aloita luomalla uusi sarja.</p>}
      {!playing && !stopped && message.length > 0 && <p className="App-status">Sarja valmis toistettavaksi.</p>}
      {keyboard && message.length > 0 && (
        <div className={answering ? "" : "Receive-hidden"}>
          {!playing && <p className="App-status">Sanoma päättyi. Kirjoita vastaus loppuun ja paina Valmis.</p>}
          <AnswerInput
            active={answering}
            answers={answers}
            inputRef={answerField}
            length={message.length}
            onChange={setAnswerText}
          />
        </div>
      )}
      {playing && !stopped && !keyboard && message.length > 0 && (
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
      {checked && message.length > 0 && (
        <dl aria-label="Kokeen tulos" className="Receive-summary">
          <div>
            <dt>Oikein</dt>
            <dd>
              {marks.correct} / {message.length} <small>({Math.round((marks.correct / message.length) * 100)} %)</small>
            </dd>
          </div>
          <div>
            <dt>Väärin</dt>
            <dd>{marks.wrong}</dd>
          </div>
          <div>
            <dt>Tyhjiä</dt>
            <dd>{marks.empty}</dd>
          </div>
        </dl>
      )}
      {message.length > 0 && (practice || (!busy && stopped)) && (
        <Results
          answers={checked ? answers : undefined}
          caption={playing || stopped ? caption : undefined}
          currentCharacter={practice && playing ? currentCharacter : undefined}
          message={message}
        />
      )}
    </div>
  );
}

export default Receive;
