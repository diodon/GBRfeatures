const App = {
  map: null,
  allFeatures: [],          // Point features (phase 1) → Polygon features (phase 2)
  featuresById: new Map(),  // _fid → feature
  colorMode: 'type',
  currentBasemap: 'osm',
  _selectedId: null,
  _phase2Ready: false,

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
  },

  // ── Phase 2: full polygons (background) ──────────────────────────────────

  async _loadPhase2() {
    try {
      const res = await fetch('data/features.fgb');
      const buffer = await res.arrayBuffer();

      const features = [];
      for await (const feature of flatgeobuf.deserialize(new Uint8Array(buffer))) {
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
    const beforeLayer = this.map.getLayer('bbox-fill') ? 'bbox-fill' : undefined;

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

    this.map.on('mouseenter', fillLayer, () => { this.map.getCanvas().style.cursor = 'pointer'; });
    this.map.on('mouseleave', fillLayer, () => { this.map.getCanvas().style.cursor = ''; });
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
      style: { version: 8, sources: {}, layers: [] },
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
