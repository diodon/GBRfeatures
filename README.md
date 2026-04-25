# GBR Feature Explorer

An interactive web map for exploring reef and island features of the **Great Barrier Reef (GBR)** and **Torres Strait** — 9,133 mapped polygons served as a static GitHub Pages application with no backend required.

**Live app:** https://diodon.github.io/GBRfeatures/

---

## Features

### Map navigation
- Pan and zoom within the **Australia / GBR region** (minimum zoom and maximum bounds enforced)
- **Home button** — resets the view to the default GBR centre, zoom, and North-up orientation in one animated move
- **Custom compass** — circle-and-needle indicator that rotates live with the map; click to reset bearing to North
- Pitch / tilt is disabled — the map always stays fully horizontal

### Feature interaction
- Click any feature to inspect its full attributes in the side panel
- **Shift-click** to build a multi-feature selection — selected features are listed in the side panel with per-row × remove buttons and full export support; shift-click again to deselect; a regular click returns to single-feature mode
- **Hover tooltip** shows the local name and reef ID (`LOC_NAME_S`) of the feature under the cursor
- **Feature search** — type a name in the search box at the top of the side panel to get live suggestions; select one to zoom the map to that feature and show its details; ↑↓ Enter Esc keyboard navigation supported
- **Clear** button resets the drawing, the selection, and the search box simultaneously

### Visualisation
- Toggle between **OpenStreetMap** and **ESRI World Imagery** (satellite) basemaps
- Colour features by **type** (Reef, Island, Rock, Bank, Cay, Terrestrial Reef) or switch to a **single colour** — the feature-type legend shows/hides automatically
- **Labels** toggle shows feature names on the map at zoom ≥ 9
- **Dark / light theme** toggle (sun ☀ / moon 🌙 button in the header) — preference is saved across sessions

### Drawing tools
| Tool | What it does |
|---|---|
| **Polygon** | Draw a free polygon on the map |
| **BBox** | Two-click rubber-band rectangle |
| **Query features** | Finds all GBR features whose centroid falls inside the drawn shape |

### Export
The export panel is available after selecting a single feature, building a shift-click multi-selection, or running a spatial query.

**Always included:** `name`, `type`, `UNIQUE_ID`, `longitude`, `latitude` (centroid, WGS84 EPSG:4326)

**Optional toggles** — click to activate any combination:

| Toggle | Extra columns added |
|---|---|
| **WKT** | `wkt` — full polygon geometry as Well-Known Text |
| **BBox** | `minX`, `minY`, `maxX`, `maxY`, `bbox_wkt` |
| **Buffer** | `buffer_km` — applies a buffer (0–100 km) to the polygon before computing WKT and/or BBox |

WKT, BBox and Buffer are disabled until full polygon geometry has loaded in the background.

Choose **CSV** or **JSON**, then **Copy** to clipboard or **Download** as a file.

### Draw result panel
After drawing a polygon or bounding box, a panel in the lower-left of the map shows:
- The **WKT** of the shape (in a scrollable text area)
- The **bounding box** coordinates (`minX, minY, maxX, maxY`)
- **Copy WKT** and **Copy BBox** buttons to copy either value to the clipboard

---

## Dataset

| Property | Value |
|---|---|
| Source | `TS_GBR_features.gpkg` |
| Full name | TS_AIMS_NESP_Torres_Strait_Features_V1b_with_GBR_Features |
| CRS | GDA94 (EPSG:4283) → reprojected to WGS84 (EPSG:4326) for the web |
| Features | 9,133 MultiPolygon |
| Extent | 139.1°E – 153.5°E, 27.7°S – 9.0°S |
| Countries | Australia (8,753), Papua-New Guinea (380) |

### Feature types

| Type | Count | Colour |
|---|---|---|
| Reef | 6,423 | Blue |
| Island | 1,252 | Green |
| Rock | 484 | Grey |
| Bank | 466 | Amber |
| Cay | 279 | Cyan |
| Terrestrial Reef | 216 | Dark green |
| Other / Sand | 13 | Purple / Yellow |

### Datasets combined

- **GBR Features** — 5,213 features from the Great Barrier Reef
- **TS Features** — 3,920 features from the Torres Strait

### Attributes exposed in the app

| Field | Description |
|---|---|
| `GBR_NAME` | Official GBR name |
| `LOC_NAME_S` | Short local name |
| `FEAT_NAME` | Feature type (Reef, Island, Rock …) |
| `LEVEL_1/2/3` | Classification hierarchy |
| `DATASET` | Source dataset (GBR Features / TS Features) |
| `Country` | Australia or Papua-New Guinea |
| `SHAPE_AREA` | Area in km² |
| `CODE` | Feature code |
| `RegionID` | Region identifier |
| `UNIQUE_ID` | Dataset-internal unique identifier |

---

## Tech stack

| Library | Version | Purpose |
|---|---|---|
| [MapLibre GL JS](https://maplibre.org/) | 3.6.2 | WebGL map rendering |
| [MapLibre GL Draw](https://github.com/mapbox/mapbox-gl-draw) | 1.4.3 | Polygon and rectangle drawing |
| [FlatGeobuf](https://flatgeobuf.org/) | 4.4.0 | Streaming binary geospatial format for phase-2 polygon load |
| [Turf.js](https://turfjs.org/) | 6.5.0 | Centroid, bbox, buffer, point-in-polygon |
| Vanilla JS / HTML / CSS | — | No build step, no framework |

All libraries are loaded from CDN. The app is a static site that runs entirely in the browser.

---

## File structure

```
GBRfeatures/
├── index.html              # App shell, layout, help modal
├── css/
│   └── style.css           # Dark-themed responsive UI
├── js/
│   ├── config.js           # Map defaults, bounds, basemap URLs, colour palette
│   ├── wkt.js              # GeoJSON → WKT converter (Polygon, MultiPolygon)
│   ├── export.js           # CSV / JSON download logic
│   ├── panel.js            # Side panel: feature details, query results, export UI
│   ├── query.js            # Spatial filter (centroid-in-polygon)
│   ├── draw.js             # Draw tools: polygon (GL Draw) + 2-click bbox
│   ├── search.js           # Live feature-name search with suggestion dropdown
│   ├── theme.js            # Dark / light theme toggle with localStorage persistence
│   └── app.js              # MapLibre init, layers, custom controls, events
├── data/
│   ├── centroids.geojson   # Phase 1: 9,133 centroid points (~4 MB) — loads instantly
│   └── features.fgb        # Phase 2: full polygon geometry as FlatGeobuf (~5 MB) — streamed in background
└── scripts/
    └── prepare_data.py     # One-time GPKG → GeoJSON / FlatGeobuf conversion script
```

---

## Two-phase loading

To keep the initial load fast the app splits data into two phases:

1. **Phase 1 — centroids** (`data/centroids.geojson`, ~4 MB): point features load on startup and are immediately clickable and searchable. Features are shown as circles that scale with zoom.
2. **Phase 2 — polygons** (`data/features.fgb`, ~5 MB): the full polygon geometry is streamed in the background using FlatGeobuf. Once ready, circles are swapped for filled polygons and WKT / BBox exports become available.

---

## Running locally

No build step needed — just serve the directory with any static HTTP server.

```bash
# Python (built-in)
python3 -m http.server 8080

# Node.js (npx)
npx serve .
```

Then open **http://localhost:8080** in your browser.

> Opening `index.html` directly as a `file://` URL will fail due to browser CORS restrictions when fetching the data files.

---

## Regenerating the data files

If the source GeoPackage changes, regenerate the data files with:

```bash
python3 scripts/prepare_data.py
```

Requirements: `gdal` (provides `ogr2ogr`), Python 3.

The script:
1. Runs `ogr2ogr` to convert the GPKG to GeoJSON in WGS84, applying a 0.0005° simplification tolerance
2. Retains 14 key attribute fields and adds `_fid` for O(1) feature lookup
3. Generates `centroids.geojson` (point features) and `features.fgb` (FlatGeobuf polygons)

---

## Deployment (GitHub Pages)

The app is deployed directly from the `main` branch root.

To re-deploy after changes:

```bash
git add .
git commit -m "your message"
git push origin main
```

GitHub Pages rebuilds automatically on every push. Changes are live within ~1 minute.

To enable GitHub Pages on a fresh fork:
1. Go to **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` → folder: `/ (root)` → **Save**

---

## How spatial queries work

When the user draws a rectangle or polygon and clicks **Query features**, the app:

1. Takes the drawn GeoJSON geometry as the query shape
2. Iterates all 9,133 features in memory (loaded at startup)
3. Computes the **centroid** of each feature with Turf.js
4. Keeps features whose centroid falls inside the drawn shape (`turf.booleanPointInPolygon`)
5. Displays the matched features in the side panel with bulk export options

Using centroids (rather than full polygon intersection) is intentional: it is fast enough to run synchronously in the browser, and matches the intuitive meaning of "features in this area" for large reef polygons that may straddle a selection boundary.

---

## How WKT export works

Full polygon geometry is available after phase-2 loading completes. The `js/wkt.js` module converts GeoJSON geometries to standard WKT strings at 7 decimal-place precision:

- `Polygon` → `POLYGON ((lon lat, …))`
- `MultiPolygon` → `MULTIPOLYGON (((lon lat, …)), ((…)))`

For buffered bounding boxes, Turf expands the feature's envelope by the requested distance (km) and the result is expressed as a 5-vertex closed `POLYGON`.

---

## Data citation

Lawrey, E. P., Stewart M. (2016) *Complete Great Barrier Reef (GBR) Reef and Island Feature boundaries including Torres Strait (NESP TWQ 3.13, AIMS, TSRA, GBRMPA)* [Dataset]. eAtlas. https://doi.org/10.26274/vhj5-gr60

Metadata record: https://catalogue.eatlas.org.au/geonetwork/srv/eng/catalog.search#/metadata/d2396b2c-68d4-4f4b-aab0-52f7bc4a81f5
