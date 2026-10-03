from flask import Flask, jsonify, request, render_template, Response, session, redirect, url_for
import csv
from io import StringIO
from functools import wraps
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from sqlalchemy import func
from flask_migrate import Migrate
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
from config import Config
from models import db, Report
from region_lookup import resolve_region_district
from sanitize import sanitize_text
from image_utils import process_photo
from corroboration import apply_corroboration
from town_lookup import resolve_town


def admin_required(view_func):
    """Wrap an admin route so it redirects to the login page unless the
    visitor's browser session already has is_admin set to True."""
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        if not session.get('is_admin'):
            return redirect(url_for('admin_login'))
        return view_func(*args, **kwargs)
    return wrapper


ALLOWED_SEVERITIES = {'low', 'medium', 'high', 'critical'}

geolocator = Nominatim(user_agent="galamsay_watch_app")

limiter = Limiter(key_func=get_remote_address)


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    Migrate(app, db)
    limiter.init_app(app)

    @app.route('/api/ping')
    def ping():
        return jsonify({'status': 'ok', 'message': 'Galamsay Watch backend is running'})

    @app.route('/api/report', methods=['POST'])
    @limiter.limit('5 per hour')
    def submit_report():
        latitude = request.form.get('latitude')
        longitude = request.form.get('longitude')
        severity = request.form.get('severity')
        description = sanitize_text(request.form.get('description', ''))

        if latitude is None or longitude is None:
            return jsonify({'error': 'latitude and longitude are required'}), 400

        try:
            latitude = float(latitude)
            longitude = float(longitude)
        except (TypeError, ValueError):
            return jsonify({'error': 'latitude and longitude must be numbers'}), 400

        if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
            return jsonify({'error': 'latitude or longitude is out of range'}), 400

        if severity not in ALLOWED_SEVERITIES:
            return jsonify({'error': f'severity must be one of {sorted(ALLOWED_SEVERITIES)}'}), 400

        photo_bytes = None
        photo_mimetype = None
        photo_file = request.files.get('photo')

        if photo_file and photo_file.filename:
            try:
                photo_bytes, photo_mimetype = process_photo(photo_file)
            except ValueError as e:
                return jsonify({'error': str(e)}), 400

        region, district = resolve_region_district(latitude, longitude)
        town = resolve_town(latitude, longitude)

        new_report = Report(
            latitude=latitude,
            longitude=longitude,
            region=region,
            district=district,
            town=town,
            severity=severity,
            description=description,
            photo=photo_bytes,
            photo_mimetype=photo_mimetype
        )

        db.session.add(new_report)
        db.session.commit()

        # Check whether this report, combined with recent nearby reports,
        # now meets the automatic corroboration threshold (see
        # corroboration.py). This never requires an admin to be watching.
        apply_corroboration(db, Report, new_report)

        return jsonify(new_report.to_dict()), 201

    @app.route('/api/report/<report_id>/photo', methods=['GET'])
    def report_photo(report_id):
        report = Report.query.get(report_id)

        if not report or not report.photo:
            return jsonify({'error': 'Photo not found'}), 404

        return Response(report.photo, mimetype=report.photo_mimetype or 'image/jpeg')

    @app.route('/api/reports', methods=['GET'])
    def get_reports():
        reports = Report.query.order_by(Report.created_at.desc()).all()
        return jsonify([r.to_dict() for r in reports]), 200

    @app.route('/api/heatmap', methods=['GET'])
    def heatmap():
        weight_by_severity = {'low': 1, 'medium': 2, 'high': 3, 'critical': 5}

        reports = Report.query.all()
        points = [
            [r.latitude, r.longitude, weight_by_severity.get(r.severity, 1)]
            for r in reports
        ]

        return jsonify(points), 200

    @app.route('/api/stats', methods=['GET'])
    def stats():
        severity_rows = (
            db.session.query(Report.severity, func.count(Report.id))
            .group_by(Report.severity)
            .all()
        )
        by_severity = dict(severity_rows)

        region_expr = func.coalesce(Report.region, 'Unknown')
        region_rows = (
            db.session.query(region_expr, func.count(Report.id))
            .group_by(region_expr)
            .all()
        )
        by_region = dict(region_rows)

        month_expr = func.to_char(Report.created_at, 'YYYY-MM')
        month_rows = (
            db.session.query(month_expr, func.count(Report.id))
            .group_by(month_expr)
            .order_by(month_expr)
            .all()
        )
        by_month = dict(month_rows)

        return jsonify({
            'by_severity': by_severity,
            'by_region': by_region,
            'by_month': by_month
        }), 200

    @app.route('/api/resolve', methods=['GET'])
    def resolve():
        try:
            lat = float(request.args.get('lat'))
            lng = float(request.args.get('lng'))
        except (TypeError, ValueError):
            return jsonify({'error': 'lat and lng must be numbers'}), 400

        region, district = resolve_region_district(lat, lng)
        return jsonify({'region': region, 'district': district}), 200

    @app.route('/api/geocode', methods=['GET'])
    @limiter.limit('20 per minute')
    def geocode():
        query = request.args.get('q', '').strip()

        if not query:
            return jsonify({'error': 'Missing search query'}), 400

        try:
            location = geolocator.geocode(query, timeout=10)
        except (GeocoderTimedOut, GeocoderServiceError):
            return jsonify({'error': 'Geocoding service is unavailable right now'}), 503

        if not location:
            return jsonify({'error': 'Location not found'}), 404

        return jsonify({
            'latitude': location.latitude,
            'longitude': location.longitude,
            'display_name': location.address
        }), 200

    @app.route('/api/export.csv', methods=['GET'])
    def export_csv():
        reports = Report.query.order_by(Report.created_at.desc()).all()

        output = StringIO()
        writer = csv.writer(output)
        writer.writerow([
            'id', 'created_at', 'latitude', 'longitude', 'region', 'district',
            'town', 'severity', 'status', 'description'
        ])

        for r in reports:
            writer.writerow([
                r.id, r.created_at.isoformat(), r.latitude, r.longitude,
                r.region, r.district, r.town, r.severity, r.status,
                r.description
            ])

        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={'Content-Disposition': 'attachment; filename=galamsay_watch_reports.csv'}
        )

    @app.route('/admin/login', methods=['GET', 'POST'])
    def admin_login():
        error = None

        if request.method == 'POST':
            password = request.form.get('password', '')
            if password and password == app.config.get('ADMIN_PASSWORD'):
                session['is_admin'] = True
                return redirect(url_for('admin_page'))
            error = 'Incorrect password'

        return render_template('admin_login.html', error=error)

    @app.route('/admin/logout')
    def admin_logout():
        session.pop('is_admin', None)
        return redirect(url_for('admin_login'))

    @app.route('/admin')
    @admin_required
    def admin_page():
        reports = Report.query.order_by(Report.created_at.desc()).all()
        return render_template('admin.html', reports=reports)

    @app.route('/admin/report/<report_id>/status', methods=['POST'])
    @admin_required
    def update_status(report_id):
        allowed_statuses = {'unverified', 'corroborated', 'verified', 'rejected', 'resolved'}
        new_status = request.form.get('status')

        if new_status not in allowed_statuses:
            return jsonify({'error': 'Invalid status'}), 400

        report = Report.query.get(report_id)
        if not report:
            return jsonify({'error': 'Report not found'}), 404

        report.status = new_status
        db.session.commit()

        return redirect(url_for('admin_page'))

    @app.route('/')
    def home_page():
        return render_template('index.html')

    @app.route('/dashboard')
    def dashboard_page():
        return render_template('dashboard.html')

    @app.route('/map')
    def map_page():
        return render_template('map.html')

    @app.route('/report')
    def report_page():
        return render_template('report.html')

    return app


app = create_app()


@app.errorhandler(413)
def file_too_large(e):
    return jsonify({'error': 'Photo is too large. Please use a smaller image (under 8MB).'}), 413


@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({'error': 'Too many requests. Please try again later.'}), 429


if __name__ == '__main__':
    app.run(debug=True)