// ============================================
// CASA0025 - Ship Detection Module
// Port of Singapore, Sentinel-1 GRD, 2023
// Author: [LI JINGYU]
// ============================================

// ------------------------------
// 1. Study area
// ------------------------------
var aoi = ee.Geometry.BBox(103.60, 1.15, 104.05, 1.36);

Map.setCenter(103.89, 1.255, 11);
Map.setOptions('SATELLITE');

// ------------------------------
// 2. Load Sentinel-1 GRD
// ------------------------------
var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(aoi)
  .filterDate('2023-01-01', '2023-12-31')
  .filter(ee.Filter.eq('instrumentMode', 'IW'));

print('Total Sentinel-1 images:', s1.size());

// ------------------------------
// 3. Preprocessing
// ------------------------------
function preprocess(image) {
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

var cleanCollection = s1.map(preprocess);
print('Preprocessed collection:', cleanCollection);

// ------------------------------
// 4. Select a test image
// ------------------------------
var testImage = ee.Image(cleanCollection.first());

print('Test image time_start:', testImage.get('system:time_start'));
print('Orbit:', testImage.get('orbitProperties_pass'));

// ------------------------------
// 5. Ship detection function
// ------------------------------
function detectShips(image, threshold, minPixels, maxPixels) {
  var vv = image.select('VV_filtered');

  // Step 1: thresholding
  var brightTargets = vv.gt(threshold);

  // Step 2: connected pixel filtering
  var connected = brightTargets.connectedPixelCount(100, true);

  // Step 3: size filtering
  var filtered = brightTargets
    .updateMask(connected.gte(minPixels))
    .updateMask(connected.lte(maxPixels));

  return filtered.selfMask();
}

// ------------------------------
// 6. Final parameters
// ------------------------------
var threshold = -10;
var minPixels = 2;
var maxPixels = 15;

// ------------------------------
// 7. Run detection
// ------------------------------
var resultMask = detectShips(testImage, threshold, minPixels, maxPixels);

// ------------------------------
// 8. Visualisation
// ------------------------------
Map.addLayer(
  testImage.select('VV_filtered'),
  {min: -22, max: -5},
  'Clean VV'
);

Map.addLayer(
  resultMask,
  {palette: ['yellow']},
  'Detection Mask'
);

print('Detection mask created successfully');

// ------------------------------
// 9. Notes
// ------------------------------
// Final parameter choice:
// threshold = -10
// minPixels = 2
// maxPixels = 15
//
// These values were selected after testing multiple combinations
// and comparing offshore target preservation and near-shore noise reduction.
