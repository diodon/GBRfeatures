const Query = {
  run(drawnPolygon, allFeatures) {
    const results = [];
    for (const feature of allFeatures) {
      try {
        const centroid = turf.centroid(feature);
        if (turf.booleanPointInPolygon(centroid, drawnPolygon)) {
          results.push(feature);
        }
      } catch (_) {
        // skip invalid geometries
      }
    }
    return results;
  }
};
