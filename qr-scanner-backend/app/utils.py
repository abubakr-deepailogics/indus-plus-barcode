import os

from app.config import ALLOWED_EXTENSIONS


def get_extension(filename: str):
    return os.path.splitext(filename)[1].lower()


def is_allowed_file(filename: str):
    return get_extension(filename) in ALLOWED_EXTENSIONS

