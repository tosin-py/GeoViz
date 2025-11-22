/*
 * Geophysical Data Plotter Logic
 * Author: Oseni Ridwan, Email: oddbrushstudio@gmail.com
 * Description: Handles data parsing, apparent resistivity calculation, 
 * Karous-Hjelt filtering, and plotting using Chart.js.
 */

// Global variables
let chart = null;
let currentDataType = 'vlf';
let chartAnnotationPluginLoaded = false; // Flag to track plugin load status

// --- Color Themes (New Feature) ---
// Define aesthetically pleasing color pairs (start color / end color) for gradients
const VLF_THEMES = {
    "ocean": { name: "Ocean (Blue/Orange)", p1: '#00b4d8', p2: '#fca311', text: 'Blue / Orange' },
    "earth": { name: "Earth (Yellow/Green)", p1: '#90be6d', p2: '#f9c74f', text: 'Green / Yellow' },
    "classic": { name: "Classic (Blue/Red)", p1: '#1e90ff', p2: '#dc143c', text: 'Blue / Red' },
};

// Define color palettes for multi-line resistivity plots (3 main colors)
// Each array represents a palette for plotting multiple 'a' spacings.
const RESISTIVITY_PALETTES = {
    "primary": { name: "Primary (Green/Blue/Orange)", colors: ['#00b67a', '#0ea5e9', '#f97316', '#8b5cf6', '#ec4899', '#ef4444'] },
    "cool": { name: "Cool Tones (Blue/Purple)", colors: ['#0077b6', '#48cae4', '#90e0ef', '#00b4d8', '#34a0a4', '#1f7a8c'] },
    "warm": { name: "Warm Tones (Red/Yellow)", colors: ['#e76f51', '#f4a261', '#e9c46a', '#a71d31', '#d83155', '#ffb703'] },
};


// --- Global Setup ---

// Plugin to ensure charts have a solid background for downloading
const customCanvasBackgroundColor = {
    id: 'customCanvasBackgroundColor',
    beforeDraw: (chartInstance, args, options) => {
        const {ctx} = chartInstance;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = document.body.classList.contains('dark-mode') ? '#1e1e1e' : '#ffffff'; 
        ctx.fillRect(0, 0, chartInstance.width, chartInstance.height);
        ctx.restore();
    }
};
Chart.register(customCanvasBackgroundColor);

// SAFELY register the chart annotation plugin if it loaded via CDN
try {
    if (typeof chartjs !== 'undefined' && chartjs.plugin && chartjs.plugin.annotation) {
        Chart.register(chartjs.plugin.annotation); 
        chartAnnotationPluginLoaded = true;
    } 
} catch (e) {
    // If registration fails, the flag remains false, and we avoid using annotation features.
    console.error("Error during annotation plugin registration:", e);
}


// --- UI & State Control ---

document.getElementById('fileInput').addEventListener('change', handleFileUpload);
document.getElementById('themeToggle').addEventListener('click', toggleDarkMode);


function populateThemeDropdowns() {
    const vlfSelect = document.getElementById('vlfColorTheme');
    const resSelect = document.getElementById('resistivityColorTheme');

    // Populate VLF Themes
    vlfSelect.innerHTML = Object.keys(VLF_THEMES).map(key => 
        `<option value="${key}">${VLF_THEMES[key].name}</option>`
    ).join('');

    // Populate Resistivity Palettes
    resSelect.innerHTML = Object.keys(RESISTIVITY_PALETTES).map(key => 
        `<option value="${key}">${RESISTIVITY_PALETTES[key].name}</option>`
    ).join('');
}


function setDataType(type) {
    currentDataType = type;
    document.getElementById('btnResistivity').classList.toggle('active', type === 'resistivity');
    document.getElementById('btnVLF').classList.toggle('active', type === 'vlf');
    
    // Toggle array selector and VLF filter options visibility
    document.getElementById('resistivityOptions').style.display = type === 'resistivity' ? 'block' : 'none';
    document.getElementById('vlfOptions').style.display = type === 'vlf' ? 'block' : 'none';

    const infoBox = document.getElementById('infoBox');
    const dataInput = document.getElementById('dataInput');
    
    if (type === 'vlf') {
        infoBox.innerHTML = '<p>Paste CSV data (3 columns): <code>Station (m), InPhase (%), Quadrature (%)</code></p>';
        dataInput.placeholder = '0\t45.2\t-12.5\n10\t52.3\t-15.8\n20\t48.7\t-18.2\n...';
    } else {
        // Use Unicode characters directly in the JS string for better cross-platform support
        infoBox.innerHTML = '<p>Paste data (7 columns recommended): <code>P1, P2, P3, P4, K, R, Apparent \u03C1</code>. <strong>Apparent \u03C1 is calculated using \u03C1 = K \u00B7 R if column 7 is missing.</strong></p>';
        dataInput.placeholder = '0	10	20	30	62.83	8.1	508.92\n10	20	30	40	62.83	9.5	\n...';
    }
    clearAll();
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (file) {
        Papa.parse(file, {
            complete: function (results) {
                // Convert parsed results back to tab-separated string for consistency
                const csvText = results.data.map((row) => row.join('\t')).join('\n');
                document.getElementById('dataInput').value = csvText;
                plotData();
            },
        });
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    if(chart) {
        updateChartTheme();
    }
}

// Helper to slightly darken a hex color (used for VLF gradient end)
function darkenColor(hex, percent) {
    let r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);

    r = Math.floor(r * (100 - percent) / 100);
    g = Math.floor(g * (100 - percent) / 100);
    b = Math.floor(b * (100 - percent) / 100);

    r = Math.min(255, Math.max(0, r)).toString(16).padStart(2, '0');
    g = Math.min(255, Math.max(0, g)).toString(16).padStart(2, '0');
    b = Math.min(255, Math.max(0, b)).toString(16).padStart(2, '0');

    return "#" + r + g + b;
}


// --- Geophysics: Calculation Utilities ---

/**
 * Calculates the Geometric Factor (K) based on the selected array type.
 * NOTE: These calculations assume standard electrode ordering (C1, P1, P2, C2).
 */
function calculateGeometricFactor(arrayType, positions) {
    const [p1, p2, p3, p4] = positions;
    if (!p1 || !p2 || !p3 || !p4) return null;

    let K_factor = null;

    switch (arrayType) {
        case 'wenner':
            // Wenner: a = |P2-P1|. K = 2 * PI * a.
            const a_wenner = Math.abs(p2 - p1);
            if (a_wenner > 0) K_factor = 2 * Math.PI * a_wenner;
            break;
        case 'schlumberger':
            // Schlumberger: L = |C2-C1|/2, a = |P2-P1|/2. K = PI * (L^2 - a^2) / a
            const L_schl = Math.abs(p4 - p1) / 2; // Half current electrode spacing
            const a_schl = Math.abs(p3 - p2) / 2; // Half potential electrode spacing
            if (a_schl > 0 && L_schl > a_schl) K_factor = Math.PI * (L_schl * L_schl - a_schl * a_schl) / a_schl;
            break;
        case 'dipole':
            // Dipole-Dipole: a = |P2-P1| (dipole length), n*a = |C1-P1| (separation).
            // Formula K = PI * n * (n+1) * (n+2) * a (used for plotting pseudosections)
            const a_dipole = Math.abs(p2 - p1);
            const R_separation = Math.abs(p3 - p2); 
            const n_factor = a_dipole > 0 ? R_separation / a_dipole : null;
            
            if (n_factor > 0 && a_dipole > 0) {
                K_factor = Math.PI * n_factor * (n_factor + 1) * (n_factor + 2) * a_dipole;
            } else if (a_dipole > 0) {
                K_factor = 2 * Math.PI * a_dipole; // Fallback value
            }
            break;
        default:
            K_factor = null;
    }
    return K_factor;
}

/**
 * Calculates the Karous-Hjelt (K-H) filter result (numerical derivative).
 */
function calculateKarousHjelt(vlfData) {
    const khData = [];
    if (vlfData.length < 2) return khData;
    
    for (let i = 0; i < vlfData.length - 1; i++) {
        const p1 = vlfData[i];
        const p2 = vlfData[i + 1];

        const d_inPhase = p2.inPhase - p1.inPhase;
        const d_station = p2.station - p1.station;
        
        if (d_station !== 0) {
            const kh_value = d_inPhase / d_station;
            const midpoint = (p1.station + p2.station) / 2;
            khData.push({ x: midpoint, y: kh_value });
        }
    }
    return khData;
}


// --- Parser Functions ---

function parseVLFData(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const data = [];

    for (const line of lines) {
        // Skip header lines
        if (/station|inphase/i.test(line)) continue; 
        // Robustly split by tabs, commas, or spaces
        const parts = line.split(/[\t, ]+/).map(p => p.trim()).filter(Boolean);
        if (parts.length < 3) continue;

        const station = parseFloat(parts[0]);
        const inPhase = parseFloat(parts[1]);
        const quadrature = parseFloat(parts[2]);

        if (Number.isFinite(station) && Number.isFinite(inPhase) && Number.isFinite(quadrature)) {
            data.push({ station, inPhase, quadrature });
        }
    }
    return data;
}


function parseResistivityData(text) {
    const lines = text.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const data = [];
    const arrayType = document.getElementById('arrayType').value;
    
    for (const line of lines) {
        // Skip header lines
        if (/electrode|pos|station/i.test(line)) continue;
        const parts = line.split(/[\t, ]+/).filter(Boolean);
        
        // Data must have at least 6 columns: P1, P2, P3, P4, K, R
        if (parts.length < 6) continue;
        
        const positions = parts.slice(0, 4).map(parseFloat);
        let kFactor = parseFloat(parts[4]);
        const resistance = parseFloat(parts[5]);
        let apparentResistivity = parseFloat(parts[6]); // Optional 7th column
        let isCalculated = false;

        if (positions.some(isNaN)) continue;

        const spacingA = Math.abs(positions[1] - positions[0]);
        if (spacingA <= 0) continue; 
        
        // 1. Calculate K factor if missing/invalid
        if (!Number.isFinite(kFactor) || kFactor === 0) {
            kFactor = calculateGeometricFactor(arrayType, positions);
            if (!Number.isFinite(kFactor) || kFactor === 0) continue; 
        }
        
        // 2. Calculate Apparent Resistivity (ρ_a) if missing/invalid
        if (!Number.isFinite(apparentResistivity)) {
            if (Number.isFinite(kFactor) && Number.isFinite(resistance)) {
                apparentResistivity = kFactor * resistance;
                isCalculated = true;
            } else {
                continue; // Cannot plot if rho cannot be determined
            }
        }
        
        // 3. Calculate Midpoint (X-axis) and Depth (for legend/grouping)
        // Midpoint is center of the entire array for profile plotting
        const midpoint = (positions[0] + positions[3]) / 2; 
        // Simplified depth approximation (used for labeling)
        const depth = spacingA * 0.519; 

        if (Number.isFinite(midpoint) && Number.isFinite(apparentResistivity)) {
            data.push({ 
                arrayType, positions, 
                spacing: spacingA, 
                midpoint, depth, 
                kFactor, resistance, 
                apparentResistivity,
                isCalculated 
            });
        }
    }
    return data;
}


// --- Plot Controller & Plotting Functions ---

function plotData() {
    const input = document.getElementById('dataInput').value;
    const chartArea = document.getElementById('chartArea');
    const existingError = chartArea.querySelector('.error-message');
    
    if (existingError) {
        clearAll(true);
        document.getElementById('dataInput').value = input;
    }

    if (!input.trim()) {
        displayError("Please paste or upload your data first!");
        return;
    }
    
    try {
        if (currentDataType === 'vlf') {
            plotVLFData(input);
        } else {
            plotResistivityData(input);
        }
        document.getElementById('downloadBtn').disabled = false;
    } catch (error) {
        console.error("Plotting Error:", error);
        displayError(`An error occurred while plotting: ${error.message}. Check the console for details.`);
    }
}

/**
 * Utility: Creates a linear gradient across the canvas width using the selected colors.
 * @param {CanvasRenderingContext2D} ctx - The canvas context.
 * @param {HTMLCanvasElement} canvas - The canvas element.
 * @param {string} startColor - Hex color for the start of the gradient (left).
 * @param {string} endColor - Hex color for the end of the gradient (right).
 */
function createLinearGradientForCanvas(ctx, canvas, startColor, endColor) {
    // Horizontal gradient across the chart area
    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    grad.addColorStop(0, startColor);
    grad.addColorStop(1, endColor);
    return grad;
}

/**
 * Utility: Gets a CSS variable color value.
 */
function var_to_rgb(cssVariable) {
     const color = getComputedStyle(document.documentElement).getPropertyValue(cssVariable);
     return color.trim();
}


function plotVLFData(input) {
    const data = parseVLFData(input);
    if (data.length === 0) {
        displayError("No valid VLF data found. Expected format: <code>Station, InPhase, Quadrature</code>");
        return;
    }
    data.sort((a, b) => a.station - b.station);

    if (chart) { chart.destroy(); chart = null; }

    document.getElementById('chartPlaceholder').style.display = 'none';
    const canvas = document.getElementById('resistivityChart');
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');

    // Calculate Y-axis limits
    const allY = data.flatMap(d => [d.inPhase, d.quadrature]);
    let yMin = Math.min(...allY);
    let yMax = Math.max(...allY);
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) { yMin = -1; yMax = 1; }
    let range = yMax - yMin;
    if (range === 0) { range = Math.abs(yMax) || 1; }
    const pad = range * 0.12;
    yMin -= pad; yMax += pad;
    
    // --- Dynamic Color Theme Implementation ---
    const selectedThemeKey = document.getElementById('vlfColorTheme').value;
    const theme = VLF_THEMES[selectedThemeKey];
    
    const p1StartColor = theme.p1;
    const p2StartColor = theme.p2;
    
    // Create subtle gradient end color by darkening the theme colors by 15%
    const p1EndColor = darkenColor(p1StartColor, 15);
    const p2EndColor = darkenColor(p2StartColor, 15);

    const inPhaseGrad = createLinearGradientForCanvas(ctx, canvas, p1StartColor, p1EndColor); 
    const quadGrad = createLinearGradientForCanvas(ctx, canvas, p2StartColor, p2EndColor); 
    
    const datasets = [
        {
            label: 'In-Phase (%)',
            data: data.map(d => ({ x: d.station, y: d.inPhase })),
            borderColor: inPhaseGrad,
            backgroundColor: 'transparent',
            borderWidth: 3, pointRadius: 3.5, pointHoverRadius: 6, tension: 0.32,
            yAxisID: 'y1',
            pointBackgroundColor: 'white', pointBorderWidth: 2, pointBorderColor: inPhaseGrad,
        },
        {
            label: 'Quadrature (%)',
            data: data.map(d => ({ x: d.station, y: d.quadrature })),
            borderColor: quadGrad,
            backgroundColor: 'transparent',
            borderWidth: 3, pointRadius: 3.5, pointHoverRadius: 6, tension: 0.32,
            yAxisID: 'y1',
            pointBackgroundColor: 'white', pointBorderWidth: 2, pointBorderColor: quadGrad,
        }
    ];
    
    const options = getChartOptions('vlf');
    const showKH = document.getElementById('karousHjeltToggle').checked;
    
    if (showKH && chartAnnotationPluginLoaded) { // Only attempt K-H if the plugin is confirmed loaded
        const khData = calculateKarousHjelt(data);
        const khPoints = khData.map(d => d.y).filter(Number.isFinite);

        if (khPoints.length > 0) {
            const khRange = Math.max(...khPoints) - Math.min(...khPoints);
            const khYMin = Math.min(...khPoints) - khRange * 0.2;
            const khYMax = Math.max(...khPoints) + khRange * 0.2;

            const khColor = var_to_rgb('--accent-color-3');

            datasets.push({
                label: 'Karous-Hjelt Filter',
                data: khData,
                borderColor: khColor,
                backgroundColor: 'transparent',
                borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, tension: 0.4,
                yAxisID: 'y2', // Secondary Y-Axis
                pointStyle: 'star',
                pointBackgroundColor: khColor, pointBorderWidth: 0,
                hidden: false,
            });

            // Add secondary Y-axis configuration
            options.scales.y2 = {
                type: 'linear',
                position: 'right',
                title: { display: true, text: 'K-H Value (Derivative)', font: { size: 14, weight: '500' }, color: khColor },
                min: khYMin,
                max: khYMax,
                grid: { drawOnChartArea: false, color: options.scales.y.grid.color }, // Only draw grid for y1
                ticks: { color: khColor, font: { size: 12 } }
            };
            options.plugins.title.text = 'VLF Survey Profile (In-Phase, Quadrature, and K-H Filter)';
        }
    } 

    // Configure primary Y-axis
    options.scales.y1 = {
        ...options.scales.y,
        id: 'y1',
        title: { display: true, text: 'Amplitude (%)', font: { size: 14, weight: '500' }, color: options.scales.y.title.color },
        min: yMin,
        max: yMax,
    };
    delete options.scales.y; 

    displayVLFStats(data);
    
    chart = new Chart(ctx, { type: 'line', data: { datasets }, options });
}


function plotResistivityData(input) {
    const data = parseResistivityData(input);
    if (data.length === 0) {
        displayError("No valid Resistivity data found. Expected format: P1, P2, P3, P4, K, R.");
        return;
    }
    if (chart) { chart.destroy(); chart = null; }

    document.getElementById('chartPlaceholder').style.display = 'none';
    const canvas = document.getElementById('resistivityChart');
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');
    
    const groupedData = {};
    data.forEach((d) => {
        const key = d.spacing.toFixed(2); 
        if (!groupedData[key]) groupedData[key] = [];
        groupedData[key].push(d);
    });
    
    // --- Resistivity Color Palette Implementation ---
    const selectedPaletteKey = document.getElementById('resistivityColorTheme').value;
    const colorPalette = RESISTIVITY_PALETTES[selectedPaletteKey].colors;
    
    const datasets = [];
    let colorIndex = 0;
    
    // Sort by spacing ('a' factor)
    Object.keys(groupedData).map(Number).sort((a, b) => a - b).forEach((spacing) => {
        const points = groupedData[spacing.toFixed(2)];
        points.sort((a, b) => a.midpoint - b.midpoint); 
        
        const measuredPoints = points.filter(p => !p.isCalculated).map((p) => ({ x: p.midpoint, y: p.apparentResistivity }));
        const calculatedPoints = points.filter(p => p.isCalculated).map((p) => ({ x: p.midpoint, y: p.apparentResistivity }));

        // Get the base color for this depth layer
        const baseColor = colorPalette[colorIndex % colorPalette.length];
        // Create a gradient based on the base color (darkened for the end)
        const gradientEndColor = darkenColor(baseColor, 10);
        const lineGradient = createLinearGradientForCanvas(ctx, canvas, baseColor, gradientEndColor);


        // 1. Measured Data (Line and Solid Points)
        datasets.push({
            label: `Depth Layer (a = ${spacing}m)`,
            data: measuredPoints,
            borderColor: lineGradient, // Use gradient for the line
            borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 6, tension: 0.3,
            pointBackgroundColor: baseColor, // Solid point background
            pointBorderWidth: 2,
            pointBorderColor: baseColor,
            showLine: true,
            type: 'line', 
            spanGaps: true, 
            order: 1 
        });

        // 2. Calculated Data (Hollow Squares) - Plotted separately for visual distinction
        if (calculatedPoints.length > 0) {
            datasets.push({
                label: `Calculated ρ (a = ${spacing}m)`,
                data: calculatedPoints,
                borderColor: baseColor, // Use solid color for calculated point border
                borderWidth: 2, pointRadius: 5, pointHoverRadius: 7, tension: 0,
                pointBackgroundColor: 'transparent', 
                pointBorderWidth: 2.5,
                pointBorderColor: baseColor,
                showLine: false, 
                pointStyle: 'rect', 
                order: 0, // Ensure points draw on top of lines
            });
        }
        colorIndex++;
    });
    
    displayResistivityStats(data);

    const options = getChartOptions('resistivity');
    options.scales.y.type = 'logarithmic'; // Use log scale for resistivity
    options.scales.y.title.text = 'Apparent Resistivity (Ω·m) - Log Scale';
    options.plugins.title.text = `${document.getElementById('arrayType').value.toUpperCase()} Array Apparent Resistivity Profile`;

    // Must use 'scatter' type with line and point elements defined per dataset
    chart = new Chart(ctx, { type: 'scatter', data: { datasets }, options });
}

// --- Chart Configuration and Utilities ---

function getChartOptions(type) {
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#e0e0e0' : '#212529';
    const mutedTextColor = isDark ? '#a0a0a0' : '#6c757d';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
    const titles = { vlf: 'VLF Survey - In-Phase & Quadrature Profile', resistivity: 'Resistivity Profile' };
    const xAxes = { vlf: 'Station (m)', resistivity: 'Station Midpoint (m)' };
    const yAxes = { vlf: 'Amplitude (%)', resistivity: 'Apparent Resistivity (Ω·m)' };
    
    return {
        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: {
            title: { display: true, text: titles[type], font: { size: 18, weight: '600' }, padding: { top: 10, bottom: 20 }, color: textColor },
            legend: { position: 'top', labels: { color: textColor, font: { size: 12 }, padding: 15, boxWidth: 15 } },
            tooltip: {
                backgroundColor: isDark ? '#2a2a2a' : '#fff', titleColor: textColor, bodyColor: textColor, borderColor: gridColor, borderWidth: 1,
                callbacks: {
                    label: function(context) {
                        const y = context.parsed.y;
                        let unit = (type === 'vlf' ? '%' : ' Ω·m');
                        let pointType = (context.dataset.pointStyle === 'rect' ? ' (Calculated)' : '');
                        return `${context.dataset.label?.split(' (')[0] || context.dataset.label}${pointType}: ${Number.isFinite(y) ? y.toFixed(2) + unit : 'N/A'}`;
                    }
                }
            },
            annotation: {
                annotations: {}
            }
        },
        scales: {
            x: { type: 'linear', title: { display: true, text: xAxes[type], font: { size: 14, weight: '500' }, color: mutedTextColor }, grid: { color: gridColor }, ticks: { color: mutedTextColor, font: { size: 12 } } },
            y: { type: 'linear', title: { display: true, text: yAxes[type], font: { size: 14, weight: '500' }, color: mutedTextColor }, grid: { color: gridColor }, ticks: { color: mutedTextColor, font: { size: 12 } } },
        },
    };
}

function updateChartTheme() {
    // Force re-plot to redraw with new theme colors and gradient settings
    plotData();
}


// --- Stats Display Functions ---

function displayVLFStats(data) {
    const inPhase = data.map(d => d.inPhase);
    const quadrature = data.map(d => d.quadrature);
    const khEnabled = document.getElementById('karousHjeltToggle').checked;
    
    let khStats = '';
    // Only try to calculate KH if the plugin loaded, otherwise skip stats related to it
    if (khEnabled && chartAnnotationPluginLoaded) { 
        const khData = calculateKarousHjelt(data).map(d => d.y).filter(Number.isFinite);
        if (khData.length > 0) {
            const khMin = Math.min(...khData).toFixed(2);
            const khMax = Math.max(...khData).toFixed(2);
            khStats = `<div class="stat-card"><h4>K-H Filter Range</h4><p>${khMin} to ${khMax}</p></div>`;
        }
    } else if (khEnabled && !chartAnnotationPluginLoaded) {
         khStats = `<div class="stat-card"><h4>K-H Filter</h4><p>Plugin failed to load</p></div>`;
    }

    const stats = {
        points: data.length, 
        inPhaseMin: Math.min(...inPhase).toFixed(1), inPhaseMax: Math.max(...inPhase).toFixed(1),
        inPhaseAvg: (inPhase.reduce((a, b) => a + b, 0) / inPhase.length).toFixed(1),
        quadMin: Math.min(...quadrature).toFixed(1), quadMax: Math.max(...quadrature).toFixed(1),
        range: `${Math.min(...data.map(d => d.station))} - ${Math.max(...data.map(d => d.station))}m`,
    };
    document.getElementById('statsContainer').innerHTML = `
        <div class="stat-card"><h4>Data Points</h4><p>${stats.points}</p></div>
        <div class="stat-card"><h4>In-Phase Range</h4><p>${stats.inPhaseMin} to ${stats.inPhaseMax}%</p></div>
        <div class="stat-card"><h4>Quadrature Range</h4><p>${stats.quadMin} to ${stats.quadMax}%</p></div>
        ${khStats}
        <div class="stat-card"><h4>Profile Range</h4><p>${stats.range}</p></div>`;
    document.getElementById('statsSection').style.display = 'grid';
}


function displayResistivityStats(data) {
    const calculatedPoints = data.filter(d => d.isCalculated).length;
    const arrayType = document.getElementById('arrayType').value;

    const allRes = data.map((d) => d.apparentResistivity).filter(Number.isFinite);
    let stats = {
        points: data.length, 
        min: 'N/A', max: 'N/A', avg: 'N/A',
        range: `${Math.min(...data.map((d) => d.midpoint))} - ${Math.max(...data.map((d) => d.midpoint))}m`,
        spacingCount: new Set(data.map(d => d.spacing.toFixed(2))).size
    };

    if (allRes.length > 0) {
        stats.min = Math.min(...allRes).toFixed(1);
        stats.max = Math.max(...allRes).toFixed(1);
        stats.avg = (allRes.reduce((a, b) => a + b, 0) / allRes.length).toFixed(1);
    }

    document.getElementById('statsContainer').innerHTML = `
        <div class="stat-card"><h4>Array Type</h4><p>${arrayType.charAt(0).toUpperCase() + arrayType.slice(1)}</p></div>
        <div class="stat-card"><h4>Lines Plotted</h4><p>${stats.spacingCount}</p></div>
        <div class="stat-card"><h4>Calculated ρ Points</h4><p>${calculatedPoints}</p></div>
        <div class="stat-card"><h4>Max ρ</h4><p>${stats.max} Ω·m</p></div>
        <div class="stat-card"><h4>Profile Range</h4><p>${stats.range}</p></div>`;
    document.getElementById('statsSection').style.display = 'grid';
}


function displayError(message) {
    const chartArea = document.getElementById('chartArea');
    chartArea.innerHTML = `<div class="error-message"><h4>Error:</h4>${message}</div>`;
    document.getElementById('statsSection').style.display = 'none';
    document.getElementById('downloadBtn').disabled = true;
}


function clearAll(preserveInput = false) {
    if (!preserveInput) {
        document.getElementById('dataInput').value = '';
    }
    document.getElementById('fileInput').value = '';
    if (chart) {
        chart.destroy();
        chart = null;
    }
    document.getElementById('statsSection').style.display = 'none';
    document.getElementById('downloadBtn').disabled = true;

    const chartArea = document.getElementById('chartArea');
    const placeholderHtml = `
        <div id="chartPlaceholder">
            <div class="icon">📊</div>
            <h3>Input Data to Visualize Profile</h3>
            <p>Select your survey type and click "Generate Plot" to begin.</p>
        </div>
        <canvas id="resistivityChart" style="display: none;"></canvas>`;
    
    chartArea.innerHTML = placeholderHtml;

    const canvas = document.getElementById('resistivityChart');
    if (canvas) canvas.style.display = 'none';
    const placeholder = document.getElementById('chartPlaceholder');
    if (placeholder) placeholder.style.display = 'flex';
}


function loadSampleData() {
    const dataInput = document.getElementById('dataInput');
    // Ensure default themes are selected for sample run
    document.getElementById('vlfColorTheme').value = 'ocean';
    document.getElementById('resistivityColorTheme').value = 'primary';
    
    if (currentDataType === 'vlf') {
        document.getElementById('karousHjeltToggle').checked = true; 
        dataInput.value = `Station	InPhase	Quadrature
0	45.2	-12.5
10	52.3	-15.8
20	48.7	-18.2
30	35.1	-22.1
40	15.6	-19.5
50	-5.9	-10.3
60	-20.4	5.2
70	-15.8	15.7
80	-8.1	12.4
90	2.5	8.9
100	10.1	4.1
110	15.0	-2.0
120	12.0	-8.0
`;
    } else {
        document.getElementById('arrayType').value = 'wenner';
        dataInput.value = `P1	P2	P3	P4	K	R	Apparent_Rho
0	10	20	30	62.83	8.1	508.92
10	20	30	40	62.83	9.5	
20	30	40	50	62.83	11.2	703.69
30	40	50	60	62.83	10.8	
40	50	60	70	62.83	9.9	621.01
0	20	40	60	125.66	4.5	
10	30	50	70	125.66	5.1	640.86
20	40	60	80	125.66	5.8	
0	30	60	90	188.49	3.2	603.16
10	40	70	100	188.49	3.9	`;
    }
    plotData();
}

function downloadChart() {
    if (!chart) return;
    const format = document.getElementById('formatSelect').value;
    const mimeType = `image/${format}`;

    const originalCanvas = document.getElementById('resistivityChart');
    const outW = 1600;
    const outH = Math.round((originalCanvas.height / originalCanvas.width) * outW) || 900;

    const imgUrl = chart.toBase64Image('image/png', 1.0); 

    const tmp = document.createElement('canvas');
    tmp.width = outW;
    tmp.height = outH;
    const tctx = tmp.getContext('2d');

    const img = new Image();
    img.onload = () => {
        tctx.fillStyle = '#ffffff';
        tctx.fillRect(0, 0, outW, outH);
        tctx.drawImage(img, 0, 0, outW, outH);
        const url = tmp.toDataURL(mimeType, 1.0);
        const link = document.createElement('a');
        link.download = `${currentDataType}_plot.${format}`;
        link.href = url;
        link.click();
    };
    img.crossOrigin = 'anonymous';
    img.src = imgUrl;
}

// Initialize state: Populate dropdowns and set initial data type
window.onload = () => {
    populateThemeDropdowns();
    setDataType('vlf');
}
