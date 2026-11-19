import React, { RefObject, useEffect, useRef } from "react";

import "./AnswerInput.css";

const GROUP_SIZE = 5;

interface Props {
  /** Whether the answer is being written: the text field keeps the focus, and the keyboard of a phone stays open. */
  active: boolean;
  /** The answer so far, an entry for each character and an empty one for a skipped character. */
  answers: string[];
  /** The text field. The exam is started by a press of a button, which is the moment to give it the focus. */
  inputRef: RefObject<HTMLInputElement | null>;
  /** How many characters the message has. */
  length: number;
  /** The text of the text field changed. The answer is this text, see parseAnswer. */
  onChange: (text: string) => void;
}

/**
 * The answer of an exam written on a keyboard: the group that is being written as five boxes.
 *
 * The typing goes to a text field that is not seen, for a phone to show its keyboard. The field
 * holds everything that has been written, so the backspace and the corrections of a phone's
 * keyboard work as in any text field.
 */
function AnswerInput(props: Props) {
  const { active, answers, inputRef, length, onChange } = props;

  const groups = Math.ceil(length / GROUP_SIZE);
  // The group of the character that is written next. A full answer stays in the last group.
  const group = Math.min(Math.floor(answers.length / GROUP_SIZE), Math.max(0, groups - 1));
  const start = group * GROUP_SIZE;
  const size = Math.min(GROUP_SIZE, length - start);

  // Whether the exam is on at the moment, for a focus that is given back a moment after it was lost
  const activeNow = useRef(active);

  useEffect(() => {
    activeNow.current = active;
    if (active) inputRef.current?.focus({ preventScroll: true });
  }, [active, inputRef]);

  return (
    <div className="AnswerInput" onClick={() => inputRef.current?.focus({ preventScroll: true })}>
      <p className="AnswerInput-title">
        Ryhmä {group + 1} / {groups}
      </p>
      <div aria-label="Kirjoitettava ryhmä" className="AnswerInput-group">
        {Array.from({ length: size }, (_, index) => {
          const at = start + index;
          const state = at < answers.length ? "written" : at === answers.length ? "current" : "pending";
          return (
            <span
              aria-current={state === "current" ? "true" : undefined}
              className={`AnswerInput-character AnswerInput-character-${state}`}
              key={`answer-${at}`}
            >
              {at < answers.length ? answers[at] || "–" : ""}
            </span>
          );
        })}
      </div>
      <input
        aria-label="Vastaus"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        className="AnswerInput-field"
        enterKeyHint="done"
        // The field takes the focus back, unless the exam has ended in the meantime (e.g. by the press that took the focus)
        onBlur={() => {
          if (!active) return;
          window.setTimeout(() => {
            if (activeNow.current) inputRef.current?.focus({ preventScroll: true });
          }, 0);
        }}
        onChange={(event) => onChange(event.currentTarget.value)}
        readOnly={!active}
        ref={inputRef}
        spellCheck={false}
        type="text"
      />
      <p className="AnswerInput-hint">Välilyönti ohittaa merkin, askelpalautin korjaa.</p>
    </div>
  );
}

export default AnswerInput;
