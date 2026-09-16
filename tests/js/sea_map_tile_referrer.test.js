/**
 * Tests for the Referer header on the OpenStreetMap / OpenSeaMap tile requests.
 *
 * Run with:  node --test tests/js/sea_map_tile_referrer.test.js
 *
 * Background: Django's SecurityMiddleware sends `Referrer-Policy: same-origin`
 * (its default since Django 3.1), which strips the Referer from the
 * cross-origin tile requests. OSM's tile servers answer a request without a
 * Referer with their "403 Access blocked" placeholder image instead of the
 * tile, so the whole sea map renders as a wall of "Access blocked" panels.
 *
 * Leaflet 1.7+ takes a per-tile `referrerPolicy` option and applies it to the
 * <img> before setting `src`, which is the narrow fix: only the tile images
 * send the origin, every other request on the page keeps the strict policy.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = path.join(
    __dirname,
    '../../nav_app/maps/static/maps/js/core/main_map.js'
);

/**
 * main_map.js is an IIFE that registers a DOMContentLoaded handler and then
 * exports its tile-layer factory. Evaluate the real file with just enough of a
 * stub environment for that to happen, and record every L.tileLayer call so
 * the assertions run against the options the shipped code actually passes.
 */
function loadTileLayers() {
    const calls = [];
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        document: { addEventListener() {}, querySelector: () => null },
        window: {},
        module: { exports: {} },
        L: {
            tileLayer(url, options) {
                calls.push({ url, options });
                return { addTo() { return this; } };
            }
        }
    };
    sandbox.window.window = sandbox.window;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(SRC, 'utf8'), sandbox, { filename: SRC });

    const { createTileLayers } = sandbox.module.exports;
    assert.strictEqual(
        typeof createTileLayers,
        'function',
        'main_map.js must export createTileLayers() so the tile options are testable'
    );
    createTileLayers();
    return calls;
}

test('the OpenStreetMap base layer asks for a referrer policy that still sends the origin', () => {
    const osm = loadTileLayers().find(c => c.url.includes('tile.openstreetmap.org'));

    assert.ok(osm, 'an OpenStreetMap base layer must be created');
    assert.strictEqual(
        osm.options.referrerPolicy,
        'strict-origin-when-cross-origin',
        'without this, Django\'s same-origin policy strips the Referer and OSM ' +
        'serves its "403 Access blocked" tile instead of the map'
    );
});

test('the OpenSeaMap seamark overlay asks for the same referrer policy', () => {
    const seamark = loadTileLayers().find(c => c.url.includes('openseamap.org'));

    assert.ok(seamark, 'an OpenSeaMap seamark overlay must be created');
    assert.strictEqual(
        seamark.options.referrerPolicy,
        'strict-origin-when-cross-origin'
    );
});

test('no tile layer is left on a policy that sends no Referer at all', () => {
    for (const { url, options } of loadTileLayers()) {
        assert.ok(
            options.referrerPolicy && options.referrerPolicy !== 'no-referrer',
            `tile layer ${url} would be served the "Access blocked" placeholder`
        );
    }
});
