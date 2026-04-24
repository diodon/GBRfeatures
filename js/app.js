const App = {
  map: null,
  allFeatures: [],
  featuresById: new Map(),
  colorMode: 'type',   // 'type' | 'single'
  currentBasemap: 'osm',
  _selectedId: null,

  async init() {
    this._initMap();
    this._initControls();

    const res = await fetch('data/features.geojson');
    const geojson = await res.json();

    this.allFeatures = geojson.features;
    this.allFeatures.forEach(f => this.featuresById.set(f.properties._fid, f));

    this.map.on('load', () => {
      this._addBasemap('osm');
      this._addFeaturesLayer(geojson);
      Draw.init(this.map);
      Panel.showPlaceholder();
    });
  },

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
    document.getElementById('basemap-osm').addEventListener('click', () => this.switchBasemap('osm'));
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

    const layersToRestore = [];
    ['gbr-fill', 'gbr-outline', 'gbr-highlight'].forEach(id => {
      if (this.map.getLayer(id)) layersToRestore.push(id);
    });

    if (this.map.getLayer('basemap')) this.map.removeLayer('basemap');
    if (this.map.getSource('basemap')) this.map.removeSource('basemap');

    this.map.addSource('basemap', Config.basemaps[type]);
    this.map.addLayer({ id: 'basemap', type: 'raster', source: 'basemap' }, layersToRestore[0] || undefined);

    this.currentBasemap = type;
    document.getElementById(`basemap-${type}`).classList.add('active');
  },

  _addFeaturesLayer(geojson) {
    this.map.addSource('gbr', { type: 'geojson', data: geojson, generateId: false });

    this.map.addLayer({
      id: 'gbr-fill',
      type: 'fill',
      source: 'gbr',
      paint: {
        'fill-color': this._colorExpression(),
        'fill-opacity': 0.65
      }
    });

    this.map.addLayer({
      id: 'gbr-outline',
      type: 'line',
      source: 'gbr',
      paint: {
        'line-color': '#ffffff',
        'line-width': 0.5,
        'line-opacity': 0.6
      }
    });

    this.map.addLayer({
      id: 'gbr-highlight',
      type: 'line',
      source: 'gbr',
      filter: ['==', ['get', '_fid'], -1],
      paint: {
        'line-color': '#FBBF24',
        'line-width': 3
      }
    });

    this.map.on('click', 'gbr-fill', e => {
      if (e.originalEvent._fromDraw) return;
      const fid = e.features[0].properties._fid;
      const feature = this.featuresById.get(+fid);
      if (feature) {
        this._highlightFeature(+fid);
        Panel.showFeature(feature);
      }
    });

    this.map.on('mouseenter', 'gbr-fill', () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', 'gbr-fill', () => {
      this.map.getCanvas().style.cursor = '';
    });
  },

  _colorExpression() {
    if (this.colorMode === 'single') return Config.singleColor;

    const matchExpr = ['match', ['get', 'FEAT_NAME']];
    Object.entries(Config.featureColors).forEach(([type, color]) => {
      matchExpr.push(type, color);
    });
    matchExpr.push('#64748B');
    return matchExpr;
  },

  _updateLayerColors() {
    if (!this.map.getLayer('gbr-fill')) return;
    this.map.setPaintProperty('gbr-fill', 'fill-color', this._colorExpression());
  },

  _highlightFeature(fid) {
    this._selectedId = fid;
    this.map.setFilter('gbr-highlight', ['==', ['get', '_fid'], fid]);
  },

  clearHighlight() {
    this._selectedId = null;
    if (this.map.getLayer('gbr-highlight')) {
      this.map.setFilter('gbr-highlight', ['==', ['get', '_fid'], -1]);
    }
  },

  zoomToFeature(feature) {
    const bbox = turf.bbox(feature);
    this.map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 80, maxZoom: 14 });
    this._highlightFeature(feature.properties._fid);
    Panel.showFeature(feature);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
