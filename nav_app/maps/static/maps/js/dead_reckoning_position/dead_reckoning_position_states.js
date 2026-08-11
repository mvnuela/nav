/**
 * Interaction state ids owned by the Dead Reckoning Position tool.
 *
 * Kept in its own file so adding a tool never requires editing a shared
 * file (see core/interaction/interaction_states.js).
 */
(function() {
    'use strict';

    window.DeadReckoningStates = Object.freeze({
        PLACING: 'deadReckoningPosition.placing'
    });
})();
