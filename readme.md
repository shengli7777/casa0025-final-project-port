# Interactive Analysis of Maritime Activity in the Port of Singapore Using Sentinel-1

## Project Overview

This project explores maritime activity and spatial use in the Port of Singapore and surrounding waters using Sentinel-1 SAR imagery in Google Earth Engine. The project delivers an interactive application that allows users to explore maritime patterns in one of the busiest shipping hubs in the world.

**Live Application:** [singapore-port-maritime](https://quantum-balm-387314.projects.earthengine.app/view/singapore-port-maritime)

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

**Stage 5 — Interface and Analytical Outputs:** The detection output from Stage 4 is used as the basis for interactive visualisation and interpretation. This stage integrates the ship candidate layer into the application together with SAR composites, orbit and polarisation controls, and chart-based summaries of maritime activity patterns. In the current application, the ship candidate detection layer is displayed in VV mode only, because the detection workflow is based on filtered VV backscatter rather than VH imagery.

The output of Stage 4 is a **ship candidate detection mask**, which serves as the input for subsequent visualisation and interpretation in Stage 5.

---

## Application Features

The interactive GEE application supports:

- **Month selector** — view SAR composites for any month in 2023
- **Polarisation toggle** — switch between VV and VH bands
- **Orbit direction filter** — compare ascending vs descending passes
- **Ship candidate detection layer** — in VV mode, threshold-based ship candidates are displayed using connected-pixel and size filtering
- **Monthly backscatter chart** — time series of mean VV and VH across 2023
- **Map legend** — colour scale for SAR backscatter interpretation

---

## Repository Structure

```text
casa0025-final-project-port/
├── docs/                          # Rendered website (GitHub Pages)
│   └── images/
│       └── monthly_image_count.png
├── images/
│   ├── monthly_image_count.png
│   ├── app_screenshot.png
│   └── ship_detection_final.png
├── scripts/
│   ├── preprocessing_data.js      # Initial data filtering and compositing
│   ├── preprocessing_masking.js   # Speckle filter and masking
│   ├── ship_detection.js          # Ship candidate detection and parameter testing
│   └── app.js                     # Interactive GEE application script
├── index.qmd                      # Website source (Quarto)
├── _quarto.yml                    # Quarto configuration
└── readme.md
```

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
