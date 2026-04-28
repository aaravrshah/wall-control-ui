# Programmable Deformable Wall UI (Prototype v1)

A frontend-first React + Vite prototype for operating a **4 × 16 programmable deformable wall** used in oscillatory flume experiments.

This build is intentionally focused on operator UX, experiment setup flow, and advanced editing/sequencing scaffolding. It now includes a browser-side serial link that sends safe Arduino pattern/frame commands from the main control page.

## What this prototype includes

- Progressive disclosure UX with **Simple Mode** (default) and optional **Advanced Mode**.
- Routing across six meaningful pages:
  - Home
  - Experiment Setup
  - Run
  - Pattern Editor (advanced)
  - Sequencer (advanced)
  - Diagnostics (advanced)
- Central experiment state model (React Context).
- LocalStorage persistence for current experiment, run state, and saved experiments.
- Seeded presets and saved experiments.
- Reusable 4 × 16 `WallGrid` visualizer with heatmap coloring.
- Mock animation in Run view using preset-based waveform generation.
- Keyframe list sequencing prototype with interpolation preview.
- Diagnostics panel with simulated readouts + simulated actuator jog control.

## Install and run

```bash
npm install
npm run dev
```

Then open the Vite URL shown in terminal (typically `http://localhost:5173`).

Build for production:

```bash
npm run build
npm run preview
```

## Current scope and intentional exclusions

This v1 prototype **does not** include:
- WebSocket/backend APIs
- Real actuator telemetry
- Real-time fault handling logic

Wall-state previews remain simulated in the UI, but the Home page can now send positive-only `frame:<64 values>` commands or demo pattern commands to a connected Arduino over the Web Serial API.

## Arduino hookup

The main control page now includes an **Arduino Link** panel that can:

- Request a serial connection to the Arduino from the browser
- Send `flat`, `sine`, `diag`, and `uiuc` commands from the tested demo sketch
- Stream the current wall preview while a run is active
- Send row-major positive displacement frames for the 4 x 16 wall grid

Important setup notes:

- Use a Chromium-based browser that supports the Web Serial API, such as Chrome or Edge.
- Run the app from `localhost` or another secure context.
- Match the baud rate to the Arduino sketch. The provided sketch uses `9600`.
- The included `arduino_wall_controller.ino` sketch is based on `arduino_demo_patterns.ino`: it owns calibrated centers, board direction signs, physical row/column mapping, and PWM clamps.
- The UI no longer sends raw servo angles. It sends positive displacement degrees only, and the Arduino clamps every command to `0..28` degrees before converting to PCA9685 ticks.

## Folder structure

```text
src/
  components/
    AppLayout.jsx
    DiagnosticsPanel.jsx
    EmptyState.jsx
    ExperimentPreview.jsx
    KeyframeList.jsx
    ModeToggle.jsx
    NumericControl.jsx
    PatternCard.jsx
    SaveLoadPanel.jsx
    SectionHeader.jsx
    StatusCard.jsx
    TopNav.jsx
    WallGrid.jsx
  context/
    ExperimentContext.jsx
  data/
    presets.js
  hooks/
    useLocalStorageState.js
  pages/
    Diagnostics.jsx
    ExperimentSetup.jsx
    Home.jsx
    PatternEditor.jsx
    Run.jsx
    Sequencer.jsx
  styles/
    app.css
  utils/
    grid.js
    patterns.js
    storage.js
  App.jsx
  main.jsx
```

## Architecture notes

- **State model** is centralized in `ExperimentContext` to keep future hardware integration clean.
- Preset + sequence math lives in `utils/` so it can be reused by future controller adapters.
- Visual components (`WallGrid`, `ExperimentPreview`) are reused across setup/run/advanced pages.
- Advanced pages are mode-gated and redirect when users are in simple mode.

## What to build next (for hardware integration)

1. **Controller adapter layer**
   - Add an abstraction for transport (serial/WebSocket).
   - Convert experiment model to low-level actuator command frames.
2. **Command + telemetry pipeline**
   - Implement queueing/acknowledgement.
   - Add heartbeat and connection recovery states.
3. **Runtime safety controls**
   - Emergency stop lockouts.
   - Fault code mapping and safe-stop behavior.
4. **Data logging/export**
   - Persist run metadata and actuator traces.
   - Export experiment definitions and run logs.
5. **Validation and constraints**
   - Enforce bounds from hardware capability profile.
   - Parameter guardrails per preset and experiment type.

## Notes

This repository is designed to be readable and easy to extend by students and research engineers.
