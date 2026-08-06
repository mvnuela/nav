/**
 * The track point's date and time are two separate controls so that adding a
 * point can inherit the previous date without inventing a time. Everything
 * downstream — course_chain.hoursBetween(), the year the variation drift is
 * measured from, the exported ISO timestamp — still wants a single wall-clock
 * string, and this is the one place the two halves are put back together.
 *
 * @param {string} date "YYYY-MM-DD" from the date input.
 * @param {string} time "HH:MM" or "HH:MM:SS" from the time input.
 * @returns {string|undefined} "YYYY-MM-DDTHH:MM:SS", or undefined unless both
 *   halves are filled in — a point with only one of them has no time yet.
 */
function composeLocal(date, time) {
    if (!date || !time) return undefined;
    const withSeconds = time.length === 5 ? `${time}:00` : time;
    return `${date}T${withSeconds}`;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { composeLocal };
}