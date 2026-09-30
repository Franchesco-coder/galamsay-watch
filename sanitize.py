import re

TAG_PATTERN = re.compile(r'<[^>]*>')


def sanitize_text(text):
    """Strip any HTML tags out of user-submitted text.

    A plain description field has no legitimate use for HTML, so removing
    tags entirely (rather than trying to allow a "safe" subset) closes off
    script injection without needing a heavier HTML-parsing library.
    """
    if not text:
        return text
    return TAG_PATTERN.sub('', text).strip()