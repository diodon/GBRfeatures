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

  _centroidRows(features) {
    return features.map(f => {
      const c = turf.centroid(f);
      const [lon, lat] = c.geometry.coordinates;
      return { name: this._name(f), type: f.properties.FEAT_NAME || '', unique_id: f.properties.UNIQUE_ID || '', longitude: +lon.toFixed(7), latitude: +lat.toFixed(7) };
    });
  },

  _wktRows(features) {
    return features.map(f => ({
      name: this._name(f),
      type: f.properties.FEAT_NAME || '',
      unique_id: f.properties.UNIQUE_ID || '',
      wkt: WKT.fromGeoJSON(f.geometry)
    }));
  },

  _bboxRows(features, bufferKm) {
    return features.map(f => {
      const buffered = turf.buffer(f, bufferKm, { units: 'kilometers' });
      const [minX, minY, maxX, maxY] = turf.bbox(buffered);
      return {
        name: this._name(f),
        type: f.properties.FEAT_NAME || '',
        unique_id: f.properties.UNIQUE_ID || '',
        buffer_km: bufferKm,
        minX: +minX.toFixed(7),
        minY: +minY.toFixed(7),
        maxX: +maxX.toFixed(7),
        maxY: +maxY.toFixed(7),
        bbox_wkt: WKT.bboxToWKT(minX, minY, maxX, maxY)
      };
    });
  },

  generate(action, features, format, bufferKm) {
    let rows, csvHeader, csvRow, filename;

    if (action === 'centroid') {
      rows = this._centroidRows(features);
      csvHeader = 'name,type,unique_id,longitude,latitude';
      csvRow = r => `"${r.name}","${r.type}","${r.unique_id}",${r.longitude},${r.latitude}`;
      filename = 'gbr_centroids';
    } else if (action === 'wkt') {
      rows = this._wktRows(features);
      csvHeader = 'name,type,unique_id,wkt';
      csvRow = r => `"${r.name}","${r.type}","${r.unique_id}","${r.wkt}"`;
      filename = 'gbr_wkt';
    } else if (action === 'bbox') {
      rows = this._bboxRows(features, bufferKm);
      csvHeader = 'name,type,unique_id,buffer_km,minX,minY,maxX,maxY,bbox_wkt';
      csvRow = r => `"${r.name}","${r.type}","${r.unique_id}",${r.buffer_km},${r.minX},${r.minY},${r.maxX},${r.maxY},"${r.bbox_wkt}"`;
      filename = 'gbr_bbox';
    } else {
      return null;
    }

    if (format === 'csv') {
      return { content: [csvHeader, ...rows.map(csvRow)].join('\n'), filename: `${filename}.csv`, mime: 'text/csv' };
    } else {
      return { content: JSON.stringify(rows, null, 2), filename: `${filename}.json`, mime: 'application/json' };
    }
  },

  downloadResult(result) {
    this._download(result.content, result.filename, result.mime);
  },

  centroid(features, format) {
    const r = this.generate('centroid', features, format, 0);
    this._download(r.content, r.filename, r.mime);
  },

  wkt(features, format) {
    const r = this.generate('wkt', features, format, 0);
    this._download(r.content, r.filename, r.mime);
  },

  bbox(features, bufferKm, format) {
    const r = this.generate('bbox', features, format, bufferKm);
    this._download(r.content, r.filename, r.mime);
  }
};
