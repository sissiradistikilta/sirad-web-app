/// <reference types="vite/client" />

/** The address of the backend given in the build (API_URL), empty if there is none. */
declare const __API_URL__: string;

/** Whether live keying, and with it the connection to the backend, is in use (LIVE_ENABLED in the build). */
declare const __LIVE_ENABLED__: boolean;
