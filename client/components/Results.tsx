import React, { useEffect, useState } from "react";

import { MorseCharacter } from "../types";
import { chunkArray } from "../utils";
import { useLetterChunks } from "../hooks";
import "./Results.css";

interface Props {
  message: MorseCharacter[];
}

function Results(props: Props) {
  const { message } = props;
  const [rows, setRows] = useState<MorseCharacter[][][]>([]);
  const letterChunks = useLetterChunks(message);

  useEffect(() => {
    const nextRows = chunkArray(letterChunks, 5);
    setRows(nextRows);
  }, [letterChunks]);

  return (
    <div className="Results">
      <div className="special">===</div>
      <table>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`results-${rowIndex}`}>
              {row.map((column, columnIndex) => {
                const flatIndex = rowIndex * 5 * column.length + columnIndex * column.length;
                return (
                  <td key={`results-${rowIndex}-${columnIndex}`} className="cell">
                    <span className="num">{flatIndex + 1}</span>
                    <span className="group">{column.join("")}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="special special-va">
        +<span className="va-overline">VA</span>
      </div>
    </div>
  );
}

export default Results;
