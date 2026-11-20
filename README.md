# sirad-web

This is React port of [dy.fi/sm](https://dy.fi/sm) application.

## Usage:

- `npm run start` = start the backend -> [http://localhost:4001](http://localhost:4001)
- `npm run start:app` = frontend production build + start the backend so that it also serves the frontend -> [http://localhost:4001](http://localhost:4001)
- `npm run dev` = starts development server (backend) and Vite development server (frontend) -> [http://localhost:4000](http://localhost:4000) (frontend) & [http://localhost:4001](http://localhost:4001) (backend)
- `npm run dev:client` = starts Vite development server (frontend) -> [http://localhost:4000](http://localhost:4000). It reads `.env`, if there is one (see `.env.example`)
- `npm run dev:server` = start development server (backend) -> [http://localhost:4001](http://localhost:4001)
- `npm run clean` = clean
- `npm run build` = build (client/frontend, production build)
- `npm run typecheck` = type check
- `npm run lint` = lint (ESLint)
- `npm run lint:fix` = autofix linting errors
- `npm run format` = check format (Prettier)
- `npm run format:fix` = autofix format
- `npm run test` = run tests
- `npm run test:watch` = run tests in watch mode

## Frontend and backend

The frontend and the backend are deployed separately: the frontend is a static site in GitHub Pages ([cw.sirad.fi](https://cw.sirad.fi)) and the backend is a web service in [Render.com](https://render.com).

The backend (`server`) has a WebSocket API at `/ws` and a health check at `/health`. It does not serve the frontend unless `SERVE_FRONTEND` is `true`. The frontend keeps a connection to the WebSocket API open, and the light in the top right corner tells whether there is a connection (green) or not (red). Without an address of a backend there is no light.

| Variable          | Used by  | Meaning                                                                                                                                                                                                          |
| ----------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_URL`         | frontend | The address of the backend, e.g. `https://api.sirad.fi`. It is given when the frontend is built. The default is `http://localhost:4001` in development, otherwise empty. In development it can be set in `.env`. |
| `PORT`            | backend  | The port of the server, `4001` by default. Render.com sets it.                                                                                                                                                   |
| `ALLOWED_ORIGINS` | backend  | The addresses that are allowed to use the API, separated with commas, e.g. `https://cw.sirad.fi`. Everything is allowed if it is not set.                                                                        |
| `SERVE_FRONTEND`  | backend  | `true` makes the backend also serve the built frontend from `dist`.                                                                                                                                              |

### Deploys

- `.github/workflows/deploy.yml` builds the frontend and deploys it to GitHub Pages: production from `main` and a preview for each pull request.
- `.github/workflows/deploy-api.yml` deploys the backend to Render.com from `main`, when the backend has changed (`server`, the dependencies, `render.yaml` or the workflow itself). It can also be run by hand from the Actions tab. There are no deploys of the backend for pull requests.

The Render.com service is described in `render.yaml`. To set it up:

1. In Render.com, create a new Blueprint from this repository. It creates the web service `sirad-api`, with automatic deploys off.
2. In the settings of the GitHub repository (Secrets and variables -> Actions), add
   - the secret `RENDER_API_KEY`: an API key from the account settings of Render.com
   - the variable `RENDER_SERVICE_ID`: the id of the service (`srv-...`), seen in the address of the service in the Render.com dashboard
   - the variable `API_URL`: the address of the service, e.g. `https://sirad-api.onrender.com`, and later `https://api.sirad.fi`
3. Run the Deploy workflow again (or push to `main`), so that the frontend is built with the address of the backend.

## Audio

The Morse audio is implemented in `client/audio`, and `client/hooks/usePlayer.ts` connects it to React.

- `timeline.ts` calculates the timing of a whole message in advance, as tone and silence events: a dot is 1 unit, a dash 3 units, and the gaps are 1 unit between the elements of a character, 3 units between characters and 7 units between groups. With a slower effective speed (Farnsworth timing) only the gaps between characters and groups are stretched.
- `MorsePlayer.ts` plays a timeline with the Web Audio API. One oscillator runs during a playback and the tones are keyed with gain automation on the clock of the `AudioContext`, with 5 ms ramps. A timer only schedules the tones of the next 300 ms every 25 ms, it does not time the tones.
