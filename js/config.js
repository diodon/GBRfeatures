const Config = {
  center: [146.5, -18.5],
  zoom: 5,

  featureColors: {
    'Reef':             '#2563EB',
    'Island':           '#16A34A',
    'Rock':             '#6B7280',
    'Bank':             '#D97706',
    'Cay':              '#0891B2',
    'Terrestrial Reef': '#15803D',
    'Other':            '#7C3AED',
    'Sand':             '#CA8A04'
  },
  singleColor: '#0F766E',

  basemaps: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    esri: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community'
    }
  }
};
