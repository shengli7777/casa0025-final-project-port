// =============================================
// CASA0025 Final Project - Stage 5
// Interactive Maritime Activity Explorer
// Port of Singapore, Sentinel-1 SAR, 2023
// Role: Member 5 - UI / visualisation lead
// =============================================

// -----------------------------
// 1. Project constants
// -----------------------------
var YEAR = 2023;
var DETECTION_THRESHOLD = -10;
var DETECTION_MIN_PIXELS = 2;
var DETECTION_MAX_PIXELS = 15;
var LOCAL_QUERY_RADIUS_METRES = 1000;

var MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

var MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

var SAR_PALETTE = ['061326', '0C3B66', '1F7CB7', '66D4F1', 'FFFFFF'];
var HEATMAP_PALETTE = [
  'FFF7BC', 'FEE391', 'FEC44F', 'FE9929',
  'EC7014', 'E85D04', 'D62828', '9D0208'
];
var HEATMAP_RADIUS_PEAK_METRES = 120;
var HEATMAP_RADIUS_SPREAD_METRES = 260;
var HEATMAP_RADIUS_BLEND_METRES = 420;
var HEATMAP_VIS_MIN = 0.2;
var HEATMAP_VIS_MAX = 4.5;
var HEATMAP_VIS_BOOST = 3.5;

var vvVis = {
  bands: ['VV'],
  min: -25,
  max: 0,
  palette: SAR_PALETTE
};

var vhVis = {
  bands: ['VH'],
  min: -30,
  max: -5,
  palette: SAR_PALETTE
};

var detectionVis = {
  palette: ['FF7A1A'],
  opacity: 0.92
};

var heatmapVis = {
  min: HEATMAP_VIS_MIN,
  max: HEATMAP_VIS_MAX,
  palette: HEATMAP_PALETTE,
  opacity: 0.84
};

var UI_TEXT_PRIMARY = '#0F3554';
var UI_TEXT_SECONDARY = '#4D6B85';
var UI_BORDER = '#B9D4E6';
var UI_DIVIDER = '#D6E5F0';
var UI_PANEL_BG = '#F4FAFE';
var UI_PANEL_BG_ALT = '#EAF4FB';
var UI_PANEL_BG_STRONG = '#D4E7F5';
var UI_PANEL_BG_DISABLED = '#E2EDF5';
var UI_BORDER_STRONG = '#7DAFD1';
var UI_ACCENT = '#1E6FA8';
var UI_ACCENT_DARK = '#0E4E7A';

var monthlyChartStats = new Array(12);
var monthlyChartStatsLoaded = false;
var monthlyChartStatsLoading = false;
var fixedOverviewRequestId = 0;

// -----------------------------
// 2. Study area and analysis zones
// -----------------------------
var aoi = ee.Geometry.Polygon(
  [[[103.60, 1.15],
    [104.05, 1.15],
    [104.05, 1.36],
    [103.60, 1.36],
    [103.60, 1.15]]]
);

var analysisRegions = ee.FeatureCollection([
  ee.Feature(
    ee.Geometry.Rectangle([103.60, 1.20, 103.75, 1.36]),
    {region_id: 'WEST', region_name: 'West anchorage'}
  ),
  ee.Feature(
    ee.Geometry.Rectangle([103.75, 1.20, 103.90, 1.36]),
    {region_id: 'CENTRAL', region_name: 'Central harbour'}
  ),
  ee.Feature(
    ee.Geometry.Rectangle([103.90, 1.20, 104.05, 1.36]),
    {region_id: 'EAST', region_name: 'East anchorage'}
  ),
  ee.Feature(
    ee.Geometry.Rectangle([103.60, 1.15, 104.05, 1.20]),
    {region_id: 'SOUTH', region_name: 'Southern approach'}
  )
]);

var regionItems = [
  {label: 'Full study area', value: 'ALL'},
  {label: 'West anchorage', value: 'WEST'},
  {label: 'Central harbour', value: 'CENTRAL'},
  {label: 'East anchorage', value: 'EAST'},
  {label: 'Southern approach', value: 'SOUTH'}
];

var regionNameById = {
  ALL: 'Full study area',
  WEST: 'West anchorage',
  CENTRAL: 'Central harbour',
  EAST: 'East anchorage',
  SOUTH: 'Southern approach'
};

// -----------------------------
// 3. Data loading and masks
// -----------------------------
var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(aoi)
  .filterDate('2023-01-01', '2024-01-01')
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'));

var waterOccurrence = ee.Image('JRC/GSW1_4/GlobalSurfaceWater')
  .select('occurrence');
var waterMask = waterOccurrence.gt(50);

var land = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017')
  .filterBounds(aoi);
var landImage = ee.Image(0).byte().paint(land, 1);
var coastalBuffer = landImage.focal_max({
  radius: 500,
  kernelType: 'circle',
  units: 'meters'
});
var openWaterMask = coastalBuffer.eq(0);

// -----------------------------
// 4. Application state
// -----------------------------
var currentMonth = 1;
var currentTimeSelection = 'year';
var currentBand = 'VV';
var currentOrbit = 'BOTH';
var currentRegion = 'ALL';
var showSarLayer = true;
var showDetectionLayer = true;
var showHeatmapLayer = true;
var showZoneLayer = true;

var currentFilteredCollection = null;
var currentComposite = null;
var currentDetectionMask = null;
var currentHeatmap = null;
var currentPage = 'select';
var syncUiState = false;
var syncTimeSelectionUi = false;
var vhButtonLocked = false;

// -----------------------------
// 5. Earth Engine helper functions
// -----------------------------
function getMonthName(monthNumber) {
  return MONTH_NAMES[monthNumber - 1];
}

function getMonthShortName(monthNumber) {
  return MONTH_SHORT[monthNumber - 1];
}

function getMonthStart(monthNumber) {
  return ee.Date.fromYMD(YEAR, monthNumber, 1);
}

function getMonthEnd(monthNumber) {
  return getMonthStart(monthNumber).advance(1, 'month');
}

function emptySarImage() {
  return ee.Image.constant([-999, -999])
    .rename(['VV', 'VH'])
    .updateMask(ee.Image(0))
    .clip(aoi);
}

function emptyCleanImage() {
  return ee.Image.constant([-999, -999])
    .rename(['VV_filtered', 'VH_filtered'])
    .updateMask(ee.Image(0))
    .clip(aoi);
}

function emptySingleBandImage(name) {
  return ee.Image.constant(0)
    .rename(name)
    .updateMask(ee.Image(0))
    .clip(aoi);
}

function filterByOrbit(collection) {
  if (currentOrbit === 'ASCENDING') {
    return collection.filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING'));
  }

  if (currentOrbit === 'DESCENDING') {
    return collection.filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'));
  }

  return collection;
}

function getMonthlyCollection(monthNumber) {
  return filterByOrbit(
    s1.filterDate(getMonthStart(monthNumber), getMonthEnd(monthNumber))
  );
}

function makeMonthlyComposite(collection) {
  return ee.Image(ee.Algorithms.If(
    collection.size().gt(0),
    collection.median().clip(aoi),
    emptySarImage()
  ));
}

function preprocessForDetection(image) {
  image = ee.Image(image);

  var vv = image.select('VV')
    .focal_mean({radius: 1, kernelType: 'square', units: 'pixels'})
    .rename('VV_filtered');

  var vh = image.select('VH')
    .focal_mean({radius: 1, kernelType: 'square', units: 'pixels'})
    .rename('VH_filtered');

  return vv.addBands(vh)
    .updateMask(waterMask)
    .updateMask(openWaterMask)
    .copyProperties(image, ['system:time_start', 'orbitProperties_pass']);
}

function detectShipsFromCleanImage(cleanImage) {
  cleanImage = ee.Image(cleanImage);

  var brightTargets = cleanImage.select('VV_filtered')
    .gt(DETECTION_THRESHOLD);
  var connected = brightTargets.connectedPixelCount(100, true);
  var filtered = brightTargets
    .updateMask(connected.gte(DETECTION_MIN_PIXELS))
    .updateMask(connected.lte(DETECTION_MAX_PIXELS));

  return filtered.selfMask().rename('ship');
}

function makeDetectionMask(collection) {
  var cleanCollection = collection.map(preprocessForDetection);
  var cleanComposite = ee.Image(ee.Algorithms.If(
    collection.size().gt(0),
    cleanCollection.median().clip(aoi),
    emptyCleanImage()
  ));

  return detectShipsFromCleanImage(cleanComposite);
}

function detectShipBinary(image) {
  image = ee.Image(image);

  var vv = image.select('VV')
    .focal_mean({radius: 1, kernelType: 'square', units: 'pixels'});

  var brightTargets = vv.gt(DETECTION_THRESHOLD);
  var connected = brightTargets.connectedPixelCount(100, true);
  var shipMask = brightTargets
    .updateMask(connected.gte(DETECTION_MIN_PIXELS))
    .updateMask(connected.lte(DETECTION_MAX_PIXELS));

  return shipMask
    .unmask(0)
    .updateMask(waterMask)
    .updateMask(openWaterMask)
    .unmask(0)
    .rename('ship')
    .copyProperties(image, ['system:time_start', 'orbitProperties_pass']);
}

function makeHeatmap(collection) {
  var heatmap = ee.Image(ee.Algorithms.If(
    collection.size().gt(0),
    collection.map(detectShipBinary).select('ship').sum().clip(aoi),
    emptySingleBandImage('ship')
  ));

  return heatmap.rename('ship');
}

function makeHeatmapDisplay(heatmap) {
  heatmap = ee.Image(heatmap);

  var smoothed = heatmap
    .focal_max({
      radius: HEATMAP_RADIUS_PEAK_METRES,
      kernelType: 'circle',
      units: 'meters'
    })
    .focal_mean({
      radius: HEATMAP_RADIUS_SPREAD_METRES,
      kernelType: 'circle',
      units: 'meters'
    })
    .focal_mean({
      radius: HEATMAP_RADIUS_BLEND_METRES,
      kernelType: 'circle',
      units: 'meters'
    })
    .multiply(HEATMAP_VIS_BOOST);

  return smoothed
    .updateMask(smoothed.gt(HEATMAP_VIS_MIN))
    .rename('ship');
}

function selectedRegionFeatureCollection() {
  if (currentRegion === 'ALL') {
    return ee.FeatureCollection([ee.Feature(aoi, {
      region_id: 'ALL',
      region_name: 'Full study area'
    })]);
  }

  return analysisRegions.filter(ee.Filter.eq('region_id', currentRegion));
}

function selectedRegionGeometry() {
  if (currentRegion === 'ALL') {
    return aoi;
  }

  return selectedRegionFeatureCollection().geometry();
}

function formatNumber(value, decimals) {
  if (value === null || value === undefined) {
    return 'n/a';
  }

  return Number(value).toFixed(decimals);
}

function formatInteger(value) {
  if (value === null || value === undefined) {
    return 'n/a';
  }

  return Math.round(Number(value)).toLocaleString('en-US');
}

// -----------------------------
// 6. UI helper functions
// -----------------------------
function sectionTitle(text) {
  return ui.Label(text, {
    fontSize: '15px',
    fontWeight: 'bold',
    color: UI_TEXT_PRIMARY,
    margin: '0 0 10px 0'
  });
}

function smallText(text) {
  return ui.Label(text, {
    fontSize: '11px',
    color: UI_TEXT_SECONDARY,
    margin: '0 0 8px 0'
  });
}

function sectionPanel() {
  return ui.Panel({
    style: {
      padding: '14px 14px 12px 14px',
      stretch: 'horizontal'
    }
  });
}

function dividerLine() {
  return ui.Panel({
    style: {
      height: '1px',
      backgroundColor: UI_DIVIDER,
      stretch: 'horizontal',
      margin: '0 14px'
    }
  });
}

function cardPanel(width) {
  return ui.Panel({
    style: {
      width: width,
      padding: '10px',
      margin: '0 8px 8px 0',
      backgroundColor: UI_PANEL_BG,
      border: '1px solid ' + UI_BORDER
    }
  });
}

function addCard(parent, title, value, note, width) {
  var card = cardPanel(width || '182px');
  var valueLabel;
  var noteLabel = null;
  card.add(ui.Label(title, {
    fontSize: '11px',
    fontWeight: 'bold',
    color: UI_TEXT_PRIMARY,
    margin: '0 0 8px 0',
    textAlign: 'center',
    stretch: 'horizontal'
  }));
  valueLabel = ui.Label(value, {
    fontSize: '20px',
    fontWeight: 'bold',
    color: UI_ACCENT_DARK,
    margin: '0 0 4px 0',
    textAlign: 'center',
    stretch: 'horizontal'
  });
  card.add(valueLabel);
  if (note) {
    noteLabel = ui.Label(note, {
      fontSize: '10px',
      color: UI_TEXT_SECONDARY,
      margin: '0',
      textAlign: 'center',
      stretch: 'horizontal'
    });
    card.add(noteLabel);
  }
  parent.add(card);
  return {
    card: card,
    value: valueLabel,
    note: noteLabel
  };
}

function makeColorBar(palette, min, max, width) {
  return ui.Thumbnail({
    image: ee.Image.pixelLonLat().select(0)
      .add(180)
      .multiply((max - min) / 360.0)
      .add(min)
      .visualize({min: min, max: max, palette: palette}),
    params: {bbox: '-180,0,180,10', dimensions: (width || 180) + 'x14'},
    style: {margin: '4px 0 2px 0', stretch: 'horizontal'}
  });
}

function makeSwatch(color) {
  return ui.Label('', {
    backgroundColor: color,
    padding: '7px',
    margin: '2px 8px 2px 0'
  });
}

function makeSummaryRow(labelText) {
  var row = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {
      stretch: 'horizontal',
      margin: '0 0 6px 0',
      border: '0 0 1px 0',
      borderColor: UI_DIVIDER,
      padding: '0 0 6px 0'
    }
  });

  var keyLabel = ui.Label(labelText, {
    fontSize: '11px',
    fontWeight: 'bold',
    color: UI_TEXT_PRIMARY,
    margin: '0',
    width: '120px'
  });

  var valueLabel = ui.Label('...', {
    fontSize: '11px',
    color: UI_TEXT_SECONDARY,
    margin: '0',
    stretch: 'horizontal'
  });

  row.add(keyLabel);
  row.add(valueLabel);

  return {
    row: row,
    value: valueLabel
  };
}

function makeExplorerStatRow(labelText) {
  var row = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {
      stretch: 'horizontal',
      margin: '0',
      padding: '16px 0',
      border: '0 0 1px 0',
      borderColor: UI_DIVIDER
    }
  });

  var keyLabel = ui.Label(labelText, {
    fontSize: '14px',
    color: UI_TEXT_PRIMARY,
    margin: '0',
    width: '195px'
  });

  var valueLabel = ui.Label('...', {
    fontSize: '14px',
    fontWeight: 'bold',
    color: UI_ACCENT,
    margin: '0',
    stretch: 'horizontal',
    textAlign: 'right'
  });

  row.add(keyLabel);
  row.add(valueLabel);

  return {
    row: row,
    value: valueLabel
  };
}

function chartStatsFeatureCollection() {
  return ee.FeatureCollection(monthlyChartStats.map(function(row) {
    return ee.Feature(null, {
      month: row.month,
      label: row.label,
      images: row.images,
      meanVV: row.meanVV,
      meanVH: row.meanVH,
      candidates: row.candidates,
      density: row.density
    });
  }));
}

// -----------------------------
// 7. Layout and map
// -----------------------------
ui.root.clear();

var appMap = ui.Map();
appMap.setCenter(103.82, 1.255, 11);
appMap.setOptions('HYBRID');
appMap.style().set('cursor', 'crosshair');
appMap.setControlVisibility({
  all: false,
  zoomControl: true,
  mapTypeControl: true,
  scaleControl: true,
  fullscreenControl: true
});

var sidebar = ui.Panel({
  style: {
    width: '430px',
    padding: '0',
    backgroundColor: '#FFFFFF',
    stretch: 'vertical'
  }
});

var splitPanel = ui.SplitPanel({
  firstPanel: sidebar,
  secondPanel: appMap,
  orientation: 'horizontal',
  wipe: false,
  style: {stretch: 'both'}
});

ui.root.widgets().reset([splitPanel]);

var zoneOutline = ee.Image().byte().paint({
  featureCollection: analysisRegions,
  color: 1,
  width: 1
});

var aoiBorder = ee.Image().byte().paint({
  featureCollection: ee.FeatureCollection([ee.Feature(aoi)]),
  color: 1,
  width: 2
});

appMap.layers().reset([
  ui.Map.Layer(emptySarImage(), vvVis, 'SAR composite', true),
  ui.Map.Layer(emptySingleBandImage('ship'), heatmapVis, 'Monthly ship density heatmap', false),
  ui.Map.Layer(emptySingleBandImage('ship'), detectionVis, 'Ship candidate detection', true),
  ui.Map.Layer(zoneOutline, {palette: ['00D1FF'], opacity: 0.8}, 'Analysis zones', true),
  ui.Map.Layer(emptySingleBandImage('selected'), {palette: ['FFFFFF'], opacity: 0.95}, 'Selected region', false),
  ui.Map.Layer(aoiBorder, {palette: ['FF3B30'], opacity: 0.95}, 'Study area boundary', true)
]);

// -----------------------------
// 8. Sidebar sections
// -----------------------------
var header = ui.Panel({
  style: {
    padding: '18px 18px 14px 18px',
    backgroundColor: '#FFFFFF',
    stretch: 'horizontal'
  }
});
header.add(ui.Label('Port of Singapore Maritime Activity Tool', {
  fontSize: '24px',
  fontWeight: 'bold',
  color: UI_TEXT_PRIMARY,
  margin: '0 0 6px 0'
}));
header.add(smallText('Sentinel-1 SAR ship candidate exploration for 2023.'));
sidebar.add(header);
sidebar.add(dividerLine());

var selectPage = ui.Panel({
  style: {stretch: 'horizontal'}
});

var explorerPage = ui.Panel({
  style: {stretch: 'horizontal', shown: false}
});

sidebar.add(selectPage);
sidebar.add(explorerPage);

var yearSection = sectionPanel();
yearSection.add(sectionTitle('Time Slice'));
yearSection.add(smallText('Select the full-year 2023 summary or choose a month from the dropdown.'));

var yearSelectButton = ui.Button({
  label: '2023',
  onClick: function() {
    currentTimeSelection = 'year';
    updateOverviewPanel();
  },
  style: {
    stretch: 'horizontal',
    margin: '0 0 14px 0',
    padding: '18px 16px',
    textAlign: 'left',
    fontSize: '24px',
    fontWeight: 'bold',
    backgroundColor: UI_PANEL_BG_STRONG,
    color: UI_TEXT_PRIMARY,
    border: '1px solid ' + UI_BORDER_STRONG
  }
});
yearSection.add(yearSelectButton);

yearSection.add(ui.Label('Month', {
  fontSize: '12px',
  fontWeight: 'bold',
  color: UI_TEXT_PRIMARY,
  margin: '0 0 8px 0'
}));

var monthSelectDropdown = ui.Select({
  items: MONTH_NAMES.map(function(label, index) {
    return {
      label: label + ' ' + YEAR,
      value: index + 1
    };
  }),
  value: currentMonth,
  onChange: function(value) {
    if (syncTimeSelectionUi) {
      return;
    }
    setCurrentMonth(Number(value));
  },
  style: {
    stretch: 'horizontal',
    margin: '0 0 6px 0',
    backgroundColor: UI_PANEL_BG_ALT,
    color: UI_TEXT_PRIMARY,
    border: '1px solid ' + UI_BORDER
  }
});
yearSection.add(monthSelectDropdown);
selectPage.add(yearSection);
selectPage.add(dividerLine());

var overviewSection = sectionPanel();
var overviewTitle = sectionTitle('2023 Overview');
overviewSection.add(overviewTitle);
var overviewNote = smallText('Reference values for Full study area and Both passes. Candidate pixels and density sum remain relative indicators rather than validated vessel counts.');
overviewSection.add(overviewNote);
var overviewCards = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal', true),
  style: {stretch: 'horizontal'}
});
var overviewImagesCard = addCard(overviewCards, 'Sentinel-1 Images', '...', 'full study area | both passes', '182px');
var overviewMeanVvCard = addCard(overviewCards, 'Mean VV', '...', 'full study area | both passes', '182px');
var overviewMeanVhCard = addCard(overviewCards, 'Mean VH', '...', 'full study area | both passes', '182px');
var overviewCandidatesCard = addCard(overviewCards, 'Candidate Pixels', '...', 'full study area | both passes', '182px');
var overviewDensityCard = addCard(overviewCards, 'Density Sum', '...', 'full study area | both passes', '372px');
overviewSection.add(overviewCards);
selectPage.add(overviewSection);

var nextPageSection = sectionPanel();
var nextPageButton = ui.Button({
  label: 'Next',
  onClick: function() {
    currentPage = 'explore';
    updatePageVisibility();
  },
  style: {
    stretch: 'horizontal',
    backgroundColor: UI_PANEL_BG_STRONG,
    color: UI_TEXT_PRIMARY,
    border: '1px solid ' + UI_BORDER_STRONG
  }
});
nextPageSection.add(nextPageButton);
selectPage.add(nextPageSection);

var controlsSection = sectionPanel();
controlsSection.add(sectionTitle('Map Explorer'));

controlsSection.add(ui.Label('Region', {
  fontSize: '12px',
  fontWeight: 'bold',
  color: UI_TEXT_PRIMARY,
  margin: '0 0 4px 0'
}));
var regionSelect = ui.Select({
  items: regionItems,
  value: currentRegion,
  onChange: function(value) {
    currentRegion = value;
    zoomToSelectedRegion();
    updateSelectedRegionLayer();
    updateViewSummary();
  },
  style: {
    stretch: 'horizontal',
    margin: '0 0 8px 0',
    backgroundColor: UI_PANEL_BG_ALT,
    color: UI_TEXT_PRIMARY,
    border: '1px solid ' + UI_BORDER
  }
});
controlsSection.add(regionSelect);

var zoomButton = ui.Button({
  label: 'Zoom to selected region',
  onClick: zoomToSelectedRegion,
  style: {
    stretch: 'horizontal',
    margin: '0 0 12px 0',
    backgroundColor: UI_PANEL_BG_STRONG,
    color: UI_TEXT_PRIMARY,
    border: '1px solid ' + UI_BORDER_STRONG
  }
});
controlsSection.add(zoomButton);

controlsSection.add(ui.Label('Polarisation', {
  fontSize: '12px',
  fontWeight: 'bold',
  color: UI_TEXT_PRIMARY,
  margin: '0 0 4px 0'
}));
var bandButtonPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {margin: '0 0 10px 0'}
});
var vvButton = ui.Button({
  label: 'VV',
  onClick: function() {
    currentBand = 'VV';
    updateApp(false);
  },
  style: {
    width: '190px',
    margin: '0 8px 0 0',
    backgroundColor: UI_PANEL_BG_ALT,
    color: UI_TEXT_PRIMARY,
    border: '1px solid ' + UI_BORDER
  }
});
var vhButton = ui.Button({
  label: 'VH',
  onClick: function() {
    currentBand = 'VH';
    updateApp(false);
  },
  style: {
    width: '190px',
    margin: '0',
    backgroundColor: UI_PANEL_BG_ALT,
    color: UI_TEXT_PRIMARY,
    border: '1px solid ' + UI_BORDER
  }
});
bandButtonPanel.add(vvButton);
bandButtonPanel.add(vhButton);
controlsSection.add(bandButtonPanel);

controlsSection.add(ui.Label('Orbit direction', {
  fontSize: '12px',
  fontWeight: 'bold',
  color: UI_TEXT_PRIMARY,
  margin: '0 0 4px 0'
}));
var orbitSelect = ui.Select({
  items: [
    {label: 'Both passes', value: 'BOTH'},
    {label: 'Ascending only', value: 'ASCENDING'},
    {label: 'Descending only', value: 'DESCENDING'}
  ],
  value: currentOrbit,
  onChange: function(value) {
    currentOrbit = value;
    updateApp(false);
  },
  style: {
    stretch: 'horizontal',
    margin: '0 0 12px 0',
    backgroundColor: UI_PANEL_BG_ALT,
    color: UI_TEXT_PRIMARY,
    border: '1px solid ' + UI_BORDER
  }
});
controlsSection.add(orbitSelect);

controlsSection.add(ui.Label('Map layers', {
  fontSize: '12px',
  fontWeight: 'bold',
  color: UI_TEXT_PRIMARY,
  margin: '0 0 4px 0'
}));
var sarCheckbox = ui.Checkbox({
  label: 'SAR composite',
  value: showSarLayer,
  onChange: function(value) {
    showSarLayer = value;
    updateLayerVisibility();
  },
  style: {margin: '0 0 2px 0'}
});
var detectionCheckbox = ui.Checkbox({
  label: 'Ship candidates',
  value: showDetectionLayer,
  onChange: function(value) {
    showDetectionLayer = value;
    if (value) {
      currentBand = 'VV';
    }
    applyLayerBandConstraints();
    updateLayerVisibility();
  },
  style: {margin: '0 0 2px 0'}
});
var heatmapCheckbox = ui.Checkbox({
  label: 'Density heatmap',
  value: showHeatmapLayer,
  onChange: function(value) {
    showHeatmapLayer = value;
    if (value) {
      currentBand = 'VV';
    }
    applyLayerBandConstraints();
    updateLayerVisibility();
  },
  style: {margin: '0 0 2px 0'}
});
var zonesCheckbox = ui.Checkbox({
  label: 'Analysis zones',
  value: showZoneLayer,
  onChange: function(value) {
    showZoneLayer = value;
    updateLayerVisibility();
  },
  style: {margin: '0 0 4px 0'}
});
controlsSection.add(sarCheckbox);
controlsSection.add(detectionCheckbox);
controlsSection.add(heatmapCheckbox);
controlsSection.add(zonesCheckbox);
explorerPage.add(controlsSection);
explorerPage.add(dividerLine());

var summarySection = sectionPanel();
summarySection.add(sectionTitle('Selected View Statistics'));
var summaryTable = ui.Panel({
  style: {stretch: 'horizontal', margin: '0'}
});
var summaryMonthRow = makeExplorerStatRow('Month');
var summaryRegionRow = makeExplorerStatRow('Region');
var summaryBandRow = makeExplorerStatRow('Band');
var summaryOrbitRow = makeExplorerStatRow('Orbit');
var summaryImagesRow = makeExplorerStatRow('Images');
var summaryMeanVvRow = makeExplorerStatRow('Mean VV');
var summaryMeanVhRow = makeExplorerStatRow('Mean VH');
var summaryCandidatesRow = makeExplorerStatRow('Candidate pixels');
var summaryDensityRow = makeExplorerStatRow('Density sum');
summaryTable.add(summaryMonthRow.row);
summaryTable.add(summaryRegionRow.row);
summaryTable.add(summaryBandRow.row);
summaryTable.add(summaryOrbitRow.row);
summaryTable.add(summaryImagesRow.row);
summaryTable.add(summaryMeanVvRow.row);
summaryTable.add(summaryMeanVhRow.row);
summaryTable.add(summaryCandidatesRow.row);
summaryTable.add(summaryDensityRow.row);
summarySection.add(summaryTable);
explorerPage.add(summarySection);

var backSection = sectionPanel();
var backButton = ui.Button({
  label: 'Back',
  onClick: function() {
    currentPage = 'select';
    updatePageVisibility();
  },
  style: {
    stretch: 'horizontal',
    backgroundColor: UI_PANEL_BG_STRONG,
    color: UI_TEXT_PRIMARY,
    border: '1px solid ' + UI_BORDER_STRONG
  }
});
backSection.add(backButton);
explorerPage.add(backSection);

// -----------------------------
// 9. Map legend and chart dock
// -----------------------------
var rightDockPanel = ui.Panel({
  style: {
    position: 'bottom-right',
    width: '270px',
    padding: '0 0 42px 0',
    backgroundColor: 'rgba(0, 0, 0, 0)'
  }
});

var legendPanel = ui.Panel({
  style: {
    width: '270px',
    padding: '8px',
    margin: '0 0 8px 0',
    backgroundColor: 'rgba(244, 250, 254, 0.95)',
    border: '1px solid ' + UI_BORDER
  }
});
legendPanel.add(ui.Label('Map Legend', {
  fontSize: '13px',
  fontWeight: 'bold',
  color: UI_TEXT_PRIMARY,
  margin: '0 0 6px 0',
  textAlign: 'center',
  stretch: 'horizontal'
}));
legendPanel.add(ui.Label('SAR backscatter', {
  fontSize: '10px',
  fontWeight: 'bold',
  color: UI_TEXT_PRIMARY,
  margin: '0 0 2px 0'
}));
legendPanel.add(makeColorBar(SAR_PALETTE, -25, 0, 200));
var sarLegendLabels = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {stretch: 'horizontal', margin: '0 0 6px 0'}
});
sarLegendLabels.add(ui.Label('Low', {fontSize: '10px', color: UI_TEXT_SECONDARY, margin: '0'}));
sarLegendLabels.add(ui.Label('High', {fontSize: '10px', color: UI_TEXT_SECONDARY, margin: '0 0 0 152px'}));
legendPanel.add(sarLegendLabels);

var candidateRow = ui.Panel({layout: ui.Panel.Layout.flow('horizontal')});
candidateRow.add(makeSwatch('#FF7A1A'));
candidateRow.add(ui.Label('Ship candidate pixels', {
  fontSize: '10px',
  color: UI_TEXT_SECONDARY,
  margin: '2px 0'
}));
legendPanel.add(candidateRow);

legendPanel.add(ui.Label('Ship density frequency', {
  fontSize: '10px',
  fontWeight: 'bold',
  color: UI_TEXT_PRIMARY,
  margin: '6px 0 2px 0'
}));
legendPanel.add(makeColorBar(HEATMAP_PALETTE, HEATMAP_VIS_MIN, HEATMAP_VIS_MAX, 200));
var densityLegendLabels = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {stretch: 'horizontal', margin: '0'}
});
densityLegendLabels.add(ui.Label('Low', {fontSize: '10px', color: UI_TEXT_SECONDARY, margin: '0'}));
densityLegendLabels.add(ui.Label('High', {fontSize: '10px', color: UI_TEXT_SECONDARY, margin: '0 0 0 152px'}));
legendPanel.add(densityLegendLabels);

var chartPanel = ui.Panel({
  style: {
    width: '270px',
    padding: '8px',
    backgroundColor: 'rgba(244, 250, 254, 0.95)',
    border: '1px solid ' + UI_BORDER
  }
});
chartPanel.add(ui.Label('Monthly Trend Charts', {
  fontSize: '13px',
  fontWeight: 'bold',
  color: UI_TEXT_PRIMARY,
  margin: '0 0 6px 0'
}));
var chartPanelNote = ui.Label('Full study area | Both passes | 2023 reference series', {
  fontSize: '10px',
  color: UI_TEXT_SECONDARY,
  margin: '0 0 6px 0'
});
chartPanel.add(chartPanelNote);
var chartsContainer = ui.Panel({
  style: {stretch: 'horizontal'}
});
chartPanel.add(chartsContainer);

rightDockPanel.add(legendPanel);
rightDockPanel.add(chartPanel);
appMap.add(rightDockPanel);

// -----------------------------
// 10. UI update functions
// -----------------------------
function getAnnualReferenceStats() {
  if (!monthlyChartStatsLoaded) {
    return null;
  }

  var validRows = monthlyChartStats.filter(function(row) {
    return !!row;
  });

  if (!validRows.length) {
    return null;
  }

  var totalImages = 0;
  var weightedMeanVv = 0;
  var weightedMeanVh = 0;
  var totalCandidates = 0;
  var totalDensity = 0;

  validRows.forEach(function(row) {
    var imageWeight = Number(row.images || 0);
    totalImages += imageWeight;

    if (row.meanVV !== null && row.meanVV !== undefined) {
      weightedMeanVv += Number(row.meanVV) * imageWeight;
    }

    if (row.meanVH !== null && row.meanVH !== undefined) {
      weightedMeanVh += Number(row.meanVH) * imageWeight;
    }

    totalCandidates += Number(row.candidates || 0);
    totalDensity += Number(row.density || 0);
  });

  return {
    images: totalImages,
    meanVV: totalImages ? (weightedMeanVv / totalImages) : null,
    meanVH: totalImages ? (weightedMeanVh / totalImages) : null,
    candidates: totalCandidates,
    density: totalDensity
  };
}

function updateOverviewPanel() {
  if (currentTimeSelection === 'year') {
    overviewTitle.setValue(YEAR + ' Overview');
    overviewNote.setValue(
      'Reference values for the full 2023 period using Full study area and Both passes. Candidate pixels and density sum remain relative indicators rather than validated vessel counts.'
    );
  } else {
    overviewTitle.setValue(getMonthName(currentMonth) + ' ' + YEAR + ' Overview');
    overviewNote.setValue(
      'Reference values for ' + getMonthName(currentMonth) + ' ' + YEAR +
      ' using Full study area and Both passes. Candidate pixels and density sum remain relative indicators rather than validated vessel counts.'
    );
  }

  overviewImagesCard.value.setValue('...');
  overviewMeanVvCard.value.setValue('...');
  overviewMeanVhCard.value.setValue('...');
  overviewCandidatesCard.value.setValue('...');
  overviewDensityCard.value.setValue('...');
  updateTimeSelectionControls();
  updateFixedOverviewFromCharts();
}

function updateBandButtons() {
  if (currentBand === 'VV') {
    vvButton.style().set('backgroundColor', UI_PANEL_BG_STRONG);
    vvButton.style().set('color', UI_TEXT_PRIMARY);
    vvButton.style().set('border', '1px solid ' + UI_BORDER_STRONG);
    vvButton.setDisabled(false);
    if (vhButtonLocked) {
      vhButton.style().set('backgroundColor', UI_PANEL_BG_DISABLED);
      vhButton.style().set('color', UI_TEXT_PRIMARY);
      vhButton.style().set('border', '1px solid ' + UI_BORDER);
    } else {
      vhButton.style().set('backgroundColor', UI_PANEL_BG_ALT);
      vhButton.style().set('color', UI_TEXT_PRIMARY);
      vhButton.style().set('border', '1px solid ' + UI_BORDER);
    }
  } else {
    vvButton.style().set('backgroundColor', UI_PANEL_BG_ALT);
    vvButton.style().set('color', UI_TEXT_PRIMARY);
    vvButton.style().set('border', '1px solid ' + UI_BORDER);
    vvButton.setDisabled(false);
    vhButton.style().set('backgroundColor', UI_PANEL_BG_STRONG);
    vhButton.style().set('color', UI_TEXT_PRIMARY);
    vhButton.style().set('border', '1px solid ' + UI_BORDER_STRONG);
  }
}

function setCurrentMonth(monthNumber) {
  currentMonth = monthNumber;
  currentTimeSelection = 'month';
  updateApp(false);
}

function updateTimeSelectionControls() {
  if (currentTimeSelection === 'year') {
    yearSelectButton.style().set('backgroundColor', UI_PANEL_BG_STRONG);
    yearSelectButton.style().set('color', UI_TEXT_PRIMARY);
    yearSelectButton.style().set('border', '1px solid ' + UI_BORDER_STRONG);
  } else {
    yearSelectButton.style().set('backgroundColor', UI_PANEL_BG_ALT);
    yearSelectButton.style().set('color', UI_TEXT_SECONDARY);
    yearSelectButton.style().set('border', '1px solid ' + UI_BORDER);
  }

  syncTimeSelectionUi = true;
  monthSelectDropdown.setValue(currentMonth);
  syncTimeSelectionUi = false;
}

function updatePageVisibility() {
  selectPage.style().set('shown', currentPage === 'select');
  explorerPage.style().set('shown', currentPage === 'explore');
}

function applyLayerBandConstraints() {
  if (syncUiState) {
    return;
  }

  syncUiState = true;

  if (currentBand === 'VH') {
    if (showDetectionLayer) {
      showDetectionLayer = false;
      detectionCheckbox.setValue(false);
    }
    if (showHeatmapLayer) {
      showHeatmapLayer = false;
      heatmapCheckbox.setValue(false);
    }
    detectionCheckbox.setDisabled(true);
    heatmapCheckbox.setDisabled(true);
    vhButton.setDisabled(false);
    vhButtonLocked = false;
  } else {
    detectionCheckbox.setDisabled(false);
    heatmapCheckbox.setDisabled(false);

    if (showDetectionLayer || showHeatmapLayer) {
      if (currentBand !== 'VV') {
        currentBand = 'VV';
      }
      vhButton.setDisabled(true);
      vhButtonLocked = true;
    } else {
      vhButton.setDisabled(false);
      vhButtonLocked = false;
    }
  }

  if (currentBand === 'VV' && !(showDetectionLayer || showHeatmapLayer)) {
    vhButton.setDisabled(false);
    vhButtonLocked = false;
  }

  updateBandButtons();
  syncUiState = false;
}

function updateFixedOverviewFromCharts() {
  var row = currentTimeSelection === 'year' ?
    getAnnualReferenceStats() :
    monthlyChartStats[currentMonth - 1];

  if (!row) {
    overviewImagesCard.value.setValue('...');
    overviewMeanVvCard.value.setValue('...');
    overviewMeanVhCard.value.setValue('...');
    overviewCandidatesCard.value.setValue('...');
    overviewDensityCard.value.setValue('...');

    if (currentTimeSelection === 'year') {
      return;
    }

    fixedOverviewRequestId += 1;
    var requestId = fixedOverviewRequestId;
    computeMonthlyStatsForCharts(currentMonth, function(result) {
      if (requestId !== fixedOverviewRequestId || !result) {
        return;
      }
      monthlyChartStats[currentMonth - 1] = result;
      updateFixedOverviewFromCharts();
    });
    return;
  }

  overviewImagesCard.value.setValue(formatInteger(row.images));
  overviewMeanVvCard.value.setValue(formatNumber(row.meanVV, 2) + ' dB');
  overviewMeanVhCard.value.setValue(formatNumber(row.meanVH, 2) + ' dB');
  overviewCandidatesCard.value.setValue(formatInteger(row.candidates));
  overviewDensityCard.value.setValue(formatInteger(row.density));
}

function updateLayerVisibility() {
  appMap.layers().get(0).setShown(showSarLayer);
  appMap.layers().get(1).setShown(showHeatmapLayer && currentBand === 'VV');
  appMap.layers().get(2).setShown(showDetectionLayer && currentBand === 'VV');
  appMap.layers().get(3).setShown(showZoneLayer);
  appMap.layers().get(4).setShown(showZoneLayer && currentRegion !== 'ALL');
  appMap.layers().get(5).setShown(true);
}

function updateSelectedRegionLayer() {
  var selectedLayer = emptySingleBandImage('selected');

  if (currentRegion !== 'ALL') {
    selectedLayer = ee.Image().byte().paint({
      featureCollection: selectedRegionFeatureCollection(),
      color: 1,
      width: 3
    });
  }

  appMap.layers().set(4, ui.Map.Layer(
    selectedLayer,
    {palette: ['FFFFFF'], opacity: 0.95},
    'Selected region: ' + regionNameById[currentRegion],
    showZoneLayer && currentRegion !== 'ALL'
  ));
}

function zoomToSelectedRegion() {
  if (currentRegion === 'ALL') {
    appMap.centerObject(aoi, 11);
  } else {
    appMap.centerObject(selectedRegionGeometry(), 12);
  }
}

function updateMapLayers() {
  currentFilteredCollection = getMonthlyCollection(currentMonth);
  currentComposite = makeMonthlyComposite(currentFilteredCollection);
  currentDetectionMask = makeDetectionMask(currentFilteredCollection);
  currentHeatmap = makeHeatmap(currentFilteredCollection);
  var displayHeatmap = makeHeatmapDisplay(currentHeatmap);

  var sarVis = currentBand === 'VV' ? vvVis : vhVis;

  appMap.layers().set(0, ui.Map.Layer(
    currentComposite,
    sarVis,
    'SAR ' + currentBand + ' composite - ' + getMonthShortName(currentMonth) + ' ' + YEAR,
    showSarLayer
  ));

  appMap.layers().set(1, ui.Map.Layer(
    displayHeatmap,
    heatmapVis,
    'Monthly ship density heatmap - ' + getMonthShortName(currentMonth),
    showHeatmapLayer && currentBand === 'VV'
  ));

  appMap.layers().set(2, ui.Map.Layer(
    currentDetectionMask,
    detectionVis,
    'Ship candidate detection - ' + getMonthShortName(currentMonth),
    showDetectionLayer && currentBand === 'VV'
  ));

  appMap.layers().set(3, ui.Map.Layer(
    zoneOutline,
    {palette: ['00D1FF'], opacity: 0.8},
    'Analysis zones',
    showZoneLayer
  ));

  updateSelectedRegionLayer();

  appMap.layers().set(5, ui.Map.Layer(
    aoiBorder,
    {palette: ['FF3B30'], opacity: 0.95},
    'Study area boundary',
    true
  ));

  updateLayerVisibility();
}

function updateViewSummary() {
  if (currentRegion === 'ALL' && currentOrbit === 'BOTH' && monthlyChartStatsLoaded) {
    var fixedRow = monthlyChartStats[currentMonth - 1];
    if (fixedRow) {
      summaryMonthRow.value.setValue(getMonthName(currentMonth) + ' ' + YEAR);
      summaryRegionRow.value.setValue(regionNameById[currentRegion]);
      summaryBandRow.value.setValue(currentBand);
      summaryOrbitRow.value.setValue(currentOrbit);
      summaryImagesRow.value.setValue(formatInteger(fixedRow.images));
      summaryMeanVvRow.value.setValue(formatNumber(fixedRow.meanVV, 2) + ' dB');
      summaryMeanVhRow.value.setValue(formatNumber(fixedRow.meanVH, 2) + ' dB');
      summaryCandidatesRow.value.setValue(formatInteger(fixedRow.candidates));
      summaryDensityRow.value.setValue(formatInteger(fixedRow.density));
      return;
    }
  }

  summaryMonthRow.value.setValue('Computing...');
  summaryRegionRow.value.setValue('Computing...');
  summaryBandRow.value.setValue('Computing...');
  summaryOrbitRow.value.setValue('Computing...');
  summaryImagesRow.value.setValue('Computing...');
  summaryMeanVvRow.value.setValue('Computing...');
  summaryMeanVhRow.value.setValue('Computing...');
  summaryCandidatesRow.value.setValue('Computing...');
  summaryDensityRow.value.setValue('Computing...');

  var regionGeometry = selectedRegionGeometry();
  var meanBackscatter = currentComposite.select(['VV', 'VH']).reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: regionGeometry,
    scale: 100,
    maxPixels: 1e8,
    tileScale: 4
  });

  var shipPixels = currentDetectionMask.unmask(0).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: regionGeometry,
    scale: 30,
    maxPixels: 1e8,
    tileScale: 4
  }).get('ship');

  var densitySum = currentHeatmap.unmask(0).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: regionGeometry,
    scale: 60,
    maxPixels: 1e8,
    tileScale: 4
  }).get('ship');

  var summary = ee.Dictionary({
    image_count: currentFilteredCollection.size(),
    mean_vv: meanBackscatter.get('VV'),
    mean_vh: meanBackscatter.get('VH'),
    ship_pixels: shipPixels,
    density_sum: densitySum
  });

  summary.evaluate(function(result) {
    if (!result) {
      summaryMonthRow.value.setValue('Unavailable');
      summaryRegionRow.value.setValue('Unavailable');
      summaryBandRow.value.setValue('Unavailable');
      summaryOrbitRow.value.setValue('Unavailable');
      summaryImagesRow.value.setValue('Unavailable');
      summaryMeanVvRow.value.setValue('Unavailable');
      summaryMeanVhRow.value.setValue('Unavailable');
      summaryCandidatesRow.value.setValue('Unavailable');
      summaryDensityRow.value.setValue('Unavailable');
      return;
    }

    summaryMonthRow.value.setValue(getMonthName(currentMonth) + ' ' + YEAR);
    summaryRegionRow.value.setValue(regionNameById[currentRegion]);
    summaryBandRow.value.setValue(currentBand);
    summaryOrbitRow.value.setValue(currentOrbit);
    summaryImagesRow.value.setValue(formatInteger(result.image_count));
    summaryMeanVvRow.value.setValue(formatNumber(result.mean_vv, 2) + ' dB');
    summaryMeanVhRow.value.setValue(formatNumber(result.mean_vh, 2) + ' dB');
    summaryCandidatesRow.value.setValue(formatInteger(result.ship_pixels));
    summaryDensityRow.value.setValue(formatInteger(result.density_sum));
  });
}

function computeMonthlyStatsForCharts(monthNumber, callback) {
  var monthCollection = s1.filterDate(
    getMonthStart(monthNumber),
    getMonthEnd(monthNumber)
  );

  var monthComposite = makeMonthlyComposite(monthCollection);
  var monthDetection = makeDetectionMask(monthCollection);
  var monthHeatmap = makeHeatmap(monthCollection);

  var meanBackscatter = monthComposite.select(['VV', 'VH']).reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: aoi,
    scale: 100,
    maxPixels: 1e8,
    tileScale: 4
  });

  var shipPixels = monthDetection.unmask(0).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: 30,
    maxPixels: 1e8,
    tileScale: 4
  }).get('ship');

  var densitySum = monthHeatmap.unmask(0).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: 60,
    maxPixels: 1e8,
    tileScale: 4
  }).get('ship');

  ee.Dictionary({
    month: monthNumber,
    label: getMonthShortName(monthNumber),
    images: monthCollection.size(),
    meanVV: meanBackscatter.get('VV'),
    meanVH: meanBackscatter.get('VH'),
    candidates: shipPixels,
    density: densitySum
  }).evaluate(callback);
}

function loadMonthlyChartStats() {
  if (monthlyChartStatsLoaded || monthlyChartStatsLoading) {
    if (monthlyChartStatsLoaded) {
      updateCharts();
    }
    return;
  }

  monthlyChartStatsLoading = true;
  chartsContainer.clear();
  chartPanelNote.setValue('Full study area | Both passes | Preparing 2023 reference series...');

  var results = [];

  function loadNext(monthNumber) {
    if (monthNumber > 12) {
      monthlyChartStats = results;
      monthlyChartStatsLoaded = true;
      monthlyChartStatsLoading = false;
      chartPanelNote.setValue('Full study area | Both passes | 2023 reference series');
      updateFixedOverviewFromCharts();
      updateCharts();
      return;
    }

    chartPanelNote.setValue(
      'Full study area | Both passes | Preparing ' +
      getMonthShortName(monthNumber) + ' ' + YEAR +
      ' (' + monthNumber + '/12)'
    );

    computeMonthlyStatsForCharts(monthNumber, function(result) {
      if (!result) {
        result = {
          month: monthNumber,
          label: getMonthShortName(monthNumber),
          images: 0,
          meanVV: null,
          meanVH: null,
          candidates: 0,
          density: 0
        };
      }
      results.push(result);
      monthlyChartStats[monthNumber - 1] = result;
      loadNext(monthNumber + 1);
    });
  }

  chartsContainer.add(ui.Label('Preparing reference charts...', {
    fontSize: '11px',
    color: UI_TEXT_SECONDARY,
    margin: '4px 0'
  }));

  loadNext(1);
}

function updateCharts() {
  chartsContainer.clear();

  if (!monthlyChartStatsLoaded) {
    chartsContainer.add(ui.Label('Preparing reference charts...', {
      fontSize: '11px',
      color: UI_TEXT_SECONDARY,
      margin: '4px 0'
    }));
    return;
  }

  var statsFc = chartStatsFeatureCollection();

  var candidateChart = ui.Chart.feature.byFeature(
      statsFc,
      'month',
      ['candidates']
    )
    .setChartType('ColumnChart')
    .setOptions({
      title: 'Monthly Ship Candidate Pixels',
      hAxis: {
        title: 'Month',
        ticks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
      },
      vAxis: {
        title: 'Candidate pixels',
        viewWindow: {min: 0, max: 1600}
      },
      colors: [UI_ACCENT],
      legend: {position: 'none'},
      bar: {groupWidth: '70%'},
      height: 120,
      chartArea: {left: 42, top: 26, width: '76%', height: '50%'}
    });

  candidateChart.onClick(function(xValue) {
    if (xValue !== null && xValue !== undefined) {
      setCurrentMonth(Math.max(1, Math.min(12, Math.round(xValue))));
    }
  });

  var backscatterChart = ui.Chart.feature.byFeature(
      statsFc,
      'month',
      ['meanVV', 'meanVH']
    )
    .setChartType('LineChart')
    .setOptions({
      title: 'Mean SAR Backscatter',
      hAxis: {
        title: 'Month',
        ticks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
      },
      vAxis: {
        title: 'Mean dB',
        viewWindow: {min: -24, max: -12}
      },
      colors: [UI_ACCENT_DARK, '#5BA7D1'],
      lineWidth: 2,
      pointSize: 4,
      legend: {position: 'top'},
      height: 120,
      chartArea: {left: 42, top: 26, width: '76%', height: '50%'}
    });

  chartsContainer.add(candidateChart);
  chartsContainer.add(backscatterChart);
}

function updateApp(refreshCharts) {
  updateOverviewPanel();
  applyLayerBandConstraints();
  updateBandButtons();
  updateMapLayers();
  updateViewSummary();

  if (refreshCharts) {
    updateCharts();
  }
}

// -----------------------------
// 11. Initialise app
// -----------------------------
loadMonthlyChartStats();
updateApp(false);
updatePageVisibility();
