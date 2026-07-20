/**
 * Interaction state ids owned by the Plotting Triangles tool.
 *
 * Kept in its own file so adding a tool never requires editing a shared
 * file (see core/interaction/interaction_states.js).
 *
 * One state: the align-to-point flow is a single click after arming (the
 * triangle to align is chosen beforehand from the toolbar dropdown, not by
 * tapping it on the map), so there is no multi-step sequence to model.
 */
(function() {
    'use strict';

    window.TriangleStates = Object.freeze({
        ALIGN_PICK_POINT: 'triangleAlign.pickPoint'
    });
})();
