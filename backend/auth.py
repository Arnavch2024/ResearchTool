"""
auth.py — JWT-based authentication for Research RAG.

Provides:
  • POST /api/auth/register  — Create a new user account
  • POST /api/auth/login     — Authenticate and receive JWT
  • GET  /api/auth/me        — Get current user profile from token
  • login_required decorator — Protect routes; injects g.user_id / g.user_email
"""

import os
import re
from datetime import datetime, timedelta, timezone
from functools import wraps

import bcrypt
import jwt
from bson import ObjectId
from flask import Blueprint, request, jsonify, g

from db import get_db

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-production")
JWT_EXPIRY_DAYS = 7

# ─── Validation ───────────────────────────────────────────────────────────────

_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")
MIN_PASSWORD_LENGTH = 8


def _validate_registration(data: dict) -> tuple[bool, str]:
    """Validate registration payload. Returns (is_valid, error_message)."""
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or len(name) < 2:
        return False, "Name must be at least 2 characters."
    if not _EMAIL_RE.match(email):
        return False, "Invalid email address."
    if len(password) < MIN_PASSWORD_LENGTH:
        return False, f"Password must be at least {MIN_PASSWORD_LENGTH} characters."
    return True, ""


# ─── Token Helpers ────────────────────────────────────────────────────────────

def _create_token(user_id: str, email: str) -> str:
    """Create a signed JWT with user_id and email claims."""
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def _decode_token(token: str) -> dict | None:
    """Decode and verify a JWT. Returns payload or None."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


# ─── Decorator ────────────────────────────────────────────────────────────────

def login_required(f):
    """
    Decorator that extracts the JWT from the Authorization header,
    validates it, and injects g.user_id and g.user_email.
    Returns 401 if the token is missing or invalid.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authentication required"}), 401

        token = auth_header[7:]  # strip "Bearer "
        payload = _decode_token(token)
        if not payload:
            return jsonify({"error": "Invalid or expired token"}), 401

        g.user_id = payload["sub"]
        g.user_email = payload.get("email", "")
        return f(*args, **kwargs)

    return decorated


# ─── Routes ───────────────────────────────────────────────────────────────────

@auth_bp.route("/register", methods=["POST"])
def register():
    """Create a new user account."""
    data = request.get_json(silent=True) or {}

    valid, err = _validate_registration(data)
    if not valid:
        return jsonify({"error": err}), 400

    name = data["name"].strip()
    email = data["email"].strip().lower()
    password = data["password"]

    db = get_db()

    # Check if email already exists
    if db.users.find_one({"email": email}):
        return jsonify({"error": "An account with this email already exists."}), 409

    # Hash password
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())

    # Insert user
    result = db.users.insert_one({
        "email": email,
        "password_hash": password_hash,
        "name": name,
        "created_at": datetime.now(timezone.utc),
    })

    user_id = str(result.inserted_id)
    token = _create_token(user_id, email)

    return jsonify({
        "token": token,
        "user": {
            "id": user_id,
            "name": name,
            "email": email,
        },
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    """Authenticate user and return JWT."""
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    db = get_db()
    user = db.users.find_one({"email": email})

    if not user:
        return jsonify({"error": "Invalid email or password."}), 401

    if not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"]):
        return jsonify({"error": "Invalid email or password."}), 401

    user_id = str(user["_id"])
    token = _create_token(user_id, email)

    return jsonify({
        "token": token,
        "user": {
            "id": user_id,
            "name": user["name"],
            "email": email,
        },
    })


@auth_bp.route("/me", methods=["GET"])
@login_required
def me():
    """Return the current user's profile from the JWT."""
    db = get_db()
    user = None
    try:
        if ObjectId.is_valid(g.user_id):
            user = db.users.find_one({"_id": ObjectId(g.user_id)})
    except Exception:
        pass

    if not user:
        user = db.users.find_one({"_id": g.user_id}) or db.users.find_one({"email": g.user_email})

    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify({
        "user": {
            "id": str(user["_id"]),
            "name": user.get("name", "Scholar"),
            "email": user["email"],
        },
    })
