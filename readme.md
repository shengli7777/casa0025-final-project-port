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

The output of Stage 4 is a **ship candidate detection mask**, which serves as the input for subsequent visualisation and interpretation.

---

## Advanced Analysis

The ship candidate detection result from Stage 4 is used as the basis for interactive visualisation and interpretation. Rather than treating ship candidates as validated vessel counts, the project uses them as relative indicators of maritime activity. These outputs support spatial comparison across port waters and temporal comparison across the 2023 study period.

### Spatial Density Heatmap

The VV-based ship candidate mask is transformed into a smoothed density heatmap to highlight areas where candidate detections occur more frequently. This helps users identify broader maritime activity zones such as anchorage areas, shipping approaches, and busy port waters, rather than focusing only on individual detected pixels.

The density heatmap is displayed in VV mode only, because it is derived from the same filtered VV backscatter workflow as the ship candidate detection layer.

### Temporal Exploration and Analytical Outputs

The application also summarises ship candidate detections and SAR backscatter values across the 2023 study period. Monthly charts show changes in ship candidate pixels and mean VV/VH backscatter, allowing users to compare relative temporal patterns across the year.

These analytical outputs are integrated into the interactive dashboard alongside SAR composites, orbit and polarisation controls, layer toggles, regional statistics, map legends, and monthly trend charts. The ship candidate and density heatmap layers should be interpreted as exploratory indicators of relative maritime activity, not as validated vessel counts.

---
## Application Features

The interactive GEE application supports:

- **Overview screen and time selector** — users first review the 2023 reference overview, then select the full-year summary or a specific month before entering the map explorer
- **Map Explorer navigation** — the **Next** button opens the main map explorer from the overview screen
- **Region controls** — users can select the full study area or one of four analysis zones: West anchorage, Central harbour, East anchorage, and Southern approach
- **Zoom to selected region** — users can zoom the map directly to the chosen analysis region
- **Polarisation controls** — users can switch between VV and VH backscatter for visual comparison; ship candidates and the density heatmap are only available in VV mode
- **Orbit direction filter** — users can compare both passes, ascending-only imagery, or descending-only imagery
- **Map layer toggles** — users can turn the SAR composite, ship candidate layer, density heatmap, analysis zones, and study area boundary on or off
- **Ship candidate detection layer** — in VV mode, threshold-based ship candidates are displayed using connected-pixel and size filtering
- **Density heatmap** — a smoothed density layer highlights relative concentrations of candidate detections across the port
- **Selected view statistics** — a summary panel reports the active month, region, band, orbit direction, image count, mean VV, mean VH, candidate pixels, and density sum
- **Monthly trend charts** — fixed reference charts show the 2023 candidate-pixel series and mean SAR backscatter series for the full study area and both passes
- **Map legend** — a compact legend explains the SAR backscatter colour ramp, ship candidate layer, and ship density frequency scale

---

## Interactive Application Contribution

The final application script is implemented in `scripts/app.js`. It integrates the analytical outputs into a complete Google Earth Engine dashboard suitable for live demonstration and assessment. The key contribution is the user-facing interaction layer:

- Built a multi-panel Earth Engine interface with an overview screen, map explorer, controls, legend, summary statistics, and linked monthly charts
- Added month, polarisation, orbit, region, and map-layer controls
- Added regional summaries for the full study area, west anchorage, central harbour, east anchorage, and southern approach zones
- Added a zoom-to-region function for the selected analysis zone
- Added VV-only visibility rules for the ship candidate and density heatmap layers, because the detection workflow is based on VV backscatter
- Added monthly density heatmaps and fixed 2023 reference charts for ship candidate pixels and mean SAR backscatter
- Added website documentation so users can interpret the outputs as relative activity indicators rather than validated vessel counts

For the presentation, this section can be demonstrated by selecting a month, switching VV/VH and orbit direction, changing the analysis region, toggling the SAR, ship candidate, density heatmap, and analysis zone layers, and using the monthly charts to explain temporal variation.

---

## Repository Structure

```text
casa0025-final-project-port/
├── docs/                          # Rendered website output for GitHub Pages
├── images/                        # Figures, charts, and screenshots used in the website and README
├── _includes/
│   ├── gee-app.html               # Embedded live GEE app iframe
│   └── toc-active.html            # Loads the active / collapsible contents script
├── scripts/
│   ├── preprocessing_data.js       # Sentinel-1 filtering, orbit counts, and monthly image statistics
│   ├── preprocessing_masking.js    # Speckle filtering, water masking, and near-shore exclusion
│   ├── ship_detection.js           # VV threshold-based ship candidate detection and parameter testing
│   ├── heatmap_mothlyship.js       # Development script for monthly ship-density heatmap logic
│   └── app.js                      # Final interactive Google Earth Engine application script
├── index.qmd                       # Quarto website source file
├── _quarto.yml                     # Quarto website configuration
├── references.bib                  # Bibliography records
├── styles.css                      # Website styling
├── toc-active.js                   # Active / collapsible contents sidebar logic
└── readme.md                       # Project README

```
---


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
   Provides the final user-facing Google Earth Engine application, including the overview screen, map explorer, month selection, region selection, zoom-to-region function, polarisation switching, orbit filtering, layer controls, summary statistics, map legend, monthly charts, and VV-only detection-layer visibility rules.

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

