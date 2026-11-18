# sirad-web

This is React port of [dy.fi/sm](https://dy.fi/sm) application.

## Usage:

- `npm run start` = frontend production build + start production server -> [http://localhost:4001](http://localhost:4001)
- `npm run dev` = starts development server (backend) and Vite development server (frontend) -> [http://localhost:4000](http://localhost:4000) (frontend) & [http://localhost:4001](http://localhost:4001) (backend)
- `npm run dev:client` = starts Vite development server (frontend) -> [http://localhost:4000](http://localhost:4000)
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

## Audio

The Morse audio is implemented in `client/audio`, and `client/hooks/usePlayer.ts` connects it to React.

- `timeline.ts` calculates the timing of a whole message in advance, as tone and silence events: a dot is 1 unit, a dash 3 units, and the gaps are 1 unit between the elements of a character, 3 units between characters and 7 units between groups. With a slower effective speed (Farnsworth timing) only the gaps between characters and groups are stretched.
- `MorsePlayer.ts` plays a timeline with the Web Audio API. One oscillator runs during a playback and the tones are keyed with gain automation on the clock of the `AudioContext`, with 5 ms ramps. A timer only schedules the tones of the next 300 ms every 25 ms, it does not time the tones.
