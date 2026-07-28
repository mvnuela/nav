/**
 * Angular unit conversions shared by the navigation task form and the task
 * panel.
 *
 * Charts state angular rates in minutes ("8' annually") while the task JSON
 * stores degrees, so values cross that boundary in both directions: minutes in
 * on entry, degrees back out for display. Both conversions are exact — rounding
 * is deliberately left to roundTo, because the precision wanted when storing a
 * value (the schema's 0.0001°) is not the precision wanted when showing it.
 *
 * Loaded as a plain script; also exported for `node --test tests/js/`.
 */

/**
 * @param {number} minutes Angle in minutes of arc.
 * @returns {number} The same angle in degrees, unrounded.
 */
function minutesToDegrees(minutes) {
    return minutes / 60;
}

/**
 * @param {number} degrees Angle in degrees.
 * @returns {number} The same angle in minutes of arc, unrounded.
 */
function degreesToMinutes(degrees) {
    return degrees * 60;
}

/**
 * @param {number} value Number to round.
 * @param {number} decimals How many decimal places to keep.
 * @returns {number} The value rounded to that many decimals.
 */
function roundTo(value, decimals) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { minutesToDegrees, degreesToMinutes, roundTo };
}