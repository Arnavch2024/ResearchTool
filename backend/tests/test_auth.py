"""Tests for auth.py — registration validation, JWT lifecycle and the
login_required decorator. No real MongoDB is touched: get_db() is
monkeypatched to a fresh in-memory database per test.
"""

import jwt
import pytest
from flask import Flask, g, jsonify

import auth
from db import InMemoryDatabase


@pytest.fixture
def db():
    return InMemoryDatabase()


@pytest.fixture
def client(monkeypatch, db):
    """A minimal Flask app exposing only the auth blueprint + one protected route."""
    monkeypatch.setattr(auth, "get_db", lambda: db)

    app = Flask(__name__)
    app.config["TESTING"] = True
    app.register_blueprint(auth.auth_bp)

    @app.route("/protected")
    @auth.login_required
    def protected():
        return jsonify({"user_id": g.user_id, "email": g.user_email})

    with app.test_client() as c:
        yield c


def _register(client, email="alice@example.com", password="supersecret", name="Alice"):
    return client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "password": password},
    )


# ─── _validate_registration ───────────────────────────────────────────────────

def test_validate_registration_accepts_good_payload():
    ok, err = auth._validate_registration(
        {"name": "Alice", "email": "a@b.com", "password": "12345678"}
    )
    assert ok is True
    assert err == ""


@pytest.mark.parametrize("payload,reason", [
    ({"name": "A", "email": "a@b.com", "password": "12345678"}, "name"),
    ({"name": "Alice", "email": "not-an-email", "password": "12345678"}, "email"),
    ({"name": "Alice", "email": "a@b.com", "password": "short"}, "password"),
    ({}, "missing fields"),
])
def test_validate_registration_rejects_bad_payload(payload, reason):
    ok, err = auth._validate_registration(payload)
    assert ok is False, reason
    assert err


# ─── Token helpers ────────────────────────────────────────────────────────────

def test_create_and_decode_token_roundtrip():
    token = auth._create_token("user-123", "a@b.com")
    payload = auth._decode_token(token)
    assert payload["sub"] == "user-123"
    assert payload["email"] == "a@b.com"


def test_decode_token_rejects_garbage():
    assert auth._decode_token("not.a.jwt") is None


def test_decode_token_rejects_tampered_signature():
    token = auth._create_token("user-123", "a@b.com")
    tampered = token[:-1] + ("a" if token[-1] != "a" else "b")
    assert auth._decode_token(tampered) is None


def test_decode_token_rejects_foreign_secret():
    forged = jwt.encode({"sub": "attacker"}, "some-other-secret", algorithm="HS256")
    assert auth._decode_token(forged) is None


def test_jwt_secret_is_not_the_insecure_default():
    assert auth.JWT_SECRET != "change-me-in-production"
    assert len(auth.JWT_SECRET) >= 32


# ─── Register route ───────────────────────────────────────────────────────────

def test_register_creates_user_and_returns_token(client):
    resp = _register(client)
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["user"]["email"] == "alice@example.com"
    assert body["token"]
    assert auth._decode_token(body["token"])["sub"] == body["user"]["id"]


def test_register_rejects_invalid_payload(client):
    resp = client.post("/api/auth/register", json={"name": "A", "email": "x", "password": "1"})
    assert resp.status_code == 400


def test_register_duplicate_email_conflicts(client):
    assert _register(client).status_code == 201
    assert _register(client).status_code == 409


def test_register_normalises_email_case(client):
    _register(client, email="Alice@Example.com")
    # Logging in with a different case must still find the account.
    resp = client.post("/api/auth/login", json={"email": "alice@example.com", "password": "supersecret"})
    assert resp.status_code == 200


# ─── Login route ──────────────────────────────────────────────────────────────

def test_login_success(client):
    _register(client)
    resp = client.post("/api/auth/login", json={"email": "alice@example.com", "password": "supersecret"})
    assert resp.status_code == 200
    assert resp.get_json()["token"]


def test_login_wrong_password(client):
    _register(client)
    resp = client.post("/api/auth/login", json={"email": "alice@example.com", "password": "wrongpass"})
    assert resp.status_code == 401


def test_login_unknown_user(client):
    resp = client.post("/api/auth/login", json={"email": "ghost@example.com", "password": "whatever"})
    assert resp.status_code == 401


def test_login_requires_both_fields(client):
    resp = client.post("/api/auth/login", json={"email": "a@b.com"})
    assert resp.status_code == 400


# ─── login_required ───────────────────────────────────────────────────────────

def test_login_required_blocks_missing_header(client):
    assert client.get("/protected").status_code == 401


def test_login_required_blocks_bad_scheme(client):
    resp = client.get("/protected", headers={"Authorization": "Token abc"})
    assert resp.status_code == 401


def test_login_required_blocks_invalid_token(client):
    resp = client.get("/protected", headers={"Authorization": "Bearer not.a.jwt"})
    assert resp.status_code == 401


def test_login_required_injects_user_context(client):
    token = _register(client).get_json()["token"]
    resp = client.get("/protected", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["email"] == "alice@example.com"
    assert body["user_id"]


# ─── /me route ────────────────────────────────────────────────────────────────

def test_me_returns_current_user(client):
    token = _register(client).get_json()["token"]
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.get_json()["user"]["email"] == "alice@example.com"
