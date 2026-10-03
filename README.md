# 🌍 Galamsay Watch

**An anonymous, map-based platform for reporting suspected illegal small-scale mining (galamsay) in Ghana.**

🔗 **Live site:** [galamsay-watch.onrender.com](https://galamsay-watch.onrender.com)

> ⚠️ Hosted on free-tier infrastructure. The first request after a period of inactivity may take 20–50 seconds while the server and database wake up.

---

## About

Galamsay Watch lets anyone report a suspected illegal mining site **without providing any identifying information** — no name, no account, no contact details. The platform automatically resolves each report's region, district, and town, lets reports corroborate each other automatically when multiple people report the same area, and visualizes everything on a live, interactive map.

Built by **Francis Totsi**, a 4th-year Geomatic Engineering student at the **Kwame Nkrumah University of Science and Technology (KNUST)**. This is my first full-stack web application, built to explore how geospatial data and everyday web engineering can support Ghana's fight against illegal mining.

---

## Features

- 🕶️ **Fully anonymous reporting** — no accounts, no logins, no identifying data stored
- 📍 **Three ways to set location** — automatic GPS capture, address search, or click-to-pin on an interactive map
- 🗺️ **Automatic geospatial resolution** — every report is tagged with its real region, district, and town using Ghana's administrative boundaries
- 📸 **Optional photo evidence** — automatically compressed and stripped of hidden location metadata (EXIF GPS data) before storage
- 🔥 **Live interactive map** — color-coded markers, clustering, a severity-weighted heatmap, and street/satellite view toggle
- 🤝 **Automatic corroboration** — reports near each other within a time window are automatically flagged as mutually corroborated, with no admin required
- 📊 **Analytics dashboard** — report counts by severity, region, and time
- 🔒 **Admin review panel** — password-protected page for manually verifying, rejecting, or resolving reports
- ⬇️ **CSV export** — all report data downloadable for use in external GIS tools
- 🛡️ **Anti-abuse protections** — rate limiting on report submission and the geocoding endpoint, input sanitization on free-text fields

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, Flask |
| Database | PostgreSQL (hosted on [Neon](https://neon.tech)) |
| ORM / Migrations | SQLAlchemy, Flask-Migrate (Alembic) |
| Geocoding | [OpenStreetMap Nominatim](https://nominatim.org/) via `geopy` |
| Geospatial lookups | `Shapely` + [geoBoundaries](https://www.geoboundaries.org/) administrative boundary data |
| Image processing | `Pillow` |
| Rate limiting | `Flask-Limiter` |
| Frontend mapping | [Leaflet.js](https://leafletjs.com/), Leaflet.markercluster, Leaflet.heat |
| Charts | [Chart.js](https://www.chartjs.org/) |
| Hosting | [Render](https://render.com) (web service) |

---

## Project Structure

```
galamsay-watch/
├── app.py                  # Flask app factory and all routes
├── config.py                # Environment-based configuration
├── models.py                 # SQLAlchemy Report model
├── region_lookup.py           # Point-in-polygon region/district resolution
├── town_lookup.py              # Reverse geocoding for town/village names
├── image_utils.py               # Photo compression and EXIF stripping
├── sanitize.py                   # Strips HTML from free-text input
├── corroboration.py               # Automatic nearby-report corroboration
├── requirements.txt
│
├── data/
│   ├── ghana_regions.geojson        # Region boundaries
│   └── ghana_districts.geojson       # District boundaries
│
├── migrations/               # Flask-Migrate / Alembic schema history
│
├── templates/
│   ├── index.html              # Home page
│   ├── report.html              # Anonymous report submission form
│   ├── map.html                  # Live interactive map
│   ├── dashboard.html             # Analytics dashboard
│   ├── admin.html                  # Admin review panel
│   └── admin_login.html             # Admin login
│
└── static/
    ├── css/
    └── js/
```

---

## Running Locally

**Requirements:** Python 3.10+, PostgreSQL

```bash
# Clone the repository
git clone https://github.com/Franchesco-coder/galamsay-watch.git
cd galamsay-watch

# Create and activate a virtual environment, then install dependencies
pip install -r requirements.txt

# Create a .env file in the project root (see Environment Variables below)

# Create the database tables
flask --app app db upgrade

# Run the development server
flask --app app run
```

The app will be available at `http://127.0.0.1:5000`.

### Environment Variables

Create a `.env` file in the project root:

```
DATABASE_URL=postgresql+psycopg2://user:password@host:5432/dbname
SECRET_KEY=your-secret-key
ADMIN_PASSWORD=your-admin-password
```

---

## API Overview

| Endpoint | Method | Description |
|---|---|---|
| `/api/report` | POST | Submit a new anonymous report (multipart/form-data, supports an optional photo) |
| `/api/reports` | GET | List all reports |
| `/api/report/<id>/photo` | GET | Fetch a report's photo |
| `/api/heatmap` | GET | Severity-weighted points for the heatmap |
| `/api/stats` | GET | Aggregated counts by severity, region, and month |
| `/api/geocode` | GET | Address → coordinates |
| `/api/resolve` | GET | Coordinates → region/district |
| `/api/export.csv` | GET | Download all reports as CSV |

---

## Known Limitations

- Hosted on free-tier infrastructure: the server sleeps after inactivity, and the database pauses after 5 minutes idle (both auto-resume on the next request, with a short delay).
- Rate limiting is per-IP and in-memory, suited to the current scale rather than high-traffic production use.
- Automatic corroboration indicates that multiple independent reports were made near the same location — it is a trust signal, not confirmation that illegal mining is occurring.

---

## License

This project was built for educational purposes as part of a Geomatic Engineering program at KNUST. Feel free to explore the code.

---

**Built with care by Francis Totsi** · Geomatic Engineering, KNUST