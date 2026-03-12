# Hydrology Copilot — Frontend

React/TypeScript web client for the Hydrology Copilot, providing a conversational interface for natural-language-driven hydrological data analysis using NASA's NLDAS-3 dataset.

**Paper:** *Hydrology Copilot: A Cloud-Native AI System for Hydrological Data Analysis* (submitted to Computers and Geosciences Journal)

**Backend repo:** [NASAWaterInsight/Backend-Copilot-NLDAS-3](https://github.com/NASAWaterInsight/Backend-Copilot-NLDAS-3)

---

## Overview

The frontend is a single-page React application that serves as the primary interface for natural-language-driven hydrologic data exploration. Users issue free-form text queries and receive:

- **Interactive maps** — Azure Maps tile layers for large-area exploration
- **Static maps** — Publication-ready PNG visualizations with legends and colorbars
- **Comparison views** — Side-by-side visualizations for temporal/spatial comparisons
- **Generated code** — Transparent Python code for scientific reproducibility
- **AI summaries** — Natural-language explanations of results
- **Data exports** — GeoTIFF and GeoJSON downloads

The interface supports persistent conversational memory, allowing multi-turn analytical discourse (e.g., "Show me drought in Michigan" → "Show me the same for California" → "How does that compare to July 2023?").

---

## Prerequisites

- **Node.js 18+** and **npm**
- **Backend running** on `http://localhost:8000` (see [Backend-Copilot-NLDAS-3](https://github.com/NASAWaterInsight/Backend-Copilot-NLDAS-3))

### Install Node.js

**macOS (Homebrew):**
```bash
brew install node
```

**Windows:**
Download from https://nodejs.org/

**Verify:**
```bash
node --version
npm --version
```

---

## Setup

### 1. Clone the Repository

```bash
git clone https://github.com/NASAWaterInsight/Frontend-Copilot-NLDAS-3.git
cd Frontend-Copilot-NLDAS-3
```

### 2. Configure Environment

Create a `.env` file in the project root:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_AZURE_MAPS_SUBSCRIPTION_KEY=<your-azure-maps-key>
VITE_AZURE_MAPS_CLIENT_ID=<your-azure-maps-client-id>
```

> **Important:** Never commit this file. It contains API keys.

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Development Server

```bash
npm run dev
```

The app opens at `http://localhost:5173` (default Vite port).

### 5. Build for Production

```bash
npm run build
npm run preview    # Preview the production build locally
```

---

## Usage

1. Start the **backend** first (`python3 main.py` in the backend repo)
2. Start the **frontend** (`npm run dev`)
3. Type a natural-language query, for example:
   - "Show me precipitation in Florida on October 12, 2023"
   - "Show drought conditions in Michigan for August 2023"
   - "Compare SPI in California May 2023 vs June 2023"
   - "Show areas in Texas where SPI was below -1.0 for June 2012"

The system will generate code, execute the analysis, and display results as interactive and static maps.

### Interface Features

- **New Chat** — Start a fresh analytical session
- **Debug Info** — Expandable panel for development diagnostics
- **Download** — Export static maps as PNG files
- **Scroll to zoom** — Interactive Azure Maps exploration

---

## Project Structure

```
Frontend-Copilot-NLDAS-3/
├── src/                     # Source code
│   └── HydrologyDarkChat.tsx  # Main chat component
├── scripts/                 # Build and utility scripts
├── index.html               # Entry point
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite build configuration
├── tailwind.config.cjs      # Tailwind CSS configuration
├── postcss.config.cjs       # PostCSS configuration
└── .env                     # Environment variables (not in repo — create manually)
```

---

## Key Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| React | ^18.2.0 | UI framework |
| TypeScript | ^5.0.0 | Type-safe JavaScript |
| azure-maps-control | ^3.6.1 | Interactive map visualization |
| Vite | — | Build tool and dev server |
| Tailwind CSS | — | Utility-first CSS styling |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Connecting to server" hangs | Make sure the backend is running on `http://localhost:8000`. Restart backend if needed. |
| Maps not loading | Check that `VITE_AZURE_MAPS_SUBSCRIPTION_KEY` and `VITE_AZURE_MAPS_CLIENT_ID` are set in `.env` |
| Static maps not showing for analysis queries | Pull the latest backend version and run `python3 agents/agent_creation.py` |
| `npm install` fails | Try deleting `node_modules` and `package-lock.json`, then run `npm install` again |

---

## Related Repositories

- **Backend:** [NASAWaterInsight/Backend-Copilot-NLDAS-3](https://github.com/NASAWaterInsight/Backend-Copilot-NLDAS-3)
- **NLDAS-3 Data Access:** [NASAWaterInsight/NLDAS-3](https://github.com/NASAWaterInsight/NLDAS-3)

## Contact

Mahya G.Z. Hashemi — mahyasadat.ghazizadehhashemi@nasa.gov
Hydrological Sciences Laboratory, NASA Goddard Space Flight Center

## License

[NASA Open Source Agreement — to be determined by GSFC Technology Transfer Office]

