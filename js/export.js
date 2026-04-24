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

  centroid(features, format) {
    const rows = features.map(f => {
      const c = turf.centroid(f);
      const [lon, lat] = c.geometry.coordinates;
      return { name: this._name(f), type: f.properties.FEAT_NAME || '', unique_id: f.properties.UNIQUE_ID || '', longitude: +lon.toFixed(7), latitude: +lat.toFixed(7) };
    });

    if (format === 'csv') {
      const csv = ['name,type,unique_id,longitude,latitude',
        ...rows.map(r => `"${r.name}","${r.type}","${r.unique_id}",${r.longitude},${r.latitude}`)
      ].join('\n');
      this._download(csv, 'gbr_centroids.csv', 'text/csv');
    } else {
      this._download(JSON.stringify(rows, null, 2), 'gbr_centroids.json', 'application/json');
    }
  },

  wkt(features, format) {
    const rows = features.map(f => ({
      name: this._name(f),
      type: f.properties.FEAT_NAME || '',
      unique_id: f.properties.UNIQUE_ID || '',
      wkt: WKT.fromGeoJSON(f.geometry)
    }));

    if (format === 'csv') {
      const csv = ['name,type,unique_id,wkt',
        ...rows.map(r => `"${r.name}","${r.type}","${r.unique_id}","${r.wkt}"`)
      ].join('\n');
      this._download(csv, 'gbr_wkt.csv', 'text/csv');
    } else {
      this._download(JSON.stringify(rows, null, 2), 'gbr_wkt.json', 'application/json');
    }
  },

  bbox(features, bufferKm, format) {
    const rows = features.map(f => {
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

    if (format === 'csv') {
      const csv = ['name,type,unique_id,buffer_km,minX,minY,maxX,maxY,bbox_wkt',
        ...rows.map(r =>
          `"${r.name}","${r.type}","${r.unique_id}",${r.buffer_km},${r.minX},${r.minY},${r.maxX},${r.maxY},"${r.bbox_wkt}"`
        )
      ].join('\n');
      this._download(csv, 'gbr_bbox.csv', 'text/csv');
    } else {
      this._download(JSON.stringify(rows, null, 2), 'gbr_bbox.json', 'application/json');
    }
  }
};
