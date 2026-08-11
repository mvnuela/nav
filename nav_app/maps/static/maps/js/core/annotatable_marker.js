/**
 * Annotatable markers — a chart point that carries three things at once:
 * a symbol, a label the user can edit, and a place in the geometry graph so
 * lines and rays can be drawn from it.
 *
 * Observed positions were the first of these and, until this module, the only
 * ones: everything below was lifted out of observed_position.js so that dead
 * reckoning positions (and later the geometry tools' own points) get the same
 * behaviour instead of a third copy of it.
 *
 * What stays OUT of here on purpose: control panels, the interaction machine
 * and its placement states, and the cursor preview. Those belong to the tools —
 * this module never listens to the map. It is handed coordinates and makes a
 * point out of them.
 */
(function (global) {
    'use strict';

    const kinds = new Map();

    /**
     * @param {{id:string, label:string, badge:string, color:string,
     *          icon:function(number,string):string}} def
     */
    function defineKind(def) {
        kinds.set(def.id, Object.assign({ counter: 0 }, def));
    }

    function kindOf(kindId) {
        const kind = kinds.get(kindId);
        if (!kind) throw new Error('Unknown annotatable marker kind: ' + kindId);
        return kind;
    }

    function formatTime(date) {
        return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }

    /** Stored as "num/den"; either half may be empty. */
    function parseFraction(str) {
        if (!str) return { numerator: '', denominator: '' };
        const idx = str.indexOf('/');
        if (idx === -1) return { numerator: str, denominator: '' };
        return { numerator: str.slice(0, idx), denominator: str.slice(idx + 1) };
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
            .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function nautical(value, isLat) {
        return typeof global.decimalToNautical === 'function'
            ? global.decimalToNautical(value, isLat)
            : value.toFixed(4);
    }

    /** Popup and list use different input ids so both editors can be open at once. */
    function fieldId(where, kindId, id, half) {
        return `annot-${where}-${kindId}-${id}-${half}`;
    }

    function fractionInputs(where, kindId, id, description, width) {
        const parts = parseFraction(description);
        const style = `width:${width}px; text-align:center; padding:2px; font-size:12px;
                       border:1px solid #ccc; border-radius:3px; font-family:inherit;`;
        return `
            <div style="display:inline-flex; flex-direction:column; align-items:center; font-family:monospace;">
                <input type="text" id="${fieldId(where, kindId, id, 'num')}"
                       value="${escapeHtml(parts.numerator)}" style="${style}">
                <div style="width:${width}px; border-top:1px solid #333; margin:2px 0;"></div>
                <input type="text" id="${fieldId(where, kindId, id, 'den')}"
                       value="${escapeHtml(parts.denominator)}" style="${style}">
            </div>`;
    }

    function popupContent(marker) {
        const d = marker.pointData;
        const kind = kindOf(d.kindId);
        return `
            <div style="font-family: Arial, sans-serif; font-size: 12px;">
                <div style="font-weight: bold; color: ${kind.color}; margin-bottom: 5px;">
                    ${kind.badge} ${escapeHtml(kind.label)} #${d.id}
                </div>
                <div style="margin-bottom: 3px;"><strong>Lat:</strong> ${nautical(d.lat, true)}</div>
                <div style="margin-bottom: 3px;"><strong>Lon:</strong> ${nautical(d.lng, false)}</div>
                <div style="margin-bottom: 8px; color: #666;">
                    <strong>Time:</strong> ${formatTime(d.timestamp)}
                </div>
                <div style="margin-bottom: 6px;">
                    <label style="font-weight: bold; display: block; margin-bottom: 3px;">Description:</label>
                    ${fractionInputs('popup', d.kindId, d.id, d.description, 60)}
                </div>
                <div style="display: flex; gap: 4px;">
                    <button onclick="window.AnnotatableMarker.savePopup('${d.kindId}', ${d.id})"
                        style="flex:1; background:#1976D2; color:white; border:none; padding:4px 10px;
                        border-radius:3px; cursor:pointer; font-size:11px;">Save</button>
                    <button onclick="window.AnnotatableMarker.deleteFromPopup('${d.kindId}', ${d.id})"
                        style="flex:1; background:#D32F2F; color:white; border:none; padding:4px 10px;
                        border-radius:3px; cursor:pointer; font-size:11px;">Delete</button>
                </div>
            </div>`;
    }

    /** Every marker this module made, so the global popup handlers can find one. */
    const byKey = new Map();
    const key = (kindId, id) => `${kindId}#${id}`;

    function create(opts) {
        const kind = kindOf(opts.kindId);
        const size = 20;
        kind.counter += 1;

        const marker = global.L.marker([opts.lat, opts.lon], {
            icon: global.L.divIcon({
                className: 'annotatable-marker',
                html: `<div style="filter: drop-shadow(1px 1px 1px rgba(0,0,0,0.3));">${kind.icon(size, kind.color)}</div>`,
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2],
            }),
            draggable: true,
        });

        marker.pointData = {
            kindId: kind.id, id: kind.counter, timestamp: new Date(),
            lat: opts.lat, lng: opts.lon, description: '',
        };
        marker._annot = { map: opts.map, layer: opts.layer, onChange: opts.onChange || function () {} };

        marker.bindPopup(popupContent(marker), { maxWidth: 250 });

        // A geometry point too, so Connect / Ray / Delete can target it. While a
        // geometry mode is active the click belongs to geometry, not to the popup.
        if (global.GeometryLeaflet) {
            marker.pointId = global.GeometryLeaflet.registerExternalPoint(opts.lat, opts.lon);
        }
        marker.off('click');
        marker.on('click', function (e) {
            global.L.DomEvent.stopPropagation(e);
            const geo = global.GeometryLeaflet;
            if (geo && geo.isGeometryInteractionMode() && marker.pointId) {
                geo.handleExternalPointClick(marker.pointId);
            } else {
                marker.openPopup();
            }
        });

        marker.on('dragend', function (e) {
            const pos = e.target.getLatLng();
            marker.pointData.lat = pos.lat;
            marker.pointData.lng = pos.lng;
            marker.setPopupContent(popupContent(marker));
            if (global.GeometryLeaflet && marker.pointId) {
                global.GeometryLeaflet.updateExternalPoint(marker.pointId, pos.lat, pos.lng);
            }
            marker._annot.onChange();
        });

        marker.addTo(opts.layer);
        byKey.set(key(kind.id, marker.pointData.id), marker);
        marker._annot.onChange();
        return marker;
    }

    function readFraction(where, kindId, id) {
        const num = document.getElementById(fieldId(where, kindId, id, 'num'));
        const den = document.getElementById(fieldId(where, kindId, id, 'den'));
        if (!num || !den) return null;
        const n = num.value.trim();
        const d = den.value.trim();
        return (n || d) ? `${n}/${d}` : '';
    }

    function saveDescription(where, kindId, id) {
        const marker = byKey.get(key(kindId, id));
        const fraction = readFraction(where, kindId, id);
        if (!marker || fraction === null) return;
        marker.pointData.description = fraction;
        marker.setPopupContent(popupContent(marker));
        marker._annot.onChange();
    }

    function remove(kindId, id) {
        const marker = byKey.get(key(kindId, id));
        if (!marker) return;
        const map = marker._annot.map;
        const layer = marker._annot.layer;
        const onChange = marker._annot.onChange;
        if (global.GeometryLeaflet && marker.pointId) {
            global.GeometryLeaflet.removeExternalPoint(marker.pointId);
        }
        if (marker.closePopup) marker.closePopup();
        layer.removeLayer(marker);
        if (map && map.hasLayer(marker)) map.removeLayer(marker);
        byKey.delete(key(kindId, id));
        onChange();
    }

    /** Clears one kind's markers from a layer and restarts its numbering. */
    function clear(kindId, layer) {
        const doomed = [];
        layer.eachLayer(function (l) {
            if (l.pointData && l.pointData.kindId === kindId) doomed.push(l.pointData.id);
        });
        doomed.forEach(function (id) { remove(kindId, id); });
        kindOf(kindId).counter = 0;
    }

    function listOf(layer) {
        const out = [];
        layer.eachLayer(function (l) { if (l.pointData) out.push(l.pointData); });
        return out.sort(function (a, b) { return a.id - b.id; });
    }

    /**
     * The side list. Two behaviours here exist because of bugs: the delegated
     * click survives the innerHTML rebuild, and the rebuild is skipped while the
     * user is typing into one of the list's own inputs — otherwise their text
     * would be wiped mid-word.
     */
    function renderList(container, layer) {
        if (!container) return;
        if (!container._annotDelegated) {
            container._annotDelegated = true;
            container.addEventListener('click', function (e) {
                const del = e.target.closest('[data-annot-delete]');
                if (del) {
                    e.preventDefault(); e.stopPropagation();
                    remove(del.dataset.annotKind, parseInt(del.dataset.annotDelete, 10));
                    return;
                }
                const save = e.target.closest('[data-annot-save]');
                if (save) {
                    e.preventDefault(); e.stopPropagation();
                    saveDescription('list', save.dataset.annotKind, parseInt(save.dataset.annotSave, 10));
                }
            });
        }

        const active = document.activeElement;
        if (active && active.id && /^annot-list-/.test(active.id)) return;

        const points = listOf(layer);
        if (points.length === 0) {
            container.innerHTML =
                '<div style="color:#999; font-style:italic; font-size:11px;">No positions marked</div>';
            return;
        }

        container.innerHTML = points.map(function (p) {
            const kind = kindOf(p.kindId);
            return `
                <div style="padding:6px; margin-bottom:4px; background:#f5f5f5; border-radius:4px; font-size:0.85em;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
                        <span style="font-weight:bold; color:${kind.color};">${kind.badge} #${p.id}</span>
                        <span style="color:#666; flex:1; text-align:right;">${formatTime(p.timestamp)}</span>
                        <button type="button" data-annot-delete="${p.id}" data-annot-kind="${p.kindId}"
                            title="Remove this position"
                            style="background:${kind.color}; color:white; border:none; padding:2px 6px;
                            border-radius:3px; cursor:pointer; font-size:12px; line-height:1;">×</button>
                    </div>
                    <div style="margin-top:2px; color:#333; font-family:monospace; font-size:0.9em;">
                        ${nautical(p.lat, true)}, ${nautical(p.lng, false)}
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; margin-top:4px;">
                        <span style="color:#555; font-size:0.85em;">Description:</span>
                        ${fractionInputs('list', p.kindId, p.id, p.description, 48)}
                        <button type="button" data-annot-save="${p.id}" data-annot-kind="${p.kindId}"
                            style="background:#1976D2; color:white; border:none; padding:2px 8px;
                            border-radius:3px; cursor:pointer; font-size:11px;">Save</button>
                    </div>
                </div>`;
        }).join('');
    }

    global.AnnotatableMarker = {
        defineKind: defineKind,
        create: create,
        remove: remove,
        clear: clear,
        listOf: listOf,
        renderList: renderList,
        savePopup: function (kindId, id) { saveDescription('popup', kindId, id); },
        deleteFromPopup: function (kindId, id) { remove(kindId, id); },
    };
})(window);
