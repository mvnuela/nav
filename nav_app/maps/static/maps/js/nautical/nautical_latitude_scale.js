/**
 * Nautical Latitude Scale (Vertical)
 *
 * Classic nautical chart latitude scale placed on the LEFT side of the map.
 * 1 minute of latitude = 1 nautical mile (NM).
 * Users can transfer distances from the map to this scale using dividers.
 *
 * Uses Leaflet's built-in projection (latLngToContainerPoint) for Mercator-correct positioning.
 */

(function() {
    'use strict';

    var map = null;
    var svgContainer = null;
    var svgNS = 'http://www.w3.org/2000/svg';

    // Layout constants
    var SCALE_WIDTH = 60;
    var LEFT_OFFSET = 4;
    // Ticks are anchored to the left border and grow rightward; labels sit to
    // their right, flush against the right edge of the strip.
    var TICK_BASE_X = 1;
    var MAJOR_TICK_LEN = 13;
    var MEDIUM_TICK_LEN = 9;
    var MINOR_TICK_LEN = 6;
    var SUB_MINOR_TICK_LEN = 3;

    // Alternating band width (for the classic black/white minute blocks)
    var BAND_WIDTH = 6;

    // Labels sit just clear of the longest tick, left-aligned so they read as a
    // single column tight against the bands.
    var LABEL_X = TICK_BASE_X + MAJOR_TICK_LEN + 3;

    /**
     * Give text a white outline so it stays readable over open water now that
     * there's no opaque strip behind the scale.
     */
    function addHalo(textEl) {
        textEl.setAttribute('stroke', '#fff');
        textEl.setAttribute('stroke-width', '2.5');
        textEl.setAttribute('stroke-linejoin', 'round');
        textEl.setAttribute('paint-order', 'stroke');
    }

    /**
     * Determine which tick levels to show based on zoom.
     * Returns { minor: minutes, medium: minutes, major: minutes, showBands: bool }
     */
    function getTickConfig(zoom) {
        if (zoom >= 13) {
            // Very high zoom: show every 1' tick, bands per 1'
            return { minor: 1, medium: 10, major: 60, showBands: true, bandMinutes: 1 };
        } else if (zoom >= 11) {
            // High zoom: show 1' ticks, 10' medium, 1 degree major
            return { minor: 1, medium: 10, major: 60, showBands: true, bandMinutes: 1 };
        } else if (zoom >= 9) {
            // Medium-high zoom: 2' minor, 10' medium, 1 degree major
            return { minor: 2, medium: 10, major: 60, showBands: true, bandMinutes: 2 };
        } else if (zoom >= 7) {
            // Medium zoom: 10' minor, 30' medium, 1 degree major
            return { minor: 10, medium: 30, major: 60, showBands: true, bandMinutes: 10 };
        } else if (zoom >= 5) {
            // Low-medium zoom: 30' minor, 1 degree medium, 5 degree major
            return { minor: 30, medium: 60, major: 300, showBands: true, bandMinutes: 30 };
        } else if (zoom >= 3) {
            // Low zoom: 1 degree minor, 5 degree medium, 10 degree major
            return { minor: 60, medium: 300, major: 600, showBands: false, bandMinutes: 60 };
        } else {
            // Very low zoom: 5 degree only
            return { minor: 300, medium: 600, major: 1800, showBands: false, bandMinutes: 300 };
        }
    }

    // Smallest vertical gap between two labels that still reads cleanly.
    var MIN_LABEL_PX = 26;
    // Label intervals in arc-minutes, finest first.
    var LABEL_STEPS = [1, 2, 5, 10, 15, 20, 30, 60, 120, 300, 600, 1800];

    /**
     * Pick the finest label interval (in arc-minutes) that keeps neighbouring
     * labels at least MIN_LABEL_PX apart and still lands on drawn ticks.
     *
     * Without this the scale labelled only whole degrees and 10' marks, so a
     * zoomed-in view could show a single number for the entire strip and the
     * position had to be counted off tick by tick.
     */
    function pickLabelStep(pxPerMin, minorMinutes) {
        for (var i = 0; i < LABEL_STEPS.length; i++) {
            var step = LABEL_STEPS[i];
            if (step < minorMinutes) continue;          // must sit on a real tick
            if (step % minorMinutes !== 0) continue;
            if (step * pxPerMin >= MIN_LABEL_PX) return step;
        }
        return LABEL_STEPS[LABEL_STEPS.length - 1];
    }

    /**
     * Format latitude for label display.
     * minutesTotal: total minutes from equator (can be negative)
     */
    function formatLatLabel(minutesTotal) {
        var absMin = Math.abs(minutesTotal);
        var deg = Math.floor(absMin / 60);
        var min = absMin % 60;
        var hemisphere = minutesTotal >= 0 ? 'N' : 'S';

        if (min === 0) {
            return deg + '\u00B0' + hemisphere;
        }
        return deg + '\u00B0' + min + '\u2032' + hemisphere;
    }

    /**
     * Short form used between the full labels: minutes only, e.g. 37'.
     */
    function formatMinuteLabel(minutesTotal) {
        var absMin = Math.abs(minutesTotal);
        return (absMin % 60) + '\u2032';
    }

    /**
     * Check pixel density: skip individual 1' ticks if they'd be < minPx apart
     */
    function shouldSkipMinor(map, lat, config) {
        if (config.minor > 1) return false;
        var lon = map.getBounds().getWest();
        var p1 = map.latLngToContainerPoint([lat, lon]);
        var p2 = map.latLngToContainerPoint([lat + 1 / 60, lon]);
        return Math.abs(p2.y - p1.y) < 3;
    }

    /**
     * Build and render the full scale into the SVG.
     */
    function drawScale() {
        if (!map || !svgContainer) return;

        // Clear previous content
        while (svgContainer.firstChild) {
            svgContainer.removeChild(svgContainer.firstChild);
        }

        var size = map.getSize();
        var mapH = size.y;
        svgContainer.setAttribute('height', mapH);

        var bounds = map.getBounds();
        var zoom = map.getZoom();
        var config = getTickConfig(zoom);

        // Reference longitude: left edge of map
        var refLon = bounds.getWest();

        // Latitude range in total arc-minutes
        var southMin = Math.floor(bounds.getSouth() * 60);
        var northMin = Math.ceil(bounds.getNorth() * 60);

        // Clamp to valid latitude range
        southMin = Math.max(southMin, -90 * 60);
        northMin = Math.min(northMin, 90 * 60);

        // Snap to minor interval
        var startMin = Math.floor(southMin / config.minor) * config.minor;
        var endMin = Math.ceil(northMin / config.minor) * config.minor;

        // Safety: limit total ticks to avoid perf issues
        var totalTicks = (endMin - startMin) / config.minor;
        if (totalTicks > 2000) {
            // Fallback: increase minor interval
            config.minor = Math.ceil((endMin - startMin) / 2000);
            startMin = Math.floor(southMin / config.minor) * config.minor;
            endMin = Math.ceil(northMin / config.minor) * config.minor;
        }

        // The x position of the left border (ticks grow rightward from here)
        var scaleX = TICK_BASE_X;

        // No background strip: the scale floats directly over the chart. Text
        // gets a white halo (see addHalo) so it stays legible over dark water.

        // Draw border line on left side of scale (ticks hang off it)
        var borderLine = document.createElementNS(svgNS, 'line');
        borderLine.setAttribute('x1', scaleX);
        borderLine.setAttribute('y1', 0);
        borderLine.setAttribute('x2', scaleX);
        borderLine.setAttribute('y2', mapH);
        borderLine.setAttribute('stroke', '#333');
        borderLine.setAttribute('stroke-width', '1.5');
        svgContainer.appendChild(borderLine);

        // Draw alternating black/white bands (classic nautical chart style)
        if (config.showBands) {
            drawBands(refLon, startMin, endMin, config, scaleX, mapH);
        }

        // Vertical pixels per arc-minute at mid-screen, used for both the
        // sub-minor tick spacing and the label interval. Measured over a whole
        // degree because latLngToContainerPoint rounds to integer pixels, which
        // would collapse a single-minute probe to 0 px at low zooms.
        var midLat = ((startMin + endMin) / 2) / 60;
        var probeLat = midLat + 1 <= 85 ? midLat + 1 : midLat - 1;
        var pa = map.latLngToContainerPoint([midLat, refLon]);
        var pb = map.latLngToContainerPoint([probeLat, refLon]);
        var pxPerMin = Math.abs(pb.y - pa.y) / 60;

        var labelStep = pickLabelStep(pxPerMin, config.minor);

        // Pick a sub-minor interval that subdivides each band into arc-minutes,
        // but keep ticks at least ~3 px apart to stay readable.
        var subMinor = null;
        if (config.minor > 1) {
            var subCandidates = [1, 2, 5, 10, 15];
            for (var si = 0; si < subCandidates.length; si++) {
                if (subCandidates[si] < config.minor &&
                    subCandidates[si] * pxPerMin >= 3) {
                    subMinor = subCandidates[si];
                    break;
                }
            }
        }

        // Draw sub-minor ticks (minute subdivisions inside each band)
        if (subMinor !== null) {
            var subStart = Math.floor(southMin / subMinor) * subMinor;
            var subEnd = Math.ceil(northMin / subMinor) * subMinor;
            for (var sm = subStart; sm <= subEnd; sm += subMinor) {
                // Skip positions already drawn by the main tick loop
                if (sm % config.minor === 0) continue;

                var sLat = sm / 60;
                var sPt = map.latLngToContainerPoint([sLat, refLon]);
                var sY = sPt.y;
                if (sY < -5 || sY > mapH + 5) continue;

                // Bands alternate: even bandIdx = dark fill → red tick for contrast
                var onDarkBand = false;
                if (config.showBands) {
                    var bandIdx = Math.floor(sm / config.bandMinutes);
                    onDarkBand = (((bandIdx % 2) + 2) % 2 === 0);
                }

                var subTick = document.createElementNS(svgNS, 'line');
                subTick.setAttribute('x1', scaleX);
                subTick.setAttribute('y1', sY);
                subTick.setAttribute('x2', scaleX + SUB_MINOR_TICK_LEN);
                subTick.setAttribute('y2', sY);
                subTick.setAttribute('stroke', onDarkBand ? '#e53935' : '#555');
                subTick.setAttribute('stroke-width', onDarkBand ? '1' : '0.5');
                svgContainer.appendChild(subTick);
            }
        }

        // Northernmost labelled minute currently on screen. It always carries
        // the full degree/minute form, so a view that fits inside one degree
        // still states which degree it is in.
        var anchorMin = null;
        for (var am = endMin; am >= startMin; am -= config.minor) {
            if (am % labelStep !== 0) continue;
            var aY = map.latLngToContainerPoint([am / 60, refLon]).y;
            if (aY >= 8 && aY <= mapH) {
                anchorMin = am;
                break;
            }
        }

        // Draw ticks and labels
        for (var m = startMin; m <= endMin; m += config.minor) {
            var lat = m / 60;
            var pt = map.latLngToContainerPoint([lat, refLon]);
            var y = pt.y;

            // Skip if outside viewport
            if (y < -10 || y > mapH + 10) continue;

            var tickLen;
            var strokeWidth;
            var showLabel = false;

            if (m % config.major === 0) {
                // Major tick (degree boundary)
                tickLen = MAJOR_TICK_LEN;
                strokeWidth = 2;
            } else if (m % config.medium === 0) {
                // Medium tick
                tickLen = MEDIUM_TICK_LEN;
                strokeWidth = 1.5;
            } else {
                // Minor tick
                tickLen = MINOR_TICK_LEN;
                strokeWidth = 0.8;
            }

            // Labels follow the pixel-driven interval, not the tick hierarchy,
            // so every zoom keeps several readable numbers on the strip.
            showLabel = (m % labelStep === 0);

            // Draw tick mark (from left border rightward)
            var tick = document.createElementNS(svgNS, 'line');
            tick.setAttribute('x1', scaleX);
            tick.setAttribute('y1', y);
            tick.setAttribute('x2', scaleX + tickLen);
            tick.setAttribute('y2', y);
            tick.setAttribute('stroke', '#333');
            tick.setAttribute('stroke-width', strokeWidth);
            svgContainer.appendChild(tick);

            // Draw label
            if (showLabel) {
                // Chart convention: the degree is spelled out on the degree
                // line (and once at the top of the strip); the marks between
                // carry minutes only.
                var isDegree = (m % 60 === 0);
                var isFull = isDegree || (m === anchorMin);

                var label = document.createElementNS(svgNS, 'text');
                label.setAttribute('x', LABEL_X);
                label.setAttribute('y', y + 3);
                label.setAttribute('text-anchor', 'start');
                label.setAttribute('font-size', isDegree ? '10' : (isFull ? '9' : '8.5'));
                label.setAttribute('font-family', 'Arial, sans-serif');
                label.setAttribute('font-weight', isFull ? 'bold' : 'normal');
                label.setAttribute('fill', '#222');
                label.textContent = isFull ? formatLatLabel(m) : formatMinuteLabel(m);
                addHalo(label);
                svgContainer.appendChild(label);
            }
        }

    }

    /**
     * Draw alternating black/white bands between minor tick intervals
     * (classic nautical chart pattern for easy divider reading).
     */
    function drawBands(refLon, startMin, endMin, config, scaleX, mapH) {
        var bandMin = config.bandMinutes;
        var bandStart = Math.floor(startMin / bandMin) * bandMin;
        var toggle = ((bandStart / bandMin) % 2 === 0);

        for (var m = bandStart; m < endMin; m += bandMin) {
            var lat1 = m / 60;
            var lat2 = (m + bandMin) / 60;

            var p1 = map.latLngToContainerPoint([lat1, refLon]);
            var p2 = map.latLngToContainerPoint([lat2, refLon]);

            var y1 = Math.min(p1.y, p2.y);
            var y2 = Math.max(p1.y, p2.y);
            var h = y2 - y1;

            // Clip to viewport
            if (y2 < 0 || y1 > mapH) {
                toggle = !toggle;
                continue;
            }

            var clippedY = Math.max(y1, 0);
            var clippedH = Math.min(y2, mapH) - clippedY;

            if (clippedH > 0) {
                var band = document.createElementNS(svgNS, 'rect');
                band.setAttribute('x', scaleX + 1);
                band.setAttribute('y', clippedY);
                band.setAttribute('width', BAND_WIDTH);
                band.setAttribute('height', clippedH);
                band.setAttribute('fill', toggle ? '#333' : '#fff');
                band.setAttribute('stroke', '#333');
                band.setAttribute('stroke-width', '0.5');
                svgContainer.appendChild(band);
            }

            toggle = !toggle;
        }
    }

    /**
     * Create the SVG container and attach it to the map.
     */
    function createContainer() {
        var mapContainer = map.getContainer();
        var size = map.getSize();

        svgContainer = document.createElementNS(svgNS, 'svg');
        svgContainer.setAttribute('width', SCALE_WIDTH);
        svgContainer.setAttribute('height', size.y);
        svgContainer.style.position = 'absolute';
        svgContainer.style.top = '0';
        svgContainer.style.left = LEFT_OFFSET + 'px';
        svgContainer.style.zIndex = '800';
        svgContainer.style.pointerEvents = 'none';
        svgContainer.style.overflow = 'hidden';

        mapContainer.appendChild(svgContainer);
    }

    /**
     * Global initialization function (called from main_map.js).
     */
    window.initNauticalLatitudeScale = function(leafletMap) {
        map = leafletMap;

        createContainer();
        drawScale();

        map.on('moveend', drawScale);
        map.on('zoomend', drawScale);
        map.on('resize', function() {
            var size = map.getSize();
            svgContainer.setAttribute('height', size.y);
            drawScale();
        });

        console.log('Nautical latitude scale initialized');
    };

})();
