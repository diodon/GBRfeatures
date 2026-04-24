const Panel = {
  _currentFeatures: [],
  _bufferKm: 5,

  init() {
    document.getElementById('buffer-slider').addEventListener('input', e => {
      this._bufferKm = +e.target.value;
      document.getElementById('buffer-value').textContent = `${this._bufferKm} km`;
    });
  },

  showPlaceholder() {
    document.getElementById('panel-content').innerHTML = `
      <div class="panel-placeholder">
        <p>Click on a feature to see its details.</p>
        <p>Use the drawing tools to query features by area.</p>
      </div>`;
  },

  showFeature(feature) {
    this._currentFeatures = [feature];
    const p = feature.properties;
    const name = p.GBR_NAME || p.LOC_NAME_S || '(unnamed)';

    document.getElementById('panel-content').innerHTML = `
      <div class="feature-header">
        <h3>${this._escape(name)}</h3>
        <span class="type-badge" style="background:${this._typeColor(p.FEAT_NAME)}">${p.FEAT_NAME || '—'}</span>
      </div>

      <table class="attr-table">
        ${this._row('Short name', p.LOC_NAME_S)}
        ${this._row('Level 1', p.LEVEL_1)}
        ${this._row('Level 2', p.LEVEL_2)}
        ${this._row('Level 3', p.LEVEL_3)}
        ${this._row('Dataset', p.DATASET)}
        ${this._row('Country', p.Country)}
        ${this._row('Area (deg²)', p.SHAPE_AREA != null ? p.SHAPE_AREA.toFixed(4) : null)}
        ${this._row('Code', p.CODE)}
        ${this._row('Region ID', p.RegionID)}
        ${this._row('Unique ID', p.UNIQUE_ID)}
      </table>

      ${this._exportBlock()}`;

    this._bindExportButtons();
  },

  showQueryResults(features) {
    this._currentFeatures = features;
    const count = features.length;

    const rows = features.slice(0, 200).map(f => {
      const p = f.properties;
      const name = p.GBR_NAME || p.LOC_NAME_S || '(unnamed)';
      return `<tr class="result-row" data-fid="${p._fid}">
        <td>${this._escape(name)}</td>
        <td><span class="type-badge small" style="background:${this._typeColor(p.FEAT_NAME)}">${p.FEAT_NAME || '—'}</span></td>
      </tr>`;
    }).join('');

    const truncNote = count > 200 ? `<p class="trunc-note">Showing first 200 of ${count}</p>` : '';

    document.getElementById('panel-content').innerHTML = `
      <div class="query-header">
        <h3>${count} feature${count !== 1 ? 's' : ''} found</h3>
        <p class="hint">Click a row to inspect the feature.</p>
      </div>

      ${this._exportBlock()}

      ${truncNote}
      <table class="result-table">
        <thead><tr><th>Name</th><th>Type</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;

    this._bindExportButtons();

    document.querySelectorAll('.result-row').forEach(row => {
      row.addEventListener('click', () => {
        const fid = +row.dataset.fid;
        const f = App.featuresById.get(fid);
        if (f) App.zoomToFeature(f);
      });
    });
  },

  _exportBlock() {
    return `
      <div class="export-section">
        <h4>Export</h4>

        <div class="export-row">
          <span>Name + Type + Centroid</span>
          <div class="btn-group">
            <button class="btn-exp" data-action="centroid" data-fmt="csv">CSV</button>
            <button class="btn-exp" data-action="centroid" data-fmt="json">JSON</button>
          </div>
        </div>

        <div class="export-row">
          <span>Name + Type + WKT</span>
          <div class="btn-group">
            <button class="btn-exp" data-action="wkt" data-fmt="csv">CSV</button>
            <button class="btn-exp" data-action="wkt" data-fmt="json">JSON</button>
          </div>
        </div>

        <div class="export-row">
          <span>BBox + Buffer</span>
          <div class="buffer-control">
            <input type="range" id="buffer-slider" min="0" max="100" step="0.5" value="${this._bufferKm}">
            <span id="buffer-value">${this._bufferKm} km</span>
          </div>
          <div class="btn-group">
            <button class="btn-exp" data-action="bbox" data-fmt="csv">CSV</button>
            <button class="btn-exp" data-action="bbox" data-fmt="json">JSON</button>
          </div>
        </div>
      </div>`;
  },

  _bindExportButtons() {
    document.querySelectorAll('.btn-exp').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const fmt = btn.dataset.fmt;
        const features = this._currentFeatures;
        if (!features.length) return;

        if (action === 'centroid') Export.centroid(features, fmt);
        else if (action === 'wkt')  Export.wkt(features, fmt);
        else if (action === 'bbox') Export.bbox(features, this._bufferKm, fmt);
      });
    });

    const slider = document.getElementById('buffer-slider');
    if (slider) {
      slider.addEventListener('input', e => {
        this._bufferKm = +e.target.value;
        document.getElementById('buffer-value').textContent = `${this._bufferKm} km`;
      });
    }
  },

  _row(label, value) {
    if (value == null || value === '') return '';
    return `<tr><td class="attr-label">${label}</td><td>${this._escape(String(value))}</td></tr>`;
  },

  _typeColor(type) {
    return Config.featureColors[type] || '#64748B';
  },

  _escape(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
};
