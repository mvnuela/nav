/**
 * Core interaction state ids.
 *
 * Each tool owns its own state ids in its own `*_states.js`, so adding a tool
 * never requires editing a shared file. Only the root `IDLE` state lives here,
 * because every tool needs to transition back to it.
 */
(function() {
    'use strict';

    window.InteractionStates = Object.freeze({
        IDLE: 'idle'
    });
})();