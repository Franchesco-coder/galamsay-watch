const latitudeField = document.getElementById('latitude');
const longitudeField = document.getElementById('longitude');
const locationStatus = document.getElementById('locationStatus');
const form = document.getElementById('reportForm');
const responseMessage = document.getElementById('responseMessage');
const addressInput = document.getElementById('addressInput');
const addressSearchBtn = document.getElementById('addressSearchBtn');
const addressStatus = document.getElementById('addressStatus');

// ---------- Map setup ----------
// Centered on Ghana by default, zoomed out until a location is set.
const map = L.map('pickMap').setView([7.9465, -1.0232], 7);

// Plain OpenStreetMap tiles - free forever, no API key required.
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

streetLayer.addTo(map);

L.control.layers(
    { 'Street': streetLayer, 'Satellite': satelliteLayer },
    null,
    { position: 'topright' }
).addTo(map);

// A custom pulsing dot marker instead of Leaflet's plain default pin.
const pulseIcon = L.divIcon({
    className: 'custom-pulse-icon',
    html: '<div class="pulse-icon"><div class="ring"></div><div class="dot"></div></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
});

let marker = null;

function setMarker(lat, lng, statusText) {
    const latlng = [lat, lng];

    if (marker) {
        marker.setLatLng(latlng);
    } else {
        marker = L.marker(latlng, { icon: pulseIcon }).addTo(map);
    }

    map.flyTo(latlng, 15, { duration: 1.2 });

    latitudeField.value = lat;
    longitudeField.value = lng;
    locationStatus.textContent = statusText;
}

map.on('click', (e) => {
    setMarker(e.latlng.lat, e.latlng.lng, 'Location set from map ✓');
    addressStatus.textContent = '';
});

// ---------- GPS capture ----------
function captureLocation() {
    if (!navigator.geolocation) {
        locationStatus.textContent = 'Location capture is not supported on this browser.';
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            setMarker(position.coords.latitude, position.coords.longitude, 'Location captured ✓');
        },
        (error) => {
            locationStatus.textContent = 'Could not capture location automatically. Please allow location access, search an address, or click the map.';
        }
    );
}

captureLocation();

// ---------- Address search ----------
addressSearchBtn.addEventListener('click', async () => {
    const query = addressInput.value.trim();

    if (!query) {
        addressStatus.textContent = 'Please type an address first.';
        return;
    }

    addressStatus.textContent = 'Searching...';

    try {
        const res = await fetch('/api/geocode?q=' + encodeURIComponent(query));
        const data = await res.json();

        if (res.ok) {
            setMarker(data.latitude, data.longitude, 'Location set from address ✓');
            addressStatus.textContent = 'Found: ' + data.display_name;
        } else {
            addressStatus.textContent = 'Error: ' + data.error;
        }
    } catch (err) {
        addressStatus.textContent = 'Network error - could not search address.';
    }
});

// ---------- Form submission ----------
form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
        latitude: parseFloat(latitudeField.value),
        longitude: parseFloat(longitudeField.value),
        severity: document.getElementById('severity').value,
        description: document.getElementById('description').value
    };

    if (!payload.latitude || !payload.longitude) {
        responseMessage.textContent = 'Location has not been captured yet. Please allow location access, search an address, or click the map.';
        return;
    }

    try {
        const res = await fetch('/api/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            responseMessage.textContent = 'Report submitted. Thank you.';
            form.reset();
            addressStatus.textContent = '';
            captureLocation();
        } else {
            responseMessage.textContent = 'Error: ' + data.error;
        }
    } catch (err) {
        responseMessage.textContent = 'Network error - could not submit report.';
    }
});