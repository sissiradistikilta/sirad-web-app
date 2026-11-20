const CONNECTION_KEY = "sirad-web.connection";

/**
 * Whether the user wants the connection to the backend. It is on unless the user has switched it off.
 * The choice is remembered in the browser, if the browser lets it be.
 */
export function readConnectionPreference() {
  try {
    return window.localStorage.getItem(CONNECTION_KEY) !== "off";
  } catch {
    return true;
  }
}

export function writeConnectionPreference(on: boolean) {
  try {
    if (on) window.localStorage.removeItem(CONNECTION_KEY);
    else window.localStorage.setItem(CONNECTION_KEY, "off");
  } catch {
    // The choice then lasts until the page is closed
  }
}
