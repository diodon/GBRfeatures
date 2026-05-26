const Draw = {
  _draw: null,
  _mode: null,        // 'polygon' | 'bbox' | null
  _bboxStart: null,
  _previewSrc: 'bbox-preview',
  _resultBox: null,

  init(map) {
    this._map = map;
    this._resultBox = document.getElementById('draw-result');

    this._draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {}
    });
    map.addControl(this._draw, 'top-left');

    map.on('draw.create', () => this._onPolygonComplete());
    map.on('draw.update', () => this._onPolygonComplete());

    document.getElementById('btn-draw-polygon').addEventListener('click', () => this._startPolygon());
    document.getElementById('btn-draw-bbox').addEventListener('click', () => this._startBBox());
    document.getElementById('btn-clear-draw').addEventListener('click', () => this._clear());
    document.getElementById('btn-query').addEventListener('click', () => this._runQuery());

    map.on('click', e => this._onMapClick(e));
    map.on('mousemove', e => this._onMouseMove(e));
  },

  _startPolygon() {
    Measure.clear();
    this._cancelBBox();
    this._draw.deleteAll();
    this._draw.changeMode('draw_polygon');
    this._mode = 'polygon';
    this._setResultBox('');
    this._map.getCanvas().style.cursor = 'crosshair';
    this._setQueryVisible(false);
  },

  _startBBox() {
    Measure.clear();
    this._draw.deleteAll();
    this._draw.changeMode('simple_select');
    this._mode = 'bbox';
    this._bboxStart = null;
    this._setResultBox('<span class="hint-text">Click first corner of bounding box…</span>');
    this._map.getCanvas().style.cursor = 'crosshair';
    this._setQueryVisible(false);
  },

  _cancelBBox() {
    this._bboxStart = null;
    this._removeBBoxPreview();
  },

  _onMapClick(e) {
    if (this._mode !== 'bbox') return;
    const pt = [e.lngLat.lng, e.lngLat.lat];

    if (!this._bboxStart) {
      this._bboxStart = pt;
      this._setResultBox('<span class="hint-text">Click second corner…</span>');
    } else {
      const [x0, y0] = this._bboxStart;
      const [x1, y1] = pt;
      const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
      const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);

      this._bboxStart = null;
      this._mode = null;
      this._map.getCanvas().style.cursor = '';
      this._removeBBoxPreview();

      this._showBBoxResult(minX, minY, maxX, maxY);
      this._drawBBoxPolygon(minX, minY, maxX, maxY);
      this._setQueryVisible(true);
    }
  },

  _onMouseMove(e) {
    if (this._mode !== 'bbox' || !this._bboxStart) return;
    const [x0, y0] = this._bboxStart;
    const x1 = e.lngLat.lng, y1 = e.lngLat.lat;
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
    this._drawBBoxPreview(minX, minY, maxX, maxY);
  },

  _onPolygonComplete() {
    if (this._mode !== 'polygon') return;
    this._mode = null;
    this._map.getCanvas().style.cursor = '';

    const features = this._draw.getAll().features;
    if (!features.length) return;
    const poly = features[0];
    const wkt = WKT.fromGeoJSON(poly.geometry);
    const [minX, minY, maxX, maxY] = turf.bbox(poly);

    const bboxStr = `${minX.toFixed(5)}, ${minY.toFixed(5)}, ${maxX.toFixed(5)}, ${maxY.toFixed(5)}`;
    this._setResultBox(`
      <div class="result-label">Polygon WKT</div>
      <textarea class="result-text" readonly rows="3">${wkt}</textarea>
      <div class="result-label" style="margin-top:6px">BBox: ${bboxStr}</div>
      <div class="copy-btn-row">
        <button class="copy-btn" id="copy-poly-wkt">Copy WKT</button>
        <button class="copy-btn" id="copy-poly-bbox">Copy BBox</button>
      </div>`);

    document.getElementById('copy-poly-wkt')?.addEventListener('click', () => navigator.clipboard.writeText(wkt));
    document.getElementById('copy-poly-bbox')?.addEventListener('click', () => navigator.clipboard.writeText(bboxStr));
    this._setQueryVisible(true);
  },

  _showBBoxResult(minX, minY, maxX, maxY) {
    const wkt = WKT.bboxToWKT(minX, minY, maxX, maxY);
    const bboxStr = `${minX.toFixed(5)}, ${minY.toFixed(5)}, ${maxX.toFixed(5)}, ${maxY.toFixed(5)}`;
    this._setResultBox(`
      <div class="result-label">BBox</div>
      <code class="result-bbox">${bboxStr}</code>
      <div class="result-label" style="margin-top:6px">WKT</div>
      <textarea class="result-text" readonly rows="2">${wkt}</textarea>
      <div class="copy-btn-row">
        <button class="copy-btn" id="copy-bbox-wkt">Copy WKT</button>
        <button class="copy-btn" id="copy-bbox-coords">Copy BBox</button>
      </div>`);

    document.getElementById('copy-bbox-wkt')?.addEventListener('click', () => navigator.clipboard.writeText(wkt));
    document.getElementById('copy-bbox-coords')?.addEventListener('click', () => navigator.clipboard.writeText(bboxStr));
  },

  _drawBBoxPolygon(minX, minY, maxX, maxY) {
    const geojson = this._bboxGeojson(minX, minY, maxX, maxY);
    this._removeBBoxPreview();
    this._map.addSource(this._previewSrc, { type: 'geojson', data: geojson });
    this._map.addLayer({ id: 'bbox-fill', type: 'fill', source: this._previewSrc,
      paint: { 'fill-color': '#F59E0B', 'fill-opacity': 0.15 } });
    this._map.addLayer({ id: 'bbox-line', type: 'line', source: this._previewSrc,
      paint: { 'line-color': '#F59E0B', 'line-width': 2, 'line-dasharray': [4, 2] } });
  },

  _drawBBoxPreview(minX, minY, maxX, maxY) {
    const geojson = this._bboxGeojson(minX, minY, maxX, maxY);
    if (this._map.getSource(this._previewSrc)) {
      this._map.getSource(this._previewSrc).setData(geojson);
    } else {
      this._map.addSource(this._previewSrc, { type: 'geojson', data: geojson });
      this._map.addLayer({ id: 'bbox-fill', type: 'fill', source: this._previewSrc,
        paint: { 'fill-color': '#F59E0B', 'fill-opacity': 0.1 } });
      this._map.addLayer({ id: 'bbox-line', type: 'line', source: this._previewSrc,
        paint: { 'line-color': '#F59E0B', 'line-width': 2, 'line-dasharray': [4, 2] } });
    }
  },

  _removeBBoxPreview() {
    if (this._map.getLayer('bbox-fill')) this._map.removeLayer('bbox-fill');
    if (this._map.getLayer('bbox-line')) this._map.removeLayer('bbox-line');
    if (this._map.getSource(this._previewSrc)) this._map.removeSource(this._previewSrc);
  },

  _runQuery() {
    let queryPolygon = null;

    if (this._map.getSource(this._previewSrc)) {
      // BBox mode: use bbox polygon
      const data = this._map.getSource(this._previewSrc)._data;
      queryPolygon = data;
    } else {
      // Polygon mode: use draw result
      const features = this._draw.getAll().features;
      if (features.length) queryPolygon = features[0];
    }

    if (!queryPolygon) return;

    const results = Query.run(queryPolygon, App.allFeatures);
    Panel.showQueryResults(results);

    if (results.length) {
      const bbox = turf.bbox(turf.featureCollection(results));
      this._map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60, maxZoom: 12 });
    }
  },

  _clear() {
    Measure.clear();
    this._draw.deleteAll();
    this._cancelBBox();
    this._mode = null;
    this._map.getCanvas().style.cursor = '';
    this._setResultBox('');
    this._setQueryVisible(false);
    Panel.showPlaceholder();
    App.clearHighlight();
    const input = document.getElementById('search-input');
    if (input) { input.value = ''; document.getElementById('search-clear').classList.remove('visible'); }
    Search._hide();
  },

  cancelActive() {
    this._draw.deleteAll();
    this._cancelBBox();
    this._mode = null;
    this._map.getCanvas().style.cursor = '';
    this._setResultBox('');
    this._setQueryVisible(false);
  },

  _setResultBox(html) {
    this._resultBox.innerHTML = html;
    this._resultBox.style.display = html ? 'block' : 'none';
  },

  _setQueryVisible(visible) {
    document.getElementById('btn-query').style.display = visible ? 'inline-block' : 'none';
  },

  _bboxGeojson(minX, minY, maxX, maxY) {
    return turf.bboxPolygon([minX, minY, maxX, maxY]);
  },

  getCurrentDrawnShape() {
    if (this._map.getSource(this._previewSrc)) {
      return this._map.getSource(this._previewSrc)._data;
    }
    const features = this._draw.getAll().features;
    return features.length ? features[0] : null;
  }
};
