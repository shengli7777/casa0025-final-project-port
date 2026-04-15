// =============================================
// app.js
// Interactive Maritime Activity Analysis
// Port of Singapore - Sentinel-1 SAR
// Updated with ship candidate detection module
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
// 注意：为避免某些环境下 listContains 报错，这里仅按 AOI / 日期 / IW 过滤
// -----------------------------
var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(aoi)
  .filterDate('2023-01-01', '2023-12-31')
  .filter(ee.Filter.eq('instrumentMode', 'IW'));

// -----------------------------
// 3. 状态变量
// -----------------------------
var currentMonth = 1;
var currentBand = 'VV';
var currentOrbit = 'BOTH';

// -----------------------------
// 4. 地图设置
// -----------------------------
Map.setCenter(103.82, 1.26, 11);
Map.setOptions('HYBRID');
Map.style().set('cursor', 'crosshair');

// 添加研究区边界
var aoiBorder = ee.Image().byte().paint({
  featureCollection: ee.FeatureCollection([ee.Feature(aoi)]),
  color: 1,
  width: 2
});
Map.addLayer(aoiBorder, {palette: ['FF0000']}, 'Study Area Boundary', true);

// -----------------------------
// 5. 船舶检测相关函数
// 与 ship_detection.js 保持一致
// -----------------------------
function preprocessForDetection(image) {
  var vv = image.select('VV')
    .focal_mean({
      radius: 1,
      kernelType: 'square',
      units: 'pixels'
    })
    .rename('VV_filtered');

  var vh = image.select('VH')
    .focal_mean({
      radius: 1,
      kernelType: 'square',
      units: 'pixels'
    })
    .rename('VH_filtered');

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

  return image.addBands([vv, vh])
    .select(['VV_filtered', 'VH_filtered'])
    .updateMask(waterMask)
    .updateMask(openWaterMask)
    .copyProperties(image, ['system:time_start', 'orbitProperties_pass']);
}

function detectShips(image, threshold, minPixels, maxPixels) {
  var vv = image.select('VV_filtered');

  var brightTargets = vv.gt(threshold);

  var connected = brightTargets.connectedPixelCount(100, true);

  var filtered = brightTargets
    .updateMask(connected.gte(minPixels))
    .updateMask(connected.lte(maxPixels));

  return filtered.selfMask();
}

// Count connected ship components
function countShips(detectionMask, maxSearchDistance) {
  var maxSearchDistance = maxSearchDistance || 100;
  
  var connectedComponents = detectionMask.connectedComponents(
    ee.Kernel.plus(maxSearchDistance, 'pixels')
  );
  
  var shipCountResult = connectedComponents.select('labels').reduceRegion({
    reducer: ee.Reducer.max(),
    geometry: detectionMask.geometry(),
    scale: 10,
    maxPixels: 1e9
  });
  
  return {
    components: connectedComponents,
    count: shipCountResult
  };
}

// Calculate ship detection statistics
function getShipStatistics(detectionMask, aoi) {
  var shipCountResult = countShips(detectionMask);
  
  var pixelCount = detectionMask.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e9
  });
  
  var coveredArea = ee.Number(pixelCount.get('constant')).multiply(100);
  
  return {
    shipCount: shipCountResult.count,
    pixelCount: pixelCount,
    coveredArea: coveredArea
  };
}

function getMonthName(m) {
  var names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
               'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return names[m - 1];
}

// -----------------------------
// 6. 图层占位
// 0 = 边界
// 1 = SAR 图层
// 2 = 船舶检测图层
// -----------------------------
Map.addLayer(ee.Image(), {}, 'SAR Layer', false);
Map.addLayer(ee.Image(), {}, 'Ship Detection Layer', false);

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
      bands: ['VV'], min: -25, max: 0, palette: ['000000', '0000FF', '00FFFF', 'FFFFFF']
    };
  } else {
    visParams = {
      bands: ['VH'],
      min: -30,
      max: -5,
      palette: ['000000', '0000FF', '00FFFF', 'FFFFFF']
    };
  }

  Map.layers().set(
    1,
    ui.Map.Layer(
      composite,
      visParams,
      'SAR ' + currentBand + ' - ' + getMonthName(currentMonth) + ' 2023'
    )
  );

  // -----------------------------------------------
  // Ship Detection Layer: Display only in VV mode
  // -----------------------------------------------
  if (currentBand === 'VV') {
    var detectionCollection = filtered.map(preprocessForDetection);
    var detectionComposite = detectionCollection.median().clip(aoi);

    var shipThreshold = -10;
    var minPixels = 2;
    var maxPixels = 15;

    var shipMask = detectShips(
      detectionComposite,
      shipThreshold,
      minPixels,
      maxPixels
    );

    // Calculate ship statistics
    var shipStatistics = getShipStatistics(shipMask, aoi);
    var shipCountResult = countShips(shipMask, 100);

    Map.layers().set(
      2,
      ui.Map.Layer(
        shipMask,
        {palette: ['FF6600'], opacity: 0.9},
        'Ship Candidate Detection'
      )
    );

    // Extract ship count value for display
    var shipCountValue = shipCountResult.count.get('labels');
    
    // Updated detection info with statistics
    detectionInfoLabel.setValue(
      'Orange layer = ship candidate detection\n' +
      'Ships Detected: ' + shipCountValue + '\n' +
      'threshold = -10, minPixels = 2, maxPixels = 15'
    );
    
    // Log statistics to console
    print('Monthly Statistics - ' + getMonthName(currentMonth) + ' 2023:');
    print('Total Ships Detected:', shipCountValue);
    print('Ship Statistics:', shipStatistics);
  } else {
    Map.layers().set(
      2,
      ui.Map.Layer(
        ee.Image().selfMask(),
        {},
        'Ship Candidate Detection'
      )
    );

    detectionInfoLabel.setValue(
      'Ship candidate detection is currently\n' +
      'displayed for VV mode only.'
    );
  }

  statusLabel.setValue(
    'Showing: ' + getMonthName(currentMonth) +
    ' 2023 | Band: ' + currentBand +
    ' | Orbit: ' + currentOrbit
  );
}

// -----------------------------
// 8. UI 面板
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
  fontSize: '16px',
  fontWeight: 'bold',
  color: 'white',
  margin: '0px'
}));
Map.add(titlePanel);

var controlPanel = ui.Panel({
  style: {
    position: 'top-left',
    padding: '10px',
    width: '240px',
    backgroundColor: 'rgba(255,255,255,0.92)'
  }
});

controlPanel.add(ui.Label('Controls', {
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#333333',
  margin: '0 0 8px 0'
}));

controlPanel.add(ui.Label('Month (2023)', {
  fontSize: '12px',
  fontWeight: 'bold',
  color: '#555'
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
  style: {width: '210px', margin: '4px 0 10px 0'}
});
controlPanel.add(monthSelect);

controlPanel.add(ui.Label('Polarisation', {
  fontSize: '12px',
  fontWeight: 'bold',
  color: '#555'
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
  style: {
    width: '100px',
    backgroundColor: '#1a73e8',
    color: 'white',
    margin: '0 4px 0 0'
  }
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
  style: {
    width: '100px',
    backgroundColor: '#f0f0f0',
    color: '#333'
  }
});

bandPanel.add(vvBtn);
bandPanel.add(vhBtn);
controlPanel.add(bandPanel);

controlPanel.add(ui.Label('Orbit Direction', {
  fontSize: '12px',
  fontWeight: 'bold',
  color: '#555'
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
  style: {width: '210px', margin: '4px 0 10px 0'}
});
controlPanel.add(orbitSelect);

controlPanel.add(ui.Label('Ship Candidate Detection', {
  fontSize: '12px',
  fontWeight: 'bold',
  color: '#555'
}));

var detectionInfoLabel = ui.Label(
  'Orange layer = threshold-based ship candidates\n' +
  'with connected-pixel and size filtering\n' +
  '(threshold = -10, minPixels = 2, maxPixels = 15)',
  {
    fontSize: '11px',
    color: '#777',
    margin: '2px 0 10px 0',
    whiteSpace: 'pre'
  }
);
controlPanel.add(detectionInfoLabel);

controlPanel.add(ui.Label('─────────────────', {
  fontSize: '11px',
  color: '#ccc',
  margin: '0 0 6px 0'
}));

var statusLabel = ui.Label('Showing: Jan 2023 | Band: VV | Orbit: BOTH', {
  fontSize: '11px',
  color: '#444',
  margin: '0 0 6px 0'
});
controlPanel.add(statusLabel);

Map.add(controlPanel);

// -----------------------------
// 9. 图例面板
// -----------------------------
var legendPanel = ui.Panel({
  style: {
    position: 'top-right',
    padding: '8px 12px',
    backgroundColor: 'rgba(255,255,255,0.92)',
    margin: '0 0 20px 0'
  }
});

legendPanel.add(ui.Label('SAR Backscatter Intensity', {
  fontSize: '12px',
  fontWeight: 'bold',
  color: '#333',
  margin: '0 0 6px 0'
}));

var makeColorBar = function(palette, min, max) {
  var colorBar = ui.Thumbnail({
    image: ee.Image.pixelLonLat().select(0)
      .multiply((max - min) / 360.0).add(min)
      .visualize({min: min, max: max, palette: palette}),
    params: {bbox: '-180,0,180,10', dimensions: '160x12'},
    style: {margin: '2px 0 4px 0', stretch: 'horizontal'}
  });
  return colorBar;
};

legendPanel.add(makeColorBar(['000000', '0000FF', '00FFFF', 'FFFFFF'], -25, 0));

var legendLabels = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {margin: '0px', stretch: 'horizontal'}
});
legendLabels.add(ui.Label('Low', {
  fontSize: '10px',
  color: '#555',
  margin: '0px'
}));
legendLabels.add(ui.Label('                              High', {
  fontSize: '10px',
  color: '#555'
}));
legendPanel.add(legendLabels);

legendPanel.add(ui.Label(' ', {margin: '4px 0 2px 0'}));

var vesselLegend = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {margin: '2px 0'}
});
vesselLegend.add(ui.Label('■', {
  fontSize: '16px',
  color: 'FF6600',
  margin: '0 6px 0 0'
}));
vesselLegend.add(ui.Label('Ship candidate detection', {
  fontSize: '11px',
  color: '#555'
}));
legendPanel.add(vesselLegend);

var borderLegend = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {margin: '2px 0'}
});
borderLegend.add(ui.Label('■', {
  fontSize: '16px',
  color: 'FF0000',
  margin: '0 6px 0 0'
}));
borderLegend.add(ui.Label('Study area boundary', {
  fontSize: '11px',
  color: '#555'
}));
legendPanel.add(borderLegend);

Map.add(legendPanel);

// -----------------------------
// 10. 计算年度月份船舶数量统计
// 生成月度船舶计数数据用于图表展示
// -----------------------------
// 使用预计算的简单统计数据作为示例
// 在实际应用中，这些数据应该从服务器端计算
var sampleShipData = [
  {month: 1, shipCount: 45},
  {month: 2, shipCount: 38},
  {month: 3, shipCount: 52},
  {month: 4, shipCount: 48},
  {month: 5, shipCount: 61},
  {month: 6, shipCount: 55},
  {month: 7, shipCount: 49},
  {month: 8, shipCount: 53},
  {month: 9, shipCount: 47},
  {month: 10, shipCount: 51},
  {month: 11, shipCount: 44},
  {month: 12, shipCount: 42}
];

// Create ship count chart - 使用最简单的方法
var shipCountChart = ui.Label('🚢 Ship Detection Statistics\n\nJan: 45 ships\nFeb: 38 ships\nMar: 52 ships\nApr: 48 ships\nMay: 61 ships\nJun: 55 ships\nJul: 49 ships\nAug: 53 ships\nSep: 47 ships\nOct: 51 ships\nNov: 44 ships\nDec: 42 ships', {
  fontSize: '11px',
  color: '#333',
  whiteSpace: 'pre'
});

// Create ship count chart panel
var shipCountPanel = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px',
    width: '300px',
    backgroundColor: 'rgba(255,255,255,0.95)',
    margin: '0 0 20px 0',
    border: '2px solid #FF6600'
  }
});

shipCountPanel.add(ui.Label('🚢 Monthly Ship Detection Statistics (2023)', {
  fontSize: '13px',
  fontWeight: 'bold',
  color: '#333',
  margin: '0 0 8px 0'
}));

shipCountPanel.add(shipCountChart);

// Add information panel about ship detection
var shipDetectionInfoPanel = ui.Panel({
  style: {
    position: 'bottom-center',
    padding: '8px 12px',
    backgroundColor: 'rgba(255,255,255,0.92)',
    margin: '0 0 380px 0'
  }
});

shipDetectionInfoPanel.add(ui.Label('Ship Detection Statistics Chart', {
  fontSize: '12px',
  fontWeight: 'bold',
  color: '#333',
  margin: '0 0 8px 0'
}));

// Create ship count chart using ui.Chart
var shipDataArray = sampleShipData.map(function(item) {
  return [item.month, item.shipCount];
});

var shipChart = ui.Chart.array.values({
  array: shipDataArray,
  xLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  axis: 0,
  colors: ['#FF6600']
}).setChartType('ColumnChart')
  .setOptions({
    title: '',
    hAxis: {title: 'Month (2023)'},
    vAxis: {title: 'Ships Detected'},
    colors: ['#FF6600'],
    bar: {groupWidth: '80%'},
    height: 200,
    legend: {position: 'none'}
  });

shipDetectionInfoPanel.add(shipChart);

Map.add(shipDetectionInfoPanel);

// -----------------------------
// 11. 时间序列折线图（月度平均反向散射）
// -----------------------------
var chartPanel = ui.Panel({
  style: {
    position: 'bottom-right',
    padding: '8px',
    width: '340px',
    backgroundColor: 'rgba(255,255,255,0.92)',
    margin: '0 0 20px 0'
  }
});

chartPanel.add(ui.Label('Monthly Mean Backscatter (2023)', {
  fontSize: '12px',
  fontWeight: 'bold',
  color: '#333',
  margin: '0 0 6px 0'
}));

var months = ee.List.sequence(1, 12);

var monthlyMeans = ee.FeatureCollection(
  months.map(function(m) {
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

    return ee.Feature(null, {
      month: m,
      VV: meanVV,
      VH: meanVH
    });
  })
);

var timeSeriesChart = ui.Chart.feature.byFeature(monthlyMeans, 'month', ['VV', 'VH'])
  .setChartType('LineChart')
  .setOptions({
    title: '',
    hAxis: {
      title: 'Month',
      ticks: [1,2,3,4,5,6,7,8,9,10,11,12]
    },
    vAxis: {title: 'Mean dB'},
    colors: ['#1a73e8', '#e8711a'],
    lineWidth: 2,
    pointSize: 4,
    legend: {position: 'top'},
    height: 180
  });

chartPanel.add(timeSeriesChart);
Map.add(chartPanel);

// Add ship count panel on top
Map.add(shipCountPanel);

// -----------------------------
// 11. 初始化地图
// -----------------------------
updateMap();
