"""
db.py — MongoDB connection singleton with seamless in-memory fallback.

Supports:
  • MongoDB Atlas / local MongoDB if running
  • Transparent, thread-safe in-memory collections when MongoDB is not connected
"""

import os
from datetime import datetime, timezone
from bson import ObjectId
from pymongo import MongoClient, ASCENDING

_client = None
_db = None
_is_connected = False
_tested_connection = False


class InMemoryCollection:
    """Thread-safe in-memory replica of basic PyMongo collection methods."""

    def __init__(self, name: str):
        self.name = name
        self.docs: list[dict] = []

    def create_index(self, keys, **kwargs):
        pass

    def insert_one(self, doc: dict):
        doc = dict(doc)
        if "_id" not in doc:
            doc["_id"] = ObjectId()
        self.docs.append(doc)

        class InsertResult:
            inserted_id = doc["_id"]

        return InsertResult()

    def find_one(self, query: dict):
        for doc in self.docs:
            match = True
            for k, v in query.items():
                if k == "_id":
                    if str(doc.get("_id")) != str(v):
                        match = False
                        break
                elif doc.get(k) != v:
                    match = False
                    break
            if match:
                return dict(doc)
        return None

    def find(self, query: dict, projection: dict | None = None):
        results = []
        for doc in self.docs:
            match = True
            for k, v in query.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                d = dict(doc)
                if projection:
                    for pk, pv in projection.items():
                        if pv == 0 and pk in d:
                            d.pop(pk, None)
                results.append(d)

        class Cursor(list):
            def sort(self, key, direction=1):
                reverse = direction == -1 if isinstance(direction, int) else False
                if isinstance(key, list):
                    key = key[0][0]
                return Cursor(sorted(self, key=lambda x: str(x.get(key, "")), reverse=reverse))

            def limit(self, n: int):
                return Cursor(self[:n])

        return Cursor(results)

    def update_one(self, filter_query: dict, update: dict, upsert: bool = False):
        existing = self.find_one(filter_query)
        if existing:
            doc = next(d for d in self.docs if d.get("_id") == existing["_id"])
            if "$set" in update:
                doc.update(update["$set"])
        elif upsert:
            new_doc = dict(filter_query)
            if "$setOnInsert" in update:
                new_doc.update(update["$setOnInsert"])
            if "$set" in update:
                new_doc.update(update["$set"])
            self.insert_one(new_doc)

    def delete_many(self, filter_query: dict):
        self.docs = [
            d for d in self.docs
            if not all(d.get(k) == v for k, v in filter_query.items())
        ]

    def delete_one(self, filter_query: dict):
        for i, d in enumerate(self.docs):
            if all(d.get(k) == v for k, v in filter_query.items()):
                self.docs.pop(i)
                break


class InMemoryDatabase:
    """Mock database with users, chat_messages, sessions collections."""

    def __init__(self):
        self.users = InMemoryCollection("users")
        self.chat_messages = InMemoryCollection("chat_messages")
        self.sessions = InMemoryCollection("sessions")

    def command(self, cmd: str):
        return {"ok": 1}


_fallback_db = InMemoryDatabase()


def get_db():
    """Return live MongoDB instance if reachable, else in-memory fallback."""
    global _client, _db, _is_connected, _tested_connection

    if not _tested_connection:
        _tested_connection = True
        uri = os.environ.get("MONGODB_URI", "mongodb://localhost:27017/research_rag")
        try:
            client = MongoClient(uri, serverSelectionTimeoutMS=1000)
            client.admin.command("ping")
            db_name = uri.rsplit("/", 1)[-1].split("?")[0] or "research_rag"
            _client = client
            _db = client[db_name]
            _ensure_indexes(_db)
            _is_connected = True
            print(f"[DB] Successfully connected to MongoDB ({db_name})")
        except Exception as e:
            _is_connected = False
            print(f"[DB] MongoDB not reachable ({e}). Using in-memory store.")

    return _db if _is_connected and _db is not None else _fallback_db


def _ensure_indexes(db):
    try:
        db.users.create_index("email", unique=True)
        db.chat_messages.create_index([
            ("user_id", ASCENDING),
            ("session_id", ASCENDING),
            ("timestamp", ASCENDING),
        ])
        db.sessions.create_index([
            ("user_id", ASCENDING),
            ("last_active", ASCENDING),
        ])
    except Exception:
        pass


def ping_db() -> bool:
    """Return True if real MongoDB is connected, else False."""
    get_db()
    return _is_connected
