"""Run python -m backend.manage init-db before the first PostgreSQL deployment."""
import argparse
from .config import Settings
from .database import Database

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["init-db"])
    parser.parse_args()
    database = Database(Settings())
    database.initialize()
    database.engine.dispose()
    print("Database schema initialized.")
