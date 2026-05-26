const Measure = {
  _map: null,
  _mode: null,         // 'distance' | 'area' | null
  _points: [],         // [[lng, lat], ...]
  _resultBox: null,
  _justFinished: false,

  _SRC: 'measure-src',
  _LAYERS: ['measure-fill', 'measure-line', 'measure-points'],

  init(map) {
    this._map = map;
    this._resultBox = document.getElementById('measure-result');

    document.getElementById('btn-measure-dist').addEventListener('click', () => this._startDistance());
    document.getElementById('btn-measure-area').addEventListener('click', () => this._startArea());

    map.on('click',     e => this._onMapClick(e));
    map.on('mousemove', e => this._onMouseMove(e));
    map.on('dblclick',  e => this._onDblClick(e));
  },

  _startDistance() {
    Draw.cancelActive();
    this.clear();
    this._mode = 'distance';
    this._map.getCanvas().style.cursor = 'crosshair';
    document.getElementById('btn-measure-dist').classList.add('active');
    this._showResult('<span class="hint-text">Click to place points — double-click to finish.</span>');
  },

  _startArea() {
    Draw.cancelActive();
    this.clear();
    this._mode = 'area';
    this._map.getCanvas().style.cursor = 'crosshair';
    document.getElementById('btn-measure-area').classList.add('active');
    this._showResult('<span class="hint-text">Click to place points — double-click to close.</span>');
  },

  _onMapClick(e) {
    if (!this._mode) return;
    if (this._justFinished) { this._justFinished = false; return; }
    this._points.push([e.lngLat.lng, e.lngLat.lat]);
    this._update();
  },

  _onMouseMove(e) {
    if (!this._mode || this._points.length === 0) return;
    this._update([e.lngLat.lng, e.lngLat.lat]);
  },

  _onDblClick(e) {
    if (!this._mode) return;
    e.preventDefault();  // prevent map zoom
    // The second click of the dblclick was already added by _onMapClick — remove it
    this._points.pop();
    this._justFinished = true;
    this._finish();
  },

  _finish() {
    const pts = this._points;
    const wasArea = this._mode === 'area';

    this._mode = null;
    this._map.getCanvas().style.cursor = '';
    document.getElementById('btn-measure-dist').classList.remove('active');
    document.getElementById('btn-measure-area').classList.remove('active');

    if (pts.length < 2) {
      this.clear();
      return;
    }

    this._update(null, wasArea);  // render final static state

    if (wasArea && pts.length >= 3) {
      this._showAreaResult(pts);
    } else {
      this._showDistanceResult(pts);
    }
  },

  _showDistanceResult(pts) {
    let rows = '';
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = turf.distance(turf.point(pts[i]), turf.point(pts[i + 1]), { units: 'kilometers' });
      total += d;
      rows += `<tr><td>${i + 1}</td><td>${d.toFixed(3)} km</td></tr>`;
    }
    const totalStr = total.toFixed(3);

    this._showResult(`
      <div class="result-label">Distance measurement</div>
      <table class="measure-table">
        <thead><tr><th>Seg</th><th>Distance</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td><strong>Total</strong></td><td><strong>${totalStr} km</strong></td></tr></tfoot>
      </table>
      <div class="copy-btn-row" style="margin-top:6px">
        <button class="copy-btn" id="copy-measure-dist">Copy total (km)</button>
      </div>`);

    document.getElementById('copy-measure-dist')?.addEventListener('click', () => {
      navigator.clipboard.writeText(totalStr);
    });
  },

  _showAreaResult(pts) {
    const ring = [...pts, pts[0]];
    const poly = turf.polygon([ring]);
    const areaSqM  = turf.area(poly);
    const areaSqKm = areaSqM / 1e6;
    const areaHa   = areaSqM / 1e4;

    const kmStr = areaSqKm.toPrecision(4);
    const haStr = areaHa.toPrecision(4);

    this._showResult(`
      <div class="result-label">Area measurement</div>
      <div class="result-bbox">${kmStr} km²</div>
      <div class="result-bbox">${haStr} ha</div>
      <div class="copy-btn-row">
        <button class="copy-btn" id="copy-measure-area-km">Copy km²</button>
        <button class="copy-btn" id="copy-measure-area-ha">Copy ha</button>
      </div>`);

    document.getElementById('copy-measure-area-km')?.addEventListener('click', () => {
      navigator.clipboard.writeText(kmStr);
    });
    document.getElementById('copy-measure-area-ha')?.addEventListener('click', () => {
      navigator.clipboard.writeText(haStr);
    });
  },

  // cursorPt: live preview point (mousemove); isArea: override when _mode is already null (after finish)
  _update(cursorPt, isArea) {
    const areaMode = isArea !== undefined ? isArea : this._mode === 'area';
    const pts = cursorPt ? [...this._points, cursorPt] : this._points;
    if (pts.length === 0) return;

    const features = [];

    if (pts.length >= 2) {
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: pts } });
    }

    if (areaMode && pts.length >= 3) {
      features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...pts, pts[0]]] } });
    }

    this._points.forEach(pt => {
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: pt } });
    });

    const geojson = { type: 'FeatureCollection', features };

    if (this._map.getSource(this._SRC)) {
      this._map.getSource(this._SRC).setData(geojson);
    } else {
      this._map.addSource(this._SRC, { type: 'geojson', data: geojson });
      this._addLayers(areaMode);
    }
  },

  _addLayers(withFill) {
    if (withFill) {
      this._map.addLayer({
        id: 'measure-fill',
        type: 'fill',
        source: this._SRC,
        filter: ['==', '$type', 'Polygon'],
        paint: { 'fill-color': '#F59E0B', 'fill-opacity': 0.12 }
      });
    }

    this._map.addLayer({
      id: 'measure-line',
      type: 'line',
      source: this._SRC,
      filter: ['==', '$type', 'LineString'],
      paint: { 'line-color': '#F59E0B', 'line-width': 2, 'line-dasharray': [4, 2] }
    });

    this._map.addLayer({
      id: 'measure-points',
      type: 'circle',
      source: this._SRC,
      filter: ['==', '$type', 'Point'],
      paint: {
        'circle-radius': 5,
        'circle-color': '#F59E0B',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5
      }
    });
  },

  _showResult(html) {
    this._resultBox.innerHTML = html;
    this._resultBox.style.display = html ? 'block' : 'none';
  },

  _clearLayers() {
    this._LAYERS.forEach(id => {
      if (this._map.getLayer(id)) this._map.removeLayer(id);
    });
    if (this._map.getSource(this._SRC)) this._map.removeSource(this._SRC);
  },

  cancelMode() {
    this._mode = null;
    this._justFinished = false;
    if (this._map) this._map.getCanvas().style.cursor = '';
    document.getElementById('btn-measure-dist')?.classList.remove('active');
    document.getElementById('btn-measure-area')?.classList.remove('active');
  },

  clear() {
    this.cancelMode();
    this._points = [];
    if (this._map) this._clearLayers();
    this._showResult('');
  }
};
