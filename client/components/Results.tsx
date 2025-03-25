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
              {row.map((column, columnIndex) => (
                <td key={`results-${rowIndex}-${columnIndex}`}>
                  <span>{rowIndex * 5 + columnIndex + 1}</span>
                  {column.join("")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="special">+V̅A̅</div>
    </div>
  );
}

export default Results;
