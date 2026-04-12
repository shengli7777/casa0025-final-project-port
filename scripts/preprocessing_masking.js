// =============================================
// preprocessing_masking.js
// Project: Interactive Analysis of Maritime Activity
// in the Port of Singapore Using Sentinel-1
// Role: Preprocessing - Denoising, Masking, Compositing
// =============================================

// -----------------------------
// 1. Define Study Area (AOI)
// -----------------------------
var aoi = ee.Geometry.Polygon(
  [[[103.60, 1.15],
    [104.05, 1.15],
    [104.05, 1.36],
    [103.60, 1.36],
    [103.60, 1.15]]]
);

Map.centerObject(aoi, 11);
Map.setOptions('HYBRID');

// -----------------------------
// 2. Load Sentinel-1 GRD Data
// -----------------------------
var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(aoi)
  .filterDate('2023-01-01', '2023-12-31')
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'));

print('Total images loaded:', s1.size());

// =============================================
// STEP 1: SPECKLE FILTERING (Denoising)
// SAR imagery is affected by speckle noise.
// A focal mean filter is applied to smooth
// the image while preserving key features.
// =============================================

// Apply speckle filter using a 3x3 focal mean kernel
function applySpeckleFilter(image) {
  var vv = image.select('VV')
    .focal_mean({radius: 1, kernelType: 'square', units: 'pixels'})
    .rename('VV_filtered');
  var vh = image.select('VH')
    .focal_mean({radius: 1, kernelType: 'square', units: 'pixels'})
    .rename('VH_filtered');
  return image.addBands([vv, vh]);
}

var s1Filtered = s1.map(applySpeckleFilter);

// Compare raw vs filtered median composite
var rawComposite = s1.median().clip(aoi);
var filteredComposite = s1Filtered.median().clip(aoi);

// Visualisation parameters
var vvVis = {bands: ['VV'], min: -25, max: 0, palette: ['000000', '0000FF', '00FFFF', 'FFFFFF']};
var vvFilteredVis = {bands: ['VV_filtered'], min: -25, max: 0, palette: ['000000', '0000FF', '00FFFF', 'FFFFFF']};

Map.addLayer(rawComposite, vvVis, '1a. Raw VV Composite (no filter)', false);
Map.addLayer(filteredComposite, vvFilteredVis, '1b. Filtered VV Composite (3x3 focal mean)', false);

print('Step 1 complete: Speckle filter applied (3x3 focal mean)');

// =============================================
// STEP 2: WATER / LAND MASKING
// We isolate the water surface to focus
// vessel detection on open water only.
// Land pixels are masked out using a
// threshold on VV backscatter:
// land typically returns higher backscatter
// than calm water.
// =============================================

// Method: threshold on VV band
// Water typically has VV < -15 dB (smooth surface, low return)
// Land has higher backscatter due to structures/vegetation

function applyWaterMask(image) {
  // Use SRTM water occurrence as water mask
  var waterOccurrence = ee.Image('JRC/GSW1_4/GlobalSurfaceWater')
    .select('occurrence');
  // Pixels with >50% water occurrence = water
  var waterMask = waterOccurrence.gt(50);
  return image.updateMask(waterMask);
}

var maskedComposite = filteredComposite.select(['VV_filtered', 'VH_filtered']);
var waterMaskedComposite = applyWaterMask(maskedComposite);

Map.addLayer(waterMaskedComposite, vvFilteredVis, '2. Water-masked VV (land removed)', false);

print('Step 2 complete: Land pixels masked using JRC Global Surface Water');

// =============================================
// STEP 3: NEAR-SHORE COMPLEX AREA HANDLING
// Near-shore areas have mixed land-water signals
// that can cause false vessel detections.
// We apply an additional buffer to remove
// pixels within 500m of the coastline.
// =============================================

// Load land boundary (LSIB simplified)
var land = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017')
  .filterBounds(aoi);

// Create land mask image
var landImage = ee.Image(0).byte().paint(land, 1);

// Buffer: erode land by 500m (removes near-shore pixels)
var landBuffered = landImage.focal_max({
  radius: 500,
  kernelType: 'circle',
  units: 'meters'
});

// Invert to get open-water mask (excluding near-shore)
var openWaterMask = landBuffered.eq(0);

// Apply to water-masked composite
var cleanComposite = waterMaskedComposite.updateMask(openWaterMask);

Map.addLayer(cleanComposite, vvFilteredVis, '3. Near-shore removed (500m buffer)', false);

print('Step 3 complete: Near-shore pixels removed (500m coastal buffer)');

// =============================================
// STEP 4: PARAMETER COMPARISON
// Compare three preprocessing configurations:
// A: Raw median composite (no processing)
// B: Speckle filtered only
// C: Speckle filtered + water mask + near-shore removal
// =============================================

// Config A: Raw
var configA = rawComposite.select('VV').clip(aoi);

// Config B: Speckle filtered only
var configB = filteredComposite.select('VV_filtered').clip(aoi);

// Config C: Full pipeline
var configC = cleanComposite.select('VV_filtered').clip(aoi);

// Add all three to map for visual comparison
Map.addLayer(configA, {min: -25, max: 0, palette: ['000000','0000FF','00FFFF','FFFFFF']},
  '4a. Config A: Raw (no processing)', false);
Map.addLayer(configB, {min: -25, max: 0, palette: ['000000','0000FF','00FFFF','FFFFFF']},
  '4b. Config B: Speckle filtered only', false);
Map.addLayer(configC, {min: -25, max: 0, palette: ['000000','0000FF','00FFFF','FFFFFF']},
  '4c. Config C: Full pipeline (recommended)', true);

// Print mean backscatter statistics for each config
var statOptions = {geometry: aoi, scale: 100, maxPixels: 1e9};

var meanA = configA.reduceRegion({reducer: ee.Reducer.mean(), geometry: aoi, scale: 100, maxPixels: 1e9});
var meanB = configB.reduceRegion({reducer: ee.Reducer.mean(), geometry: aoi, scale: 100, maxPixels: 1e9});
var meanC = configC.reduceRegion({reducer: ee.Reducer.mean(), geometry: aoi, scale: 100, maxPixels: 1e9});

print('--- Parameter Comparison: Mean VV Backscatter (dB) ---');
print('Config A (Raw):', meanA);
print('Config B (Speckle filtered):', meanB);
print('Config C (Full pipeline):', meanC);

// =============================================
// STEP 5: OUTPUT CLEAN DETECTION LAYER
// The final output is a clean, masked image
// ready for vessel detection:
// - Speckle noise reduced
// - Land pixels removed
// - Near-shore clutter removed
// Vessel detection: VV > -10 dB threshold
// =============================================

// Final clean layer
var finalCleanLayer = cleanComposite.select('VV_filtered').rename('VV_clean');

// Apply vessel detection threshold
var vesselDetection = finalCleanLayer.gt(-10).selfMask();

Map.addLayer(finalCleanLayer,
  {min: -25, max: 0, palette: ['000000','0000FF','00FFFF','FFFFFF']},
  '5a. Final Clean VV Layer (detection input)', true);

Map.addLayer(vesselDetection,
  {palette: ['FF6600'], opacity: 0.8},
  '5b. Vessel Detection Output (VV > -10 dB)', true);

// Add study area boundary
var aoiBorder = ee.Image().byte().paint({
  featureCollection: ee.FeatureCollection([ee.Feature(aoi)]),
  color: 1,
  width: 2
});
Map.addLayer(aoiBorder, {palette: ['FF0000']}, 'Study Area Boundary', true);

print('Step 5 complete: Final clean detection layer ready');
print('Vessel detection threshold: VV > -10 dB');

// =============================================
// SUMMARY
// =============================================
print('--- Preprocessing Pipeline Summary ---');
print('Input: Sentinel-1 GRD, 2023, IW mode, VV+VH');
print('Step 1: Speckle filter - 3x3 focal mean kernel');
print('Step 2: Water mask - JRC Global Surface Water (>50% occurrence)');
print('Step 3: Near-shore buffer - 500m coastal exclusion zone');
print('Step 4: Parameter comparison - Config A / B / C evaluated');
print('Step 5: Output - Clean VV layer + vessel detection (VV > -10 dB)');
print('Recommended config: C (full pipeline)');
