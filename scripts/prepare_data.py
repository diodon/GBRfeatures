#!/usr/bin/env python3
"""Convert TS_GBR_features.gpkg to GeoJSON / FlatGeobuf files for the web app."""

import json
import subprocess
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR   = os.path.dirname(SCRIPT_DIR)
GPKG       = os.path.join(ROOT_DIR, 'TS_GBR_features.gpkg')
OUT_GEOJSON   = os.path.join(ROOT_DIR, 'data', 'features.geojson')
OUT_CENTROIDS = os.path.join(ROOT_DIR, 'data', 'centroids.geojson')
OUT_FGB       = os.path.join(ROOT_DIR, 'data', 'features.fgb')
TMP = '/tmp/gbr_raw.geojson'

FIELDS = 'GBR_NAME,LOC_NAME_S,FEAT_NAME,LEVEL_1,LEVEL_2,LEVEL_3,LABEL_ID,SHAPE_AREA,X_COORD,Y_COORD,UNIQUE_ID,CODE'

# ── Step 1: GPKG → simplified GeoJSON ─────────────────────────────────────
print('Converting GPKG to GeoJSON with simplification...')
result = subprocess.run([
    'ogr2ogr', '-f', 'GeoJSON', TMP, GPKG,
    '-t_srs', 'EPSG:4326',
    '-simplify', '0.0005',
    '-select', FIELDS
], capture_output=True, text=True)

if result.returncode != 0:
    print('ogr2ogr failed:', result.stderr)
    sys.exit(1)

print('Adding _fid as property...')
with open(TMP) as f:
    data = json.load(f)

for i, feature in enumerate(data['features'], start=1):
    feature['id'] = i
    feature['properties']['_fid'] = i

with open(OUT_GEOJSON, 'w') as f:
    json.dump(data, f, separators=(',', ':'))

size_mb = os.path.getsize(OUT_GEOJSON) / 1_048_576
print(f'  {OUT_GEOJSON}  ({size_mb:.1f} MB, {len(data["features"])} features)')

# ── Step 2: centroids.geojson (points from X_COORD / Y_COORD) ─────────────
print('Generating centroids...')
centroids = {
    'type': 'FeatureCollection',
    'features': []
}
for f in data['features']:
    p = f['properties']
    centroids['features'].append({
        'type': 'Feature',
        'id': f['id'],
        'geometry': {'type': 'Point', 'coordinates': [p['X_COORD'], p['Y_COORD']]},
        'properties': p
    })

with open(OUT_CENTROIDS, 'w') as f:
    json.dump(centroids, f, separators=(',', ':'))

size_mb = os.path.getsize(OUT_CENTROIDS) / 1_048_576
print(f'  {OUT_CENTROIDS}  ({size_mb:.1f} MB)')

# ── Step 3: features.fgb (FlatGeobuf from full polygons) ──────────────────
print('Converting to FlatGeobuf...')
result = subprocess.run([
    'ogr2ogr', '-f', 'FlatGeobuf', OUT_FGB, OUT_GEOJSON
], capture_output=True, text=True)

if result.returncode != 0:
    print('ogr2ogr fgb failed:', result.stderr)
    sys.exit(1)

size_mb = os.path.getsize(OUT_FGB) / 1_048_576
print(f'  {OUT_FGB}  ({size_mb:.1f} MB)')
print('Done.')
