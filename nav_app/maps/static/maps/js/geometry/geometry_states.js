/**
 * Interaction state ids owned by the Geometry tool.
 *
 * Kept in its own file so adding a tool never requires editing a shared
 * file (see core/interaction/interaction_states.js).
 */
(function() {
    'use strict';

    window.GeometryStates = Object.freeze({
        PLACE_POINT: 'geometry.placePoint',
        CONNECT:     'geometry.connect',
        RAY:         'geometry.ray',
        DELETE:      'geometry.delete'
    });
})();
