// =============================================
// preprocessing_data.js
// Project: Interactive Analysis of Maritime Activity
// in the Port of Singapore Using Sentinel-1
// Author: [SHENG LI]
// =============================================

// -----------------------------
// 1. Define study area (AOI)
// -----------------------------
var aoi = ee.Geometry.Polygon(
  [[[103.60, 1.15],
    [104.05, 1.15],
    [104.05, 1.36],
    [103.60, 1.36],
    [103.60, 1.15]]]
);

// -----------------------------
// 2. Define study period
// -----------------------------
var startDate = '2023-01-01';
var endDate = '2023-12-31';

// -----------------------------
// 3. Load Sentinel-1 GRD data
// Filters:
// - study area
// - date range
// - IW mode
// - VV and VH polarisation
// -----------------------------
var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(aoi)
  .filterDate(startDate, endDate)
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'));

// -----------------------------
// 4. Check image availability
// -----------------------------
print('Sentinel-1 collection:', s1);
print('Total image count:', s1.size());

// Separate ascending and descending passes
var s1Ascending = s1.filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING'));
var s1Descending = s1.filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'));

print('Ascending image count:', s1Ascending.size());
print('Descending image count:', s1Descending.size());

// -----------------------------
// 5. Create composite image
// Median composite is used here
// as an initial preprocessing step
// -----------------------------
var s1Composite = s1.median().clip(aoi);

// -----------------------------
// 6. Visualisation settings
// -----------------------------
var vvVis = {
  bands: ['VV'],
  min: -25,
  max: 5
};

var vhVis = {
  bands: ['VH'],
  min: -30,
  max: 0
};

// -----------------------------
// 7. Display on map
// -----------------------------
Map.centerObject(aoi, 11);
Map.addLayer(aoi, {color: 'red'}, 'Study Area');
Map.addLayer(s1Composite, vvVis, 'Sentinel-1 VV Composite');
Map.addLayer(s1Composite, vhVis, 'Sentinel-1 VH Composite');

// -----------------------------
// 8. Print summary
// -----------------------------
print('Study area ready.');
print('Study period:', startDate, 'to', endDate);
print('Polarisation used: VV and VH');
print('Instrument mode: IW');

// -----------------------------
// 9. Monthly image count
// -----------------------------
var months = ee.List.sequence(1, 12);

var monthlyCounts = ee.FeatureCollection(
  months.map(function(m) {
    var start = ee.Date.fromYMD(2023, m, 1);
    var end = start.advance(1, 'month');
    var count = s1.filterDate(start, end).size();
    return ee.Feature(null, {
      month: m,
      image_count: count
    });
  })
);

print('Monthly Sentinel-1 image counts:', monthlyCounts);

var monthlyChart = ui.Chart.feature.byFeature(monthlyCounts, 'month', 'image_count')
  .setChartType('ColumnChart')
  .setOptions({
    title: 'Monthly Sentinel-1 Image Count in 2023',
    hAxis: {title: 'Month'},
    vAxis: {title: 'Image Count'},
    legend: {position: 'none'}
  });

print(monthlyChart);