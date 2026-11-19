import React, { useMemo } from "react";

import { MORSE_CODES } from "../constants";

import "./MorseTree.css";

interface Props {
  /** The dots and dashes sent so far: the path to them is lit. */
  pattern: string;
  /** A character that was just completed, shown for a moment as right or wrong. */
  completed?: { pattern: string; correct: boolean } | null;
}

interface Node {
  pattern: string;
  label: string;
  x: number;
  y: number;
  radius: number;
}

const WIDTH = 320;
const HEIGHT = 178;
/** Room at the sides for the outermost nodes. */
const MARGIN = 5;
/** The height of each level of the tree. The fifth level is on two rows, to make room for its labels. */
const ROWS = [12, 40, 68, 96, 124, 150, 167];
const RADII = [5, 11, 10.5, 9.5, 8.5, 7.5];
/** Every junction of the tree is drawn down to this level, below it only the characters. */
const FULL_DEPTH = 4;

const CHARACTERS = new Map(Object.entries(MORSE_CODES).map(([character, pattern]) => [pattern, character]));

/** A dot goes to the left and a dash to the right: the position among the nodes of the level. */
const indexOf = (pattern: string) =>
  Array.from(pattern).reduce((index, element) => index * 2 + (element === "-" ? 1 : 0), 0);

function createNode(pattern: string): Node {
  const depth = pattern.length;
  const index = indexOf(pattern);
  return {
    pattern,
    label: CHARACTERS.get(pattern) ?? "",
    x: ((index + 0.5) * WIDTH) / 2 ** depth,
    y: depth > FULL_DEPTH ? ROWS[depth + (index % 2)] : ROWS[depth],
    radius: RADII[depth]
  };
}

function createNodes() {
  const patterns = new Set<string>([""]);
  // All junctions of the first levels...
  for (let depth = 1; depth <= FULL_DEPTH; depth += 1) {
    for (let index = 0; index < 2 ** depth; index += 1) {
      patterns.add(index.toString(2).padStart(depth, "0").replace(/0/g, ".").replace(/1/g, "-"));
    }
  }
  // ...and the longer characters, e.g. the numbers
  CHARACTERS.forEach((_, pattern) => patterns.add(pattern));

  return Array.from(patterns)
    .filter((pattern) => pattern.length <= FULL_DEPTH + 1)
    .map(createNode);
}

/**
 * The Morse code as a tree: every dot is a step to the left and every dash a step to the right.
 * The path of the character that is being sent is lit, like LEDs on a board.
 */
function MorseTree(props: Props) {
  const { pattern, completed = null } = props;

  const nodes = useMemo(createNodes, []);
  const byPattern = useMemo(() => new Map(nodes.map((node) => [node.pattern, node])), [nodes]);

  const stateOf = (node: Node) => {
    if (completed && node.pattern === completed.pattern) return completed.correct ? "right" : "wrong";
    if (node.pattern === pattern && pattern) return "current";
    if (pattern.startsWith(node.pattern)) return "lit";
    return "off";
  };

  return (
    <svg
      aria-label="Sähkötettävän merkin polku"
      className="MorseTree"
      role="img"
      viewBox={`${-MARGIN} 0 ${WIDTH + 2 * MARGIN} ${HEIGHT}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {nodes
        .filter((node) => node.pattern)
        .map((node) => {
          const parent = byPattern.get(node.pattern.slice(0, -1));
          if (!parent) return null;
          const lit = pattern.startsWith(node.pattern);
          return (
            <line
              className={`MorseTree-edge${lit ? " MorseTree-edge-lit" : ""}`}
              key={`edge-${node.pattern}`}
              x1={parent.x}
              x2={node.x}
              y1={parent.y}
              y2={node.y}
            />
          );
        })}
      <text className="MorseTree-legend" textAnchor="end" x={WIDTH / 2 - 12} y={9}>
        lyhyt ·
      </text>
      <text className="MorseTree-legend" textAnchor="start" x={WIDTH / 2 + 12} y={9}>
        – pitkä
      </text>
      {nodes.map((node) => (
        <g
          className={`MorseTree-node MorseTree-node-${stateOf(node)}`}
          data-pattern={node.pattern}
          key={`node-${node.pattern}`}
        >
          <circle cx={node.x} cy={node.y} r={node.radius} />
          {node.label && (
            <text dy="0.36em" fontSize={node.radius * 1.25} textAnchor="middle" x={node.x} y={node.y}>
              {node.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export default MorseTree;
