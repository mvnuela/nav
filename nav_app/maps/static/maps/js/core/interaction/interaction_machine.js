/**
 * The interaction state machine.
 *
 * Holds exactly one current state, so two placement modes cannot be armed at
 * once — simultaneous placement is unrepresentable rather than defended against.
 *
 * Dispatch is a table lookup, never a branch on "which mode is active".
 * Adding a new tool adds zero conditionals here.
 */
(function() {
    'use strict';

    class InteractionMachine {
        /**
         * @param {Object} context - Passed to every handler and lifecycle hook.
         *        Tools put their public API on it (e.g. context.geometry).
         */
        constructor(context) {
            this.context = context || {};
            this.states = new Map();
            this.tools = new Map();
            this.listeners = new Set();
            this.current = null;
            this.adapter = null;
            // The payload the current state was entered with. Travels with a
            // transition and lives for the whole time that state is current —
            // not just at onEnter — so e.g. a two-step flow can carry data
            // (a first tapped point, a dragged feature) without stashing it
            // on `context`, which would be module state under a new name.
            this.payload = undefined;
        }

        /**
         * @param {{setCursor: Function, setMapLocked: Function}} adapter
         *        View-specific presentation. Keeps Leaflet out of the machine.
         */
        setAdapter(adapter) {
            this.adapter = adapter;
            return this;
        }

        /**
         * @param {string} toolId
         * @param {{onDeactivate?: Function}} handlers - Tool-wide teardown, fired
         *        once when the machine leaves this tool for a different one.
         */
        registerTool(toolId, handlers) {
            this.tools.set(toolId, handlers || {});
            return this;
        }

        register(state) {
            if (this.states.has(state.id)) {
                throw new Error(`Duplicate state id: ${state.id}`);
            }
            this.states.set(state.id, state);
            return this;
        }

        /**
         * Validate the declared state graph, then enter the initial state.
         * Validation runs here rather than in register() so that states may be
         * registered in any order.
         */
        start(initialId) {
            this.states.forEach((state) => {
                state.targets.forEach((target) => {
                    if (!this.states.has(target)) {
                        throw new Error(
                            `State "${state.id}" declares unknown target "${target}"`
                        );
                    }
                });
                if (!this.states.has(state.entry)) {
                    throw new Error(
                        `State "${state.id}" declares unknown entry "${state.entry}"`
                    );
                }
            });

            const initial = this.states.get(initialId);
            if (!initial) {
                throw new Error(`Unknown interaction state: ${initialId}`);
            }

            this.current = initial;
            this.payload = undefined;
            this.applyPresentation(initial);
            if (initial.onEnter) initial.onEnter(this.context, this.payload);
            this.notify();
            return this;
        }

        dispatch(event) {
            if (!this.current) return;
            const handler = this.current.on[event.type];
            if (!handler) return;
            const next = handler(event, this.context, this.payload);
            if (!next) return;
            if (typeof next === 'string') {
                // Bare id: the payload defaults to the triggering event itself,
                // so e.g. idle's FEATURE_DOWN handler carries `event.feature`
                // into the drag state without any extra plumbing.
                this.transitionTo(next, event);
            } else {
                this.transitionTo(next.to, next.payload);
            }
        }

        /**
         * @param {string} id
         * @param {*} [payload] - Carried into the target state; readable via
         *        getPayload() for the target state's whole lifetime. Defaults to
         *        undefined, which clears any previous payload so a stale value
         *        (e.g. a leftover pendingFirstPointId) can never leak into an
         *        unrelated later state.
         */
        transitionTo(id, payload) {
            const target = this.states.get(id);
            if (!target) {
                throw new Error(`Unknown interaction state: ${id}`);
            }
            if (this.current && this.current.id === target.id) return;

            const previous = this.current;
            if (previous) {
                if (previous.onExit) previous.onExit(this.context, this.payload);
                if (previous.tool !== null && previous.tool !== target.tool) {
                    const tool = this.tools.get(previous.tool);
                    if (tool && tool.onDeactivate) tool.onDeactivate(this.context);
                }
            }

            this.current = target;
            this.payload = payload;
            this.applyPresentation(target);
            if (target.onEnter) target.onEnter(this.context, this.payload);
            this.notify();
        }

        /**
         * Arming the entry state of the already-active flow disarms it back to
         * idle; arming any other state switches to it. The unit of toggling is
         * the flow (see state.entry), not the tool and not the single state, so
         * a multi-step flow's own entry button cancels it mid-flow instead of
         * restarting it, while a sibling sub-mode of the same tool switches
         * instead of disarming everything.
         */
        toggle(id) {
            this.transitionTo(this.isFlowActive(id) ? window.InteractionStates.IDLE : id);
        }

        getState() {
            return this.current;
        }

        /** The payload the current state was entered with, or undefined. */
        getPayload() {
            return this.payload;
        }

        isActive(id) {
            return this.current !== null && this.current.id === id;
        }

        /** True when the current state belongs to the flow whose entry is `id`. */
        isFlowActive(id) {
            return this.current !== null && this.current.entry === id;
        }

        subscribe(listener) {
            this.listeners.add(listener);
            return () => this.listeners.delete(listener);
        }

        applyPresentation(state) {
            if (!this.adapter) return;
            this.adapter.setCursor(state.cursor);
            this.adapter.setMapLocked(state.lockMap);
        }

        notify() {
            this.listeners.forEach((listener) => listener(this.current));
        }
    }

    window.InteractionMachine = InteractionMachine;
})();