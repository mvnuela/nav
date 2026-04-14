/**
 * World Magnetic Model 2025 (WMM2025) - Magnetic Declination Calculator
 *
 * Calculates magnetic declination (variation) for any point on Earth.
 * Based on NOAA/NCEI World Magnetic Model, valid 2025.0 - 2030.0
 *
 * Reference: Chulliat, A., W. Brown, P. Alken, C. Beggan, M. Nair,
 * G. Cox, A. Woods, S. Macmillan, B. Meyer and M. Paniccia, 2024,
 * The US/UK World Magnetic Model for 2025-2030, National Centers for
 * Environmental Information, NOAA, doi:10.25921/jj65-hw14
 */

(function() {
    'use strict';

    // WMM2025 Spherical Harmonic Coefficients (n=1..12, m=0..n)
    // Format: [n, m, gnm, hnm, dgnm, dhnm]
    // gnm/hnm = main field coefficients (nT)
    // dgnm/dhnm = secular variation coefficients (nT/year)
    const WMM_COEFFICIENTS = [
        [1, 0, -29351.8, 0.0, 12.0, 0.0],
        [1, 1, -1410.8, 4545.4, 9.7, -21.4],
        [2, 0, -2556.6, 0.0, -0.2, 0.0],
        [2, 1, 2951.1, -3133.6, -8.5, -0.8],
        [2, 2, 1649.3, -814.2, -5.7, -14.5],
        [3, 0, 1361.0, 0.0, -0.3, 0.0],
        [3, 1, -2404.1, -228.0, 0.1, 6.1],
        [3, 2, 1243.8, 295.8, -1.0, -1.4],
        [3, 3, 453.6, -464.5, -10.9, -4.2],
        [4, 0, 895.0, 0.0, -1.5, 0.0],
        [4, 1, 799.5, 277.5, -0.6, -0.4],
        [4, 2, 55.4, -390.2, -3.4, 3.9],
        [4, 3, -281.1, 47.7, -1.3, 2.2],
        [4, 4, -11.9, 230.9, 0.2, -0.8],
        [5, 0, -227.6, 0.0, 0.3, 0.0],
        [5, 1, 354.6, 47.0, 0.0, 0.3],
        [5, 2, 208.3, 168.1, 1.5, 1.8],
        [5, 3, -133.5, -123.0, 1.8, 0.5],
        [5, 4, -168.1, -19.5, 0.7, 2.0],
        [5, 5, -14.1, 100.9, 1.0, -0.1],
        [6, 0, 72.0, 0.0, -0.2, 0.0],
        [6, 1, 68.2, -52.6, 0.4, -0.6],
        [6, 2, 76.2, 44.2, -0.6, -0.5],
        [6, 3, -50.9, -58.1, 1.3, 1.0],
        [6, 4, -14.4, 1.4, -0.1, 0.7],
        [6, 5, 21.3, 14.0, -0.2, -0.2],
        [6, 6, 13.6, -60.2, 0.1, 0.5],
        [7, 0, -56.2, 0.0, 0.0, 0.0],
        [7, 1, 84.6, -54.5, -0.3, 0.2],
        [7, 2, -76.7, -11.8, -0.1, 0.2],
        [7, 3, -6.3, 24.9, 0.7, 0.0],
        [7, 4, 27.2, 7.7, 0.0, 0.5],
        [7, 5, 6.2, -24.2, 0.5, 0.4],
        [7, 6, 9.7, 3.5, -0.3, 0.2],
        [7, 7, -2.1, -6.3, 0.1, 0.2],
        [8, 0, 24.6, 0.0, 0.0, 0.0],
        [8, 1, 8.4, 10.0, 0.0, 0.2],
        [8, 2, -16.9, -18.3, -0.3, 0.5],
        [8, 3, -3.2, 13.3, 0.4, 0.2],
        [8, 4, -20.6, -14.6, -0.1, -0.2],
        [8, 5, 13.3, 16.2, 0.3, -0.1],
        [8, 6, 11.7, 5.7, 0.1, -0.3],
        [8, 7, -16.0, -9.1, -0.2, 0.3],
        [8, 8, -2.0, 2.1, 0.3, 0.2],
        [9, 0, 5.5, 0.0, 0.0, 0.0],
        [9, 1, 8.8, -21.8, -0.1, 0.2],
        [9, 2, 3.0, 10.8, 0.0, -0.1],
        [9, 3, -3.3, 11.8, 0.0, 0.2],
        [9, 4, 0.6, -6.9, -0.1, -0.1],
        [9, 5, -13.3, -6.9, -0.2, 0.1],
        [9, 6, -0.1, 7.8, 0.1, -0.1],
        [9, 7, 8.7, 1.0, 0.0, -0.1],
        [9, 8, -9.1, -4.0, -0.1, 0.2],
        [9, 9, -10.5, 8.4, 0.0, 0.0],
        [10, 0, -2.0, 0.0, 0.0, 0.0],
        [10, 1, -6.3, 3.3, 0.0, 0.0],
        [10, 2, 0.3, -0.3, 0.0, 0.1],
        [10, 3, 0.5, 4.6, 0.1, 0.0],
        [10, 4, -0.6, 4.4, 0.0, 0.0],
        [10, 5, 1.7, -7.9, -0.1, -0.2],
        [10, 6, -0.7, -0.6, 0.0, 0.1],
        [10, 7, 2.1, -4.2, 0.1, 0.0],
        [10, 8, 2.3, -2.8, -0.2, -0.1],
        [10, 9, -1.8, -1.1, -0.1, 0.1],
        [10, 10, -3.6, -8.8, 0.0, 0.1],
        [11, 0, 3.0, 0.0, 0.0, 0.0],
        [11, 1, -1.5, -0.1, 0.0, 0.0],
        [11, 2, -2.1, 2.1, 0.0, 0.1],
        [11, 3, 1.7, -0.6, 0.1, 0.0],
        [11, 4, -0.5, -1.8, 0.0, 0.1],
        [11, 5, 0.5, 0.9, 0.0, 0.0],
        [11, 6, -0.8, -0.4, 0.0, 0.1],
        [11, 7, 0.4, -2.5, 0.0, 0.0],
        [11, 8, 1.8, -1.3, 0.0, -0.1],
        [11, 9, 0.1, -2.1, 0.0, 0.0],
        [11, 10, 0.7, -1.9, -0.1, 0.0],
        [11, 11, 3.8, -1.8, 0.0, -0.1],
        [12, 0, -2.1, 0.0, 0.0, 0.0],
        [12, 1, -0.2, -0.8, 0.0, 0.0],
        [12, 2, 0.3, 0.3, 0.0, 0.0],
        [12, 3, 1.0, 2.2, 0.0, 0.0],
        [12, 4, -0.9, -2.2, 0.0, 0.0],
        [12, 5, 0.9, 0.3, 0.0, 0.0],
        [12, 6, 0.1, 0.7, 0.0, 0.0],
        [12, 7, 0.5, -0.1, 0.0, 0.0],
        [12, 8, -0.3, 0.4, 0.0, 0.0],
        [12, 9, -0.4, 0.3, 0.0, 0.0],
        [12, 10, 0.2, -0.9, 0.0, 0.0],
        [12, 11, -0.9, -0.2, 0.0, 0.0],
        [12, 12, 0.0, 0.7, 0.0, 0.0]
    ];

    // WGS84 constants
    const WGS84_A = 6378.137;       // semi-major axis (km)
    const WGS84_F = 1.0 / 298.257223563;  // flattening
    const WGS84_B = WGS84_A * (1 - WGS84_F); // semi-minor axis
    const RE = 6371.2;              // Earth reference radius for WMM (km)

    const NMAX = 12;  // Maximum degree of spherical harmonic expansion
    const EPOCH = 2025.0; // WMM2025 epoch

    /**
     * Convert date to decimal year
     */
    function dateToDecimalYear(date) {
        if (!date) date = new Date();
        const year = date.getFullYear();
        const start = new Date(year, 0, 1);
        const end = new Date(year + 1, 0, 1);
        return year + (date - start) / (end - start);
    }

    /**
     * Convert geodetic coordinates to geocentric spherical coordinates
     */
    function geodeticToGeocentric(lat, altKm) {
        const latRad = lat * Math.PI / 180;
        const sinLat = Math.sin(latRad);
        const cosLat = Math.cos(latRad);

        // WGS84 ellipsoid
        const a2 = WGS84_A * WGS84_A;
        const b2 = WGS84_B * WGS84_B;

        const D = Math.sqrt(a2 * cosLat * cosLat + b2 * sinLat * sinLat);

        const rho = Math.sqrt(
            altKm * (altKm + 2 * D) +
            (a2 * a2 * cosLat * cosLat + b2 * b2 * sinLat * sinLat) / (D * D)
        );

        const geocentricLat = Math.asin(
            (altKm + D) * sinLat * b2 / (D * rho * RE) +
            altKm * sinLat / rho
        );

        // More precise geocentric latitude calculation
        const sinGeoLat = ((altKm + D) / rho) * sinLat * (b2 / (D * RE)) +
                          (altKm / rho) * sinLat;

        // Use proper geocentric conversion
        const Rc = WGS84_A / Math.sqrt(1 - (2 * WGS84_F - WGS84_F * WGS84_F) * sinLat * sinLat);
        const pxy = (Rc + altKm) * cosLat;
        const pz = (Rc * (1 - (2 * WGS84_F - WGS84_F * WGS84_F)) + altKm) * sinLat;

        const r = Math.sqrt(pxy * pxy + pz * pz);
        const geocLat = Math.asin(pz / r);

        return {
            r: r,           // geocentric radius in km
            theta: geocLat, // geocentric colatitude in radians
            latRad: latRad  // original geodetic latitude in radians
        };
    }

    /**
     * Calculate magnetic declination using WMM2025
     * @param {number} lat - Geodetic latitude in degrees (-90 to 90)
     * @param {number} lon - Geodetic longitude in degrees (-180 to 180)
     * @param {Date} [date] - Date for calculation (default: now)
     * @param {number} [altKm] - Altitude in km above WGS84 ellipsoid (default: 0)
     * @returns {object} Magnetic field components and declination
     */
    function calculateMagneticDeclination(lat, lon, date, altKm) {
        if (altKm === undefined) altKm = 0;
        if (!date) date = new Date();

        const decimalYear = dateToDecimalYear(date);
        const dt = decimalYear - EPOCH;

        // Clamp to valid range
        if (dt < 0 || dt > 5) {
            console.warn('WMM2025 is valid 2025.0-2030.0. Results may be less accurate.');
        }

        const lonRad = lon * Math.PI / 180;
        const latRad = lat * Math.PI / 180;

        // Convert to geocentric coordinates
        const sinLat = Math.sin(latRad);
        const cosLat = Math.cos(latRad);

        // Geocentric radius and latitude using WGS84
        const e2 = 2 * WGS84_F - WGS84_F * WGS84_F;
        const Rc = WGS84_A / Math.sqrt(1 - e2 * sinLat * sinLat);
        const pxy = (Rc + altKm) * cosLat;
        const pz = (Rc * (1 - e2) + altKm) * sinLat;

        const r = Math.sqrt(pxy * pxy + pz * pz);
        const geocLatRad = Math.atan2(pz, pxy);
        const sinGeoLat = Math.sin(geocLatRad);
        const cosGeoLat = Math.cos(geocLatRad);

        // Ratio of Earth's reference radius to geocentric radius
        const ratio = RE / r;

        // Compute associated Legendre polynomials and field components
        // Using Schmidt semi-normalized associated Legendre functions
        const P = [];   // P[n][m]
        const dP = [];  // dP[n][m] - derivative with respect to theta

        for (let n = 0; n <= NMAX + 1; n++) {
            P[n] = new Array(n + 1).fill(0);
            dP[n] = new Array(n + 1).fill(0);
        }

        // P(0,0) = 1, P(1,0) = sin(geocLat), P(1,1) = cos(geocLat)
        P[0][0] = 1;
        P[1][0] = sinGeoLat;
        P[1][1] = cosGeoLat;
        dP[0][0] = 0;
        dP[1][0] = cosGeoLat;
        dP[1][1] = -sinGeoLat;

        // Compute P(n,m) using recursion
        for (let n = 2; n <= NMAX; n++) {
            for (let m = 0; m <= n; m++) {
                if (n === m) {
                    // P(n,n) = cos(theta) * P(n-1,n-1) * sqrt((2n-1)/(2n))
                    // Using Schmidt normalization
                    P[n][n] = cosGeoLat * P[n - 1][n - 1] * Math.sqrt((2 * n - 1) / (2 * n));
                    dP[n][n] = cosGeoLat * dP[n - 1][n - 1] * Math.sqrt((2 * n - 1) / (2 * n))
                             - sinGeoLat * P[n - 1][n - 1] * Math.sqrt((2 * n - 1) / (2 * n));
                } else if (n === m + 1) {
                    // P(n,m) = sin(theta) * (2n-1) * P(n-1,m) / sqrt(n*n - m*m)
                    const K = Math.sqrt(((2 * n - 1) * (2 * n - 1)) / (n * n - m * m));
                    P[n][m] = sinGeoLat * P[n - 1][m] * K;
                    dP[n][m] = (sinGeoLat * dP[n - 1][m] + cosGeoLat * P[n - 1][m]) * K;
                } else {
                    // General recursion
                    const K1 = ((2 * n - 1) / Math.sqrt(n * n - m * m));
                    const K2 = (Math.sqrt((n - 1) * (n - 1) - m * m) / Math.sqrt(n * n - m * m));
                    P[n][m] = sinGeoLat * P[n - 1][m] * K1 - P[n - 2][m] * K2;
                    dP[n][m] = sinGeoLat * dP[n - 1][m] * K1 + cosGeoLat * P[n - 1][m] * K1 - dP[n - 2][m] * K2;
                }
            }
        }

        // Calculate field components in geocentric spherical coordinates
        let Br = 0;     // radial (outward)
        let Bt = 0;     // theta (southward)
        let Bp = 0;     // phi (eastward)

        for (let i = 0; i < WMM_COEFFICIENTS.length; i++) {
            const [n, m, gnm, hnm, dgnm, dhnm] = WMM_COEFFICIENTS[i];

            // Time-adjusted coefficients
            const g = gnm + dgnm * dt;
            const h = hnm + dhnm * dt;

            const rRatio = Math.pow(ratio, n + 2);
            const cosMLon = Math.cos(m * lonRad);
            const sinMLon = Math.sin(m * lonRad);

            // Radial component (Br)
            Br += (n + 1) * rRatio * (g * cosMLon + h * sinMLon) * P[n][m];

            // Theta component (Bt) - southward in geocentric
            Bt -= rRatio * (g * cosMLon + h * sinMLon) * dP[n][m];

            // Phi component (Bp) - eastward
            if (cosGeoLat !== 0) {
                Bp += rRatio * m * (g * sinMLon - h * cosMLon) * P[n][m] / cosGeoLat;
            }
        }

        // Convert from geocentric to geodetic coordinates
        // The difference angle between geodetic and geocentric latitude
        const dLat = latRad - geocLatRad;
        const sinDLat = Math.sin(dLat);
        const cosDLat = Math.cos(dLat);

        // Rotate from geocentric to geodetic
        const Bx = -Bt * cosDLat - Br * sinDLat;  // North component
        const By = Bp;                              // East component
        const Bz = Bt * sinDLat - Br * cosDLat;    // Down component

        // Calculate declination
        const H = Math.sqrt(Bx * Bx + By * By);    // Horizontal intensity
        const declination = Math.atan2(By, Bx) * 180 / Math.PI;
        const inclination = Math.atan2(Bz, H) * 180 / Math.PI;
        const F = Math.sqrt(H * H + Bz * Bz);      // Total intensity

        return {
            declination: declination,    // Magnetic declination (variation) in degrees (+E, -W)
            inclination: inclination,    // Magnetic inclination (dip) in degrees
            intensity: F,                // Total field intensity in nT
            horizontal: H,               // Horizontal intensity in nT
            north: Bx,                   // North component (nT)
            east: By,                    // East component (nT)
            down: Bz,                    // Down (vertical) component (nT)
            model: 'WMM2025',
            validFrom: 2025.0,
            validTo: 2030.0,
            decimalYear: decimalYear
        };
    }

    /**
     * Format declination for display
     * @param {number} declination - Declination in degrees
     * @returns {string} Formatted declination string
     */
    function formatDeclination(declination) {
        const dir = declination >= 0 ? 'E' : 'W';
        const absDec = Math.abs(declination);
        const deg = Math.floor(absDec);
        const min = ((absDec - deg) * 60).toFixed(1);
        return `${deg}°${min}'${dir}`;
    }

    // Internal grid resolution for pre-computation
    const GRID_COLS = 16;
    const GRID_ROWS = 10;

    /**
     * Initialize Magnetic Declination — small info box, cursor-driven, no map overlay.
     * Pre-computes a grid on pan/zoom; mousemove just looks up the cached cell.
     * @param {L.Map} leafletMap
     */
    window.initMagneticDeclination = function(leafletMap) {
        const map = leafletMap;
        let grid = [];  // cached cells: { latMin, latMax, lonMin, lonMax, decl }

        // ─── Small info box (bottom-right, away from latitude scale) ───
        L.Control.MagVar = L.Control.extend({
            options: { position: 'bottomright' },
            onAdd: function() {
                const box = L.DomUtil.create('div', 'mag-var-box');
                box.style.cssText = 'background:rgba(255,255,255,0.92);padding:4px 8px;border:1px solid rgba(0,0,0,0.25);border-radius:3px;font-size:12px;font-family:monospace;pointer-events:none;white-space:nowrap;';
                box.id = 'magVarBox';
                box.textContent = 'Var: --';
                return box;
            }
        });
        new L.Control.MagVar().addTo(map);

        // ─── Pre-compute grid on pan/zoom ───
        function rebuildGrid() {
            grid = [];
            const b = map.getBounds();
            const south = b.getSouth(), north = b.getNorth();
            const west = b.getWest(), east = b.getEast();
            const cellH = (north - south) / GRID_ROWS;
            const cellW = (east - west) / GRID_COLS;

            for (let row = 0; row < GRID_ROWS; row++) {
                for (let col = 0; col < GRID_COLS; col++) {
                    const lat0 = south + row * cellH;
                    const lon0 = west + col * cellW;
                    const result = calculateMagneticDeclination(lat0 + cellH / 2, lon0 + cellW / 2);
                    grid.push({
                        latMin: lat0, latMax: lat0 + cellH,
                        lonMin: lon0, lonMax: lon0 + cellW,
                        decl: result.declination
                    });
                }
            }
        }

        // ─── Cursor lookup — no WMM calc, just array scan ───
        function onMouseMove(e) {
            const lat = e.latlng.lat;
            const lon = e.latlng.lng;
            const box = document.getElementById('magVarBox');
            if (!box) return;

            for (let i = 0; i < grid.length; i++) {
                const c = grid[i];
                if (lat >= c.latMin && lat < c.latMax && lon >= c.lonMin && lon < c.lonMax) {
                    box.textContent = 'Var: ' + formatDeclination(c.decl) + '  (' + (c.decl >= 0 ? '+' : '') + c.decl.toFixed(1) + '°)';
                    return;
                }
            }
            box.textContent = 'Var: --';
        }

        map.on('mousemove', onMouseMove);
        map.on('moveend', rebuildGrid);
        map.on('zoomend', rebuildGrid);
        setTimeout(rebuildGrid, 200);

        // Expose globally
        window.getMagneticDeclination = calculateMagneticDeclination;
        window.formatMagneticDeclination = formatDeclination;
    };

})();
