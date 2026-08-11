/**
 * Nautical Longitude Scale (Horizontal)
 *
 * Companion to the latitude scale, placed along the TOP edge of the map.
 * Reads out longitude only — unlike latitude, 1' of longitude is not 1 NM
 * (it shrinks with cos(latitude)), so this strip deliberately has no
 * alternating black/white blocks: nothing here may be stepped off with
 * dividers as a distance.
 *
 * Uses Leaflet's built-in projection (latLngToContainerPoint) for
 * Mercator-correct positioning.
 */

(function() {
    'use strict';

    var map = null;
    var svgContainer = null;
    var svgNS = 'http://www.w3.org/2000/svg';

    // Layout constants
    var SCALE_HEIGHT = 34;
    var TOP_OFFSET = 4;
    // The left margin yields the top-left corner to the latitude scale, which
    // runs the full height of the map. To the right the strip goes all the way
    // to the corner; the control stack is pushed below it in sea_map.css so
    // nothing covers the eastern labels.
    var LEFT_MARGIN = 68;
    var RIGHT_MARGIN = 0;

    // Ticks are anchored to the top border and grow downward; labels sit below
    // the longest tick.
    var TICK_BASE_Y = 1;
    var MAJOR_TICK_LEN = 13;
    var MEDIUM_TICK_LEN = 9;
    var MINOR_TICK_LEN = 6;

    var LABEL_Y = TICK_BASE_Y + MAJOR_TICK_LEN + 11;

    // Horizontal text is wide, so labels need far more room than on the
    // latitude strip before the next one may appear.
    var MIN_LABEL_PX = 62;
    // Smallest gap between tick marks.
    var MIN_TICK_PX = 6;
    // Half a label's width: how far from either end of the strip a label must
    // stay to survive the clip.
    var LABEL_INSET = 28;

    // Intervals in arc-minutes, finest first.
    var STEPS = [1, 2, 5, 10, 15, 20, 30, 60, 120, 300, 600, 1800];

    /**
     * Give text a white outline so it stays readable over the chart.
     */
    function addHalo(textEl) {
        textEl.setAttribute('stroke', '#fff');
        textEl.setAttribute('stroke-width', '2.5');
        textEl.setAttribute('stroke-linejoin', 'round');
        textEl.setAttribute('paint-order', 'stroke');
    }

    /**
     * Finest interval from STEPS whose spacing reaches minPx, optionally
     * constrained to multiples of `base` so labels land on drawn ticks.
     */
    function pickStep(pxPerMin, minPx, base) {
        for (var i = 0; i < STEPS.length; i++) {
            var step = STEPS[i];
            if (base) {
                if (step < base || step % base !== 0) continue;
            }
            if (step * pxPerMin >= minPx) return step;
        }
        return STEPS[STEPS.length - 1];
    }

    /**
     * Fold a longitude in arc-minutes into the -180..180 range so the world
     * copies either side of the date line still label correctly.
     */
    function normalizeMinutes(minutesTotal) {
        var m = minutesTotal;
        while (m > 180 * 60) m -= 360 * 60;
        while (m < -180 * 60) m += 360 * 60;
        return m;
    }

    /**
     * Degrees padded to three digits, as on a printed chart (018°, 007°).
     */
    function padDegrees(deg) {
        var s = String(deg);
        while (s.length < 3) s = '0' + s;
        return s;
    }

    /**
     * Full label, e.g. 018°12'E. The prime meridian and the date line carry no
     * hemisphere letter.
     */
    function formatLonLabel(minutesTotal) {
        var m = normalizeMinutes(minutesTotal);
        var absMin = Math.abs(m);
        var deg = Math.floor(absMin / 60);
        var min = absMin % 60;
        var hemisphere = '';
        if (m > 0 && absMin < 180 * 60) hemisphere = 'E';
        else if (m < 0) hemisphere = 'W';

        if (min === 0) {
            return padDegrees(deg) + '°' + hemisphere;
        }
        return padDegrees(deg) + '°' + min + '′' + hemisphere;
    }

    /**
     * Short form used between the full labels: minutes only, e.g. 12'.
     */
    function formatMinuteLabel(minutesTotal) {
        var absMin = Math.abs(normalizeMinutes(minutesTotal));
        return (absMin % 60) + '′';
    }

    /**
     * Build and render the full scale into the SVG.
     */
    function drawScale() {
        if (!map || !svgContainer) return;

        while (svgContainer.firstChild) {
            svgContainer.removeChild(svgContainer.firstChild);
        }

        var size = map.getSize();
        var scaleW = Math.max(0, size.x - LEFT_MARGIN - RIGHT_MARGIN);
        svgContainer.setAttribute('width', scaleW);
        if (scaleW === 0) return;

        var bounds = map.getBounds();

        // Reference latitude: top edge of the map. In Mercator the x of a
        // meridian does not depend on latitude, so any row would do.
        var refLat = bounds.getNorth();

        // Longitude range in total arc-minutes, taken from the strip's own
        // extent rather than the map's so ticks are not computed for the
        // margins we do not draw.
        var westLon = map.containerPointToLatLng([LEFT_MARGIN, 0]).lng;
        var eastLon = map.containerPointToLatLng([LEFT_MARGIN + scaleW, 0]).lng;
        var westMin = Math.floor(westLon * 60);
        var eastMin = Math.ceil(eastLon * 60);

        // Horizontal pixels per arc-minute. Measured over a whole degree
        // because latLngToContainerPoint rounds to integer pixels, which would
        // collapse a single-minute probe to 0 px at low zooms.
        var refLon = (westLon + eastLon) / 2;
        var pa = map.latLngToContainerPoint([refLat, refLon]);
        var pb = map.latLngToContainerPoint([refLat, refLon + 1]);
        var pxPerMin = Math.abs(pb.x - pa.x) / 60;
        if (!pxPerMin) return;

        var tickStep = pickStep(pxPerMin, MIN_TICK_PX, null);
        var labelStep = pickStep(pxPerMin, MIN_LABEL_PX, tickStep);

        var majorStep = Math.max(60, labelStep);

        var startMin = Math.floor(westMin / tickStep) * tickStep;
        var endMin = Math.ceil(eastMin / tickStep) * tickStep;

        // Draw the border line the ticks hang from
        var borderLine = document.createElementNS(svgNS, 'line');
        borderLine.setAttribute('x1', 0);
        borderLine.setAttribute('y1', TICK_BASE_Y);
        borderLine.setAttribute('x2', scaleW);
        borderLine.setAttribute('y2', TICK_BASE_Y);
        borderLine.setAttribute('stroke', '#333');
        borderLine.setAttribute('stroke-width', '1.5');
        svgContainer.appendChild(borderLine);

        // Westernmost labelled meridian on screen. It always carries the full
        // degree/minute form, so a view narrower than one degree still states
        // which degree it is in.
        var anchorMin = null;
        for (var am = startMin; am <= endMin; am += tickStep) {
            if (am % labelStep !== 0) continue;
            var aX = map.latLngToContainerPoint([refLat, am / 60]).x - LEFT_MARGIN;
            if (aX >= LABEL_INSET && aX <= scaleW - LABEL_INSET) {
                anchorMin = am;
                break;
            }
        }

        for (var m = startMin; m <= endMin; m += tickStep) {
            var pt = map.latLngToContainerPoint([refLat, m / 60]);
            var x = pt.x - LEFT_MARGIN;

            if (x < -10 || x > scaleW + 10) continue;

            var tickLen;
            var strokeWidth;

            // Degrees are the major marks, but only while the strip is
            // resolving minutes: zoomed right out every tick lands on a whole
            // degree, and marking them all major turns the strip into a comb.
            if (m % majorStep === 0) {
                tickLen = MAJOR_TICK_LEN;
                strokeWidth = 2;
            } else if (m % labelStep === 0 || (labelStep < 10 && m % 10 === 0)) {
                tickLen = MEDIUM_TICK_LEN;
                strokeWidth = 1.5;
            } else {
                tickLen = MINOR_TICK_LEN;
                strokeWidth = 0.8;
            }

            var tick = document.createElementNS(svgNS, 'line');
            tick.setAttribute('x1', x);
            tick.setAttribute('y1', TICK_BASE_Y);
            tick.setAttribute('x2', x);
            tick.setAttribute('y2', TICK_BASE_Y + tickLen);
            tick.setAttribute('stroke', '#333');
            tick.setAttribute('stroke-width', strokeWidth);
            svgContainer.appendChild(tick);

            // Labels are centred on their tick, so one closer than LABEL_INSET
            // to either end would be cut off by the strip's clip.
            if (m % labelStep !== 0) continue;
            if (x < LABEL_INSET || x > scaleW - LABEL_INSET) continue;

            // Chart convention: the degree is spelled out on the degree
            // meridian (and once at the left of the strip); the marks between
            // carry minutes only.
            var isDegree = (m % 60 === 0);
            var isFull = isDegree || (m === anchorMin);

            var label = document.createElementNS(svgNS, 'text');
            label.setAttribute('x', x);
            label.setAttribute('y', LABEL_Y);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('font-size', isDegree ? '10' : (isFull ? '9' : '8.5'));
            label.setAttribute('font-family', 'Arial, sans-serif');
            label.setAttribute('font-weight', isFull ? 'bold' : 'normal');
            label.setAttribute('fill', '#222');
            label.textContent = isFull ? formatLonLabel(m) : formatMinuteLabel(m);
            addHalo(label);
            svgContainer.appendChild(label);
        }
    }

    /**
     * Create the SVG container and attach it to the map.
     */
    function createContainer() {
        var mapContainer = map.getContainer();
        var size = map.getSize();

        svgContainer = document.createElementNS(svgNS, 'svg');
        svgContainer.setAttribute('width', Math.max(0, size.x - LEFT_MARGIN - RIGHT_MARGIN));
        svgContainer.setAttribute('height', SCALE_HEIGHT);
        svgContainer.style.position = 'absolute';
        svgContainer.style.top = TOP_OFFSET + 'px';
        svgContainer.style.left = LEFT_MARGIN + 'px';
        svgContainer.style.zIndex = '800';
        svgContainer.style.pointerEvents = 'none';
        svgContainer.style.overflow = 'hidden';

        mapContainer.appendChild(svgContainer);
    }

    /**
     * Global initialization function (called from main_map.js).
     */
    window.initNauticalLongitudeScale = function(leafletMap) {
        map = leafletMap;

        createContainer();
        drawScale();

        map.on('moveend', drawScale);
        map.on('zoomend', drawScale);
        map.on('resize', drawScale);

        console.log('Nautical longitude scale initialized');
    };

})();