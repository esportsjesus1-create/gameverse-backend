"""In-memory database for GameVerse recommendation module."""

from app.database.memory_db import MemoryDatabase, get_database

__all__ = ["MemoryDatabase", "get_database"]
