const Panel = {
  _currentFeatures: [],
  _bufferKm: 5,

  init() {},

  showPlaceholder() {
    document.getElementById('panel-content').innerHTML = `
      <div class="panel-placeholder">
        <p>Click on a feature to see its details.</p>
        <p>Use the drawing tools to query features by area.</p>
      </div>`;
  },

  showFeature(feature, geometryReady = false) {
    this._currentFeatures = [feature];
    this._geometryReady = geometryReady;
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
        ${this._row('Area (km²)', p.SHAPE_AREA != null ? p.SHAPE_AREA.toFixed(4) : null)}
        ${this._row('Code', p.CODE)}
        ${this._row('Region ID', p.RegionID)}
        ${this._row('Unique ID', p.UNIQUE_ID)}
      </table>

      ${this._exportBlock()}`;

    this._bindExportButtons();
  },

  showMultiSelection(features) {
    this._currentFeatures = features;
    this._geometryReady = App._phase2Ready;
    const count = features.length;

    const rows = features.map(f => {
      const p = f.properties;
      const name = p.GBR_NAME || p.LOC_NAME_S || '(unnamed)';
      return `<tr class="result-row" data-fid="${p._fid}">
        <td>${this._escape(name)}</td>
        <td><span class="type-badge small" style="background:${this._typeColor(p.FEAT_NAME)}">${p.FEAT_NAME || '—'}</span></td>
        <td class="remove-cell">
          <button class="remove-item" data-fid="${p._fid}" title="Remove from selection">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </td>
      </tr>`;
    }).join('');

    document.getElementById('panel-content').innerHTML = `
      <div class="query-header">
        <h3>${count} feature${count !== 1 ? 's' : ''} selected</h3>
        <p class="hint">Shift-click features to add/remove. Click a row to zoom.</p>
      </div>

      ${this._exportBlock()}

      <table class="result-table">
        <thead><tr><th>Name</th><th>Type</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;

    this._bindExportButtons();

    document.querySelectorAll('.result-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.remove-item')) return;
        const fid = +row.dataset.fid;
        const f = App.featuresById.get(fid);
        if (!f) return;
        if (f.geometry.type === 'Point') {
          App.map.flyTo({ center: f.geometry.coordinates, zoom: 11 });
        } else {
          const bbox = turf.bbox(f);
          App.map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 80, maxZoom: 14 });
        }
      });
    });

    document.querySelectorAll('.remove-item').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        App.removeFromMultiSelection(+btn.dataset.fid);
      });
    });
  },

  showQueryResults(features) {
    this._currentFeatures = features;
    this._geometryReady = App._phase2Ready;
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
    const geoReady = this._geometryReady;
    const geoTitle = geoReady ? '' : ' title="Available once full geometry loads"';
    const geoDis   = geoReady ? '' : ' disabled';

    const actionRow = (action, label, dis = '', title = '') => `
      <div class="export-row" data-action="${action}" data-fmt="csv">
        <div class="export-row-top">
          <span class="export-label">${label}</span>
          <div class="export-fmt-group">
            <button class="btn-fmt active" data-fmt="csv"${dis}${title}>CSV</button>
            <button class="btn-fmt" data-fmt="json"${dis}${title}>JSON</button>
          </div>
        </div>
        <div class="export-act-group">
          <button class="btn-act-copy" data-role="copy"${dis}${title}>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy
          </button>
          <button class="btn-act-dl" data-role="download"${dis}${title}>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
          </button>
        </div>
      </div>`;

    return `
      <div class="export-section">
        <h4>Export</h4>

        ${actionRow('centroid', 'Name + Type + Centroid')}

        <div class="export-row" data-action="wkt" data-fmt="csv">
          <div class="export-row-top">
            <span class="export-label">Name + Type + WKT ${geoReady ? '' : '<span class="geo-pending">⏳ loading…</span>'}</span>
            <div class="export-fmt-group">
              <button class="btn-fmt active" data-fmt="csv"${geoDis}${geoTitle}>CSV</button>
              <button class="btn-fmt" data-fmt="json"${geoDis}${geoTitle}>JSON</button>
            </div>
          </div>
          <div class="export-act-group">
            <button class="btn-act-copy" data-role="copy"${geoDis}${geoTitle}>
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy
            </button>
            <button class="btn-act-dl" data-role="download"${geoDis}${geoTitle}>
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download
            </button>
          </div>
        </div>

        <div class="export-row" data-action="bbox" data-fmt="csv">
          <div class="export-row-top">
            <span class="export-label">BBox + Buffer ${geoReady ? '' : '<span class="geo-pending">⏳ loading…</span>'}</span>
            <div class="export-fmt-group">
              <button class="btn-fmt active" data-fmt="csv"${geoDis}${geoTitle}>CSV</button>
              <button class="btn-fmt" data-fmt="json"${geoDis}${geoTitle}>JSON</button>
            </div>
          </div>
          <div class="buffer-control">
            <input type="range" id="buffer-slider" min="0" max="100" step="0.5" value="${this._bufferKm}">
            <span id="buffer-value">${this._bufferKm} km</span>
          </div>
          <div class="export-act-group">
            <button class="btn-act-copy" data-role="copy"${geoDis}${geoTitle}>
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy
            </button>
            <button class="btn-act-dl" data-role="download"${geoDis}${geoTitle}>
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download
            </button>
          </div>
        </div>
      </div>`;
  },

  _bindExportButtons() {
    // Format toggle: clicking CSV/JSON updates the row's data-fmt and toggles active class
    document.querySelectorAll('.export-row').forEach(row => {
      row.querySelectorAll('.btn-fmt').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.disabled) return;
          row.querySelectorAll('.btn-fmt').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          row.dataset.fmt = btn.dataset.fmt;
        });
      });

      row.querySelectorAll('.btn-act-copy, .btn-act-dl').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.disabled) return;
          const action = row.dataset.action;
          const fmt = row.dataset.fmt;
          const features = this._currentFeatures;
          if (!features.length) return;

          const result = Export.generate(action, features, fmt, this._bufferKm);
          if (!result) return;

          if (btn.dataset.role === 'download') {
            Export.downloadResult(result);
          } else {
            navigator.clipboard.writeText(result.content).then(() => {
              const orig = btn.innerHTML;
              btn.textContent = 'Copied!';
              setTimeout(() => { btn.innerHTML = orig; }, 1500);
            }).catch(() => {
              const orig = btn.innerHTML;
              btn.textContent = 'Failed';
              setTimeout(() => { btn.innerHTML = orig; }, 1500);
            });
          }
        });
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
