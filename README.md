# GBR Feature Explorer

An interactive web map for exploring reef and island features of the **Great Barrier Reef (GBR)** and **Torres Strait** — 9,133 mapped polygons served as a static GitHub Pages application with no backend required.

**Live app:** https://diodon.github.io/GBRfeatures/

---

## Features

### Map interaction
- Pan, zoom and click any feature to inspect its full attributes in the side panel
- Toggle between **OpenStreetMap** and **ESRI World Imagery** (satellite) basemaps
- Colour features by **type** (Reef, Island, Rock, Bank, Cay, Terrestrial Reef) or switch to a **single colour**

### Drawing tools
| Tool | What it does |
|---|---|
| **Polygon** | Draw a free polygon on the map; outputs its WKT representation |
| **BBox** | Two-click rubber-band rectangle; outputs corner coordinates and WKT |
| **Query features** | Finds all GBR features whose centroid falls inside the drawn shape |

### Export — single selected feature
After clicking a feature, three export options are available from the side panel:

| Export | Columns | Formats |
|---|---|---|
| Name + Type + Centroid | `name`, `type`, `longitude`, `latitude` | CSV, JSON |
| Name + Type + WKT | `name`, `type`, `wkt` | CSV, JSON |
| BBox + Buffer | `name`, `type`, `buffer_km`, `minX`, `minY`, `maxX`, `maxY`, `bbox_wkt` | CSV, JSON |

The **buffer** (0–100 km) is set with a slider before exporting.

### Export — query results
The same three export options apply to the entire set of features returned by a spatial query, enabling bulk download.

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
| `SHAPE_AREA` | Area in decimal-degree² |
| `CODE` | Feature code |
| `RegionID` | Region identifier |
| `UNIQUE_ID` | Dataset-internal unique identifier |

---

## Tech stack

| Library | Version | Purpose |
|---|---|---|
| [MapLibre GL JS](https://maplibre.org/) | 3.6.2 | WebGL map rendering |
| [MapLibre GL Draw](https://github.com/mapbox/mapbox-gl-draw) | 1.4.3 | Polygon and rectangle drawing |
| [Turf.js](https://turfjs.org/) | 6.5.0 | Centroid, bbox, buffer, point-in-polygon |
| Vanilla JS / HTML / CSS | — | No build step, no framework |

All libraries are loaded from CDN. The app is a static site that runs entirely in the browser.

---

## File structure

```
GBRfeatures/
├── index.html              # App shell and layout
├── css/
│   └── style.css           # Dark-themed responsive UI
├── js/
│   ├── config.js           # Basemap URLs, colour palette
│   ├── wkt.js              # GeoJSON → WKT converter (Polygon, MultiPolygon)
│   ├── export.js           # CSV / JSON download logic
│   ├── panel.js            # Side panel: feature details, query results, export UI
│   ├── query.js            # Spatial filter (centroid-in-polygon)
│   ├── draw.js             # Draw tools: polygon (GL Draw) + 2-click bbox
│   └── app.js              # MapLibre init, layers, events, basemap / colour switching
├── data/
│   └── features.geojson    # 8.9 MB — simplified polygons, all attributes + _fid
└── scripts/
    └── prepare_data.py     # One-time GPKG → GeoJSON conversion script
```

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

> Opening `index.html` directly as a `file://` URL will fail due to browser CORS restrictions when fetching `data/features.geojson`.

---

## Regenerating the data file

If the source GeoPackage changes, regenerate `data/features.geojson` with:

```bash
python3 scripts/prepare_data.py
```

Requirements: `gdal` (provides `ogr2ogr`), Python 3.

The script:
1. Runs `ogr2ogr` to convert the GPKG to GeoJSON in WGS84, applying a 0.0005° simplification tolerance
2. Retains 14 key attribute fields
3. Adds `_fid` as a feature property and sets the GeoJSON `id` — both used for O(1) feature lookup on click

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

Geometries in `features.geojson` are simplified GeoJSON. The `js/wkt.js` module converts them to standard WKT strings at 7 decimal-place precision:

- `Polygon` → `POLYGON ((lon lat, …))`
- `MultiPolygon` → `MULTIPOLYGON (((lon lat, …)), ((…)))`

For buffered bounding boxes, Turf expands the feature's envelope by the requested distance (km) and the result is expressed as a 5-vertex closed `POLYGON`.

---

## Acknowledgements

Data: AIMS NESP Torres Strait Features dataset combined with GBR Features, produced by the Australian Institute of Marine Science (AIMS).
