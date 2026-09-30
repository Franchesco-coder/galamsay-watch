from io import BytesIO
from PIL import Image, ImageOps

MAX_DIMENSION = 1280
JPEG_QUALITY = 75


def process_photo(file_storage):
    """Validate, downsize and re-encode an uploaded photo as a JPEG.

    Raises ValueError with a user-facing message if the upload isn't a
    real, readable image. Re-encoding through Pillow also strips any
    embedded EXIF metadata - including GPS coordinates a phone camera may
    have saved into the original file - an extra privacy safeguard on top
    of the anonymity already built into the report form.
    """
    try:
        image = Image.open(file_storage)
        image = ImageOps.exif_transpose(image)  # fix sideways/upside-down phone photos
        image = image.convert('RGB')
    except Exception:
        raise ValueError('File is not a valid image')

    image.thumbnail((MAX_DIMENSION, MAX_DIMENSION))

    buffer = BytesIO()
    image.save(buffer, format='JPEG', quality=JPEG_QUALITY)
    return buffer.getvalue(), 'image/jpeg'