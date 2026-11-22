# ROLL RUSH

A small offline-first 3D endless ball runner prototype built with Three.js, Vite and Capacitor.

## Requirements
- Node.js 20+
- npm
- VS Code (recommended)

## Run on Windows
1. Extract the ZIP.
2. Open the `roll-rush` folder in VS Code.
3. Open Terminal → New Terminal.
4. Run:

```bash
npm install
npm run dev
```

5. Open the local URL printed in the terminal (usually http://localhost:5173).

## Build
```bash
npm run build
```

## Prepare iOS project
```bash
npx cap add ios
npx cap sync ios
```

The iOS project still needs to be built/signed using an eligible Apple development setup. This prototype does not bypass Apple's signing requirements.

## Offline notes
- The game logic and 3D assets are local.
- Personal records use localStorage on the device.
- Daily and weekly records are local to this device, not global leaderboards.
- The Google font import is optional; the game falls back to system fonts if unavailable.
