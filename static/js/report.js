const latitudeField = document.getElementById('latitude');
const longitudeField = document.getElementById('longitude');
const locationStatus = document.getElementById('locationStatus');
const form = document.getElementById('reportForm');
const responseMessage = document.getElementById('responseMessage');
const addressInput = document.getElementById('addressInput');
const addressSearchBtn = document.getElementById('addressSearchBtn');
const addressStatus = document.getElementById('addressStatus');

// ---------- Map setup ----------
const map = L.map('pickMap').setView([7.9465, -1.0232], 7);

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

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const latitude = parseFloat(latitudeField.value);
    const longitude = parseFloat(longitudeField.value);

    if (!latitude || !longitude) {
        responseMessage.textContent = 'Location has not been captured yet. Please allow location access, search an address, or click the map.';
        return;
    }

    // FormData instead of a JSON object, because this request may include
    // a file. The browser builds the correct multipart/form-data body and
    // sets its own Content-Type header (with the required boundary string)
    // automatically - we must not set that header ourselves.
    const formData = new FormData();
    formData.append('latitude', latitude);
    formData.append('longitude', longitude);
    formData.append('severity', document.getElementById('severity').value);
    formData.append('description', document.getElementById('description').value);

    const photoFile = document.getElementById('photo').files[0];
    if (photoFile) {
        formData.append('photo', photoFile);
    }

    try {
        const res = await fetch('/api/report', {
            method: 'POST',
            body: formData
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