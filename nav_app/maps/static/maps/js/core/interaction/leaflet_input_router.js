/**
 * Leaflet input adapter for the interaction machine.
 *
 * Built on the pointer lifecycle rather than Leaflet's `click`, because
 * navigation tools need drag, rotate and reposition interactions that `click`
 * cannot express. PointerEvent is used so mouse, touch and pen share one path.
 *
 * This is the only Leaflet-aware piece of the interaction system. The machine
 * and all states are view-agnostic, which is what lets the PDF/canvas view
 * supply its own router later without touching any state.
 */
(function() {
    'use strict';

    const TAP_MOVE_TOLERANCE_PX = 5;
    const TAP_MAX_DURATION_MS = 500;

    /**
     * Did this pointer gesture qualify as a tap rather than a drag or long press?
     *
     * Pure and exported so the pan-suppression rule is testable without a browser.
     * These two constants are the only tuning surface if taps feel wrong on touch.
     *
     * @param {{x: number, y: number, time: number}|null} down
     * @param {{x: number, y: number, time: number}} up
     * @returns {boolean}
     */
    window.isTapGesture = function isTapGesture(down, up) {
        if (!down || !up) return false;
        const dx = up.x - down.x;
        const dy = up.y - down.y;
        const movedTooFar = Math.sqrt(dx * dx + dy * dy) > TAP_MOVE_TOLERANCE_PX;
        const heldTooLong = (up.time - down.time) > TAP_MAX_DURATION_MS;
        return !movedTooFar && !heldTooLong;
    };

    /**
     * Presentation adapter. Keeps cursor and map-lock ownership in the machine
     * instead of scattered across tools, which is what ends the last-writer-wins
     * cursor clobbering between geometry, observed position and triangles.
     */
    window.createLeafletPresentationAdapter = function(map) {
        const container = map.getContainer();
        return {
            setCursor: function(cursor) {
                container.style.cursor = cursor || '';
            },
            setMapLocked: function(locked) {
                if (locked) {
                    map.dragging.disable();
                } else {
                    map.dragging.enable();
                }
            }
        };
    };

    class LeafletInputRouter {
        constructor(map, machine) {
            this.map = map;
            this.machine = machine;
            this.container = map.getContainer();
            this.hitTesters = [];
            this.down = null;
            this.attached = false;

            this.onPointerDown = this.onPointerDown.bind(this);
            this.onPointerMove = this.onPointerMove.bind(this);
            this.onPointerUp = this.onPointerUp.bind(this);
            this.onPointerCancel = this.onPointerCancel.bind(this);
            this.onKeyDown = this.onKeyDown.bind(this);
        }

        /**
         * @param {(x: number, y: number, latlng: Object) => Object|null} tester
         *        Returns a feature descriptor `{dragState, ...}` or null.
         *        First non-null result wins. Registration order is priority order.
         */
        registerHitTester(tester) {
            this.hitTesters.push(tester);
            return this;
        }

        attach() {
            if (this.attached) return this;
            this.container.addEventListener('pointerdown', this.onPointerDown);
            this.container.addEventListener('pointermove', this.onPointerMove);
            this.container.addEventListener('pointerup', this.onPointerUp);
            this.container.addEventListener('pointercancel', this.onPointerCancel);
            document.addEventListener('keydown', this.onKeyDown);
            this.attached = true;
            return this;
        }

        detach() {
            if (!this.attached) return this;
            this.container.removeEventListener('pointerdown', this.onPointerDown);
            this.container.removeEventListener('pointermove', this.onPointerMove);
            this.container.removeEventListener('pointerup', this.onPointerUp);
            this.container.removeEventListener('pointercancel', this.onPointerCancel);
            document.removeEventListener('keydown', this.onKeyDown);
            this.attached = false;
            return this;
        }

        /** Container-relative coordinates plus the geographic position. */
        normalize(domEvent, type) {
            const rect = this.container.getBoundingClientRect();
            const x = domEvent.clientX - rect.left;
            const y = domEvent.clientY - rect.top;
            const latlng = this.map.containerPointToLatLng(L.point(x, y));
            return {
                type: type,
                x: x,
                y: y,
                lat: latlng.lat,
                lng: latlng.lng,
                feature: null,
                originalEvent: domEvent
            };
        }

        hitTest(event) {
            for (let i = 0; i < this.hitTesters.length; i++) {
                const feature = this.hitTesters[i](
                    event.x, event.y, { lat: event.lat, lng: event.lng }
                );
                if (feature) return feature;
            }
            return null;
        }

        /** Clicks on Leaflet control panels are UI, not map interaction. */
        isControlEvent(domEvent) {
            return !!(domEvent.target &&
                      domEvent.target.closest &&
                      domEvent.target.closest('.leaflet-control'));
        }

        onPointerDown(domEvent) {
            if (domEvent.button !== 0) return;
            if (this.isControlEvent(domEvent)) return;

            const event = this.normalize(domEvent, window.InteractionEvents.POINTER_DOWN);

            const feature = this.hitTest(event);
            if (feature) {
                event.type = window.InteractionEvents.FEATURE_DOWN;
                event.feature = feature;
            }

            // Record whether this gesture began on an existing feature
            // (FEATURE_DOWN) rather than empty map (POINTER_DOWN). onPointerUp
            // uses this to suppress TAP: interacting with something already
            // placed — e.g. clicking a divider handle — must never also count
            // as a placement tap for whatever tool happens to be armed. Lives
            // in the same `this.down` bookkeeping as everything else so it is
            // cleared on pointerup/pointercancel and can never leak into the
            // next gesture.
            this.down = { x: event.x, y: event.y, time: domEvent.timeStamp, onFeature: !!feature };

            // dispatch() is fail-fast: a feature naming a dragState that was
            // never registered with the machine makes it throw "Unknown
            // interaction state: ...", and that throw must still reach the
            // console unchanged — this is not a bug to hide. Clear the gesture
            // bookkeeping on the way out so a failed pointerdown cannot leave
            // the router thinking a gesture is in progress. Capture is taken
            // only below, after a successful dispatch, so there is none to
            // release on this path.
            try {
                this.machine.dispatch(event);
            } catch (err) {
                this.down = null;
                throw err;
            }

            // Capture so a drag leaving the container still delivers move/up
            // here instead of stranding the state mid-drag — but ONLY when the
            // resulting state actually consumes the pointer lifecycle.
            //
            // Capturing unconditionally is actively harmful: capture retargets
            // subsequent pointer events, and their compatibility mouse events,
            // to the capturing element. Tools that run their own drag loop on a
            // child element — the divider's overlay canvas listens for its own
            // mousemove/mouseup — then never receive those events and their
            // drag silently dies after the initial mousedown. Leaflet's own
            // panning survives it only because Leaflet listens on this same
            // container.
            //
            // Deciding after dispatch is deliberate: a FEATURE_DOWN that routes
            // idle into a real drag state must capture, and only the
            // post-dispatch state knows that.
            if (this.stateConsumesPointerLifecycle() && this.container.setPointerCapture) {
                this.container.setPointerCapture(domEvent.pointerId);
            }
        }

        /**
         * Does the machine's current state handle the raw pointer lifecycle?
         * States that only place on TAP do not, and must not hold capture.
         */
        stateConsumesPointerLifecycle() {
            const state = this.machine.getState();
            if (!state || !state.on) return false;
            return !!(state.on[window.InteractionEvents.POINTER_MOVE] ||
                      state.on[window.InteractionEvents.POINTER_UP]);
        }

        onPointerMove(domEvent) {
            this.machine.dispatch(
                this.normalize(domEvent, window.InteractionEvents.POINTER_MOVE)
            );
        }

        onPointerUp(domEvent) {
            const event = this.normalize(domEvent, window.InteractionEvents.POINTER_UP);
            const up = { x: event.x, y: event.y, time: domEvent.timeStamp };

            // POINTER_UP first so drag states can finish and return to idle,
            // then TAP for placement states. A TAP with no handler is ignored.
            // Either dispatch can throw the same fail-fast "Unknown interaction
            // state" error as onPointerDown, and that error must still
            // propagate. But releasing capture and clearing `this.down` are the
            // gesture's end-of-life bookkeeping, not something to skip just
            // because a misconfigured state threw partway through — otherwise
            // the container is left holding capture and the router keeps
            // thinking a gesture is in progress. The finally runs that cleanup
            // on both the success and the throw path.
            try {
                this.machine.dispatch(event);

                // A gesture that started on an existing feature (FEATURE_DOWN
                // recorded in this.down.onFeature, see onPointerDown) never
                // synthesises TAP, even if it was otherwise still — clicking a
                // divider handle, say, is an interaction with something already
                // placed, not a placement click, and must not be handed to
                // whichever placement tool happens to be armed.
                if (!(this.down && this.down.onFeature) && window.isTapGesture(this.down, up)) {
                    const tap = Object.assign({}, event, {
                        type: window.InteractionEvents.TAP
                    });
                    this.machine.dispatch(tap);
                }
            } finally {
                this.releaseCapture(domEvent);
                this.down = null;
            }
        }

        onPointerCancel(domEvent) {
            this.releaseCapture(domEvent);
            this.down = null;
        }

        releaseCapture(domEvent) {
            if (this.container.hasPointerCapture &&
                this.container.hasPointerCapture(domEvent.pointerId)) {
                this.container.releasePointerCapture(domEvent.pointerId);
            }
        }

        onKeyDown(domEvent) {
            if (domEvent.key !== 'Escape') return;
            this.machine.dispatch({
                type: window.InteractionEvents.ESCAPE,
                originalEvent: domEvent
            });
        }
    }

    window.LeafletInputRouter = LeafletInputRouter;
})();