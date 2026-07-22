/**
 * Builds and starts the interaction machine for the Leaflet sea map.
 *
 * Tool state registration happens in each tool's own module, which calls
 * window.mapInteraction.register(...) during its init. This file owns only
 * the machine, the router and the idle root.
 */
(function() {
    'use strict';

    window.initInteractionManager = function initInteractionManager(map) {
        const context = { map: map };

        const machine = new window.InteractionMachine(context);
        machine.setAdapter(window.createLeafletPresentationAdapter(map));
        machine.register(window.createIdleState());

        const router = new window.LeafletInputRouter(map, machine);
        router.attach();

        window.mapInteraction = machine;
        window.mapInteractionRouter = router;

        return machine;
    };
})();