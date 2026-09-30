import logging
from geopy.geocoders import Nominatim

logger = logging.getLogger(__name__)

# Nominatim (OpenStreetMap) requires a custom user_agent identifying your app.
geolocator = Nominatim(user_agent="galamsay_watch_app")

# Most detailed place type first. We take the first one the result contains.
LOCALITY_KEYS = [
    'hamlet', 'village', 'neighbourhood', 'suburb',
    'quarter', 'town', 'city_district', 'city'
]


def resolve_town(latitude, longitude):
    """Return the town/village/neighbourhood name for a coordinate, or None.

    This is a best-effort extra: if the outside service is slow, down, or
    knows nothing about the spot, we return None and the report is still saved.
    """
    try:
        location = geolocator.reverse(
            (latitude, longitude), language='en', zoom=15, timeout=5
        )
    except Exception as e:
        logger.warning('Town lookup failed: %s', e)
        return None

    if not location:
        return None

    address = location.raw.get('address', {})

    for key in LOCALITY_KEYS:
        if address.get(key):
            return address[key][:150]

    return None