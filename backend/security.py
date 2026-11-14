import hashlib
import json
from .config import ROOT
import secrets
import time
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from starlette.responses import JSONResponse
from .database import LoginSession, RateBucket, User

SECURITY_HEADERS = json.loads((ROOT / "vercel.json").read_text())["headers"][0]["headers"]
COOKIE = "pacific_session"
hasher = PasswordHasher()
DUMMY_HASH = hasher.hash(secrets.token_urlsafe(24))


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def verify_password(encoded, password):
    try:
        return hasher.verify(encoded or DUMMY_HASH, password) and bool(encoded)
    except (VerificationError, InvalidHashError):
        return False


def limit(db, identity, maximum, seconds):
    now = int(time.time())
    bucket = f"{digest(identity)}:{now // seconds}"
    insert = sqlite_insert if db.bind.dialect.name == "sqlite" else postgres_insert
    statement = insert(RateBucket).values(key=bucket, count=1, expires_at=now + seconds * 2)
    statement = statement.on_conflict_do_update(index_elements=["key"], set_={"count": RateBucket.count + 1})
    db.execute(statement)
    count = db.scalar(select(RateBucket.count).where(RateBucket.key == bucket))
    db.execute(delete(RateBucket).where(RateBucket.expires_at < now))
    db.commit()
    if count > maximum:
        raise HTTPException(429, "Too many requests. Try again later.", headers={"Retry-After": str(seconds - now % seconds)})


def current_user(request, db, required=True):
    token = request.cookies.get(COOKIE, "")
    login = db.get(LoginSession, digest(token)) if token else None
    user = db.get(User, login.user_id) if login and login.expires_at > time.time() else None
    if not user and required:
        raise HTTPException(401, "Sign in to access saved datasets.")
    return user


def start_session(db, response, user, settings):
    token = secrets.token_urlsafe(32)
    db.execute(delete(LoginSession).where(LoginSession.expires_at < int(time.time())))
    db.add(LoginSession(token_hash=digest(token), user_id=user.id, expires_at=int(time.time()) + settings.session_seconds))
    db.commit()
    response.set_cookie(COOKIE, token, httponly=True, secure=settings.production, samesite="lax", max_age=settings.session_seconds, path="/")


class RequestGuard:
    """Bound incoming bodies and require same-origin application requests for writes."""
    def __init__(self, app, settings):
        self.app, self.settings = app, settings

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = {k.decode().lower(): v.decode() for k, v in scope["headers"]}
        write = scope["method"] in {"POST", "PUT", "PATCH", "DELETE"}
        if write:
            origin = headers.get("origin")
            expected = self.settings.origin or f"{scope.get('scheme', 'http')}://{headers.get('host', '')}"
            if headers.get("x-pacific-request") != "1" or headers.get("sec-fetch-site") == "cross-site" or (origin and origin != expected):
                return await JSONResponse({"error": "Origin not allowed."}, status_code=403)(scope, receive, send)
            body = bytearray()
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                body.extend(message.get("body", b""))
                if len(body) > 1_200_000:
                    return await JSONResponse({"error": "Request exceeds the 1.2 MB limit."}, status_code=413)(scope, receive, send)
                if not message.get("more_body"):
                    break
            if body and headers.get("content-type", "").split(";")[0] != "application/json":
                return await JSONResponse({"error": "JSON required."}, status_code=415)(scope, receive, send)
            original_receive = receive
            delivered = False

            async def replay():
                nonlocal delivered
                if not delivered:
                    delivered = True
                    return {"type": "http.request", "body": bytes(body), "more_body": False}
                return await original_receive()
            receive = replay

        async def secured_send(message):
            if message["type"] == "http.response.start":
                additions = [(header["key"].lower().encode(), header["value"].encode()) for header in SECURITY_HEADERS if header["key"] != "Content-Security-Policy" or scope["path"] != "/api/docs"]
                if scope["path"].startswith("/api/"):
                    additions.append((b"cache-control", b"no-store"))
                message["headers"] = list(message["headers"]) + additions
            await send(message)
        await self.app(scope, receive, secured_send)
