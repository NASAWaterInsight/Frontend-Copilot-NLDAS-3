# Hydrology Copilot — Frontend

**A React-based conversational interface for natural-language hydrological data analysis.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5+-646CFF.svg)](https://vitejs.dev/)
[![Azure Maps](https://img.shields.io/badge/Azure%20Maps-Latest-0078D4.svg)](https://azure.microsoft.com/products/azure-maps/)

The Hydrology Copilot frontend is a single-page web application that lets researchers, decision-makers, and non-specialists ask hydrological questions in plain English and receive interactive maps, scientific visualizations, and AI-generated explanations grounded in NASA's NLDAS-3 dataset.

Users type a query, watch the analysis stream live, and explore the results — no coding, no menu navigation, no file downloads required.

---

## What it does

The frontend is a thin client that orchestrates an interactive scientific workflow:

1. **Accepts natural-language queries** through a chat interface — "Show drought conditions in Texas for August 2011"
2. **Streams live progress** from the backend — parsing query → loading data → executing code → building map
3. **Renders interactive maps** with three complementary visualization modes (Azure Maps tiles, transparent overlays, static PNGs)
4. **Maintains persistent conversational memory** across queries — follow-ups like "show me the same for California" work automatically
5. **Exports results** as PDF reports, downloadable PNG maps, and source Python code for reproducibility

Built with React, TypeScript, and Azure Maps. Hosted on Azure Static Web Apps.

---

## Key features

### 💬 Conversational interface
- Chat-style UI with full conversation history
- Multi-turn analysis with context retention ("how does that compare to July 2023?")
- Live progress streaming via Server-Sent Events (SSE)
- Per-query elapsed-time badges for performance feedback
- "New Chat" button to start fresh sessions

### 🗺️ Three visualization modes
- **Interactive tile maps** — Azure Maps with backend-rendered 256×256 PNG tiles, pan/zoom/click for value inspection
- **Transparent overlays** — Georeferenced PNG overlays atop satellite imagery for smaller regions
- **Static publication-ready maps** — Server-rendered PNGs with embedded legends, ready to download

### 🎨 Adaptive legends
- **Continuous colorbar** for raw variables (temperature, precipitation, etc.)
- **USDM 11-class categorical legend** for drought percentiles (D4–D0–NULL–W0–W4)
- Backend-driven — single source of truth, no client-side rescaling
- Drought categories with the standard NOAA/SPoRT-LIS percentile thresholds (2, 5, 10, 20, 30, 70, 80, 90, 95, 98)

### 📄 PDF export
- Full conversation export to multi-page PDF
- Maps automatically swapped to static images for crisp print rendering
- Custom NASA-themed header and pagination

### 🔐 Privacy-respecting identity
- Stable pseudonymous user ID generated locally in browser
- No authentication required, no personal data collected
- Memory persistence works through the local ID without an account

### ⚙️ Developer-friendly
- TypeScript throughout for type safety
- Component-based architecture
- Debug panel exposing raw backend responses
- Console logging for diagnostics

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  Hydrology Copilot Frontend                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              HydrologyDarkChat.tsx                      │    │
│  │  (main chat orchestrator + message history + export)    │    │
│  └─────────────────────┬───────────────────────────────────┘    │
│                        │                                        │
│                        │ queries                                │
│                        ▼                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              useStreamingChat (SSE hook)                │    │
│  │  Streams progress events from backend during analysis   │    │
│  └─────────────────────┬───────────────────────────────────┘    │
│                        │                                        │
│                        ▼                                        │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              AzureMapView.tsx                          │     │
│  │  Interactive tile rendering + colorbar + popups        │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              ColorbarLegend.tsx                        │     │
│  │  Adaptive legend: continuous OR categorical USDM       │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              ProgressSteps.tsx                         │     │
│  │  Live progress indicator during analysis               │     │
│  └────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS / SSE
                              ▼
                  ┌───────────────────────────┐
                  │   Backend (FastAPI on     │
                  │   Azure Functions)        │
                  └───────────────────────────┘
```

---

## Quick start

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Azure Maps subscription key ([free tier available](https://azure.microsoft.com/products/azure-maps/))
- Running instance of the [Hydrology Copilot backend](https://github.com/NASAWaterInsight/Backend-Copilot-NLDAS-3)

### Installation

```bash
# Clone the repository
git clone https://github.com/NASAWaterInsight/Frontend-Copilot-NLDAS-3.git
cd Frontend-Copilot-NLDAS-3

# Install dependencies
npm install
```

### Configuration

Create a `.env` file in the project root:

```bash
# Backend API endpoint
VITE_API_BASE_URL=http://localhost:8000

# Azure Maps credentials
VITE_AZURE_MAPS_SUBSCRIPTION_KEY=your-azure-maps-key
VITE_AZURE_MAPS_CLIENT_ID=your-client-id   # optional, only if using AAD auth
```

### Run locally

```bash
npm run dev
```

The app will be available at `http://localhost:5173`. Hot reload is enabled — edits to `.tsx` files refresh the browser automatically.

### Build for production

```bash
npm run build
```

Output is written to `dist/`. Deploy this folder to Azure Static Web Apps, Vercel, Netlify, or any static host.

---

## Example queries

Once running, try these to see different visualization modes:

| Query | Mode | Notes |
|---|---|---|
| "Show precipitation in Florida on October 12, 2023" | Continuous colorbar + tiles | Basic forcing variable |
| "Show drought conditions in Michigan for August 2023" | SPI colorbar + tiles | Monthly drought index |
| "Show root-zone soil moisture percentiles for the Southern Plains on August 2, 2011" | USDM categorical + tiles | Demonstrates D4–W4 legend |
| "Compare California SPI between July and August 2023" | Static side-by-side | Comparison mode |
| "Detect flash drought in the Great Plains, June to August 2012" | Static + hatching overlay | Multi-indicator analysis |
| "Analyze Colorado River Basin drying trends 2003–2023" | Time series chart | Mann-Kendall trend |

After running any query, try follow-ups:
- "What did I just ask about?"
- "Show me the same for Texas"
- "How does that compare to last year?"

---

## Components

### `HydrologyDarkChat.tsx`
Main page component. Manages chat state, message history, user identity, PDF export, and orchestrates the streaming workflow. ~600 lines.

### `AzureMapView.tsx`
Renders the interactive map. Initializes Azure Maps, loads backend-generated tiles, attaches the colorbar, and handles fallback to static PNG when tiles aren't available. Supports both continuous and categorical color scales.

### `ColorbarLegend.tsx`
Adaptive legend component. Switches between two modes based on backend metadata:
- **Continuous mode:** CSS gradient with numeric tick labels (used for temperature, precipitation, SPI, etc.)
- **Categorical mode:** 11 stacked color swatches with USDM labels (D4, D3, D2, D1, D0, NULL, W0, W1, W2, W3, W4) — matches the SPoRT-LIS operational convention

### `ProgressSteps.tsx`
Live progress indicator showing the analysis pipeline as it runs. Updates on SSE events: `PARSING_QUERY`, `MEMORY_RETRIEVAL`, `AGENT_THINKING`, `LOADING_DATA`, `EXECUTING_CODE`, `CREATING_MAP`, `GENERATING_TILES`, `COMPLETED`.

### `useStreamingChat.ts`
Custom React hook wrapping the SSE streaming connection to the backend. Returns:
- `steps` — current progress events
- `isStreaming` — boolean flag
- `sendStreamingQuery(query, userId, threadId)` — kick off a query
- `resetSteps()` — clear progress state

### `userIdentity.ts`
Manages the stable pseudonymous user ID. Stored in `localStorage`. Same ID across browser sessions enables long-term memory; `clearUserId()` wipes it for a fresh start.

---

## How the conversational memory works

Each user gets a stable pseudonymous ID generated in their browser. When a query is sent, the backend:

1. Looks up past conversations for that ID in Azure AI Search (vector store)
2. Filters by semantic similarity (threshold 0.3) AND metadata (timestamps, variables, regions)
3. Injects relevant context only when the query references prior interactions ("same", "that", "compare")
4. Stores the new analysis (variable, region, date, methodology) back to memory after completion

This means follow-up queries like "show me the same for California" work without restating the variable, time period, or visualization style. The frontend doesn't manage memory directly — it just sends the user ID and lets the backend handle retrieval.

---

## Visualization modes explained

The backend returns different response shapes depending on the analysis. The frontend automatically selects the appropriate display mode:

### Tile mode (interactive)
Used for large-area raw data queries. Backend renders 256×256 PNG tiles on-demand via FastAPI. Azure Maps fetches tiles as the user pans and zooms.

**Triggered when:** `use_tiles: true` and `tile_config.tile_url` is present.

```typescript
// In response payload:
{
  use_tiles: true,
  tile_config: {
    tile_url: "http://backend/api/tiles/{z}/{x}/{y}.png?vmin=0&vmax=100&cmap=usdm_11class",
    color_scale: { vmin: 0, vmax: 100, categorical: true, class_labels: [...], class_colors: [...] }
  },
  bounds: { north, south, east, west }
}
```

### Overlay mode (georeferenced PNG)
Used for smaller regions or when tile generation isn't possible (monthly data, derived computations). A single transparent PNG is overlaid on the Azure Maps base layer.

**Triggered when:** `overlay_url` exists, `use_tiles: false`.

### Static mode (no map)
Used for comparisons, multi-panel figures, time series, and animations where interactive panning doesn't make sense.

**Triggered when:** `type: "simple_visualization"` or `computation_type` is `comparison`/`animation`/`trend`.

---

## PDF export

The "Export PDF" button captures the entire conversation including all maps and explanations, then generates a multi-page PDF.

Implementation details:
- Interactive Azure Maps are hidden during export and replaced with their static PNG equivalents
- `html2canvas` captures the conversation container at 2× resolution
- `jsPDF` paginates the canvas across A4 pages with a NASA-themed header and footer
- Maps and color legends are preserved with full fidelity

Click "📄 Export PDF" after any conversation to download.

---

## Browser support

- Chrome / Edge (recommended) — full support including SSE streaming
- Firefox — full support
- Safari 14+ — full support
- Mobile browsers — functional but interactive maps work best on desktop

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React 18 with hooks |
| Language | TypeScript 5 |
| Build tool | Vite 5 |
| Styling | Tailwind CSS |
| Maps | Azure Maps Control (atlas) |
| State | React state + custom hooks (no Redux) |
| Streaming | Native EventSource API |
| Charts | Recharts (where used) |
| PDF | jsPDF + html2canvas |
| Hosting | Azure Static Web Apps |

---

## Deployment

### Azure Static Web Apps (recommended)

1. Push the repository to GitHub
2. In Azure Portal, create a new Static Web App
3. Connect it to your GitHub repo
4. Configure build settings:
   - **App location:** `/`
   - **Output location:** `dist`
   - **Build command:** `npm run build`
5. Add environment variables in the Static Web Apps configuration:
   - `VITE_API_BASE_URL` — your backend URL
   - `VITE_AZURE_MAPS_SUBSCRIPTION_KEY` — your Azure Maps key

The CI/CD pipeline is generated automatically via GitHub Actions.

### Other hosts

Build with `npm run build`, then upload `dist/` to any static host (Netlify, Vercel, S3 + CloudFront, GitHub Pages).

For sites with custom paths, set `base` in `vite.config.ts`:

```ts
export default defineConfig({
  base: '/your-subpath/',
  // ...
})
```

---

## Project structure

```
Frontend-Copilot-NLDAS-3/
├── src/
│   ├── components/
│   │   ├── HydrologyDarkChat.tsx   # Main chat orchestrator
│   │   ├── AzureMapView.tsx        # Interactive map + colorbar wiring
│   │   ├── ColorbarLegend.tsx      # Continuous + categorical legend
│   │   └── ProgressSteps.tsx       # Streaming progress UI
│   ├── hooks/
│   │   └── useStreamingChat.ts     # SSE connection wrapper
│   ├── services/
│   │   └── multiAgent.ts           # Backend API client
│   ├── utils/
│   │   ├── userIdentity.ts         # Pseudonymous ID management
│   │   └── geotiffLoader.ts        # Optional GeoTIFF rendering
│   ├── types.ts                    # TypeScript interfaces
│   └── App.tsx                     # Root component
├── public/
│   ├── total.svg                   # Header animation
│   └── ...
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── package.json
└── README.md
```

---

## Known limitations

- **Interactive maps require Azure Maps key** — for fully offline / self-hosted scenarios, only static map mode is available
- **Mobile UX** — chat works on mobile, but interactive map panning is best on desktop
- **PDF export quality** — large conversations may take 10–20 seconds to render; very long sessions can produce 5+ MB PDFs

---

## Roadmap

- [ ] Side-by-side comparison view (multiple queries displayed simultaneously)
- [ ] Saved/named conversation threads with shareable URLs
- [ ] Time-slider control for animations
- [ ] Layer toggle for combining variables on one map
- [ ] Mobile-optimized layout
- [ ] Light/dark theme switcher (currently dark only)

---

## Citation

If you use the Hydrology Copilot in your research, please cite:

> Hashemi, M. G. Z., Kumar, S. V., Hartwig, J., Lopez, J. C., Hain, C. R., & Bolten, J. (2026). Hydrology Copilot: A Cloud-Native AI System for Hydrological Data Analysis. *International Journal of Applied Earth Observation and Geoinformation*.

---

## Related projects

- 🔬 **Backend:** https://github.com/NASAWaterInsight/Backend-Copilot-NLDAS-3
- 📊 **NLDAS-3 dataset:** https://github.com/NASAWaterInsight/NLDAS-3
- 🛰️ **Data access guide:** https://github.com/NASAWaterInsight/NLDAS-3/blob/develop/data_access/1-download_from_aws.md

---

## Acknowledgments

Funded by NASA Earth Sciences Division. Cloud architecture developed in collaboration with the Microsoft Azure team. Part of the **NASA Water Insight** initiative.

**Project leads:**
- Mahya G. Z. Hashemi (NASA GSFC / SAIC) — mahyasadat.ghazizadehhashemi@nasa.gov
- Sujay V. Kumar (NASA GSFC)
- John Bolten (NASA GSFC)

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Contributing

Pull requests welcome! For substantial changes, please open an issue first.

```bash
# Fork, then:
git checkout -b feature/your-feature
npm install
npm run dev
# ... make changes ...
npm run build   # ensure production build succeeds
git commit -am "Add: your feature"
git push origin feature/your-feature
# Open a PR on GitHub
```

---

## Troubleshooting

**"Backend connection error":** Verify the backend is running and `VITE_API_BASE_URL` matches its host/port. Check browser console for CORS errors.

**Maps show blank tiles:** Open browser console — if you see 401 errors from Azure Maps, your subscription key is invalid or out of quota. Free tier allows 1,000 transactions/day.

**Legend shows continuous gradient when it should be categorical:** Open browser console (F12) and look for `🎨 tile_config.color_scale:`. If `categorical: true` is missing, the backend isn't forwarding the field — check backend `create_tile_config` in `agent_chat.py`.

**PDF export hangs:** Long conversations (10+ maps) can take a while. Wait at least 30 seconds before assuming failure. Check console for `html2canvas` errors.

**Memory not working ("show me the same" doesn't pick up context):** Open the debug panel (🔥 button at the bottom) and verify `userId` is consistent across queries. Try "What did I just ask about?" to confirm the backend can reach Azure AI Search.

For more help, file an issue at https://github.com/NASAWaterInsight/Frontend-Copilot-NLDAS-3/issues
