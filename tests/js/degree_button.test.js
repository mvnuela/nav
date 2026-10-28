/**
 * Tests for the text edit behind the "°" button in degree_button.js.
 *
 * Run with:  node --test tests/js/*.test.js
 *
 * Students on Windows have no easy way to type a degree sign, so coordinate
 * fields get a button that inserts one at the caret. The edit is pure — text
 * plus selection in, text plus caret out — so it is tested here; the button
 * wiring is checked in the browser.
 */
const { test } = require('node:test');
const assert = require('node:assert');

const {
    insertAtCaret,
} = require('../../nav_app/maps/static/maps/js/core/degree_button.js');

test('inserts into an empty field', () => {
    assert.deepStrictEqual(insertAtCaret('', 0, 0, '°'), { value: '°', caret: 1 });
});

test('inserts at the caret, not at the end', () => {
    // "54|22.5'N" -> the student typed the degrees, then the minutes, then
    // clicked back after "54".
    assert.deepStrictEqual(
        insertAtCaret("5422.5'N", 2, 2, '°'),
        { value: "54°22.5'N", caret: 3 },
    );
});

test('appends after what was typed so far', () => {
    assert.deepStrictEqual(insertAtCaret('54', 2, 2, '°'), { value: '54°', caret: 3 });
});

test('replaces a selection', () => {
    // A space the student used in place of the sign, selected and replaced.
    assert.deepStrictEqual(
        insertAtCaret('54 22.5N', 2, 3, '°'),
        { value: '54°22.5N', caret: 3 },
    );
});

test('treats a missing selection as the end of the text', () => {
    // An input that never had focus can report null selection offsets.
    assert.deepStrictEqual(insertAtCaret('54', null, null, '°'), { value: '54°', caret: 3 });
});
