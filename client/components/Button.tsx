import React, { useMemo, useRef, useEffect, useState } from "react";
import "./Button.css";

const componentClassName = "Button";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  lcd?: string;
}

function Button(props: ButtonProps) {
  const { children, className = "", disabled, lcd, ...rest } = props;
  const classNames = useMemo(
    () => [
      componentClassName,
      ...className.split(/\s+/).filter((c) => c !== componentClassName),
      disabled ? "disabled" : "enabled",
      lcd ? "with-lcd" : "no-lcd"
    ],
    [className, disabled, lcd]
  );

  const lcdRef = useRef<HTMLSpanElement>(null);
  const [scroll, setScroll] = useState(false);

  useEffect(() => {
    if (lcdRef.current) {
      const parent = lcdRef.current.parentElement;
      if (parent) {
        setScroll(lcdRef.current.scrollWidth > parent.offsetWidth);
      }
    }
  }, [lcd]);

  return (
    <button className={classNames.join(" ")} disabled={disabled} {...rest}>
      <span className="led-text-wrap">
        <span className="led"></span>
        <span className="text">{children}</span>
      </span>
      {lcd && (
        <span className={`lcd-value${scroll ? " scroll" : ""}`}>
          <span ref={lcdRef}>{lcd}</span>
        </span>
      )}
    </button>
  );
}

export default Button;
