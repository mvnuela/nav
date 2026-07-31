/**
 * Tests for local_datetime.js — joining the track point's two time controls.
 *
 * Run with:  node --test "tests/js/*.test.js"
 *
 * The date and time are separate inputs so a new track point can inherit the
 * previous point's date with the time left blank. Everything downstream still
 * wants one wall-clock string, and that join is what these tests pin down.
 */
const { test } = require('node:test');
const assert = require('node:assert');

const { composeLocal } = require('../../nav_app/maps/static/maps/js/navigation/local_datetime.js');
const CC = require('../../nav_app/maps/static/maps/js/navigation/course_chain.js');

test('joins the two halves into one datetime-local string', () => {
    assert.strictEqual(composeLocal('2026-05-12', '14:30:00'), '2026-05-12T14:30:00');
});

test('pads a seconds-less time so the result always carries seconds', () => {
    assert.strictEqual(composeLocal('2026-05-12', '14:30'), '2026-05-12T14:30:00');
});

test('a half-filled pair is not a time at all', () => {
    assert.strictEqual(composeLocal('2026-05-12', ''), undefined);
    assert.strictEqual(composeLocal('', '14:30:00'), undefined);
    assert.strictEqual(composeLocal('2026-05-12', undefined), undefined);
    assert.strictEqual(composeLocal(undefined, undefined), undefined);
});

test('what it produces is what course_chain can read back', () => {
    const a = composeLocal('2026-05-12', '12:00:00');
    const b = composeLocal('2026-05-12', '14:30:00');
    assert.strictEqual(CC.hoursBetween(a, b), 2.5);
});

test('a half-filled pair leaves the leg without an elapsed time', () => {
    const a = composeLocal('2026-05-12', '');
    const b = composeLocal('2026-05-12', '14:30:00');
    assert.ok(Number.isNaN(CC.hoursBetween(a, b)));
});