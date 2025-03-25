import React, { useMemo } from "react";

import "./Button.css";

const componentClassName = "Button";

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  const classNames = useMemo(() => className.split(/\s+/).filter((c) => c !== componentClassName), [className]);
  return <button className={`${[componentClassName, ...classNames].join(" ")}`} {...rest} />;
}

export default Button;
