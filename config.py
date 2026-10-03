import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.environ.get('SECRET_KEY')
    MAX_CONTENT_LENGTH = 8 * 1024 * 1024  # 8 MB cap on the whole request body
    ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD')