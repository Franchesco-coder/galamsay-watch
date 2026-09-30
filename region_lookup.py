import json
import os
from shapely.geometry import shape, Point

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')


def _load_boundaries(filename):
    path = os.path.join(DATA_DIR, filename)
    with open(path, encoding='utf-8') as f:
        geojson = json.load(f)

    boundaries = []
    for feature in geojson['features']:
        polygon = shape(feature['geometry'])
        if not polygon.is_valid:
            polygon = polygon.buffer(0)
        name = feature['properties']['shapeName']
        boundaries.append((polygon, name))
    return boundaries


# Loaded once when the server starts, then reused for every report.
REGIONS = _load_boundaries('ghana_regions.geojson')
DISTRICTS = _load_boundaries('ghana_districts.geojson')


def _find_name(boundaries, point):
    for polygon, name in boundaries:
        if polygon.covers(point):
            return name
    return None


def resolve_region_district(latitude, longitude):
    # Shapely points are (x, y) = (longitude, latitude) - NOT (lat, lng).
    point = Point(longitude, latitude)
    region = _find_name(REGIONS, point)
    district = _find_name(DISTRICTS, point)
    return region, district