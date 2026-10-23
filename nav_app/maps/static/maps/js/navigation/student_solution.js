/**
 * Pure logic of the student solution form: turns the values of the form's
 * fields into the student solution file and names the file.
 *
 * The result must validate against the lenient student schema
 * (maps/student_schema.py): only the row id is required, empty fields are left
 * out entirely (not null), and the file carries no student name or login.
 * No DOM access here, so it can be tested in Node.
 */
(function (global) {
    'use strict';

    const composeLocal = (typeof module !== 'undefined' && module.exports)
        ? require('./local_datetime.js').composeLocal
        : global.composeLocal;

    const POI_TEXT = ['name', 'type', 'description'];
    const TRK_NUMBERS = ['distance_nm', 'log_nm', 'course_compass_deg', 'course_true_deg',
        'course_over_ground_deg', 'wind_true_deg', 'wind_true_speed', 'wind_app_deg',
        'wind_app_speed', 'speed_kn'];

    function blank(v) {
        return v === undefined || v === null || String(v).trim() === '';
    }

    /** `<prefix>_task-<id>.json`; an empty prefix means the student's login. */
    function studentFilename(prefix, login, taskId) {
        function clean(s) {
            return String(s === undefined || s === null ? '' : s).trim()
                .replace(/\.json$/i, '')
                .replace(/[^\p{L}\p{N}._-]+/gu, '_')
                .replace(/^_+|_+$/g, '');
        }
        const base = clean(prefix) || clean(login);
        return base + '_task-' + taskId + '.json';
    }

    function assembleStudentSolution(input) {
        const warnings = [];

        const poi = input.poiRows.map(function (row, i) {
            const out = { id: 'poi-' + (i + 1) };
            POI_TEXT.forEach(function (k) { if (!blank(row[k])) out[k] = row[k]; });
            if (!blank(row.lat)) out.lat = Number(row.lat);
            if (!blank(row.lon)) out.lon = Number(row.lon);
            return out;
        });

        const trk = input.trkRows.map(function (row, i) {
            const out = { id: 'trk-' + (i + 1) };

            const hasDate = !blank(row.date);
            const hasTime = !blank(row.time);
            if (hasDate && hasTime) {
                out.time = composeLocal(row.date, row.time) + (input.tzOffset || 'Z');
            } else if (hasDate || hasTime) {
                warnings.push('Track point #' + (i + 1) + ': the ' + (hasDate ? 'time' : 'date') +
                    ' is missing, so the date and time were left out.');
            }

            const hasLat = !blank(row.lat);
            const hasLon = !blank(row.lon);
            if (hasLat || hasLon) {
                const position = {};
                if (hasLat) position.lat = Number(row.lat);
                if (hasLon) position.lon = Number(row.lon);
                if (hasLat && hasLon && !blank(row.position_txt)) position.position_txt = row.position_txt;
                out.position = position;
            }

            TRK_NUMBERS.forEach(function (k) { if (!blank(row[k])) out[k] = Number(row[k]); });
            return out;
        });

        return {
            data: {
                task_id: input.taskId,
                task_title: input.taskTitle,
                poi: poi,
                solution: { trk: trk, comment: blank(input.comment) ? null : input.comment },
            },
            warnings: warnings,
        };
    }

    const StudentSolution = {
        studentFilename: studentFilename,
        assembleStudentSolution: assembleStudentSolution,
    };
    global.StudentSolution = StudentSolution;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = StudentSolution;
    }
})(typeof window !== 'undefined' ? window : globalThis);
