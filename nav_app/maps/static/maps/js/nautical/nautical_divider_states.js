/**
 * Interaction state ids owned by the Nautical Divider tool.
 *
 * Kept in its own file so adding a tool never requires editing a shared
 * file (see core/interaction/interaction_states.js).
 *
 * One state, not two: the design spec sketched divider.awaitingA ->
 * divider.awaitingB, but NauticalDividerManager already tracks which end it
 * is on internally via placementPointA, so a single PLACING state gives the
 * same exclusivity and cancel behaviour with far less machinery.
 */
(function() {
    'use strict';

    window.DividerStates = Object.freeze({
        PLACING: 'divider.placing'
    });
})();
