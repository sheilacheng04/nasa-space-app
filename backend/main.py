import csv
import io
import logging
import time
from contextlib import asynccontextmanager
from uuid import uuid4
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.responses import JSONResponse
from starlette.staticfiles import StaticFiles
from .config import ROOT, Settings
from .database import Database, Dataset, LoginSession, User
from .schemas import AnalysisInput, Credentials, DatasetInput
from .security import COOKIE, RequestGuard, current_user, digest, hasher, limit, start_session, verify_password
from . import services


def create_app(settings=None):
    settings = settings or Settings()
    database = Database(settings)

    @asynccontextmanager
    async def lifespan(app):
        if not settings.production:
            database.initialize()
        yield
        database.engine.dispose()

    def request_header(x_pacific_request: str | None = Header(default=None, alias="X-Pacific-Request", description="Set to 1 for POST, PUT and DELETE requests.")):
        # The ASGI guard enforces this before reading mutation bodies.
        pass

    app = FastAPI(dependencies=[Depends(request_header)], title="The Two-Faced Pacific API", version="2.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None, lifespan=lifespan)
    app.state.database = database
    app.add_middleware(RequestGuard, settings=settings)

    def session():
        with database.session() as db:
            yield db

    def client_id(request):
        return request.client.host if request.client else "unknown"

    @app.exception_handler(HTTPException)
    async def http_error(_, error):
        return JSONResponse({"error": error.detail}, status_code=error.status_code, headers=error.headers)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(_, error):
        issues = [{"field": ".".join(str(p) for p in e["loc"][1:]), "message": e["msg"]} for e in error.errors()]
        return JSONResponse({"error": "Invalid request data.", "issues": issues}, status_code=422)

    @app.exception_handler(SQLAlchemyError)
    async def database_error(_, error):
        logging.getLogger(__name__).error("Database request failed: %s", type(error).__name__)
        return JSONResponse({"error": "Database unavailable. Please try again."}, status_code=503)

    @app.get("/api/health")
    def health(db=Depends(session)):
        db.execute(text("SELECT 1"))
        return {"status": "ok", "service": "pacific-api", "database": database.engine.dialect.name, "version": "2.0.0"}

    @app.get("/api/bootstrap")
    def bootstrap():
        return {key: services.snapshot(settings, f"{key}.json") for key in ("sites", "news", "enso", "sources")}

    @app.get("/api/data/{path:path}")
    def data(path: str):
        return services.snapshot(settings, path)

    @app.get("/api/weather/{site_id}")
    def weather(site_id: str, request: Request, db=Depends(session)):
        limit(db, "weather:" + client_id(request), 30, 60)
        return services.weather(settings, db, site_id)

    @app.get("/api/geocode")
    def geocode(request: Request, q: str = Query(min_length=3, max_length=120), db=Depends(session)):
        limit(db, "geocode:" + client_id(request), 30, 60)
        return services.geocode(db, q.strip())

    @app.get("/api/auth/me")
    def me(request: Request, db=Depends(session)):
        user = current_user(request, db, required=False)
        return {"user": {"id": user.id, "username": user.username} if user else None}

    @app.post("/api/auth/register", status_code=201)
    def register(body: Credentials, request: Request, response: Response, db=Depends(session)):
        limit(db, "register:" + client_id(request), 10, 3600)
        user = User(id=str(uuid4()), username=body.username, password_hash=hasher.hash(body.password))
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "That username is unavailable.")
        start_session(db, response, user, settings)
        return {"user": {"id": user.id, "username": user.username}}

    @app.post("/api/auth/login")
    def login(body: Credentials, request: Request, response: Response, db=Depends(session)):
        limit(db, "login-ip:" + client_id(request), 30, 900)
        limit(db, "login-user:" + body.username, 10, 900)
        user = db.scalar(select(User).where(User.username == body.username))
        if not verify_password(user.password_hash if user else None, body.password):
            raise HTTPException(401, "Username or password is incorrect.")
        if hasher.check_needs_rehash(user.password_hash):
            user.password_hash = hasher.hash(body.password)
        previous = request.cookies.get(COOKIE)
        if previous:
            db.execute(delete(LoginSession).where(LoginSession.token_hash == digest(previous)))
        start_session(db, response, user, settings)
        return {"user": {"id": user.id, "username": user.username}}

    @app.post("/api/auth/logout", status_code=204)
    def logout(request: Request, response: Response, db=Depends(session)):
        db.execute(delete(LoginSession).where(LoginSession.token_hash == digest(request.cookies.get(COOKIE, ""))))
        db.commit()
        response.delete_cookie(COOKIE, path="/", secure=settings.production, httponly=True, samesite="lax")

    def summary(item, include_rows=False):
        result = {"id": item.id, "name": item.name, "rowCount": item.row_count, "createdAt": item.created_at, "updatedAt": item.updated_at}
        if include_rows:
            result["observations"] = item.observations
        return result

    def owned(db, request, dataset_id):
        user = current_user(request, db)
        item = db.scalar(select(Dataset).where(Dataset.id == dataset_id, Dataset.user_id == user.id))
        if item is None:
            raise HTTPException(404, "Dataset not found.")
        return item

    @app.get("/api/datasets")
    def datasets(request: Request, db=Depends(session)):
        user = current_user(request, db)
        return {"datasets": [summary(d) for d in db.scalars(select(Dataset).where(Dataset.user_id == user.id).order_by(Dataset.updated_at.desc()))]}

    @app.post("/api/datasets", status_code=201)
    def save_dataset(body: DatasetInput, request: Request, db=Depends(session)):
        user = current_user(request, db)
        limit(db, "save:" + user.id, 60, 60)
        db.execute(select(User).where(User.id == user.id).with_for_update())
        count = db.scalar(select(func.count()).select_from(Dataset).where(Dataset.user_id == user.id))
        if count >= 100:
            raise HTTPException(409, "Your account has 100 datasets. Delete an unused dataset before saving another.")
        item = Dataset(id=str(uuid4()), user_id=user.id, name=body.name, observations=[p.model_dump() for p in body.observations], row_count=len(body.observations))
        db.add(item)
        db.commit()
        return summary(item, True)

    @app.get("/api/datasets/{dataset_id}")
    def dataset(dataset_id: str, request: Request, db=Depends(session)):
        return summary(owned(db, request, dataset_id), True)

    @app.put("/api/datasets/{dataset_id}")
    def update_dataset(dataset_id: str, body: DatasetInput, request: Request, db=Depends(session)):
        item = owned(db, request, dataset_id)
        item.name, item.observations = body.name, [p.model_dump() for p in body.observations]
        item.row_count, item.updated_at = len(body.observations), int(time.time())
        db.commit()
        return summary(item, True)

    @app.delete("/api/datasets/{dataset_id}", status_code=204)
    def delete_dataset(dataset_id: str, request: Request, db=Depends(session)):
        db.delete(owned(db, request, dataset_id))
        db.commit()

    @app.get("/api/datasets/{dataset_id}/export.csv")
    def export_dataset(dataset_id: str, request: Request, db=Depends(session)):
        item = owned(db, request, dataset_id)
        output = io.StringIO(newline="")
        writer = csv.DictWriter(output, fieldnames=["name", "lat", "lng", "value", "category", "date"])
        writer.writeheader()
        for row in item.observations:
            writer.writerow({k: ("'" + v if isinstance(v, str) and v.startswith(("=", "+", "-", "@", "\t", "\r")) else v) for k, v in row.items()})
        return Response(output.getvalue(), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="observations-{item.id}.csv"'})

    @app.post("/api/analyze")
    def analyze(body: AnalysisInput, request: Request, db=Depends(session)):
        if not settings.ai_enabled or not settings.ai_key:
            raise HTTPException(503, "AI is not configured. Local analysis remains available.")
        user = current_user(request, db)
        limit(db, "ai:" + user.id, 10, 3600)
        return services.analyze(settings, body.text)

    if (ROOT / "dist").exists():
        app.mount("/", StaticFiles(directory=ROOT / "dist", html=True), name="frontend")
    return app


app = create_app()
