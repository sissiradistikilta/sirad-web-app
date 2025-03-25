import React, { ReactNode } from "react";

import "./Options.css";

interface Props {
  children?: ReactNode;
}

function Options({ children }: Props) {
  return <div className="Options">{children}</div>;
}

export default Options;
