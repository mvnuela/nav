/**
 * Main Map Initialization and Orchestration
 * Coordinates all nautical map features
 */

(function() {
    'use strict';

    // Wait for DOM and Leaflet to be ready
    document.addEventListener('DOMContentLoaded', function() {
        initializeNauticalMap();
    });

    // OSM's tile servers answer a request that carries no Referer header with
    // their "403 Access blocked" placeholder image instead of the tile. Django's
    // SecurityMiddleware sends `Referrer-Policy: same-origin` (its default since
    // Django 3.1), which strips the Referer from exactly these cross-origin tile
    // requests — so on the deployed site every tile came back as that
    // placeholder. Leaflet applies this per-tile option to the <img> before
    // setting `src`, so only the tile images send the origin; every other
    // request on the page keeps the strict site-wide policy.
    const TILE_REFERRER_POLICY = 'strict-origin-when-cross-origin';

    /**
     * Build the two tile layers the sea map is drawn from: the OpenStreetMap
     * base layer and the OpenSeaMap seamark overlay on top of it.
     */
    function createTileLayers() {
        return [
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 18,
                referrerPolicy: TILE_REFERRER_POLICY,
                attribution: '© OpenStreetMap contributors'
            }),
            L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
                maxZoom: 18,
                referrerPolicy: TILE_REFERRER_POLICY,
                attribution: 'Map data: © <a href="http://www.openseamap.org">OpenSeaMap</a> contributors'
            })
        ];
    }

    /**
     * Initialize the complete nautical map with all features
     */
    function initializeNauticalMap() {
        // Create map with initial position from Django template.
        // Clamp zoom to 3–12 (applies to +/- buttons, scroll and double-click
        // alike, since min/maxZoom are enforced by the map itself).
        const map = L.map('map', { minZoom: 3, maxZoom: 12 }).setView(
            [window.initialLat, window.initialLon],
            7
        );

        // Add the OpenStreetMap base layer and the OpenSeaMap seamark overlay
        // (buoys, lighthouses, etc.)
        createTileLayers().forEach(layer => layer.addTo(map));

        // Interaction machine must exist before any tool initializes, so tools
        // can register their states during init. It is started after them.
        //
        // Guarded so that a failure here cannot abort the whole map bootstrap.
        // This runs first, so an uncaught throw would take the graticule, the
        // controls and every tool down with it. Degrading to "no machine" leaves
        // the map fully usable, since each tool still owns its own listeners.
        if (typeof initInteractionManager === 'function') {
            try {
                initInteractionManager(map);
            } catch (err) {
                console.error('Interaction machine failed to initialize:', err);
            }
        }

        // Initialize all map features
        initializeGraticule(map);
        initializeControls(map);
        initializeCoordinateInput(map);

        // Initialize additional tools (from separate modules)
        if (typeof initNauticalTriangles === 'function') {
            initNauticalTriangles(map);
        }
        if (typeof initNauticalDivider === 'function') {
            initNauticalDivider(map);
        }
        if (typeof initGPXRoutes === 'function') {
            initGPXRoutes(map);
        }
        if (typeof initObservedPosition === 'function') {
            initObservedPosition(map);
        }
        if (typeof initDeadReckoningPosition === 'function') {
            initDeadReckoningPosition(map);
        }
        if (typeof initGeometry === 'function') {
            initGeometry(map);
        }
        if (typeof initNauticalLatitudeScale === 'function') {
            initNauticalLatitudeScale(map);
        }
        if (typeof initNauticalLongitudeScale === 'function') {
            initNauticalLongitudeScale(map);
        }
        if (typeof initMagneticDeclination === 'function') {
            initMagneticDeclination(map);
        }

        // Started last so every tool has registered its states and target
        // validation sees the complete graph. Guarded for the same reason as
        // the setup call above, and because the machine may be absent if that
        // call failed.
        if (window.mapInteraction) {
            try {
                window.mapInteraction.start(window.InteractionStates.IDLE);
            } catch (err) {
                console.error('Interaction machine failed to start:', err);
            }
        }

        dockInfoBoxesUnderCoordinateInput();

        console.log('✓ Nautical map initialized successfully');
    }

    /**
     * Place the variation box and the cursor coordinate readout immediately
     * below the "Go to Position" box. Both are topright controls, but the
     * corner stacks them in add order, so re-order the DOM once every control
     * exists.
     */
    function dockInfoBoxesUnderCoordinateInput() {
        const corner = document.querySelector('.leaflet-top.leaflet-right');
        const coordInput = document.querySelector('.leaflet-control-coordinate-input');
        if (!corner || !coordInput) return;

        // Insert in reverse order so the final stack reads: Go to Position,
        // variation, coordinates.
        ['.leaflet-control-coordinate', '#magVarBox'].forEach(selector => {
            const box = corner.querySelector(selector);
            if (box) corner.insertBefore(box, coordInput.nextSibling);
        });
    }

    /**
     * Initialize custom graticule layer with nautical formatting
     */
    function initializeGraticule(map) {
        const graticuleLayer = L.layerGroup().addTo(map);

        function drawGraticule() {
            graticuleLayer.clearLayers();

            const bounds = map.getBounds();
            const zoom = map.getZoom();

            // Determine interval based on zoom level. The higher zooms are
            // refined so the grid keeps pace as the view narrows: past zoom 9 a
            // single 0.5° spacing left only one line of each in view at zoom 12.
            let interval;
            if (zoom <= 3) interval = 30;
            else if (zoom <= 5) interval = 10;
            else if (zoom <= 7) interval = 5;
            else if (zoom <= 9) interval = 1;
            else if (zoom === 10) interval = 0.5;      // 30′
            else if (zoom === 11) interval = 0.25;     // 15′
            else interval = 0.1;                       // 6′  (zoom 12)

            // Calculate bounds
            const latStart = Math.floor(bounds.getSouth() / interval) * interval;
            const latEnd = Math.ceil(bounds.getNorth() / interval) * interval;
            const lngStart = Math.floor(bounds.getWest() / interval) * interval;
            const lngEnd = Math.ceil(bounds.getEast() / interval) * interval;

            // Draw latitude lines
            for (let lat = latStart; lat <= latEnd; lat += interval) {
                // Draw line
                const line = L.polyline([
                    [lat, bounds.getWest()],
                    [lat, bounds.getEast()]
                ], {
                    color: '#483D8B',
                    weight: 1,
                    opacity: 0.7,
                    dashArray: '5, 5'
                });
                line.addTo(graticuleLayer);

                // No latitude label here: the nautical latitude scale on the left
                // edge already reads out latitude, and these labels sat on top of it.
            }

            // Draw longitude lines
            for (let lng = lngStart; lng <= lngEnd; lng += interval) {
                // Draw line
                const line = L.polyline([
                    [bounds.getSouth(), lng],
                    [bounds.getNorth(), lng]
                ], {
                    color: '#483D8B',
                    weight: 1,
                    opacity: 0.7,
                    dashArray: '5, 5'
                });
                line.addTo(graticuleLayer);

                // No longitude label here: the nautical longitude scale along
                // the top edge already reads out longitude, and these labels sat
                // on top of it — the same reason the latitude labels went.
            }
        }

        map.on('moveend', drawGraticule);
        map.on('zoomend', drawGraticule);
        drawGraticule(); // Initial draw
    }

    /**
     * Initialize custom map controls
     */
    function initializeControls(map) {
        // Added first so it sits at the top of the topright stack
        addHomeButton(map);

        // Add coordinate display control (shows position under cursor)
        L.control.coordinateDisplay().addTo(map);

        // Add zoom level display
        L.control.zoomDisplay().addTo(map);

        // Add nautical scale
        // HIDDEN: bottom-left nautical mile scale bar temporarily disabled.
        // L.control.nauticalScale().addTo(map);

        // Add legend
        // HIDDEN: Nautical Symbols legend temporarily disabled.
        // L.control.legend().addTo(map);

        // Move the built-in +/- zoom buttons down to the bottom-left, clear of
        // the latitude scale that runs down the left edge.
        if (map.zoomControl) {
            map.zoomControl.setPosition('bottomleft');
        }

        // Add map lock button (disable/enable all panning and zooming)
        addMapLockControl(map);
    }

    /**
     * Link back to the home page. The map fills the viewport, so there is no
     * page chrome to hang a nav link on — it has to be a map control.
     */
    function addHomeButton(map) {
        const HomeControl = L.Control.extend({
            options: { position: 'topright' },
            onAdd: function() {
                const link = L.DomUtil.create('a', 'leaflet-control home-btn');
                // homeUrl is set by the template; '/' is the index route anyway.
                link.href = window.homeUrl || '/';
                link.textContent = '← Home';
                link.title = 'Return to the home page';
                link.style.cssText = [
                    'display:block', 'padding:6px 8px', 'background:white',
                    'border:2px solid rgba(0,0,0,0.2)', 'border-radius:4px',
                    'box-shadow:0 1px 5px rgba(0,0,0,0.4)', 'color:#0078A8',
                    'font-size:12px', 'font-weight:bold', 'text-decoration:none',
                    'text-align:center', 'white-space:nowrap'
                ].join(';');

                // Stops the click reaching the map; the link still navigates.
                L.DomEvent.disableClickPropagation(link);

                return link;
            }
        });

        new HomeControl().addTo(map);
    }

    /**
     * Toggle button that disables / enables all map panning and zooming
     */
    function addMapLockControl(map) {
        window.mapInteractionLocked = false;

        // The built-in +/- zoom buttons call map.zoomIn()/zoomOut() directly,
        // bypassing every interaction handler (dragging, scrollWheelZoom, ...).
        // Guard those methods at the source so a locked map cannot zoom, no
        // matter how the zoom was triggered (button, API, keyboard shortcut).
        if (!map._lockZoomGuardInstalled) {
            map._lockZoomGuardInstalled = true;
            const origZoomIn = map.zoomIn.bind(map);
            const origZoomOut = map.zoomOut.bind(map);
            map.zoomIn = function() {
                return window.mapInteractionLocked ? map : origZoomIn.apply(null, arguments);
            };
            map.zoomOut = function() {
                return window.mapInteractionLocked ? map : origZoomOut.apply(null, arguments);
            };
        }

        // Also visually grey-out and click-block the +/- buttons while locked.
        if (!document.getElementById('map-lock-style')) {
            const style = document.createElement('style');
            style.id = 'map-lock-style';
            style.textContent =
                '.map-interaction-locked .leaflet-control-zoom a {' +
                ' pointer-events: none; opacity: 0.5; cursor: default; }';
            document.head.appendChild(style);
        }

        const MapLockControl = L.Control.extend({
            options: { position: 'bottomleft' },
            onAdd: function() {
                const btn = L.DomUtil.create('button', 'leaflet-control map-lock-btn');
                btn.title = 'Lock / unlock map movement';
                btn.innerHTML = '&#x1F513;'; // 🔓
                btn.style.cssText = [
                    'width:34px', 'height:34px', 'border:2px solid rgba(0,0,0,0.2)',
                    'border-radius:4px', 'background:white', 'cursor:pointer',
                    'font-size:16px', 'line-height:1', 'display:flex',
                    'align-items:center', 'justify-content:center',
                    'box-shadow:0 1px 5px rgba(0,0,0,0.4)'
                ].join(';');

                L.DomEvent.disableClickPropagation(btn);
                L.DomEvent.on(btn, 'click', function() {
                    window.mapInteractionLocked = !window.mapInteractionLocked;
                    if (window.mapInteractionLocked) {
                        map.dragging.disable();
                        map.scrollWheelZoom.disable();
                        map.doubleClickZoom.disable();
                        map.keyboard.disable();
                        map.touchZoom.disable();
                        map.boxZoom.disable();
                        map.getContainer().classList.add('map-interaction-locked');
                        btn.innerHTML = '&#x1F512;'; // 🔒
                        btn.style.background = '#e67e22';
                        btn.style.color = 'white';
                        btn.style.borderColor = '#e67e22';
                    } else {
                        map.dragging.enable();
                        map.scrollWheelZoom.enable();
                        map.doubleClickZoom.enable();
                        map.keyboard.enable();
                        map.touchZoom.enable();
                        map.boxZoom.enable();
                        map.getContainer().classList.remove('map-interaction-locked');
                        btn.innerHTML = '&#x1F513;'; // 🔓
                        btn.style.background = 'white';
                        btn.style.color = 'black';
                        btn.style.borderColor = 'rgba(0,0,0,0.2)';
                    }
                });

                return btn;
            }
        });

        new MapLockControl().addTo(map);
    }

    /**
     * Initialize "Go to Coordinates" input control
     */
    function initializeCoordinateInput(map) {
        L.Control.CoordinateInput = L.Control.extend({
            options: {
                position: 'topright'
            },

            onAdd: function() {
                const container = L.DomUtil.create('div', 'leaflet-control-coordinate-input');
                container.style.background = 'white';
                container.style.borderRadius = '4px';
                container.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
                container.style.marginTop = '10px';
                container.style.cursor = 'pointer';

                container.innerHTML = `
                    <div id="coordInputToggle" style="padding: 8px 10px; background: white; border-radius: 4px; font-weight: bold; font-size: 12px;">
                        🧭 Go to Position
                    </div>
                    <div id="coordInputPanel" style="display: none; padding: 10px; padding-top: 0;">
                        <input type="text" id="latInput" placeholder="Latitude (e.g. 54.5 or 54°30'N)"
                           style="width: 100%; padding: 5px; margin-bottom: 5px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px;">
                    <input type="text" id="lonInput" placeholder="Longitude (e.g. 18.5 or 018°30'E)"
                           style="width: 100%; padding: 5px; margin-bottom: 5px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px;">
                    <select id="zoomLevel" style="width: 100%; padding: 5px; margin-bottom: 5px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px;">
                        <option value="7">Zoom: 7 (Regional)</option>
                        <option value="8">Zoom: 8 (Area)</option>
                        <option value="9">Zoom: 9 (Local)</option>
                        <option value="10" selected>Zoom: 10 (Detailed)</option>
                        <option value="11">Zoom: 11 (Close)</option>
                        <option value="12">Zoom: 12 (Very Close)</option>
                    </select>
                    <select id="markKind" style="width: 100%; padding: 5px; margin-bottom: 5px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px;">
                        <option value="dr">Mark as: Dead reckoning</option>
                        <option value="observed">Mark as: Observed position</option>
                        <option value="plain">Mark as: Plain point</option>
                    </select>
                    <div style="display: flex; gap: 4px;">
                        <button id="goButton" style="flex: 1; padding: 6px; background: #0078A8; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold; font-size: 12px;">
                            Navigate
                        </button>
                        <button id="markButton" style="flex: 1; padding: 6px; background: #2E7D32; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold; font-size: 12px;">
                            Mark
                        </button>
                    </div>
                        <div id="inputError" style="color: red; font-size: 10px; margin-top: 5px; display: none;"></div>
                    </div>
                `;

                L.DomEvent.disableClickPropagation(container);

                return container;
            },

            onRemove: function() {}
        });

        const coordInput = new L.Control.CoordinateInput();
        coordInput.addTo(map);

        // Add event listener for the navigate button
        setTimeout(() => {
            const panelToggle = document.getElementById('coordInputToggle');
            const panel = document.getElementById('coordInputPanel');
            
            // Toggle panel visibility
            if (panelToggle && panel) {
                panelToggle.onclick = function(e) {
                    e.stopPropagation();
                    const isVisible = panel.style.display !== 'none';
                    panel.style.display = isVisible ? 'none' : 'block';
                    panelToggle.style.background = isVisible ? 'white' : '#e8f5e9';
                };
            }
            
            /**
             * One parser for both buttons: parseLatLon accepts decimals, comma
             * decimals and nautical notation, and rejects a latitude typed into
             * the longitude box — the control's own ad-hoc parsing did none of
             * that.
             */
            function readTypedPosition() {
                const errorDiv = document.getElementById('inputError');
                const lat = parseLatLon(document.getElementById('latInput').value, 'lat');
                const lon = parseLatLon(document.getElementById('lonInput').value, 'lon');
                const fail = !lat.ok ? lat.error
                    : !lon.ok ? lon.error
                    : lat.value === undefined ? 'enter a latitude'
                    : lon.value === undefined ? 'enter a longitude'
                    : null;
                if (fail) {
                    errorDiv.style.display = 'block';
                    errorDiv.style.color = 'red';
                    errorDiv.textContent = 'Error: ' + fail;
                    return null;
                }
                return { lat: lat.value, lon: lon.value };
            }

            function report(message) {
                const errorDiv = document.getElementById('inputError');
                errorDiv.style.display = 'block';
                errorDiv.style.color = 'green';
                errorDiv.textContent = message;
                setTimeout(() => { errorDiv.style.display = 'none'; }, 3000);
            }

            const goButton = document.getElementById('goButton');
            if (goButton) {
                goButton.addEventListener('click', function() {
                    const pos = readTypedPosition();
                    if (!pos) return;
                    const zoom = parseInt(document.getElementById('zoomLevel').value);
                    map.setView([pos.lat, pos.lon], zoom);
                    report(`Navigated to ${formatCoordinatePair(pos.lat, pos.lon)}`);
                });
            }

            const markButton = document.getElementById('markButton');
            if (markButton) {
                markButton.addEventListener('click', function() {
                    const pos = readTypedPosition();
                    if (!pos) return;
                    const kind = document.getElementById('markKind').value;

                    // Deliberately does NOT move the view: marking a point out of
                    // shot should not throw away what you are looking at. Nor does
                    // it touch the interaction machine — this is typed input, not
                    // a map interaction, so an active placing mode stays active.
                    if (kind === 'plain') {
                        if (!window.GeometryLeaflet) {
                            report('Geometry tool is not on this page');
                            return;
                        }
                        window.GeometryLeaflet.addPointAt(pos.lat, pos.lon);
                    } else {
                        const tool = kind === 'observed' ? window.ObservedPosition
                                                         : window.DeadReckoningPosition;
                        if (!tool) {
                            report('That tool is not on this page');
                            return;
                        }
                        tool.add(pos.lat, pos.lon);
                    }
                    report(`Marked at ${formatCoordinatePair(pos.lat, pos.lon)}`);
                });
            }

            // Allow Enter key to trigger navigation
            ['latInput', 'lonInput'].forEach(id => {
                const input = document.getElementById(id);
                if (input) {
                    input.addEventListener('keypress', function(e) {
                        if (e.key === 'Enter') {
                            document.getElementById('goButton').click();
                        }
                    });
                }
            });
        }, 100);
    }

    // Exposed for the Node test suite; the browser only ever uses the IIFE.
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { createTileLayers, TILE_REFERRER_POLICY };
    }

})();