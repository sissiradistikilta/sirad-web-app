import React, { useEffect, useRef } from "react";

import "./MorseKey.css";

interface Props {
  /** Whether the key can be used. The key takes the focus when it is enabled, for the space bar to work. */
  disabled?: boolean;
  /** Whether the key is shown as pressed. */
  down: boolean;
  /** The key went down. The time is in milliseconds on the clock of performance.now(). */
  onDown: (time: number) => void;
  onUp: (time: number) => void;
}

/** Elements where the space bar has a meaning of its own. */
const KEYBOARD_CONTROLS = "select, input, textarea, button, a, [role='tab']";

/**
 * A Morse key for a finger, a mouse or the space bar. The key is down for as long as
 * any of them holds it down.
 */
function MorseKey(props: Props) {
  const { disabled = false, down, onDown, onUp } = props;

  const element = useRef<HTMLButtonElement>(null);
  const holders = useRef(new Set<string>());
  const handlers = useRef({ onDown, onUp });

  useEffect(() => {
    handlers.current = { onDown, onUp };
  }, [onDown, onUp]);

  useEffect(() => {
    // The focus is not taken from a field that is being written in
    if (!disabled && !document.activeElement?.closest("input, select, textarea")) {
      element.current?.focus({ preventScroll: true });
    }
  }, [disabled]);

  useEffect(() => {
    if (disabled) return;

    const hold = (holder: string, event: Event) => {
      const wasDown = holders.current.size > 0;
      holders.current.add(holder);
      if (!wasDown) handlers.current.onDown(event.timeStamp || performance.now());
    };
    const release = (holder: string, event: Event) => {
      if (!holders.current.delete(holder)) return;
      if (holders.current.size === 0) handlers.current.onUp(event.timeStamp || performance.now());
    };

    const isSpace = (event: KeyboardEvent) => event.code === "Space" || event.key === " ";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isSpace(event)) return;
      const target = event.target instanceof Element ? event.target : null;
      // The space bar works as the key unless it is used for something else, e.g. opening a select
      if (target && target !== element.current && target.closest(KEYBOARD_CONTROLS)) return;

      // No scrolling of the page, and no click of the key from the space bar
      event.preventDefault();
      if (!event.repeat) hold("keyboard", event);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (!isSpace(event)) return;
      if (holders.current.has("keyboard")) event.preventDefault();
      release("keyboard", event);
    };
    // The key does not stay down if the window is left while it is held
    const handleBlur = (event: Event) => {
      Array.from(holders.current).forEach((holder) => release(holder, event));
    };

    const button = element.current;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      // The key stays down even if the finger slides off it
      button?.setPointerCapture?.(event.pointerId);
      // If the lift of the previous press was never told about, this press is still a new one
      release(`pointer-${event.pointerId}`, event);
      hold(`pointer-${event.pointerId}`, event);
    };
    const handlePointerUp = (event: PointerEvent) => release(`pointer-${event.pointerId}`, event);
    const prevent = (event: Event) => event.preventDefault();
    // A phone must not start a gesture of its own from a long press, e.g. selecting the text of the page.
    // Such a gesture also takes the touch over, and the lift of the finger is then never told about.
    const handleTouchStart = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault();
    };
    // The lift of the last finger lets the key go, also if the event of the pointer was lost
    const handleTouchEnd = (event: TouchEvent) => {
      if (event.targetTouches.length > 0) return;
      Array.from(holders.current)
        .filter((holder) => holder.startsWith("pointer-"))
        .forEach((holder) => release(holder, event));
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    button?.addEventListener("pointerdown", handlePointerDown);
    button?.addEventListener("pointerup", handlePointerUp);
    button?.addEventListener("pointercancel", handlePointerUp);
    button?.addEventListener("lostpointercapture", handlePointerUp);
    // No menu from a long press
    button?.addEventListener("contextmenu", prevent);
    button?.addEventListener("selectstart", prevent);
    button?.addEventListener("touchstart", handleTouchStart, { passive: false });
    button?.addEventListener("touchend", handleTouchEnd);
    button?.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      // The key does not stay down when it is disabled while held
      handleBlur(new Event("blur"));
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      button?.removeEventListener("pointerdown", handlePointerDown);
      button?.removeEventListener("pointerup", handlePointerUp);
      button?.removeEventListener("pointercancel", handlePointerUp);
      button?.removeEventListener("lostpointercapture", handlePointerUp);
      button?.removeEventListener("contextmenu", prevent);
      button?.removeEventListener("selectstart", prevent);
      button?.removeEventListener("touchstart", handleTouchStart);
      button?.removeEventListener("touchend", handleTouchEnd);
      button?.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [disabled]);

  return (
    <div className="MorseKey">
      <button
        aria-label="Sähkötysavain"
        disabled={disabled}
        aria-pressed={down}
        className={`MorseKey-button${down ? " MorseKey-button-down" : ""}`}
        ref={element}
        type="button"
      >
        <span className="MorseKey-label">Avain</span>
        <span className="MorseKey-hint">Paina tästä tai välilyönnillä</span>
      </button>
    </div>
  );
}

export default MorseKey;
