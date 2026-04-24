const WKT = {
  fromGeoJSON(geometry) {
    if (!geometry) return null;
    switch (geometry.type) {
      case 'Polygon':      return this._polygon(geometry.coordinates);
      case 'MultiPolygon': return this._multiPolygon(geometry.coordinates);
      default: return null;
    }
  },

  _coord(c) {
    return `${c[0].toFixed(7)} ${c[1].toFixed(7)}`;
  },

  _ring(coords) {
    return `(${coords.map(c => this._coord(c)).join(', ')})`;
  },

  _polygon(coords) {
    return `POLYGON (${coords.map(r => this._ring(r)).join(', ')})`;
  },

  _multiPolygon(coords) {
    const polys = coords.map(poly => `(${poly.map(r => this._ring(r)).join(', ')})`);
    return `MULTIPOLYGON (${polys.join(', ')})`;
  },

  bboxToWKT(minX, minY, maxX, maxY) {
    const p = (n) => n.toFixed(7);
    return `POLYGON ((${p(minX)} ${p(minY)}, ${p(maxX)} ${p(minY)}, ${p(maxX)} ${p(maxY)}, ${p(minX)} ${p(maxY)}, ${p(minX)} ${p(minY)}))`;
  }
};
