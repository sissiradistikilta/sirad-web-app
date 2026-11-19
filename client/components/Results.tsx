import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MorseCharacter } from "../types";
import { chunkArray } from "../utils";
import { useLetterChunks } from "../hooks";

import Button from "./Button";

import "./Results.css";

const GROUPS_PER_ROW = 5;

interface Props {
  /** Shown next to the start of the message, e.g. the speed that the message was played at. */
  caption?: string;
  message: MorseCharacter[];
}

/**
 * The message laid out like the paper form (sähkötyssanomalomake): five groups on a row,
 * with the number of the first character before the row and the number of the last one after it.
 */
function Results(props: Props) {
  const { caption, message } = props;

  const container = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const letterChunks = useLetterChunks(message);

  const rows = useMemo(() => {
    let first = 1;
    return chunkArray(letterChunks, GROUPS_PER_ROW).map((groups) => {
      const length = groups.reduce((sum, group) => sum + group.length, 0);
      const row = { first, groups, last: first + length - 1 };
      first += length;
      return row;
    });
  }, [letterChunks]);

  useEffect(() => {
    const handleChange = () => setFullscreen(document.fullscreenElement === container.current);
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else {
      container.current?.requestFullscreen().catch(() => undefined);
    }
  }, []);

  return (
    <div className="Results" ref={container} style={{ "--rows": rows.length } as React.CSSProperties}>
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
        {rows.map((row) => (
          <div className="Results-row" key={`results-${row.first}`}>
            <span className="Results-number">{row.first}</span>
            {row.groups.map((group, index) => (
              <span className="Results-group" key={`results-${row.first}-${index}`}>
                {group.join("")}
              </span>
            ))}
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
