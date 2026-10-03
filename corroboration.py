from datetime import datetime, timedelta
from math import radians, sin, cos, sqrt, atan2

CORROBORATION_RADIUS_METERS = 300
CORROBORATION_WINDOW_DAYS = 30
CORROBORATION_THRESHOLD = 2  # this report + at least this many total = corroborated


def haversine_meters(lat1, lon1, lat2, lon2):
    """Great-circle distance between two points, in meters."""
    R = 6371000
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lon2 - lon1)
    a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlambda / 2) ** 2
    return 2 * R * atan2(sqrt(a), sqrt(1 - a))


def find_nearby_reports(Report, report):
    """All OTHER non-rejected reports within the corroboration radius and
    time window of the given report. A rough database-side bounding box
    narrows things down cheaply first, then an exact haversine check in
    Python confirms which of those are genuinely within the radius.
    """
    cutoff = datetime.utcnow() - timedelta(days=CORROBORATION_WINDOW_DAYS)
    margin = CORROBORATION_RADIUS_METERS / 111_000  # ~111km per degree of latitude

    candidates = Report.query.filter(
        Report.id != report.id,
        Report.status != 'rejected',
        Report.created_at >= cutoff,
        Report.latitude.between(report.latitude - margin, report.latitude + margin),
        Report.longitude.between(report.longitude - margin, report.longitude + margin),
    ).all()

    return [
        r for r in candidates
        if haversine_meters(report.latitude, report.longitude, r.latitude, r.longitude)
        <= CORROBORATION_RADIUS_METERS
    ]


def apply_corroboration(db, Report, new_report):
    """Check whether this new report, combined with nearby recent reports,
    meets the corroboration threshold - and if so, mark it (and any
    still-unverified neighbours) as corroborated.

    This is NOT the same as human verification - it only means multiple
    independent people reported similar activity near the same spot
    recently. It's a useful automatic signal, not a confirmed fact.
    """
    nearby = find_nearby_reports(Report, new_report)
    total_count = len(nearby) + 1

    if total_count < CORROBORATION_THRESHOLD:
        return False

    new_report.status = 'corroborated'

    for other in nearby:
        if other.status == 'unverified':
            other.status = 'corroborated'

    db.session.commit()
    return True