#!/usr/bin/env python3
"""Convert TS_GBR_features.gpkg to a simplified GeoJSON for the web app."""

import json
import subprocess
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
GPKG = os.path.join(ROOT_DIR, 'TS_GBR_features.gpkg')
OUT = os.path.join(ROOT_DIR, 'data', 'features.geojson')
TMP = '/tmp/gbr_raw.geojson'

FIELDS = 'GBR_NAME,LOC_NAME_S,FEAT_NAME,LEVEL_1,LEVEL_2,LEVEL_3,DATASET,SHAPE_AREA,Country,X_COORD,Y_COORD,UNIQUE_ID,CODE,RegionID'

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

print('Adding fid as property...')
with open(TMP) as f:
    data = json.load(f)

for i, feature in enumerate(data['features'], start=1):
    feature['id'] = i
    feature['properties']['_fid'] = i

with open(OUT, 'w') as f:
    json.dump(data, f, separators=(',', ':'))

size_mb = os.path.getsize(OUT) / 1_048_576
print(f'Done: {OUT}  ({size_mb:.1f} MB, {len(data["features"])} features)')
