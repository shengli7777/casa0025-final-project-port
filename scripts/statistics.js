// =============================================
// Statistics Module - Ship Detection Analysis
// =============================================

/**
 * @param {ee.Image} detectionMask - Binary detection mask
 * @param {number} maxSearchDistance - Search distance (pixels)
 * @returns {Object} Object containing connected components and ship count
 */
function countShips(detectionMask, maxSearchDistance) {
  var maxSearchDistance = maxSearchDistance || 100;
  
  // Calculate connected components
  var connectedComponents = detectionMask.connectedComponents(
    ee.Kernel.plus(maxSearchDistance, 'pixels')
  );
  
  // Get the count of connected regions (total ship count)
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

/**
 * Calculate statistics for ship detection
 * @param {ee.Image} detectionMask - Detection mask
 * @param {ee.Geometry} aoi - Area of interest
 * @returns {Object} Object containing ship count, coverage area and other statistical data
 */
function getShipStatistics(detectionMask, aoi) {
  // Count ships
  var shipCountResult = countShips(detectionMask);
  
  // Calculate the number of detected pixels
  var pixelCount = detectionMask.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e9
  });
  
  // Calculate coverage area (10m x 10m per pixel)
  var coveredArea = ee.Number(pixelCount.get('constant')).multiply(100); // square meters
  
  return {
    shipCount: shipCountResult.count,
    pixelCount: pixelCount,
    coveredArea: coveredArea
  };
}

/**
 * Visualize ship detection results
 * @param {ee.Image} detectionMask - Detection mask
 * @param {ee.Image} connectedComponents - Connected components labeled image
 * @param {ee.Geometry} aoi - Area of interest
 * @param {ee.Image} s1Filtered - Original SAR image (optional)
 */
function viz(detectionMask, connectedComponents, aoi, s1Filtered) {
  // Create AOI boundary
  var empty = ee.Image().byte();
  var outline = empty.paint({
    featureCollection: ee.FeatureCollection([ee.Feature(aoi)]),
    color: 1,
    width: 3,
  });
  var aoi_layer = ui.Map.Layer(outline, { palette: "red" }, "AOI Boundary", true);

  // Create detection mask layer (yellow)
  var detectionLayer = ui.Map.Layer(
    detectionMask,
    { palette: ["yellow"] },
    "Ship Detection Mask",
    true
  );

  // Create connected components layer (color-labeled for each ship)
  var componentPalette = [
    '000000', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
    'FF6600', '00FF99', '9900FF', 'FF0099', '99FF00', '00FF00'
  ];
  var componentLayer = ui.Map.Layer(
    connectedComponents.select('labels'),
    { palette: componentPalette, min: 0, max: 12 },
    "Individual Ships (Labeled)",
    false
  );

  // Create SAR background layer (if provided)
  var sarLayer;
  if (s1Filtered) {
    sarLayer = ui.Map.Layer(
      s1Filtered,
      { min: -22, max: -5 },
      "SAR Background (VV)",
      false
    );
    Map.layers().set(0, sarLayer);
    Map.layers().set(1, detectionLayer);
    Map.layers().set(2, componentLayer);
    Map.layers().set(3, aoi_layer);
  } else {
    Map.layers().set(0, detectionLayer);
    Map.layers().set(1, componentLayer);
    Map.layers().set(2, aoi_layer);
  }
  
  print("Visualization layers added successfully");
}

/**
 * Extract final ship count value from statistics
 * @param {Object} statistics - Statistics result object containing ship count
 * @returns {number} Final number of ships detected
 */
function extractShipCount(statistics) {
  if (statistics.shipCount) {
    // Get the 'labels' value from the result object
    var countValue = ee.Number(statistics.shipCount.get('labels'));
    return countValue;
  }
  return ee.Number(0);
}

/**
 * Display ship statistics to console
 * @param {Object} statistics - Statistics result object
 * @param {ee.Image} detectionMask - Detection mask
 */
function printShipStatistics(statistics, detectionMask) {
  var finalShipCount = extractShipCount(statistics);
  
  print("========== SHIP DETECTION STATISTICS ==========");
  print("Total Ships Detected:", finalShipCount);
  print("Pixel Count (Detection):", statistics.pixelCount);
  print("Covered Area (m²):", statistics.coveredArea);
  print("Detection Mask Geometry:", detectionMask.geometry());
  print("=============================================");
}

/**
 * Format and output final ship detection report
 * @param {number} shipCount - Number of ships detected
 * @param {Object} pixelStats - Pixel count statistics
 * @param {ee.Number} coveredArea - Covered area in square meters
 * @param {string} timestamp - Detection timestamp (optional)
 * @returns {Object} Formatted report object
 */
function generateDetectionReport(shipCount, pixelStats, coveredArea, timestamp) {
  var report = {
    timestamp: timestamp || 'Unknown',
    totalShipsDetected: shipCount,
    detectionPixels: pixelStats,
    coveredAreaSquareMeters: coveredArea,
    coveredAreaSquareKilometers: ee.Number(coveredArea).divide(1e6)
  };
  
  return report;
}