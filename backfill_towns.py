import time
from app import app
from models import db, Report
from town_lookup import resolve_town

with app.app_context():
    reports = Report.query.filter(Report.town.is_(None)).all()
    cache = {}

    for r in reports:
        # Reports at (almost) the same spot share one lookup.
        key = (round(r.latitude, 4), round(r.longitude, 4))

        if key not in cache:
            cache[key] = resolve_town(r.latitude, r.longitude)
            time.sleep(1.1)  # Nominatim allows at most 1 request per second

        r.town = cache[key]

    db.session.commit()

    filled = sum(1 for r in reports if r.town)
    print(f'Checked {len(reports)} reports, filled in {filled} towns')