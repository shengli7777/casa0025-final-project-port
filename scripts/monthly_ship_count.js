// =============================================
// monthly_ship_count.js
// Calculate monthly ship counts for 2023
// =============================================

var aoi = ee.Geometry.Polygon(
  [[[103.60, 1.15],
    [104.05, 1.15],
    [104.05, 1.36],
    [103.60, 1.36],
    [103.60, 1.15]]]
);

var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(aoi)
  .filterDate('2023-01-01', '2023-12-31')
  .filter(ee.Filter.eq('instrumentMode', 'IW'));

function preprocess(image) {
  var vv = image.select('VV')
    .focal_mean({radius: 1, kernelType: 'square', units: 'pixels'})
    .rename('VV_filtered');

  var vh = image.select('VH')
    .focal_mean({radius: 1, kernelType: 'square', units: 'pixels'})
    .rename('VH_filtered');

  var waterMask = ee.Image('JRC/GSW1_4/GlobalSurfaceWater')
    .select('occurrence').gt(50);

  var land = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017')
    .filterBounds(aoi);
  var landImage = ee.Image(0).byte().paint(land, 1);
  var coastalBuffer = landImage.focal_max({radius: 500, kernelType: 'circle', units: 'meters'});
  var openWaterMask = coastalBuffer.eq(0);

  return image.addBands([vv, vh])
    .select(['VV_filtered', 'VH_filtered'])
    .updateMask(waterMask)
    .updateMask(openWaterMask)
    .copyProperties(image, ['system:time_start']);
}

function detectShips(image) {
  var vv = image.select('VV_filtered');
  var brightTargets = vv.gt(-10);
  var connected = brightTargets.connectedPixelCount(100, true);
  var filtered = brightTargets
    .updateMask(connected.gte(2))
    .updateMask(connected.lte(15));
  return filtered.selfMask();
}

function countShipsInImage(image) {
  var shipMask = detectShips(image);
  var count = shipMask.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e9
  }).get('constant');
  return ee.Number(count);
}

var months = ee.List.sequence(1, 12);
var monthlyCounts = months.map(function(m) {
  var start = ee.Date.fromYMD(2023, m, 1);
  var end = start.advance(1, 'month');
  var monthlyImages = s1.filterDate(start, end);
  var preprocessed = monthlyImages.map(preprocess);
  var composite = preprocessed.median();
  var count = countShipsInImage(composite);
  return ee.Feature(null, {month: m, shipCount: count});
});

var results = ee.FeatureCollection(monthlyCounts);
print('Monthly Ship Counts:', results);

// Export to console for manual extraction
results.aggregate_array('shipCount').evaluate(function(counts) {
  print('Ship counts array:', counts);
});

// -----------------------------
// 可视化月船只数量表格
// -----------------------------
var chart = ui.Chart.feature.byFeature(results, 'month', 'shipCount')
  .setChartType('ColumnChart')
  .setOptions({
    title: 'Monthly Ship Counts (2023)',
    hAxis: {title: 'Month', ticks: [1,2,3,4,5,6,7,8,9,10,11,12]},
    vAxis: {title: 'Ship Count'},
    colors: ['#1a73e8'],
    height: 300
  });

print(chart);