# Programmable Deformable Wall UI (Prototype v1)

A frontend-first React + Vite prototype for operating a **4 × 16 programmable deformable wall** used in oscillatory flume experiments.

This build is intentionally focused on operator UX, experiment setup flow, and advanced editing/sequencing scaffolding. It now generates complete Arduino sketches so the Arduino owns motion timing locally.

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

Wall-state previews remain simulated in the UI. The Home page generates a complete `.ino` sketch based on the tested Arduino pattern code, the current grid, and operator-selected wave parameters.

## Arduino workflow

The main control page now includes an **Arduino Sketch** panel that can:

- Preview the generated 4 x 16 wave pattern
- Tune frequency, amplitude, column phase, row phase, global phase, and refresh delay
- Convert the current actuator grid into per-cell amplitude multipliers
- Generate a full Arduino sketch that includes all 64 servos, calibrated centers, row/column mapping, board direction signs, and PWM clamps

Important setup notes:

- Copy the generated sketch from the UI.
- Paste it into Arduino IDE.
- Upload it manually to the Arduino.
- Runs do not stream motion commands from JavaScript. The generated Arduino sketch runs the pattern locally at its own refresh rate.

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
