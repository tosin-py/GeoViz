GeoViz: Geophysical Profile Analyzer

Version 1.0 (2025)
Author: Oseni Ridwan â€” oddbrushstudio@gmail.com

Short Description

GeoViz is a fast, client-side geophysical visualization toolkit. It
allows you to easily plot VLF and Resistivity survey profiles,
automatically compute Apparent Resistivity
(Ïâ‚ = K Ã— R)
and apply the Karousâ€“Hjelt filter for quick interpretation. It supports
multiple arrays including Wenner, Schlumberger, and Dipole-Dipole.

Key Features

-   Dual Survey Modes â€” switch seamlessly between Resistivity and VLF
    plotting.
-   Automatic Apparent Resistivity Calculation â€” computes missing Ïâ‚
    values and visually highlights calculated points.
-   Geophysical Array Flexibility â€” supports Wenner, Schlumberger, and
    Dipole-Dipole geometric factor (K) calculations.
-   Karousâ€“Hjelt Filtering â€” numerical derivative filter for VLF
    in-phase data to identify steeply dipping conductive bodies.
-   Interactive Visualization â€” customize curve colors and download
    plots as PNG or JPEG.
-   Robust Data Handling â€” paste CSV/TXT data with tabs, commas, or
    spaces as delimiters.

Getting Started

GeoViz runs entirely in HTML/CSS/JavaScript â€” no installation or backend
required.

1. Run the Application

Clone the repository and open the HTML file:

    git clone https://github.com/oddbrushstudio/geoviz.git
    cd geoviz
    open index.html

Data Formats

You can paste data directly into the input box. Delimiters can be tabs,
commas, or spaces.

A. Resistivity Survey Format

GeoViz expects 7 columns:

-   P1, P2, P3, P4 (Electrode positions)
-   K (Geometric Factor)
-   R (Measured Resistance)
-   Apparent_Rho (optional â€” auto-calculated if missing)

Example (Wenner): 0 10 20 30 62.83 8.1 508.92

B. VLF Survey Format

Three columns required:

-   Station (m)
-   InPhase (%)
-   Quadrature (%)

Example: 0 45.2 -12.5

Project Structure

â†’ index.html # Application UI (Structure)
â†’ styles.css # Styling (Presentation)
â†’ script.js # Core logic and calculations (Behavior)
â†’ LICENSE # MIT License
â†’ .gitignore # Git ignore rules
