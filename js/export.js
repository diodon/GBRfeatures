const Export = {
  _download(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  _name(f) {
    return f.properties.GBR_NAME || f.properties.LOC_NAME_S || '(unnamed)';
  },

  // opts: { wkt: bool, bbox: bool, buffer: bool, bufferKm: number }
  // Returns { content, filename, mime } — no side effects
  generate(features, opts, format) {
    const rows = features.map(f => {
      const c = turf.centroid(f);
      const [lon, lat] = c.geometry.coordinates;
      const row = {
        name:      this._name(f),
        loc_name:  f.properties.LOC_NAME_S || '',
        type:      f.properties.FEAT_NAME  || '',
        unique_id: f.properties.UNIQUE_ID  || '',
        longitude: +lon.toFixed(7),
        latitude:  +lat.toFixed(7)
      };

      if (opts.buffer) row.buffer_km = opts.bufferKm;

      const geom = opts.buffer && opts.bufferKm > 0
        ? turf.buffer(f, opts.bufferKm, { units: 'kilometers' })
        : f;

      if (opts.wkt)  row.wkt = WKT.fromGeoJSON(geom.geometry);

      if (opts.bbox) {
        const [minX, minY, maxX, maxY] = turf.bbox(geom);
        row.minX     = +minX.toFixed(7);
        row.minY     = +minY.toFixed(7);
        row.maxX     = +maxX.toFixed(7);
        row.maxY     = +maxY.toFixed(7);
        row.bbox_wkt = WKT.bboxToWKT(minX, minY, maxX, maxY);
      }

      return row;
    });

    const keys = rows.length ? Object.keys(rows[0]) : ['name','type','unique_id','longitude','latitude'];

    if (format === 'csv') {
      const lines = [
        keys.join(','),
        ...rows.map(r => keys.map(k => {
          const v = r[k];
          return typeof v === 'string' ? `"${v}"` : (v ?? '');
        }).join(','))
      ];
      return { content: lines.join('\n'), filename: 'gbr_export.csv', mime: 'text/csv' };
    } else {
      return { content: JSON.stringify(rows, null, 2), filename: 'gbr_export.json', mime: 'application/json' };
    }
  },

  download(result) {
    this._download(result.content, result.filename, result.mime);
  }
};
