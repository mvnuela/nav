/**
 * Serialises the navigation task object for download.
 *
 * DokumentacjaJSON_v1.docx section 3 requires every numeric field to carry at
 * most 4 decimal places, rounded, with fractional values padded to 4 places
 * (54.5000) and integral values written without a decimal part (95).
 * JSON.stringify drops trailing zeros, so it cannot express that; this writer
 * matches its layout — 2-space indent, insertion key order, undefined members
 * omitted — and differs only in how numbers are rendered.
 *
 * Applied on download only. buildJSON still returns a plain object, so schema
 * validation is unaffected.
 */
(function (global) {
    'use strict';

    function formatNumber(n) {
        if (!Number.isFinite(n)) return 'null';        // JSON has no NaN or Infinity
        const rounded = Math.round(n * 10000) / 10000;
        // String(-0) is "0", so negative zero cannot leak through.
        return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(4);
    }

    function write(value, indent) {
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'number') return formatNumber(value);
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'string') return JSON.stringify(value);

        const pad = ' '.repeat(indent);
        const padInner = ' '.repeat(indent + 2);

        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            const items = value.map(function (v) { return padInner + write(v, indent + 2); });
            return '[\n' + items.join(',\n') + '\n' + pad + ']';
        }

        const keys = Object.keys(value).filter(function (k) { return value[k] !== undefined; });
        if (keys.length === 0) return '{}';
        const entries = keys.map(function (k) {
            return padInner + JSON.stringify(k) + ': ' + write(value[k], indent + 2);
        });
        return '{\n' + entries.join(',\n') + '\n' + pad + '}';
    }

    function formatTaskJSON(value) {
        return write(value, 0);
    }

    const TaskJSON = { formatTaskJSON: formatTaskJSON };
    global.TaskJSON = TaskJSON;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TaskJSON;
    }
})(typeof window !== 'undefined' ? window : globalThis);
