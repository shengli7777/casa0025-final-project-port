# Interactive Analysis of Maritime Activity in the Port of Singapore Using Sentinel-1

## Project Overview

This project explores maritime activity and spatial use in the Port of Singapore and surrounding waters using Sentinel-1 SAR imagery in Google Earth Engine. The project delivers an interactive application that allows users to explore maritime patterns in one of the busiest shipping hubs in the world.

**Live Application:** [singapore-port-maritime](https://week6-gee-coursework.projects.earthengine.app/view/singapore-port-maritime)

**Project Website:** [shengli7777.github.io/casa0025-final-project-port](https://shengli7777.github.io/casa0025-final-project-port/)

---

## Problem Statement

The Port of Singapore is one of the world's most active maritime regions, with dense shipping traffic, anchorage areas, and port operations concentrated in a relatively small space. Understanding how maritime activity is distributed across this area is important for interpreting spatial patterns of sea use. This project develops an interactive application to explore these patterns using satellite radar data.

---

## End User

This application is intended for students, researchers, and users interested in maritime monitoring, remote sensing, and spatial analysis. It provides an accessible way to explore how satellite imagery can be used to examine activity patterns in port and coastal environments.

---

## Study Area

The study area covers the Port of Singapore and surrounding waters in southern Singapore. This area was selected because it is one of the busiest maritime hubs in the world, with dense ship traffic and clear spatial differences between port zones, anchorage areas, and shipping routes.

The AOI spans longitude 103.60°E to 104.05°E and latitude 1.15°N to 1.36°N, covering both the core port area and nearby waters where significant maritime activity takes place.

---

## Data

This project uses **Sentinel-1 GRD** imagery from **Google Earth Engine**.

| Parameter | Value |
|-----------|-------|
| Dataset | COPERNICUS/S1_GRD |
| Sensor type | Synthetic Aperture Radar (SAR) |
| Date range | 2023-01-01 to 2023-12-31 |
| Instrument mode | IW |
| Polarisation | VV and VH |
| Total images | 109 (61 ascending, 48 descending) |

### Why Sentinel-1?

SAR imagery is particularly suitable for maritime monitoring. Unlike optical imagery, it is unaffected by cloud cover and lighting conditions. The VV channel is sensitive to large metallic structures such as ship hulls, while VH captures volume scattering useful for distinguishing vessel types.

---

## Methodology

The project follows a five-stage processing pipeline implemented in Google Earth Engine:

**Stage 1 — Data Filtering:** Sentinel-1 GRD images were filtered by AOI, date range, instrument mode, and polarisation. A median composite was generated as the baseline output.

**Stage 2 — Speckle Filtering:** A 3×3 focal mean filter was applied to reduce speckle noise inherent in SAR imagery, improving visual interpretability and reducing false positives in vessel detection.

**Stage 3 — Water and Land Masking:** The JRC Global Surface Water dataset was used to mask land pixels (water occurrence > 50%). A 500-metre near-shore buffer was applied to remove coastal clutter using the USDOS LSIB coastline dataset.

**Stage 4 — Ship Candidate Detection:** Ship candidates were extracted from the clean VV backscatter layer using a threshold-based detection approach. Pixels above the selected VV threshold were first identified as bright targets. Connected-pixel filtering was then applied to remove isolated noise and overly large non-ship artefacts. Multiple parameter combinations were tested, including threshold values (-12, -10, -8), minimum connected pixels (1, 2, 3), and maximum connected pixels (10, 15, 25). A final parameter set of **threshold = -10**, **minPixels = 2**, and **maxPixels = 15** was selected as a balanced configuration.

**Stage 5 — Interface and Analytical Outputs:** The detection output from Stage 4 is used as the basis for interactive visualisation and interpretation. This stage integrates the ship candidate layer into the application together with SAR composites, orbit and polarisation controls, layer toggles, regional statistics, linked charts, and point-query outputs. In the current application, the ship candidate detection layer is displayed in VV mode only, because the detection workflow is based on filtered VV backscatter rather than VH imagery.

The output of Stage 4 is a **ship candidate detection mask**, which serves as the input for subsequent visualisation and interpretation in Stage 5.

---

## Application Features

The interactive GEE application supports:

- **Month slider and navigation buttons** — view SAR composites for any month in 2023
- **Polarisation toggle** — switch between VV and VH bands
- **Orbit direction filter** — compare ascending vs descending passes
- **Layer controls** — independently show or hide the SAR composite, ship candidates, density heatmap, and analysis zones
- **Regional analysis selector** — focus statistics on the full AOI or four interpretable port sub-regions
- **Ship candidate detection layer** — in VV mode, threshold-based ship candidates are displayed using connected-pixel and size filtering
- **Current summary panel** — image availability, mean VV/VH, candidate pixels, and density totals for the selected view
- **Point query** — click the map to return coordinates, zone, VV/VH backscatter, and nearby candidate pixels within 1 km
- **Linked monthly charts** — mean VV/VH time series and relative ship candidate bars; chart clicks update the map month
- **Annual heatmap** — on-demand full-year ship density layer for comparing monthly and annual patterns
- **Map legend** — colour scale for SAR backscatter interpretation
- **Method and limitations panel** — concise explanation of the detection rule and validation limits

---

## Stage 5 UI / Visualisation Contribution

The Stage 5 script is implemented in `scripts/app.js`. It turns the Stage 4 detection output into a complete Google Earth Engine app suitable for live demonstration and assessment. The key contribution is the user-facing interaction layer:

- Built a clean multi-panel Earth Engine interface with controls, legend, summary, point query, and linked charts
- Added month, polarisation, orbit, region, and layer controls
- Added regional summaries for west anchorage, central harbour, east anchorage, and southern approach zones
- Added click-based local inspection using a 1 km buffer around the selected point
- Added monthly density heatmaps, an on-demand annual heatmap, and chart-to-map linking
- Added method and limitations text inside the app so users can interpret the outputs responsibly

For the presentation, this section can be demonstrated by selecting a month, switching VV/VH and orbit direction, changing the analysis region, toggling the detection and heatmap layers, clicking a vessel-dense area, and using the monthly bar chart to jump to a different month.

---

## Repository Structure

```text
casa0025-final-project-port/
├── docs/                          # Rendered website output for GitHub Pages
├── images/                        # Figures used in README and project website
├── scripts/
│   ├── preprocessing_data.js       # Sentinel-1 filtering, orbit counts, and monthly image statistics
│   ├── preprocessing_masking.js    # Speckle filtering, water masking, and near-shore exclusion
│   ├── ship_detection.js           # VV threshold-based ship candidate detection and parameter testing
│   ├── heatmap_mothlyship.js       # Development script for monthly ship-density heatmap logic
│   └── app.js                      # Final interactive Google Earth Engine application script
├── index.qmd                       # Quarto website source file
├── _quarto.yml                     # Quarto website configuration
├── styles.css                      # Website styling
└── readme.md                       # Project README
```

---

```md
## How to Run the Application

The final interactive application is hosted as a Google Earth Engine App:

- Live application: [singapore-port-maritime](https://week6-gee-coursework.projects.earthengine.app/view/singapore-port-maritime)

To run the application code manually in Google Earth Engine:

1. Open the Google Earth Engine Code Editor.
2. Create a new script.
3. Copy the contents of `scripts/app.js`.
4. Paste the script into the Code Editor.
5. Click **Run** to launch the interactive map interface.

The supporting scripts in `scripts/` document the development workflow:
- `preprocessing_data.js` demonstrates Sentinel-1 filtering and image-count statistics.
- `preprocessing_masking.js` demonstrates speckle filtering, water masking, and near-shore exclusion.
- `ship_detection.js` demonstrates threshold-based ship candidate detection and parameter testing.
- `heatmap_mothlyship.js` documents the monthly ship-density heatmap development logic.
```

---

## Website Deployment

The project website is built with Quarto and deployed using GitHub Pages.

- `index.qmd` is the source file for the website.
- `docs/` contains the rendered website output.
- GitHub Pages is configured to serve the website from the `docs/` folder on the `main` branch.

To update the website:

1. Edit `index.qmd`.
2. Render the Quarto website.
3. Commit both the updated `index.qmd` and the updated `docs/` output.
4. Push the changes to GitHub.

The project website is available at:
[https://shengli7777.github.io/casa0025-final-project-port/](https://shengli7777.github.io/casa0025-final-project-port/)

---

## Code Walkthrough Guide

The codebase is organised to reflect the analytical workflow from Sentinel-1 imagery to the final interactive application.

1. `preprocessing_data.js`  
   Defines the study area, filters Sentinel-1 GRD imagery by AOI, date, IW mode, and VV/VH polarisation, and summarises image availability by orbit direction and month.

2. `preprocessing_masking.js`  
   Applies SAR speckle filtering, water masking, and near-shore exclusion to reduce false detections from land and coastal infrastructure.

3. `ship_detection.js`  
   Implements the VV-based ship candidate detection method using a threshold-based rule and connected-pixel filtering.

4. `heatmap_mothlyship.js`  
   Documents the development of monthly ship-density heatmap logic. This script is retained as a supporting development script rather than the primary application entry point.

5. `app.js`  
   Provides the final user-facing Google Earth Engine application, including map layers, month selection, polarisation switching, orbit filtering, layer controls, summary charts, and interactive visualisation.

---

## Limitations

- Speckle noise reduction is approximate; more advanced filters (e.g. Lee filter) may improve results
- Ship detection in this project remains approximate and has not been validated against AIS or manually labelled vessel data
- Near-shore buffer may exclude legitimate vessel detections close to port infrastructure
- Some near-shore false positives may still remain in complex coastal environments
- Fixed threshold settings may miss weaker or smaller vessel targets
- Orbit geometry differences between ascending and descending passes affect backscatter comparability

---

## Tools and Platforms

- [Google Earth Engine](https://earthengine.google.com/) — satellite data processing and application hosting
- [Quarto](https://quarto.org/) — website generation
- [GitHub Pages](https://pages.github.com/) — website deployment
- Sentinel-1 GRD — European Space Agency / Copernicus Programme
- [CASA25 Rasternauts](https://maheer-maps.github.io/CASA25_Rasternauts/) — reviewed as a previous high-quality CASA0025 example for UI structure and live-demo clarity
