import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button, MorseKey, MorseTree, Options, Select } from "../components";
import { CHARACTER_SETS, DEFAULT_SEND_MODE, LENGTHS, SEND_MODES, SPEEDS } from "../constants";
import { useExercise, useKeyer, useLetterChunks } from "../hooks";
import { WRONG_TIME } from "../hooks/useExercise";
import { patternToCharacter } from "../keying";
import { createMessage } from "../message";
import { MorseCharacter } from "../types";

import "./Send.css";

const GROUP_SIZE = 5;

const formatTime = (seconds: number) => {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

function Send() {
  const [characterSpeed, setCharacterSpeed] = useState(60);
  const [characters, setCharacters] = useState(CHARACTER_SETS[0].value);
  const [length, setLength] = useState<number>(LENGTHS[0]);
  // In the practice mode the path of the character is shown as it is sent, in an exam there is no such help
  const [mode, setMode] = useState(DEFAULT_SEND_MODE);
  const [message, setMessage] = useState<MorseCharacter[]>([]);

  const groups = useLetterChunks(message);
  const exercise = useExercise(message);
  // The character that was just completed stays lit in the tree for a moment
  const [completed, setCompleted] = useState<{ pattern: string; correct: boolean } | null>(null);
  const completedTimer = useRef<number | null>(null);

  const clearCompleted = useCallback(() => {
    if (completedTimer.current !== null) window.clearTimeout(completedTimer.current);
    completedTimer.current = null;
    setCompleted(null);
  }, []);

  const handleCharacter = useCallback(
    (sent: string) => {
      const correct = exercise.send(sent);
      if (correct === null) return;

      clearCompleted();
      setCompleted({ pattern: sent, correct });
      completedTimer.current = window.setTimeout(clearCompleted, WRONG_TIME);
    },
    [exercise.send, clearCompleted]
  );

  useEffect(() => clearCompleted, [clearCompleted]);

  const { keyDown, keyIsDown, keyUp, pattern, reset } = useKeyer(characterSpeed, handleCharacter);

  const start = useCallback(() => {
    setMessage(createMessage(characters, length));
    reset();
    exercise.start();
  }, [characters, length, reset, exercise.start]);

  const handleKeyDown = useCallback(
    (time: number) => {
      clearCompleted();
      exercise.keyDown(time);
      keyDown(time);
    },
    [clearCompleted, exercise.keyDown, keyDown]
  );

  // The group of the character that is sent next. At the end of the message the last group stays.
  const groupIndex = Math.min(Math.floor(exercise.position / GROUP_SIZE), Math.max(0, groups.length - 1));
  const group = useMemo(() => groups[groupIndex] ?? [], [groups, groupIndex]);
  const { result, running } = exercise;

  return (
    <div className={`Send${running ? " Send-running" : ""}`}>
      {!running && (
        <>
          <Options>
            <Select
              id="sendSpeed"
              title="Nopeus"
              onChange={(value) => setCharacterSpeed(Number(value))}
              options={SPEEDS.map((value) => ({
                label: `${value} merkkiä/min`,
                value: String(value)
              }))}
              selected={String(characterSpeed)}
            />
            <Select
              id="sendCharacters"
              title="Merkit"
              onChange={(value) => setCharacters(value)}
              options={CHARACTER_SETS}
              selected={characters}
            />
          </Options>
          <Options>
            <Select
              id="sendLength"
              title="Pituus"
              onChange={(value) => setLength(Number(value))}
              options={LENGTHS.map((value) => ({
                label: `${value} merkkiä (${Math.round(value / GROUP_SIZE)} ryhmää)`,
                value: String(value)
              }))}
              selected={String(length)}
            />
            <Select
              id="sendMode"
              title="Tila"
              onChange={(value) => setMode(value)}
              options={SEND_MODES}
              selected={mode}
            />
          </Options>
        </>
      )}
      <div className="App-buttons">
        <Button disabled={running} onClick={start}>
          Aloita
        </Button>
        <Button disabled={!running} onClick={exercise.stop}>
          Lopeta
        </Button>
      </div>
      {!running && !result && (
        <p className="App-status">Aloita, niin saat sähkötettävän sarjan. Aika alkaa ensimmäisestä painalluksesta.</p>
      )}
      {running && (
        <>
          <div className="App-status">
            <p>
              Ryhmä {groupIndex + 1} / {groups.length}
            </p>
            <div
              aria-label="Harjoituksen eteneminen"
              aria-valuemax={message.length}
              aria-valuemin={0}
              aria-valuenow={exercise.position}
              className="App-progress"
              role="progressbar"
            >
              <div className="App-progress-bar" style={{ width: `${(exercise.position / message.length) * 100}%` }} />
            </div>
          </div>
          <div aria-label="Sähkötettävä ryhmä" className="Send-group">
            {group.map((character, index) => {
              const at = groupIndex * GROUP_SIZE + index;
              const state =
                at < exercise.position
                  ? "done"
                  : at > exercise.position
                    ? "pending"
                    : exercise.wrong
                      ? "wrong"
                      : "current";
              return (
                <span
                  aria-current={at === exercise.position ? "true" : undefined}
                  className={`Send-character Send-character-${state}`}
                  key={`send-${at}`}
                >
                  {character}
                </span>
              );
            })}
          </div>
          {mode === "harjoittelu" && (
            <>
              <div aria-label="Sähkötetty" className="Send-elements">
                <span>{pattern.replace(/\./g, "·").replace(/-/g, "–")}</span>
                <span className="Send-pattern">{patternToCharacter(pattern) ?? (pattern ? "?" : "")}</span>
              </div>
              <MorseTree completed={completed} pattern={pattern} />
            </>
          )}
        </>
      )}
      {!running && result && (
        <dl aria-label="Harjoituksen tulos" className="Send-result">
          <div>
            <dt>Merkkejä</dt>
            <dd>
              {result.characters} / {message.length}
            </dd>
          </div>
          <div>
            <dt>Virheitä</dt>
            <dd>{result.errors}</dd>
          </div>
          <div>
            <dt>Aika</dt>
            <dd>{formatTime(result.seconds)}</dd>
          </div>
          <div>
            <dt>Nopeus</dt>
            <dd>
              {result.speed} <small>merkkiä/min</small>
            </dd>
          </div>
        </dl>
      )}
      {running && <MorseKey down={keyIsDown} onDown={handleKeyDown} onUp={keyUp} />}
    </div>
  );
}

export default Send;
