// =============================================
// app.js
// Interactive Maritime Activity Analysis
// Port of Singapore - Sentinel-1 SAR
// Updated with optimized computation to prevent server timeouts
// =============================================

// -----------------------------
// 1. 定义研究区 AOI
// -----------------------------
var aoi = ee.Geometry.Polygon(
  [[[103.60, 1.15],
    [104.05, 1.15],
    [104.05, 1.36],
    [103.60, 1.36],
    [103.60, 1.15]]]
);

// -----------------------------
// 2. 加载 Sentinel-1 数据
// -----------------------------
var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(aoi)
  .filterDate('2023-01-01', '2023-12-31')
  .filter(ee.Filter.eq('instrumentMode', 'IW'));

// -----------------------------
// 2b. 预加载水体/陆地掩膜
// -----------------------------
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
// 3. 状态变量
// -----------------------------
var currentMonth = 1;
var currentBand = 'VV';
var currentOrbit = 'BOTH';
var showHeatmap = true;

// -----------------------------
// 4. 地图设置
// -----------------------------
Map.setCenter(103.82, 1.26, 11);
Map.setOptions('HYBRID');
Map.style().set('cursor', 'crosshair');

var aoiBorder = ee.Image().byte().paint({
  featureCollection: ee.FeatureCollection([ee.Feature(aoi)]),
  color: 1,
  width: 2
});
Map.addLayer(aoiBorder, {palette: ['FF0000']}, 'Study Area Boundary', true);

// -----------------------------
// 5. 船舶检测核心函数
// -----------------------------
function preprocessForDetection(image) {
  image = ee.Image(image);

  var vv = image.select('VV')
    .focal_mean({radius: 1, kernelType: 'square', units: 'pixels'})
    .rename('VV_filtered');

  var vh = image.select('VH')
    .focal_mean({radius: 1, kernelType: 'square', units: 'pixels'})
    .rename('VH_filtered');

  return ee.Image(vv.addBands(vh))
    .updateMask(waterMask)
    .updateMask(openWaterMask)
    .copyProperties(image, ['system:time_start', 'orbitProperties_pass']);
}

function detectShips(image, threshold, minPixels, maxPixels) {
  image = ee.Image(image);
  var vv = image.select('VV_filtered');
  var brightTargets = vv.gt(threshold);
  var connected = brightTargets.connectedPixelCount(100, true);
  var filtered = brightTargets
    .updateMask(connected.gte(minPixels))
    .updateMask(connected.lte(maxPixels));
  return filtered.selfMask();
}

// -----------------------------
// 5b. 单景船舶检测 → 0/1 掩膜
// -----------------------------
function detectShipBinary(image) {
  image = ee.Image(image);

  var vv = image.select('VV')
    .focal_mean({radius: 1, kernelType: 'square', units: 'pixels'});

  var brightTargets = vv.gt(-10);
  var connected = brightTargets.connectedPixelCount(100, true);
  var shipMask = brightTargets
    .updateMask(connected.gte(2))
    .updateMask(connected.lte(15));

  // 应用水体 / 陆地掩膜，返回 0/1
  var result = shipMask
    .unmask(0)
    .updateMask(waterMask)
    .updateMask(openWaterMask)
    .unmask(0)
    .rename('ship');

  return ee.Image(result)
    .copyProperties(image, ['system:time_start']);
}

// -----------------------------
// 5c. 热点图生成
// -----------------------------
function buildHeatmap(filteredCollection) {
  var shipPresence = filteredCollection.map(detectShipBinary);
  var heatmap = shipPresence.select('ship').sum().clip(aoi);
  return heatmap;
}

function getMonthName(m) {
  var names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
               'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return names[m - 1];
}

// -----------------------------
// 6. 图层占位
// -----------------------------
Map.addLayer(ee.Image(), {}, 'SAR Layer', false);
Map.addLayer(ee.Image(), {}, 'Ship Detection Layer', false);
Map.addLayer(ee.Image(), {}, 'Ship Density Heatmap', false);

// -----------------------------
// 7. 核心函数：更新地图
// -----------------------------
function updateMap() {
  var startDate = ee.Date.fromYMD(2023, currentMonth, 1);
  var endDate = startDate.advance(1, 'month');

  var filtered = s1.filterDate(startDate, endDate);

  if (currentOrbit === 'ASCENDING') {
    filtered = filtered.filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING'));
  } else if (currentOrbit === 'DESCENDING') {
    filtered = filtered.filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'));
  }

  var composite = filtered.median().clip(aoi);

  var visParams;
  if (currentBand === 'VV') {
    visParams = {
      bands: ['VV'], min: -25, max: 0,
      palette: ['000000', '0000FF', '00FFFF', 'FFFFFF']
    };
  } else {
    visParams = {
      bands: ['VH'], min: -30, max: -5,
      palette: ['000000', '0000FF', '00FFFF', 'FFFFFF']
    };
  }

  Map.layers().set(1,
    ui.Map.Layer(composite, visParams,
      'SAR ' + currentBand + ' - ' + getMonthName(currentMonth) + ' 2023')
  );

  if (currentBand === 'VV') {
    var detectionCollection = filtered.map(preprocessForDetection);
    var detectionComposite = detectionCollection.median().clip(aoi);

    var shipMask = detectShips(detectionComposite, -10, 2, 15);

    Map.layers().set(2,
      ui.Map.Layer(shipMask,
        {palette: ['FF6600'], opacity: 0.9},
        'Ship Candidate Detection')
    );

    if (showHeatmap) {
      var heatmap = buildHeatmap(filtered);
      Map.layers().set(3,
        ui.Map.Layer(heatmap.selfMask(),
          {min: 1, max: 10,
           palette: ['FFFF00', 'FF8800', 'FF0000', 'CC0044', '660033'],
           opacity: 0.65},
          'Ship Density Heatmap - ' + getMonthName(currentMonth))
      );
    } else {
      Map.layers().set(3,
        ui.Map.Layer(ee.Image().selfMask(), {}, 'Ship Density Heatmap')
      );
    }

    detectionInfoLabel.setValue(
      'Orange = ship candidates (threshold=-10)\n' +
      'Heatmap = cumulative ship density this month'
    );
  } else {
    Map.layers().set(2,
      ui.Map.Layer(ee.Image().selfMask(), {}, 'Ship Candidate Detection')
    );
    Map.layers().set(3,
      ui.Map.Layer(ee.Image().selfMask(), {}, 'Ship Density Heatmap')
    );
    detectionInfoLabel.setValue(
      'Ship detection & heatmap are displayed\nfor VV mode only.'
    );
  }

  statusLabel.setValue(
    'Showing: ' + getMonthName(currentMonth) +
    ' 2023 | Band: ' + currentBand +
    ' | Orbit: ' + currentOrbit
  );
}

// -----------------------------
// 8. UI 控制面板
// -----------------------------
var titlePanel = ui.Panel({
  style: {
    position: 'top-center',
    padding: '8px 15px',
    backgroundColor: 'rgba(0,0,0,0.75)',
    border: '0px'
  }
});
titlePanel.add(ui.Label('Maritime Activity - Port of Singapore', {
  fontSize: '16px', fontWeight: 'bold', color: 'white', margin: '0px'
}));
Map.add(titlePanel);

var controlPanel = ui.Panel({
  style: {
    position: 'top-left',
    padding: '10px',
    width: '260px',
    backgroundColor: 'rgba(255,255,255,0.92)'
  }
});

controlPanel.add(ui.Label('Controls', {
  fontSize: '14px', fontWeight: 'bold', color: '#333333', margin: '0 0 8px 0'
}));

controlPanel.add(ui.Label('Month (2023)', {
  fontSize: '12px', fontWeight: 'bold', color: '#555'
}));

var monthSelect = ui.Select({
  items: [
    {label: 'January',   value: '1'},
    {label: 'February',  value: '2'},
    {label: 'March',     value: '3'},
    {label: 'April',     value: '4'},
    {label: 'May',       value: '5'},
    {label: 'June',      value: '6'},
    {label: 'July',      value: '7'},
    {label: 'August',    value: '8'},
    {label: 'September', value: '9'},
    {label: 'October',   value: '10'},
    {label: 'November',  value: '11'},
    {label: 'December',  value: '12'}
  ],
  value: '1',
  onChange: function(val) {
    currentMonth = parseInt(val, 10);
    updateMap();
  },
  style: {width: '230px', margin: '4px 0 10px 0'}
});
controlPanel.add(monthSelect);

controlPanel.add(ui.Label('Polarisation', {
  fontSize: '12px', fontWeight: 'bold', color: '#555'
}));

var bandPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {margin: '4px 0 10px 0'}
});

var vvBtn = ui.Button({
  label: 'VV',
  onClick: function() {
    currentBand = 'VV';
    vvBtn.style().set('backgroundColor', '#1a73e8');
    vvBtn.style().set('color', 'white');
    vhBtn.style().set('backgroundColor', '#f0f0f0');
    vhBtn.style().set('color', '#333');
    updateMap();
  },
  style: {width: '108px', backgroundColor: '#1a73e8', color: 'white', margin: '0 4px 0 0'}
});

var vhBtn = ui.Button({
  label: 'VH',
  onClick: function() {
    currentBand = 'VH';
    vhBtn.style().set('backgroundColor', '#1a73e8');
    vhBtn.style().set('color', 'white');
    vvBtn.style().set('backgroundColor', '#f0f0f0');
    vvBtn.style().set('color', '#333');
    updateMap();
  },
  style: {width: '108px', backgroundColor: '#f0f0f0', color: '#333'}
});

bandPanel.add(vvBtn);
bandPanel.add(vhBtn);
controlPanel.add(bandPanel);

controlPanel.add(ui.Label('Orbit Direction', {
  fontSize: '12px', fontWeight: 'bold', color: '#555'
}));

var orbitSelect = ui.Select({
  items: [
    {label: 'Both (All passes)', value: 'BOTH'},
    {label: 'Ascending only',    value: 'ASCENDING'},
    {label: 'Descending only',   value: 'DESCENDING'}
  ],
  value: 'BOTH',
  onChange: function(val) {
    currentOrbit = val;
    updateMap();
  },
  style: {width: '230px', margin: '4px 0 10px 0'}
});
controlPanel.add(orbitSelect);

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

controlPanel.add(ui.Label('Ship Candidate Detection', {
  fontSize: '12px', fontWeight: 'bold', color: '#555'
}));

var detectionInfoLabel = ui.Label(
  'Orange = ship candidates (threshold=-10)\n' +
  'Heatmap = cumulative ship density this month',
  {fontSize: '11px', color: '#777', margin: '2px 0 10px 0', whiteSpace: 'pre'}
);
controlPanel.add(detectionInfoLabel);

controlPanel.add(ui.Label('─────────────────────', {
  fontSize: '11px', color: '#ccc', margin: '0 0 6px 0'
}));

var statusLabel = ui.Label('Showing: Jan 2023 | Band: VV | Orbit: BOTH', {
  fontSize: '11px', color: '#444', margin: '0 0 6px 0'
});
controlPanel.add(statusLabel);

Map.add(controlPanel);

// -----------------------------
// 9. 图例面板
// -----------------------------
var legendPanel = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 12px',
    backgroundColor: 'rgba(255,255,255,0.92)'
  }
});

legendPanel.add(ui.Label('SAR Backscatter Intensity', {
  fontSize: '12px', fontWeight: 'bold', color: '#333', margin: '0 0 6px 0'
}));

var makeColorBar = function(palette, min, max) {
  return ui.Thumbnail({
    image: ee.Image.pixelLonLat().select(0)
      .multiply((max - min) / 360.0).add(min)
      .visualize({min: min, max: max, palette: palette}),
    params: {bbox: '-180,0,180,10', dimensions: '160x12'},
    style: {margin: '2px 0 4px 0', stretch: 'horizontal'}
  });
};

legendPanel.add(makeColorBar(['000000', '0000FF', '00FFFF', 'FFFFFF'], -25, 0));

var legendLabels = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {margin: '0px', stretch: 'horizontal'}
});
legendLabels.add(ui.Label('Low', {fontSize: '10px', color: '#555', margin: '0px'}));
legendLabels.add(ui.Label('                             High', {fontSize: '10px', color: '#555'}));
legendPanel.add(legendLabels);

legendPanel.add(ui.Label(' ', {margin: '4px 0 2px 0'}));

var vesselLegend = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {margin: '2px 0'}
});
vesselLegend.add(ui.Label('■', {fontSize: '16px', color: 'FF6600', margin: '0 6px 0 0'}));
vesselLegend.add(ui.Label('Ship candidate detection', {fontSize: '11px', color: '#555'}));
legendPanel.add(vesselLegend);

legendPanel.add(ui.Label(' ', {margin: '2px 0 2px 0'}));
legendPanel.add(ui.Label('Ship Density Heatmap', {
  fontSize: '12px', fontWeight: 'bold', color: '#333', margin: '4px 0 4px 0'
}));
legendPanel.add(makeColorBar(['FFFF00', 'FF8800', 'FF0000', 'CC0044', '660033'], 1, 10));

var heatmapLabels = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {margin: '0px', stretch: 'horizontal'}
});
heatmapLabels.add(ui.Label('Low freq.', {fontSize: '10px', color: '#555', margin: '0px'}));
heatmapLabels.add(ui.Label('                         High freq.', {fontSize: '10px', color: '#555'}));
legendPanel.add(heatmapLabels);

legendPanel.add(ui.Label(' ', {margin: '2px 0 2px 0'}));

var borderLegend = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {margin: '2px 0'}
});
borderLegend.add(ui.Label('■', {fontSize: '16px', color: 'FF0000', margin: '0 6px 0 0'}));
borderLegend.add(ui.Label('Study area boundary', {fontSize: '11px', color: '#555'}));
legendPanel.add(borderLegend);

Map.add(legendPanel);

var chartPanel = ui.Panel({
  style: {
    position: 'bottom-right',
    padding: '8px',
    width: '360px',
    backgroundColor: 'rgba(255,255,255,0.92)'
  }
});

chartPanel.add(ui.Label('Monthly Mean Backscatter (2023)', {
  fontSize: '12px', fontWeight: 'bold', color: '#333', margin: '0 0 6px 0'
}));

var months = ee.List.sequence(1, 12);

var monthlyMeans = ee.FeatureCollection(
  months.map(function(m) {
    m = ee.Number(m);
    var start = ee.Date.fromYMD(2023, m, 1);
    var end = start.advance(1, 'month');
    var monthImg = s1.filterDate(start, end).median().clip(aoi);

    var meanVV = monthImg.select('VV').reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: aoi,
      scale: 100,
      maxPixels: 1e8
    }).get('VV');

    var meanVH = monthImg.select('VH').reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: aoi,
      scale: 100,
      maxPixels: 1e8
    }).get('VH');

    return ee.Feature(null, {month: m, VV: meanVV, VH: meanVH});
  })
);

var timeSeriesChart = ui.Chart.feature.byFeature(monthlyMeans, 'month', ['VV', 'VH'])
  .setChartType('LineChart')
  .setOptions({
    title: '',
    hAxis: {title: 'Month', ticks: [1,2,3,4,5,6,7,8,9,10,11,12]},
    vAxis: {title: 'Mean dB'},
    colors: ['#1a73e8', '#e8711a'],
    lineWidth: 2,
    pointSize: 4,
    legend: {position: 'top'},
    height: 160
  });

chartPanel.add(timeSeriesChart);

chartPanel.add(ui.Label('─────────────────────────', {
  fontSize: '11px', color: '#ccc', margin: '6px 0 4px 0'
}));
chartPanel.add(ui.Label('Monthly Ship Pixel Count (2023)', {
  fontSize: '12px', fontWeight: 'bold', color: '#333', margin: '0 0 4px 0'
}));
chartPanel.add(ui.Label('Computing... This might take a few seconds.', {
  fontSize: '10px', color: '#999', margin: '0 0 4px 0'
}));

//对月内所有影像做 detectShipBinary，逐像素求和，统计船舶像素总数
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

Map.add(chartPanel);

// -----------------------------
// 11. 全年累计热点图按钮（右上角）
// -----------------------------
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

// -----------------------------
// 12. 初始化
// -----------------------------
updateMap();
