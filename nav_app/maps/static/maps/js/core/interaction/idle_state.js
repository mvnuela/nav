/**
 * The root interaction state.
 *
 * Idle is not empty. Two kinds of interaction exist and only one is exclusive:
 * arming a tool to place something new (exclusive, governed by placement states)
 * and manipulating something already placed (must work with no tool armed).
 *
 * The second lives here: idle routes FEATURE_DOWN to whichever drag state the
 * feature itself declares. That is data-driven, so adding a draggable feature
 * type adds no branching. It also means a drag cannot begin while a placement
 * mode is armed, because the machine is not in idle.
 */
(function() {
    'use strict';

    window.createIdleState = function createIdleState() {
        return window.defineState({
            id: window.InteractionStates.IDLE,
            tool: null,
            cursor: '',
            lockMap: false,
            // Intentionally empty: idle can reach any tool state via button-driven
            // transitionTo, and its FEATURE_DOWN target is computed from the feature.
            // Enumerating tool states here would recreate the central coupling this
            // design removes. See the spec's note on best-effort target validation.
            targets: [],
            on: {
                // Returning the bare dragState id means the drag state is
                // entered with the triggering FEATURE_DOWN event as its
                // payload (see InteractionMachine#dispatch), so the drag
                // state's handlers can read event.feature via getPayload()
                // without it ever touching shared context.
                FEATURE_DOWN: function(event) {
                    return event && event.feature ? event.feature.dragState : undefined;
                }
            }
        });
    };
})();