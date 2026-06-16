/**
 * Traverse POI Calculator - Core Math
 *
 * Goal:
 *   Find the point ALONG the vessel's current course at which a Point of
 *   Interest (lighthouse, buoy, waypoint, island…) will lie exactly on the
 *   beam — i.e. abeam, at 90° to the ship's fore-and-aft axis ("na trawersie").
 *
 * Algorithm:
 *   The object is abeam precisely when the line of sight to it is perpendicular
 *   to the course. On a straight course that point is the FOOT OF THE
 *   PERPENDICULAR dropped from the object onto the course line through the
 *   vessel. So:
 *     1. Express the object in a local flat frame (E, N in NM) centred on the
 *        vessel, via mid-latitude plane sailing (same convention as fix_core).
 *     2. Course unit vector u = (sin K, cos K) in (East, North).
 *        Along-track distance to the traverse point: d = O·u = E·sinK + N·cosK.
 *        (d < 0 ⇒ the object is already abaft the beam — traverse point astern.)
 *     3. Cross-track distance c = O·r where r = (cosK, −sinK) is the starboard
 *        normal. |c| is the beam (closest-approach) distance to the object;
 *        sign of c gives the side: c > 0 ⇒ starboard, c < 0 ⇒ port.
 *     4. Traverse point = vessel + d·u, converted back to lat/lon.
 *
 *   Fully analytical — no plotting. Standalone: no DR/Fix dependency.
 */
(function() {
    'use strict';

    window.TravPOI = window.TravPOI || {};

    function normalize(angle) {
        angle = angle % 360;
        if (angle < 0) angle += 360;
        return angle;
    }

    /**
     * Parse a coordinate input string. Accepts decimal ("54.5") or
     * nautical ("54°22.5'N"). Returns a number or NaN.
     */
    window.TravPOI.parseCoord = function(input) {
        if (typeof input === 'number') return input;
        if (typeof input !== 'string') return NaN;
        const s = input.trim();
        if (s === '') return NaN;
        if (s.includes('°') || s.includes("'")) {
            return typeof nauticalToDecimal === 'function' ? nauticalToDecimal(s) : NaN;
        }
        return parseFloat(s);
    };

    /**
     * Format a duration in hours as "Hh MMm" (and total minutes).
     */
    function formatDuration(hours) {
        const totalMin = hours * 60;
        const h = Math.floor(totalMin / 60);
        const m = Math.round(totalMin - h * 60);
        if (h <= 0) return `${m} min`;
        return `${h} h ${m.toString().padStart(2, '0')} min`;
    }

    /**
     * Compute the traverse (abeam) point for a POI on the current course.
     *
     * @param {Object} input
     *   shipLat, shipLon : current vessel position (decimal degrees, required)
     *   poiLat, poiLon   : Point of Interest position (decimal degrees, required)
     *   course           : true course Kdd, 0-359° (required)
     *   speed            : speed over ground in knots (optional, > 0)
     *
     * @returns {Object}
     *   ok: boolean
     *   error?: string
     *   travLat, travLon      : traverse point (object abeam)
     *   course                : normalized true course
     *   alongDistance         : signed NM from vessel to traverse point along course
     *   behind                : true when the traverse point lies astern
     *   beamDistance          : NM from the course line to the object (beam/CPA distance)
     *   side                  : 'port' | 'starboard'
     *   relativeBearing       : object's bearing relative to the bow (0-360°, clockwise)
     *   timeHours, timeText   : time to reach the traverse point (only if speed given & ahead)
     *   E_PO, N_PO            : object offset from vessel in the local frame (NM)
     *   steps                 : human-readable description strings
     *   warnings              : array of warning strings
     */
    window.TravPOI.calculate = function(input) {
        const shipLat = input.shipLat;
        const shipLon = input.shipLon;
        const poiLat = input.poiLat;
        const poiLon = input.poiLon;
        const course = input.course;
        const hasSpeed = isFinite(input.speed) && input.speed > 0;
        const speed = hasSpeed ? input.speed : 0;

        if (!isFinite(shipLat) || !isFinite(shipLon)) {
            return { ok: false, error: 'Invalid vessel position' };
        }
        if (!isFinite(poiLat) || !isFinite(poiLon)) {
            return { ok: false, error: 'Invalid POI position' };
        }
        if (shipLat < -90 || shipLat > 90 || poiLat < -90 || poiLat > 90) {
            return { ok: false, error: 'Latitude must be between -90 and 90' };
        }
        if (shipLon < -180 || shipLon > 180 || poiLon < -180 || poiLon > 180) {
            return { ok: false, error: 'Longitude must be between -180 and 180' };
        }
        if (!isFinite(course) || course < 0 || course >= 360) {
            return { ok: false, error: 'Course must be 0-359°' };
        }
        if (isFinite(input.speed) && input.speed < 0) {
            return { ok: false, error: 'Speed must be ≥ 0' };
        }

        const K = normalize(course);

        // Step 1: object offset from the vessel in a local flat frame (mid-lat plane sailing)
        const meanLat = (shipLat + poiLat) / 2;
        const meanLatRad = meanLat * Math.PI / 180;
        const E_PO = (poiLon - shipLon) * 60 * Math.cos(meanLatRad);   // NM east
        const N_PO = (poiLat - shipLat) * 60;                          // NM north

        const range = Math.sqrt(E_PO * E_PO + N_PO * N_PO);
        if (range < 0.01) {
            return { ok: false, error: 'POI coincides with the vessel — no traverse point' };
        }

        // Step 2: along-track (course) and cross-track (starboard) components
        const Krad = K * Math.PI / 180;
        const sinK = Math.sin(Krad);
        const cosK = Math.cos(Krad);

        const alongDistance = E_PO * sinK + N_PO * cosK;   // signed, NM along course
        const crossTrack = E_PO * cosK - N_PO * sinK;      // signed, +stbd / −port
        const beamDistance = Math.abs(crossTrack);
        const side = crossTrack >= 0 ? 'starboard' : 'port';
        const behind = alongDistance < 0;

        // Relative bearing of the object from the bow (0 = dead ahead, clockwise)
        const relativeBearing = normalize(
            (Math.atan2(E_PO, N_PO) * 180 / Math.PI) - K
        );

        // Step 3: traverse point = vessel + alongDistance · courseUnit, back to lat/lon
        const T_E = alongDistance * sinK;
        const T_N = alongDistance * cosK;
        const travLat = shipLat + T_N / 60;
        const travMeanLatRad = ((shipLat + travLat) / 2) * Math.PI / 180;
        const travLon = shipLon + T_E / (60 * Math.cos(travMeanLatRad));

        const warnings = [];
        if (behind) {
            warnings.push(`Object is already abaft the beam — traverse point is ${Math.abs(alongDistance).toFixed(2)} NM astern`);
        }
        if (beamDistance < 0.05) {
            warnings.push('Object lies almost on the course line — it will pass close ahead, beam side is ill-defined');
        }

        // Time to reach the traverse point (only meaningful when ahead)
        let timeHours = null;
        let timeText = null;
        if (hasSpeed && !behind) {
            timeHours = alongDistance / speed;
            timeText = formatDuration(timeHours);
        }

        const sideLabel = side === 'starboard' ? 'starboard (right) beam' : 'port (left) beam';
        const steps = [
            `Course (true) Kdd ${K.toFixed(1)}°`,
            `POI from vessel: ${E_PO.toFixed(2)} NM east, ${N_PO.toFixed(2)} NM north (range ${range.toFixed(2)} NM)`,
            `Relative bearing of POI: ${relativeBearing.toFixed(1)}° → ${sideLabel}`,
            `Along-track to traverse: ${alongDistance.toFixed(2)} NM${behind ? ' (astern)' : ''}`,
            `Beam (closest-approach) distance: ${beamDistance.toFixed(2)} NM`
        ];
        if (timeText) {
            steps.push(`At ${speed.toFixed(1)} kt → ${timeText} to traverse`);
        }

        return {
            ok: true,
            travLat, travLon,
            course: K,
            alongDistance,
            behind,
            beamDistance,
            side,
            relativeBearing,
            timeHours, timeText,
            E_PO, N_PO,
            steps,
            warnings
        };
    };
})();