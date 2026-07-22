/**
 * State descriptor contract for the interaction machine.
 *
 * A state is data, not logic: an `on` table mapping normalized event types to
 * handlers. A handler returns the id of the state to transition to, or nothing
 * to remain where it is. That return value IS the transition — no branching on
 * "which mode is active" happens anywhere.
 */
(function() {
    'use strict';

    /**
     * Validate and freeze a state descriptor.
     *
     * @param {Object} descriptor
     * @param {string} descriptor.id - Unique state id, e.g. 'geometry.placePoint'.
     * @param {string|null} [descriptor.tool] - Owning tool id, or null for root states.
     * @param {string} [descriptor.cursor] - CSS cursor applied while this state is current.
     * @param {boolean} [descriptor.lockMap] - Disable Leaflet map dragging while current.
     * @param {Object} [descriptor.on] - Event type ->
     *        (event, context, payload) => targetId|{to, payload}|undefined.
     * @param {string[]} [descriptor.targets] - State ids this state can transition to.
     *        Declared because handlers are functions and cannot be read statically.
     *        Validated at machine startup; best-effort, not enforced at dispatch.
     * @param {string} [descriptor.entry] - Id of the button-facing entry state of the
     *        flow this state belongs to. Defaults to the state's own id, so single-step
     *        states need not declare it. Continuation states of a multi-step flow (e.g.
     *        `divider.awaitingB`) declare their flow's first state here, so `toggle()`
     *        and `isFlowActive()` treat the whole flow as one unit rather than per-state.
     *        Validated at machine startup, same as `targets`.
     * @param {Function|null} [descriptor.onEnter] - (context, payload) => void.
     * @param {Function|null} [descriptor.onExit] - (context, payload) => void.
     *        Cancel partial work, drop previews. `payload` is what the state is
     *        leaving with, so cleanup can undo partial work built from it.
     * @returns {Object} Frozen normalized state.
     */
    window.defineState = function defineState(descriptor) {
        if (!descriptor || typeof descriptor !== 'object') {
            throw new Error('defineState: descriptor must be an object');
        }

        const id = descriptor.id;
        if (typeof id !== 'string' || id.length === 0) {
            throw new Error('defineState: id must be a non-empty string');
        }

        const tool = descriptor.tool === undefined ? null : descriptor.tool;
        if (tool !== null && typeof tool !== 'string') {
            throw new Error(`defineState(${id}): tool must be a string or null`);
        }

        const cursor = descriptor.cursor === undefined ? '' : descriptor.cursor;
        if (typeof cursor !== 'string') {
            throw new Error(`defineState(${id}): cursor must be a string`);
        }

        const lockMap = descriptor.lockMap === undefined ? false : descriptor.lockMap;
        if (typeof lockMap !== 'boolean') {
            throw new Error(`defineState(${id}): lockMap must be a boolean`);
        }

        const targets = descriptor.targets === undefined ? [] : descriptor.targets;
        if (!Array.isArray(targets)) {
            throw new Error(`defineState(${id}): targets must be an array`);
        }
        targets.forEach(function(target) {
            if (typeof target !== 'string' || target.length === 0) {
                throw new Error(`defineState(${id}): every target must be a non-empty string`);
            }
        });

        const on = descriptor.on === undefined ? {} : descriptor.on;
        if (!on || typeof on !== 'object') {
            throw new Error(`defineState(${id}): on must be an object`);
        }
        Object.keys(on).forEach(function(eventType) {
            if (!window.InteractionEvents[eventType]) {
                throw new Error(`defineState(${id}): unknown event type "${eventType}"`);
            }
            if (typeof on[eventType] !== 'function') {
                throw new Error(`defineState(${id}): handler for "${eventType}" must be a function`);
            }
        });

        ['onEnter', 'onExit'].forEach(function(hook) {
            const fn = descriptor[hook];
            if (fn !== undefined && fn !== null && typeof fn !== 'function') {
                throw new Error(`defineState(${id}): ${hook} must be a function`);
            }
        });

        const entry = descriptor.entry === undefined ? id : descriptor.entry;
        if (typeof entry !== 'string' || entry.length === 0) {
            throw new Error(`defineState(${id}): entry must be a non-empty string`);
        }

        return Object.freeze({
            id: id,
            tool: tool,
            cursor: cursor,
            lockMap: lockMap,
            targets: Object.freeze(targets.slice()),
            entry: entry,
            on: Object.freeze(Object.assign({}, on)),
            onEnter: descriptor.onEnter || null,
            onExit: descriptor.onExit || null
        });
    };
})();