/**
 * Interaction state ids owned by the Observed Position tool.
 *
 * Kept in its own file so adding a tool never requires editing a shared
 * file (see core/interaction/interaction_states.js).
 */
(function() {
    'use strict';

    window.ObservedPositionStates = Object.freeze({
        PLACING: 'observedPosition.placing'
    });
})();
