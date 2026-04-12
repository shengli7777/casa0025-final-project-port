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

The project follows a four-stage preprocessing pipeline implemented in Google Earth Engine:

**Stage 1 — Data Filtering:** Sentinel-1 GRD images were filtered by AOI, date range, instrument mode, and polarisation. A median composite was generated as the baseline output.

**Stage 2 — Speckle Filtering:** A 3×3 focal mean filter was applied to reduce speckle noise inherent in SAR imagery, improving visual interpretability and reducing false positives in vessel detection.

**Stage 3 — Water and Land Masking:** The JRC Global Surface Water dataset was used to mask land pixels (water occurrence > 50%). A 500-metre near-shore buffer was applied to remove coastal clutter using the USDOS LSIB coastline dataset.

**Stage 4 — Vessel Detection:** A threshold of VV > −10 dB was applied to the clean preprocessed layer to identify high-backscatter pixels as approximate vessel detections.

Three preprocessing configurations (Raw / Speckle filtered only / Full pipeline) were compared to evaluate the effect of each step.

---

## Application Features

The interactive GEE application supports:

- **Month selector** — view SAR composites for any month in 2023
- **Polarisation toggle** — switch between VV and VH bands
- **Orbit direction filter** — compare ascending vs descending passes
- **Vessel detection layer** — orange highlights for VV > −10 dB targets
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
│   └── app_screenshot.png
├── scripts/
│   ├── preprocessing_data.js      # Initial data filtering and compositing
│   ├── preprocessing_masking.js   # Speckle filter, water mask, vessel detection
│   └── app.js                     # Interactive GEE application script
├── index.qmd                      # Website source (Quarto)
├── _quarto.yml                    # Quarto configuration
└── readme.md
```

---

## Limitations

- Speckle noise reduction is approximate; more advanced filters (e.g. Lee filter) may improve results
- Vessel detection is threshold-based and not validated against AIS data
- Near-shore buffer may exclude legitimate vessel detections close to port infrastructure
- Orbit geometry differences between ascending and descending passes affect backscatter comparability

---

## Tools and Platforms

- [Google Earth Engine](https://earthengine.google.com/) — satellite data processing and application hosting
- [Quarto](https://quarto.org/) — website generation
- [GitHub Pages](https://pages.github.com/) — website deployment
- Sentinel-1 GRD — European Space Agency / Copernicus Programme
