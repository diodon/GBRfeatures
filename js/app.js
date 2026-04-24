const App = {
  map: null,
  allFeatures: [],          // Point features (phase 1) → Polygon features (phase 2)
  featuresById: new Map(),  // _fid → feature
  colorMode: 'type',
  currentBasemap: 'osm',
  _selectedId: null,
  _phase2Ready: false,
  _labelsVisible: false,

  async init() {
    this._initMap();
    this._initControls();

    this.map.on('load', async () => {
      this._addBasemap('osm');
      Draw.init(this.map);
      Panel.showPlaceholder();
      await this._loadPhase1();
      this._loadPhase2();   // fire-and-forget
    });
  },

  // ── Phase 1: centroids (instant) ─────────────────────────────────────────

  async _loadPhase1() {
    const res = await fetch('data/centroids.geojson');
    const geojson = await res.json();

    this.allFeatures = geojson.features;
    geojson.features.forEach(f => this.featuresById.set(+f.properties._fid, f));

    this.map.addSource('gbr', { type: 'geojson', data: geojson, generateId: false });
    this._addCircleLayer();

    document.getElementById('loading')?.remove();
    this._setStatus('Loading full geometry in background…');
  },

  _addCircleLayer() {
    this.map.addLayer({
      id: 'gbr-circles',
      type: 'circle',
      source: 'gbr',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2, 9, 5, 13, 8],
        'circle-color': this._colorExpression(),
        'circle-opacity': 0.85,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 0.5
      }
    });

    this.map.addLayer({
      id: 'gbr-circle-highlight',
      type: 'circle',
      source: 'gbr',
      filter: ['==', ['get', '_fid'], -1],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4, 9, 8, 13, 12],
        'circle-color': '#FBBF24',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2
      }
    });

    this._bindClickEvents('gbr-circles', 'gbr-circle-highlight');
    this._addLabelLayer();
  },

  _addLabelLayer() {
    try {
      // MapLibre validates text-field against style.stylesheet.glyphs at addLayer time.
      // The inline style object doesn't always propagate there, so patch it directly.
      const glyphsUrl = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';
      if (this.map.style?.stylesheet && !this.map.style.stylesheet.glyphs) {
        this.map.style.stylesheet.glyphs = glyphsUrl;
      }
      this.map.addLayer({
        id: 'gbr-labels',
        type: 'symbol',
        source: 'gbr',
        minzoom: 9,
        layout: {
          'text-field': ['coalesce', ['get', 'GBR_NAME'], ['get', 'LOC_NAME_S']],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 9, 10, 14, 14],
          'text-anchor': 'center',
          'text-max-width': 8,
          'visibility': 'none'
        },
        paint: {
          'text-color': '#f1f5f9',
          'text-halo-color': '#0f172a',
          'text-halo-width': 1.5
        }
      });
    } catch (err) {
      console.error('Label layer failed to add:', err);
    }
  },

  // ── Phase 2: full polygons (background) ──────────────────────────────────

  async _loadPhase2() {
    try {
      const res = await fetch('data/features.fgb');

      const features = [];
      for await (const feature of flatgeobuf.deserialize(res.body)) {
        feature.id = feature.properties._fid;
        features.push(feature);
        this.featuresById.set(+feature.properties._fid, feature);
      }

      this.allFeatures = features;
      this._phase2Ready = true;

      // Swap source data and replace circle layers with polygon layers
      this.map.getSource('gbr').setData({ type: 'FeatureCollection', features });
      this._replaceCirclesWithPolygons();
      this._clearStatus();

      // If a feature was already selected, re-show it with geometry exports enabled
      if (this._selectedId) {
        const f = this.featuresById.get(this._selectedId);
        if (f) Panel.showFeature(f, true);
      }

    } catch (err) {
      console.error('Phase 2 load failed:', err);
      this._setStatus('Could not load full geometry — polygon view unavailable', true);
    }
  },

  _replaceCirclesWithPolygons() {
    const beforeLayer = ['bbox-fill', 'gbr-labels'].find(id => this.map.getLayer(id));

    if (this.map.getLayer('gbr-circle-highlight')) this.map.removeLayer('gbr-circle-highlight');
    if (this.map.getLayer('gbr-circles'))          this.map.removeLayer('gbr-circles');

    this.map.addLayer({
      id: 'gbr-fill',
      type: 'fill',
      source: 'gbr',
      paint: { 'fill-color': this._colorExpression(), 'fill-opacity': 0.65 }
    }, beforeLayer);

    this.map.addLayer({
      id: 'gbr-outline',
      type: 'line',
      source: 'gbr',
      paint: { 'line-color': '#ffffff', 'line-width': 0.5, 'line-opacity': 0.6 }
    }, beforeLayer);

    this.map.addLayer({
      id: 'gbr-highlight',
      type: 'line',
      source: 'gbr',
      filter: ['==', ['get', '_fid'], this._selectedId ?? -1],
      paint: { 'line-color': '#FBBF24', 'line-width': 3 }
    }, beforeLayer);

    this._bindClickEvents('gbr-fill', 'gbr-highlight');
  },

  // ── Shared helpers ───────────────────────────────────────────────────────

  _bindClickEvents(fillLayer, highlightLayer) {
    this.map.on('click', fillLayer, e => {
      const fid = +e.features[0].properties._fid;
      const feature = this.featuresById.get(fid);
      if (feature) {
        this._selectedId = fid;
        this._setHighlight(highlightLayer, fid);
        Panel.showFeature(feature, this._phase2Ready);
      }
    });

    this.map.on('mousemove', fillLayer, e => {
      this.map.getCanvas().style.cursor = 'pointer';
      const p = e.features[0].properties;
      const name = p.GBR_NAME || p.LOC_NAME_S || '(unnamed)';
      const tip = document.getElementById('hover-tooltip');
      if (tip) {
        tip.textContent = name;
        tip.style.left = (e.point.x + 14) + 'px';
        tip.style.top  = (e.point.y - 10) + 'px';
        tip.style.display = 'block';
      }
    });
    this.map.on('mouseleave', fillLayer, () => {
      this.map.getCanvas().style.cursor = '';
      const tip = document.getElementById('hover-tooltip');
      if (tip) tip.style.display = 'none';
    });
  },

  _setHighlight(layerId, fid) {
    if (this.map.getLayer(layerId)) {
      this.map.setFilter(layerId, ['==', ['get', '_fid'], fid]);
    }
  },

  _colorExpression() {
    if (this.colorMode === 'single') return Config.singleColor;
    const expr = ['match', ['get', 'FEAT_NAME']];
    Object.entries(Config.featureColors).forEach(([t, c]) => expr.push(t, c));
    expr.push('#64748B');
    return expr;
  },

  _updateLayerColors() {
    const color = this._colorExpression();
    if (this.map.getLayer('gbr-fill'))    this.map.setPaintProperty('gbr-fill', 'fill-color', color);
    if (this.map.getLayer('gbr-circles')) this.map.setPaintProperty('gbr-circles', 'circle-color', color);
  },

  _setStatus(msg, isError = false) {
    const el = document.getElementById('status-bar');
    if (!el) return;
    el.textContent = msg;
    el.className = isError ? 'error' : '';
    el.style.display = 'block';
  },

  _clearStatus() {
    const el = document.getElementById('status-bar');
    if (el) el.style.display = 'none';
  },

  // ── Public API (used by Panel, Draw) ─────────────────────────────────────

  clearHighlight() {
    this._selectedId = null;
    if (this.map.getLayer('gbr-highlight'))        this.map.setFilter('gbr-highlight', ['==', ['get', '_fid'], -1]);
    if (this.map.getLayer('gbr-circle-highlight')) this.map.setFilter('gbr-circle-highlight', ['==', ['get', '_fid'], -1]);
  },

  zoomToFeature(feature) {
    // Phase 1: use centroid point; Phase 2: use polygon bbox
    if (feature.geometry.type === 'Point') {
      const [lon, lat] = feature.geometry.coordinates;
      this.map.flyTo({ center: [lon, lat], zoom: 11 });
    } else {
      const bbox = turf.bbox(feature);
      this.map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 80, maxZoom: 14 });
    }
    this._selectedId = feature.properties._fid;
    const hl = this.map.getLayer('gbr-highlight') ? 'gbr-highlight' : 'gbr-circle-highlight';
    this._setHighlight(hl, +feature.properties._fid);
    Panel.showFeature(feature, this._phase2Ready);
  },

  // ── Controls ─────────────────────────────────────────────────────────────

  _initMap() {
    this.map = new maplibregl.Map({
      container: 'map',
      style: {
        version: 8,
        sources: {},
        layers: [],
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
      },
      center: Config.center,
      zoom: Config.zoom
    });
    this.map.addControl(new maplibregl.NavigationControl(), 'top-left');
    this.map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
  },

  _initControls() {
    document.getElementById('basemap-osm').addEventListener('click',  () => this.switchBasemap('osm'));
    document.getElementById('basemap-esri').addEventListener('click', () => this.switchBasemap('esri'));

    document.getElementById('color-type').addEventListener('click', () => {
      this.colorMode = 'type';
      this._updateLayerColors();
      document.getElementById('color-type').classList.add('active');
      document.getElementById('color-single').classList.remove('active');
    });

    document.getElementById('color-single').addEventListener('click', () => {
      this.colorMode = 'single';
      this._updateLayerColors();
      document.getElementById('color-single').classList.add('active');
      document.getElementById('color-type').classList.remove('active');
    });

    document.getElementById('toggle-labels').addEventListener('click', () => this.toggleLabels());
  },

  toggleLabels() {
    this._labelsVisible = !this._labelsVisible;
    if (this.map.getLayer('gbr-labels')) {
      this.map.setLayoutProperty('gbr-labels', 'visibility', this._labelsVisible ? 'visible' : 'none');
    }
    const btn = document.getElementById('toggle-labels');
    btn.textContent = this._labelsVisible ? 'On' : 'Off';
    btn.classList.toggle('active', this._labelsVisible);
  },

  _addBasemap(type) {
    this.map.addSource('basemap', Config.basemaps[type]);
    this.map.addLayer({ id: 'basemap', type: 'raster', source: 'basemap' });
    this.currentBasemap = type;
    document.getElementById(`basemap-${type}`).classList.add('active');
  },

  switchBasemap(type) {
    if (type === this.currentBasemap) return;
    document.getElementById(`basemap-${this.currentBasemap}`).classList.remove('active');

    // Find first GBR layer to insert basemap below it
    const firstGbr = ['gbr-circles', 'gbr-fill'].find(id => this.map.getLayer(id));

    if (this.map.getLayer('basemap'))  this.map.removeLayer('basemap');
    if (this.map.getSource('basemap')) this.map.removeSource('basemap');

    this.map.addSource('basemap', Config.basemaps[type]);
    this.map.addLayer({ id: 'basemap', type: 'raster', source: 'basemap' }, firstGbr);

    this.currentBasemap = type;
    document.getElementById(`basemap-${type}`).classList.add('active');
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
