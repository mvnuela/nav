/**
 * Backtrack Calculator - sidebar adapter.
 * Reads the panel, calls window.Backtrack.calculate, and renders the earlier
 * point in #btOut with a copy button beside every value.
 *
 * Writes nothing into the task form: the calculator is a side tool, and the
 * only way a number leaves it is the clipboard. That is deliberate — a row's
 * Calculate button must stay the only thing that changes a row.
 */
(function () {
    'use strict';

    const FIELDS = ['btEndLat', 'btEndLon', 'btCog', 'btCompass', 'btDeviation', 'btVariation',
                    'btLeeway', 'btDistance', 'btSpeed', 'btTime', 'btEndDate', 'btEndTime', 'btEndLog'];
    const CLEARED = ['btEndLat', 'btEndLon', 'btCog', 'btCompass', 'btDistance', 'btSpeed',
                     'btTime', 'btEndDate', 'btEndTime', 'btEndLog'];

    function init() {
        const calcBtn = document.getElementById('btCalcBtn');
        if (!calcBtn) return;   // panel not on this page

        calcBtn.addEventListener('click', run);

        const clearBtn = document.getElementById('btClearBtn');
        if (clearBtn) clearBtn.addEventListener('click', clear);

        const out = document.getElementById('btOut');
        if (out) out.addEventListener('click', onCopyClick);

        FIELDS.forEach(function (id) {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('keypress', function (e) {
                    if (e.key === 'Enter') run();
                });
            }
        });
    }

    function textOf(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }

    /** undefined for a blank field, so the core sees "not given" rather than 0. */
    function numOf(id) {
        const v = parseFloat(textOf(id));
        return Number.isFinite(v) ? v : undefined;
    }

    /**
     * A coordinate that will not parse becomes NaN rather than undefined: both
     * make the core refuse, but NaN says "you typed something wrong" while
     * undefined would say "you typed nothing".
     */
    function coordOf(id, axis) {
        const res = parseLatLon(textOf(id), axis);
        if (!res.ok) return NaN;
        return res.value === undefined ? NaN : res.value;
    }

    function esc(s) {
        return String(s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }

    /** One output line with its own copy button — each value lands in a different form field. */
    function line(label, value) {
        return '<div style="margin:2px 0;"><strong>' + esc(label) + ':</strong> ' +
               '<span style="font-family:monospace;">' + esc(value) + '</span> ' +
               '<button type="button" class="bt-copy" data-copy="' + esc(value) +
               '" title="Copy" style="border:0;background:none;cursor:pointer;">⧉</button></div>';
    }

    function run() {
        const out = document.getElementById('btOut');
        const input = {
            endLat: coordOf('btEndLat', 'lat'),
            endLon: coordOf('btEndLon', 'lon'),
            cog: numOf('btCog'),
            compass: numOf('btCompass'),
            deviation: numOf('btDeviation'),
            variation: numOf('btVariation'),
            leeway: numOf('btLeeway'),
            distance: numOf('btDistance'),
            speed: numOf('btSpeed'),
            time: numOf('btTime'),
            endDate: textOf('btEndDate'),
            endTime: textOf('btEndTime'),
            endLog: numOf('btEndLog'),
        };

        const result = Backtrack.calculate(input);
        out.style.display = 'block';

        if (!result.ok) {
            out.innerHTML = '<strong style="color:#d32f2f;">⚠ ' + esc(result.error) + '</strong>';
            return;
        }

        const pair = typeof formatCoordinatePair === 'function'
            ? formatCoordinatePair(result.startLat, result.startLon)
            : result.startLat + ', ' + result.startLon;

        const parts = ['<strong>Earlier point</strong>',
                       '<div style="font-family:monospace;margin:4px 0 8px;">' + esc(pair) + '</div>',
                       line('Latitude', result.startLat),
                       line('Longitude', result.startLon)];
        if (result.startDate) parts.push(line('Date', result.startDate));
        if (result.startTime) parts.push(line('Time', result.startTime));
        if (result.startLog !== undefined) parts.push(line('Log', result.startLog));

        const all = [result.startLat, result.startLon, result.startDate, result.startTime, result.startLog]
            .filter(function (v) { return v !== undefined; }).join('  ');
        parts.push('<div style="margin-top:6px;">' +
                   '<button type="button" class="bt-copy" data-copy="' + esc(all) +
                   '" style="cursor:pointer;">⧉ Copy all</button></div>');

        if (result.notes.length) {
            parts.push('<div style="margin-top:8px;color:#b45309;font-size:0.85em;">' +
                       result.notes.map(esc).join('<br>') + '</div>');
        }
        parts.push('<div style="margin-top:8px;font-size:0.85em;line-height:1.5;color:#555;' +
                   'border-top:1px solid #bcd;padding-top:8px;">' +
                   result.steps.map(esc).join('<br>') + '</div>');

        out.innerHTML = parts.join('');
    }

    function onCopyClick(e) {
        const btn = e.target.closest ? e.target.closest('.bt-copy') : null;
        if (!btn) return;
        const label = btn.textContent;
        copyTextToClipboard(btn.dataset.copy).then(function (ok) {
            btn.textContent = ok ? '✓' : '✕';
            setTimeout(function () { btn.textContent = label; }, 1200);
        });
    }

    function clear() {
        const out = document.getElementById('btOut');
        if (out) {
            out.innerHTML = '';
            out.style.display = 'none';
        }
        CLEARED.forEach(function (id) {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
