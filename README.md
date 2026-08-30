# Automotive Log Viewer

Local-first web workspace for ECU/logger CSV analysis. Files stay in the browser; parsing, formulas and heatmap aggregation run in a Web Worker.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Drop a CSV file or use the included generated dyno-pull sample.

Live application: [devrus91.github.io/log-viewer](https://devrus91.github.io/log-viewer/). Pushes to `main` are validated and deployed automatically with GitHub Actions.

## Architecture

- `src/domain` — strict domain types and safe formula AST/parser/evaluator.
- `src/data` — CSV ingestion, metadata inference and typed-array dataset registry outside React state.
- `src/analytics` — O(N) heatmap binning and min/max rendering downsampling.
- `src/diagnostics` — semantic channel resolution, WOT pull detection, versioned rule profiles, event correlation and the data-driven diagnostic engine.
- `src/workers` — worker protocol for CSV, formulas, heatmaps and automatic diagnostics.
- `src/state` — Zustand metadata/view state; samples never enter React state.
- `src/components` — Single, synchronized Split, Heatmap, virtual Raw view, navigator, channel browser and Formula Builder.
- `src/persistence` — IndexedDB presets; diagnostic profiles use a separately versioned local repository with non-destructive migrations.

uPlot supplies Canvas rendering and low-overhead cursor/scale control. Heatmaps use a dedicated Canvas renderer. The static Next.js export has no backend and sends no log data over the network.

## Quality gates

```bash
npm run lint
npm test
npm run build
npm audit --omit=dev
```

Tests cover delimiter/quoted CSV parsing, duplicate headers, formula parsing/evaluation and cycles, heatmap filters/binning, min/max downsampling, every built-in diagnostic detector, WOT scoping, unique event identities and diagnostic-profile migration/reset behavior.
