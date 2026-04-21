var waterOccurrence = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('occurrence');
var waterMask = waterOccurrence.gt(50);

var land = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017').filterBounds(aoi);
var landImage = ee.Image(0).byte().paint(land, 1);
var coastalBuffer = landImage.focal_max({
  radius: 500,
  kernelType: 'circle',
  units: 'meters'
});
var openWaterMask = coastalBuffer.eq(0);

var showHeatmap = true;

function detectShipBinary(image) {
  image = ee.Image(image);

  var vv = image.select('VV')
    .focal_mean({radius: 1, kernelType: 'square', units: 'pixels'});

  var brightTargets = vv.gt(-10);
  var connected = brightTargets.connectedPixelCount(100, true);
  var shipMask = brightTargets
    .updateMask(connected.gte(2))
    .updateMask(connected.lte(15));

  var result = shipMask
    .unmask(0)
    .updateMask(waterMask)
    .updateMask(openWaterMask)
    .unmask(0)
    .rename('ship');

  return ee.Image(result)
    .copyProperties(image, ['system:time_start']);
}

function buildHeatmap(filteredCollection) {
  var shipPresence = filteredCollection.map(detectShipBinary);
  var heatmap = shipPresence.select('ship').sum().clip(aoi);
  return heatmap;
}

controlPanel.add(ui.Label('Heatmap Toggle', {
  fontSize: '12px', fontWeight: 'bold', color: '#555'
}));

var heatmapCheckbox = ui.Checkbox({
  label: 'Show Ship Density Heatmap',
  value: true,
  onChange: function(checked) {
    showHeatmap = checked;
    updateMap();
  },
  style: {margin: '4px 0 10px 0'}
});
controlPanel.add(heatmapCheckbox);

chartPanel.add(ui.Label('─────────────────────────', {
  fontSize: '11px', color: '#ccc', margin: '6px 0 4px 0'
}));
chartPanel.add(ui.Label('Monthly Ship Pixel Count (2023)', {
  fontSize: '12px', fontWeight: 'bold', color: '#333', margin: '0 0 4px 0'
}));
chartPanel.add(ui.Label('Computing... This might take a few seconds.', {
  fontSize: '10px', color: '#999', margin: '0 0 4px 0'
}));

var monthlyShipCounts = ee.FeatureCollection(
  months.map(function(m) {
    m = ee.Number(m);
    var start = ee.Date.fromYMD(2023, m, 1);
    var end = start.advance(1, 'month');
    var monthFiltered = s1.filterDate(start, end);

    var shipPresence = monthFiltered.map(detectShipBinary);
    var sumImage = shipPresence.select('ship').sum().clip(aoi);

    var totalShipPixels = sumImage.reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: 50,  
      tileScale: 4, 
      maxPixels: 1e10 
    }).get('ship');

    var imageCount = monthFiltered.size();

    return ee.Feature(null, {
      month: m,
      ship_pixels: totalShipPixels,
      image_count: imageCount
    });
  })
);

var shipCountChart = ui.Chart.feature.byFeature(monthlyShipCounts, 'month', ['ship_pixels'])
  .setChartType('ColumnChart')
  .setOptions({
    title: '',
    hAxis: {title: 'Month', ticks: [1,2,3,4,5,6,7,8,9,10,11,12]},
    vAxis: {title: 'Relative Ship Pixels'},
    colors: ['#FF6600'],
    legend: {position: 'none'},
    bar: {groupWidth: '70%'},
    height: 160
  });

shipCountChart.onClick(function(xValue) {
  if (xValue !== null) {
    currentMonth = Math.round(xValue);
    monthSelect.setValue(String(currentMonth));
    updateMap();
  }
});

chartPanel.add(shipCountChart);

var heatmapToolPanel = ui.Panel({
  style: {
    position: 'top-right',
    padding: '10px',
    width: '220px',
    backgroundColor: 'rgba(255,255,255,0.92)'
  }
});

heatmapToolPanel.add(ui.Label('Annual Heatmap', {
  fontSize: '14px', fontWeight: 'bold', color: '#333', margin: '0 0 6px 0'
}));

heatmapToolPanel.add(ui.Label(
  'Generate a full-year ship density\nheatmap across all 2023 imagery.',
  {fontSize: '11px', color: '#666', whiteSpace: 'pre', margin: '0 0 8px 0'}
));

var annualHeatmapBtn = ui.Button({
  label: '▶ Build Annual Heatmap',
  onClick: function() {
    annualHeatmapBtn.setDisabled(true);
    annualHeatmapBtn.setLabel('Processing…');

    var annualHeatmap = buildHeatmap(s1);

    Map.layers().set(3,
      ui.Map.Layer(annualHeatmap.selfMask(),
        {min: 1, max: 30,
         palette: ['FFFF00', 'FF8800', 'FF0000', 'CC0044', '660033'],
         opacity: 0.65},
        'Annual Ship Density Heatmap 2023')
    );

    annualHeatmapBtn.setLabel('✓ Annual Heatmap Loaded');
    detectionInfoLabel.setValue(
      'Heatmap showing full-year density.\n' +
      'Switch month to return to monthly view.'
    );
  },
  style: {width: '200px', backgroundColor: '#1a73e8', color: 'white'}
});
heatmapToolPanel.add(annualHeatmapBtn);

Map.add(heatmapToolPanel);
