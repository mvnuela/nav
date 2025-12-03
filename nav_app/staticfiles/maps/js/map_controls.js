/**
 * Custom Map Controls for Sea Navigation
 * Provides coordinate display, legend, and other navigation tools
 */

/**
 * Coordinate Display Control
 * Shows current cursor position in nautical format
 */
L.Control.CoordinateDisplay = L.Control.extend({
    options: {
        position: 'bottomleft',
        emptyString: 'Move cursor over map',
        separator: ' | ',
        prefix: '',
        decimals: 2
    },

    onAdd: function(map) {
        this._container = L.DomUtil.create('div', 'leaflet-control-coordinate');
        this._container.style.background = 'rgba(255, 255, 255, 0.9)';
        this._container.style.padding = '5px 10px';
        this._container.style.fontSize = '12px';
        this._container.style.fontFamily = 'monospace';
        this._container.style.border = '2px solid rgba(0,0,0,0.2)';
        this._container.style.borderRadius = '4px';
        this._container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
        this._container.innerHTML = this.options.emptyString;

        L.DomEvent.disableClickPropagation(this._container);
        
        map.on('mousemove', this._onMouseMove, this);
        map.on('mouseout', this._onMouseOut, this);

        return this._container;
    },

    onRemove: function(map) {
        map.off('mousemove', this._onMouseMove, this);
        map.off('mouseout', this._onMouseOut, this);
    },

    _onMouseMove: function(e) {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        
        const latFormatted = decimalToNautical(lat, true);
        const lngFormatted = decimalToNautical(lng, false);
        
        this._container.innerHTML = this.options.prefix + 
            latFormatted + this.options.separator + lngFormatted;
    },

    _onMouseOut: function() {
        this._container.innerHTML = this.options.emptyString;
    }
});

L.control.coordinateDisplay = function(options) {
    return new L.Control.CoordinateDisplay(options);
};

/**
 * Scale Control in Nautical Miles
 */
L.Control.NauticalScale = L.Control.extend({
    options: {
        position: 'bottomleft',
        maxWidth: 100,
        updateWhenIdle: false
    },

    onAdd: function(map) {
        this._map = map;
        this._container = L.DomUtil.create('div', 'leaflet-control-scale');
        this._container.style.background = 'rgba(255, 255, 255, 0.9)';
        this._container.style.padding = '5px 10px';
        this._container.style.fontSize = '11px';
        this._container.style.border = '2px solid rgba(0,0,0,0.2)';
        this._container.style.borderRadius = '4px';
        this._container.style.marginTop = '10px';

        L.DomEvent.disableClickPropagation(this._container);

        map.on(this.options.updateWhenIdle ? 'moveend' : 'move', this._update, this);
        map.whenReady(this._update, this);

        return this._container;
    },

    onRemove: function(map) {
        map.off(this.options.updateWhenIdle ? 'moveend' : 'move', this._update, this);
    },

    _update: function() {
        const map = this._map;
        const y = map.getSize().y / 2;
        const maxMeters = map.distance(
            map.containerPointToLatLng([0, y]),
            map.containerPointToLatLng([this.options.maxWidth, y])
        );

        // Convert meters to nautical miles
        const maxNauticalMiles = maxMeters / 1852;

        this._updateScale(maxNauticalMiles);
    },

    _updateScale: function(maxNM) {
        const scale = this._getRoundNum(maxNM);
        const ratio = scale / maxNM;
        const width = Math.round(this.options.maxWidth * ratio);

        this._container.style.width = width + 'px';
        this._container.innerHTML = scale < 1 
            ? (scale * 10).toFixed(1) + ' cables'
            : scale.toFixed(1) + ' NM';
    },

    _getRoundNum: function(num) {
        const pow10 = Math.pow(10, (Math.floor(num) + '').length - 1);
        let d = num / pow10;

        d = d >= 10 ? 10 :
            d >= 5 ? 5 :
            d >= 3 ? 3 :
            d >= 2 ? 2 : 1;

        return pow10 * d;
    }
});

L.control.nauticalScale = function(options) {
    return new L.Control.NauticalScale(options);
};

/**
 * Legend Control
 * Shows nautical symbol meanings
 */
L.Control.Legend = L.Control.extend({
    options: {
        position: 'topright',
        collapsed: true,
        title: 'Nautical Symbols'
    },

    onAdd: function(map) {
        this._map = map;
        this._container = L.DomUtil.create('div', 'leaflet-control-legend');
        this._container.style.background = 'white';
        this._container.style.padding = '10px';
        this._container.style.border = '2px solid rgba(0,0,0,0.2)';
        this._container.style.borderRadius = '4px';
        this._container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';

        L.DomEvent.disableClickPropagation(this._container);

        this._createTitle();
        this._createContent();

        if (this.options.collapsed) {
            this._collapse();
        }

        return this._container;
    },

    _createTitle: function() {
        this._titleDiv = L.DomUtil.create('div', 'legend-title', this._container);
        this._titleDiv.innerHTML = '<strong>' + this.options.title + '</strong>';
        this._titleDiv.style.cursor = 'pointer';
        this._titleDiv.style.marginBottom = '5px';

        L.DomEvent.on(this._titleDiv, 'click', this._toggle, this);
    },

    _createContent: function() {
        this._contentDiv = L.DomUtil.create('div', 'legend-content', this._container);
        this._contentDiv.style.maxHeight = '300px';
        this._contentDiv.style.overflowY = 'auto';
        
        // This will be populated with actual symbols from the database
        // For now, we'll create a placeholder structure
        this._contentDiv.innerHTML = `
            <div style="margin: 5px 0; font-size: 11px;">
                <div><span style="color: red;">●</span> Port Hand (Red)</div>
                <div><span style="color: green;">●</span> Starboard Hand (Green)</div>
                <div><span style="color: #FFD700;">●</span> Special Mark (Yellow)</div>
                <div><span style="color: #000;">●</span> Isolated Danger</div>
                <div><span style="color: #4169E1;">⚓</span> Lighthouse</div>
                <div style="margin-top: 5px; padding-top: 5px; border-top: 1px solid #ccc;">
                    <em>Click symbols on map for details</em>
                </div>
            </div>
        `;
    },

    _toggle: function() {
        if (this._collapsed) {
            this._expand();
        } else {
            this._collapse();
        }
    },

    _collapse: function() {
        this._contentDiv.style.display = 'none';
        this._collapsed = true;
        this._titleDiv.innerHTML = '<strong>' + this.options.title + ' ▶</strong>';
    },

    _expand: function() {
        this._contentDiv.style.display = 'block';
        this._collapsed = false;
        this._titleDiv.innerHTML = '<strong>' + this.options.title + ' ▼</strong>';
    },

    updateContent: function(symbols) {
        // Method to update legend with actual symbol data
        let html = '<div style="margin: 5px 0; font-size: 11px;">';
        
        symbols.forEach(function(symbol) {
            html += `<div><span style="color: ${symbol.color};">●</span> ${symbol.name}</div>`;
        });
        
        html += '</div>';
        this._contentDiv.innerHTML = html;
    }
});

L.control.legend = function(options) {
    return new L.Control.Legend(options);
};

/**
 * Zoom Level Display Control
 */
L.Control.ZoomDisplay = L.Control.extend({
    options: {
        position: 'bottomright'
    },

    onAdd: function(map) {
        this._map = map;
        this._container = L.DomUtil.create('div', 'leaflet-control-zoom-display');
        this._container.style.background = 'rgba(255, 255, 255, 0.9)';
        this._container.style.padding = '5px 10px';
        this._container.style.fontSize = '11px';
        this._container.style.border = '2px solid rgba(0,0,0,0.2)';
        this._container.style.borderRadius = '4px';

        L.DomEvent.disableClickPropagation(this._container);

        this._update();
        map.on('zoomend', this._update, this);

        return this._container;
    },

    onRemove: function(map) {
        map.off('zoomend', this._update, this);
    },

    _update: function() {
        this._container.innerHTML = 'Zoom: ' + this._map.getZoom();
    }
});

L.control.zoomDisplay = function(options) {
    return new L.Control.ZoomDisplay(options);
};

/**
 * Info Panel Control
 * Displays general information or help text
 */
L.Control.InfoPanel = L.Control.extend({
    options: {
        position: 'topleft',
        title: 'Sea Navigation Learning',
        content: 'Use this map to learn nautical navigation on Mercator projection.'
    },

    onAdd: function(map) {
        this._container = L.DomUtil.create('div', 'leaflet-control-info');
        this._container.style.background = 'rgba(255, 255, 255, 0.95)';
        this._container.style.padding = '15px';
        this._container.style.border = '2px solid rgba(0,0,0,0.2)';
        this._container.style.borderRadius = '4px';
        this._container.style.maxWidth = '300px';
        this._container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';

        L.DomEvent.disableClickPropagation(this._container);

        this._container.innerHTML = `
            <h3 style="margin: 0 0 10px 0; font-size: 14px;">${this.options.title}</h3>
            <p style="margin: 0; font-size: 12px; line-height: 1.4;">${this.options.content}</p>
        `;

        return this._container;
    },

    updateContent: function(title, content) {
        this._container.innerHTML = `
            <h3 style="margin: 0 0 10px 0; font-size: 14px;">${title}</h3>
            <p style="margin: 0; font-size: 12px; line-height: 1.4;">${content}</p>
        `;
    }
});

L.control.infoPanel = function(options) {
    return new L.Control.InfoPanel(options);
};