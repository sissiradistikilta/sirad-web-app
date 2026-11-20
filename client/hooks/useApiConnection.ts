import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ApiConnection, { ApiMessage, ConnectionOptions, toSocketUrl } from "../api/connection";

export interface Api {
  /** Whether there is a connection to the backend. Null if there is no backend to connect to. */
  connected: boolean | null;
  /** Sends a message to the backend. Returns false if there is no connection: the message is then lost. */
  send: (message: ApiMessage) => boolean;
  /** Listens to the messages of the backend. Returns a function that ends the listening. */
  subscribe: (listener: (message: ApiMessage) => void) => () => void;
}

/**
 * A connection to the backend at the given address (e.g. https://api.sirad.fi), kept open.
 *
 * @param options The timing of the connection, if other than the default. Read when the connection is opened.
 */
const useApiConnection = (apiUrl: string, options?: ConnectionOptions): Api => {
  const [connected, setConnected] = useState(false);
  const connection = useRef<ApiConnection | null>(null);
  const listeners = useRef(new Set<(message: ApiMessage) => void>());
  const timing = useRef(options);

  useEffect(() => {
    timing.current = options;
  }, [options]);

  useEffect(() => {
    if (!apiUrl) return;

    const opened = new ApiConnection(
      toSocketUrl(apiUrl),
      setConnected,
      (message) => listeners.current.forEach((listener) => listener(message)),
      timing.current
    );
    connection.current = opened;
    return () => {
      connection.current = null;
      opened.close();
      setConnected(false);
    };
  }, [apiUrl]);

  const send = useCallback((message: ApiMessage) => connection.current?.send(message) ?? false, []);
  const subscribe = useCallback((listener: (message: ApiMessage) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  return useMemo(
    () => ({ connected: apiUrl ? connected : null, send, subscribe }),
    [apiUrl, connected, send, subscribe]
  );
};

export default useApiConnection;
