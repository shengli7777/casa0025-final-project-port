# Interactive Analysis of Maritime Activity in the Port of Singapore Using Sentinel-1

## Project Overview

This project explores maritime activity and spatial use in the Port of Singapore and surrounding waters using Sentinel-1 SAR imagery in Google Earth Engine. The project aims to support interactive exploration of maritime patterns in one of the busiest shipping hubs in the world.

## Problem Statement

The Port of Singapore is one of the world’s most active maritime regions, with dense shipping traffic, anchorage areas, and port operations concentrated in a relatively small space. Understanding how maritime activity is distributed across this area is important for interpreting spatial patterns of sea use. This project develops an interactive application to explore these patterns using satellite radar data.

## End User

This application is intended for students, researchers, and users interested in maritime monitoring, remote sensing, and spatial analysis. It provides an accessible way to explore how satellite imagery can be used to examine activity patterns in port and coastal environments.

## Study Area

The study area covers the Port of Singapore and surrounding waters in southern Singapore. This area was selected because it is one of the busiest maritime hubs in the world, with dense ship traffic and clear spatial differences between port zones, anchorage areas, and shipping routes.

The AOI includes both the core port area and nearby waters where significant maritime activity takes place. A rectangular AOI was used in the preprocessing stage to ensure consistency and efficiency in image filtering, clipping, and spatial analysis in Google Earth Engine.

## Data

This project uses **Sentinel-1 GRD** imagery from **Google Earth Engine** to analyse maritime activity in the study area.

### Dataset
- **Dataset name:** COPERNICUS/S1_GRD
- **Platform:** Google Earth Engine
- **Sensor type:** Synthetic Aperture Radar (SAR)
- **Observation capability:** all-weather, day-and-night

### Filtering Criteria
The initial preprocessing stage applied the following filters:
- **Date range:** 2023-01-01 to 2023-12-31
- **Instrument mode:** IW
- **Polarisation:** VV and VH
- **Spatial filter:** AOI covering the Port of Singapore and surrounding waters

### Initial Results
A total of **109 Sentinel-1 images** were identified for the study area:
- **Ascending images:** 61
- **Descending images:** 48

Monthly image counts were also calculated for 2023. The results show relatively stable image availability across the year, suggesting that the dataset has sufficient temporal continuity to support further monthly or seasonal analysis.

### Why Sentinel-1?
Sentinel-1 was selected because SAR imagery is particularly suitable for maritime monitoring. Unlike optical imagery, it is less affected by cloud cover and lighting conditions, making it well suited to busy coastal and port environments.

### Limitations
Although Sentinel-1 is useful for maritime analysis, it also has some limitations:
- radar imagery is affected by speckle noise
- interpretation is less intuitive than optical imagery
- orbit direction and viewing geometry may affect comparability

## Methodology

The preprocessing workflow begins by defining the study area (AOI) for the Port of Singapore and surrounding waters in Google Earth Engine. Sentinel-1 GRD imagery was filtered by location, date range, instrument mode (IW), and polarisation (VV and VH). A median composite image was generated as an initial preprocessing output for data inspection and further analysis.

To evaluate temporal data availability, monthly image counts were also calculated for 2023. The results show relatively stable Sentinel-1 coverage throughout the year, indicating that the dataset is suitable for subsequent monthly or seasonal analysis.

The preprocessing script is included in the repository for reproducibility.

## Repository Structure

```text
casa0025-final-project-port/
├── docs/
├── images/
│   └── monthly_image_count.png
├── scripts/
│   └── preprocessing_data.js
├── index.qmd
├── _quarto.yml
└── readme.md
