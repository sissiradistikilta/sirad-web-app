import { useEffect, useState } from "react";

import ApiConnection, { toSocketUrl } from "../api/connection";

/**
 * Whether there is a connection to the backend at the given address (e.g. https://api.sirad.fi).
 * Null if there is no backend to connect to.
 */
const useApiConnection = (apiUrl: string) => {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!apiUrl) return;

    const connection = new ApiConnection(toSocketUrl(apiUrl), setConnected);
    return () => {
      connection.close();
      setConnected(false);
    };
  }, [apiUrl]);

  return apiUrl ? connected : null;
};

export default useApiConnection;
