/**
 * Coordinate entry for the navigation task form's latitude/longitude fields.
 *
 * The inputs accept two notations — decimal degrees ("54.375") and nautical
 * ("54°22.5'N"), both with a dot or a comma as the decimal separator — but the
 * form and the exported JSON only ever hold decimal. parseLatLon is the single
 * gate between what a teacher types and that canonical decimal: notation work
 * is delegated to the shared nauticalToDecimal, and this module adds the rules
 * that need to know *which* field the text was typed into (hemisphere/axis
 * match, range) plus the schema's 4-decimal rounding.
 *
 * Loaded as a plain script; also exported for `node --test tests/js/`.
 */

const COORD_AXIS = {
    lat: {
        name: 'latitude',
        limit: 90,
        example: "54.375 or 54°22.5'N",
        wrongHemi: 'EW',
        wrongHemiError: 'E/W hemisphere in a latitude field',
    },
    lon: {
        name: 'longitude',
        limit: 180,
        example: "18.5 or 018°34.2'E",
        wrongHemi: 'NS',
        wrongHemiError: 'N/S hemisphere in a longitude field',
    },
};

/** Browser: the graticule_formatter global. node --test: the module. */
function coordToDecimal(s) {
    if (typeof nauticalToDecimal === 'function') return nauticalToDecimal(s);
    return require('../graticule/graticule_formatter.js').nauticalToDecimal(s);
}

/**
 * Parse one coordinate field's text.
 *
 * @param {string} text What the teacher typed.
 * @param {'lat'|'lon'} axis Which field it was typed into.
 * @returns {{ok: true, value: number|undefined}|{ok: false, error: string}}
 *   value is undefined for blank input — whether the field may stay blank is
 *   the schema's decision, not this parser's. On error the caller keeps the
 *   typed text; the message is meant for the field's hint line.
 */
function parseLatLon(text, axis) {
    const spec = COORD_AXIS[axis];
    // A data-coord typo must flag the field, not throw and kill the caller's whole click handler.
    if (!spec) return { ok: false, error: `unknown coordinate axis "${axis}"` };
    const raw = String(text ?? '').trim();
    if (raw === '') return { ok: true, value: undefined };

    const value = coordToDecimal(raw);
    if (Number.isNaN(value)) {
        return { ok: false, error: `not a coordinate — try ${spec.example}` };
    }

    // nauticalToDecimal only accepts a hemisphere at either end, so after a
    // successful parse the ends are the only places one can be. Flagged, not
    // coerced: lat and lon pasted in swapped order should not become a
    // plausible-looking position.
    const up = raw.toUpperCase();
    const hemi = ['NSEW'.includes(up[0]) ? up[0] : '',
                  'NSEW'.includes(up[up.length - 1]) ? up[up.length - 1] : '']
        .find(Boolean) || '';
    if (hemi && spec.wrongHemi.includes(hemi)) {
        return { ok: false, error: spec.wrongHemiError };
    }

    if (value < -spec.limit || value > spec.limit) {
        return { ok: false, error: `${spec.name} must be between -${spec.limit} and ${spec.limit}` };
    }

    // The schema stores multipleOf 0.0001; the rewritten field must agree.
    return { ok: true, value: Math.round(value * 10000) / 10000 };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseLatLon };
}
