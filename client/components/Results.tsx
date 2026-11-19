import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MorseCharacter } from "../types";
import { chunkArray } from "../utils";
import { useLetterChunks } from "../hooks";

import Button from "./Button";

import "./Results.css";

const GROUPS_PER_ROW = 5;

interface Props {
  /**
   * The answer of an exam, an entry for each character and an empty one for a character that was
   * not written. When given, the answer is shown instead of the message: a wrong character is
   * marked, with the right one above it.
   */
  answers?: string[];
  /** Shown next to the start of the message, e.g. the speed that the message was played at. */
  caption?: string;
  /**
   * The number of the character that is being played, 0 before the first one. When given,
   * the form follows the playback: the group and the character being played are highlighted.
   */
  currentCharacter?: number;
  message: MorseCharacter[];
}

/**
 * The message laid out like the paper form (sähkötyssanomalomake): five groups on a row,
 * with the number of the first character before the row and the number of the last one after it.
 */
function Results(props: Props) {
  const { answers, caption, currentCharacter, message } = props;

  const container = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const letterChunks = useLetterChunks(message);

  const rows = useMemo(() => {
    let first = 1;
    return chunkArray(letterChunks, GROUPS_PER_ROW).map((groups) => {
      const length = groups.reduce((sum, group) => sum + group.length, 0);
      let start = first;
      const row = {
        first,
        // Each group with the number of its first character
        groups: groups.map((characters) => {
          const group = { characters, start };
          start += characters.length;
          return group;
        }),
        last: first + length - 1
      };
      first += length;
      return row;
    });
  }, [letterChunks]);

  useEffect(() => {
    const handleChange = () => setFullscreen(document.fullscreenElement === container.current);
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  // The row that is being played stays in sight
  const following = currentCharacter !== undefined;
  const currentRow = following
    ? rows.findIndex((row) => currentCharacter >= row.first && currentCharacter <= row.last)
    : -1;
  useEffect(() => {
    if (currentRow < 0) return;
    container.current?.querySelector(".Results-row-current")?.scrollIntoView?.({ block: "nearest" });
  }, [currentRow]);

  /** Whether a character has been played, is being played or is still to come. */
  const stateOf = (number: number) =>
    currentCharacter === undefined || currentCharacter === 0
      ? ""
      : number < currentCharacter
        ? " Results-character-played"
        : number === currentCharacter
          ? " Results-character-current"
          : "";

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else {
      container.current?.requestFullscreen().catch(() => undefined);
    }
  }, []);

  return (
    <div
      className={`Results${following ? " Results-following" : ""}${answers ? " Results-marked" : ""}`}
      ref={container}
      style={{ "--rows": rows.length } as React.CSSProperties}
    >
      <div className="Results-sheet">
        <div className="Results-header">
          <span className="Results-special">= = =</span>
          {caption && <span className="Results-caption">{caption}</span>}
          {document.fullscreenEnabled && (
            <Button className="Results-fullscreen" onClick={toggleFullscreen}>
              {fullscreen ? "Sulje koko näyttö" : "Koko näyttö"}
            </Button>
          )}
        </div>
        {rows.map((row, rowIndex) => (
          <div
            className={`Results-row${rowIndex === currentRow ? " Results-row-current" : ""}`}
            key={`results-${row.first}`}
          >
            <span className="Results-number">{row.first}</span>
            {row.groups.map((group) => {
              const current =
                following &&
                currentCharacter >= group.start &&
                currentCharacter < group.start + group.characters.length;
              return (
                <span
                  className={`Results-group${current ? " Results-group-current" : ""}`}
                  key={`results-${group.start}`}
                >
                  {group.characters.map((character, index) => {
                    const number = group.start + index;
                    const answer = answers?.[number - 1] ?? "";
                    if (answers && answer !== character) {
                      return (
                        <span className="Results-character Results-character-wrong" key={`results-${number}`}>
                          <span className="Results-correct">{character}</span>
                          {answer || "–"}
                        </span>
                      );
                    }
                    return (
                      <span className={`Results-character${stateOf(number)}`} key={`results-${number}`}>
                        {character}
                      </span>
                    );
                  })}
                </span>
              );
            })}
            <span className="Results-number Results-number-last">{row.last}</span>
          </div>
        ))}
        <div className="Results-footer">
          <span className="Results-special">
            + <span className="Results-prosign">VA</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default Results;
