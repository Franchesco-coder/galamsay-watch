from app import app
from models import db, Report
from region_lookup import resolve_region_district

with app.app_context():
    reports = Report.query.filter(Report.region.is_(None)).all()

    for r in reports:
        r.region, r.district = resolve_region_district(r.latitude, r.longitude)

    db.session.commit()
    print(f'Updated {len(reports)} reports')