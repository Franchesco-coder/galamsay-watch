const SEVERITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 };
const REFRESH_MS = 30000;

const statsEl = document.getElementById('stats');
const filterBoxes = document.querySelectorAll('.severity-filter');

// ---------- Map setup ----------
const map = L.map('liveMap').setView([7.9465, -1.0232], 7);

const streetLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
});

const satelliteLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
        attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
        maxZoom: 19
    }
);

// Street view shows by default; the layer control below lets the
// visitor switch to satellite imagery whenever they want.
streetLayer.addTo(map);

L.control.layers(
    { 'Street': streetLayer, 'Satellite': satelliteLayer },
    null,
    { position: 'bottomleft' }
).addTo(map);

// ---------- Icons ----------
function createMarkerIcon(severity) {
    return L.divIcon({
        className: 'custom-marker',
        html: `<div class="sev-marker ${severity}"><div class="ring"></div><div class="dot"></div></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        popupAnchor: [0, -12]
    });
}

// A cluster bubble takes the colour of the WORST report inside it.
function createClusterIcon(cluster) {
    const markers = cluster.getAllChildMarkers();
    let worst = 'low';

    markers.forEach((m) => {
        if (SEVERITY_RANK[m.options.severity] > SEVERITY_RANK[worst]) {
            worst = m.options.severity;
        }
    });

    const count = markers.length;
    const size = count < 10 ? 36 : count < 50 ? 44 : 52;

    return L.divIcon({
        className: `custom-cluster cluster-${worst}`,
        html: `<div style="width:${size}px;height:${size}px;line-height:${size}px">${count}</div>`,
        iconSize: [size, size]
    });
}

const clusterGroup = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 50,
    iconCreateFunction: createClusterIcon
});
map.addLayer(clusterGroup);

// ---------- Heatmap ----------
let heatLayer = null;
let heatData = [];
let showingHeat = false;
const toggleBtn = document.getElementById('toggleViewBtn');

function ensureHeatLayer() {
    if (!heatLayer) {
        heatLayer = L.heatLayer([], {
            radius: 28,
            blur: 22,
            maxZoom: 12,
            max: 5,           // matches our highest severity weight (critical)
            gradient: {
                0.2: '#2b83ba',
                0.4: '#f4c430',
                0.6: '#f77f00',
                0.8: '#d62828',
                1.0: '#6a040f'
            }
        });
    }
    return heatLayer;
}

function setView(showHeat) {
    showingHeat = showHeat;

    if (showHeat) {
        map.removeLayer(clusterGroup);
        ensureHeatLayer().setLatLngs(heatData).addTo(map);
        toggleBtn.textContent = 'Show Markers';
    } else {
        if (heatLayer) {
            map.removeLayer(heatLayer);
        }
        map.addLayer(clusterGroup);
        toggleBtn.textContent = 'Show Heatmap';
    }
}

async function loadHeatData() {
    try {
        const res = await fetch('/api/heatmap');
        heatData = await res.json();

        if (showingHeat && heatLayer) {
            heatLayer.setLatLngs(heatData);
        }
    } catch (err) {
        // The marker view still works even if this fails, so we stay quiet here.
    }
}

toggleBtn.addEventListener('click', () => setView(!showingHeat));

// ---------- State ----------
let allReports = [];
let lastSignature = '';
let shownCount = 0;
let firstLoad = true;

// ---------- Helpers ----------
function activeSeverities() {
    return new Set([...filterBoxes].filter((box) => box.checked).map((box) => box.value));
}

// The server stores UTC time without a timezone label, so we add "Z"
// (meaning UTC) before letting the browser convert it to local time.
function formatTime(iso) {
    return new Date(iso.split('.')[0] + 'Z').toLocaleString();
}

// Escape text before putting it inside HTML, so a place name containing
// characters like < or > can never be treated as real HTML.
function esc(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function popupHtml(r) {
    return `
        <span class="badge ${r.severity}">${r.severity}</span>
        <div class="popup-row"><strong>Town:</strong> ${esc(r.town || 'Unknown')}</div>
        <div class="popup-row"><strong>District:</strong> ${esc(r.district || 'Unknown')}</div>
        <div class="popup-row"><strong>Region:</strong> ${esc(r.region || 'Unknown')}</div>
        <div class="popup-time">Reported ${formatTime(r.created_at)}</div>
    `;
}

function updateStats() {
    const time = new Date().toLocaleTimeString();
    statsEl.textContent = `Showing ${shownCount} of ${allReports.length} reports · updated ${time}`;
}

function renderMarkers() {
    const active = activeSeverities();
    const visible = allReports.filter((r) => active.has(r.severity));

    clusterGroup.clearLayers();

    const markers = visible.map((r) =>
        L.marker([r.latitude, r.longitude], {
            icon: createMarkerIcon(r.severity),
            severity: r.severity
        }).bindPopup(popupHtml(r))
    );

    clusterGroup.addLayers(markers);
    return visible.length;
}

// ---------- Loading data ----------
async function loadReports() {
    try {
        const res = await fetch('/api/reports');
        if (!res.ok) {
            throw new Error('Bad response');
        }

        allReports = await res.json();

        // Only redraw the map if the list of reports actually changed.
        const signature = allReports.map((r) => r.id).join('|');

        if (signature !== lastSignature) {
            lastSignature = signature;
            shownCount = renderMarkers();

            if (firstLoad && shownCount > 0) {
                map.flyToBounds(clusterGroup.getBounds(), {
                    padding: [50, 50],
                    maxZoom: 12,
                    duration: 1.5
                });
                firstLoad = false;
            }
        }

        updateStats();
    } catch (err) {
        statsEl.textContent = 'Could not load reports. Retrying...';
    }
}

// ---------- Events ----------
filterBoxes.forEach((box) => {
    box.addEventListener('change', () => {
        shownCount = renderMarkers();
        updateStats();
    });
});

loadReports();
loadHeatData();
setInterval(loadReports, REFRESH_MS);
setInterval(loadHeatData, REFRESH_MS);