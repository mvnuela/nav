/**
 * Normalized interaction event vocabulary.
 *
 * The router emits these; states respond to them via their `on` table.
 * Values are identical to keys so that a mistyped constant is visible in
 * error messages rather than appearing as an opaque code.
 */
(function() {
    'use strict';

    window.InteractionEvents = Object.freeze({
        POINTER_DOWN: 'POINTER_DOWN',
        POINTER_MOVE: 'POINTER_MOVE',
        POINTER_UP:   'POINTER_UP',
        FEATURE_DOWN: 'FEATURE_DOWN',
        TAP:          'TAP',
        ESCAPE:       'ESCAPE'
    });
})();