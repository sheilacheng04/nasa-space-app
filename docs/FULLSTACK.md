> Optional backend architecture record. The NISAR revision serves saved evidence directly from static files. Account and live AI features require an explicitly configured `globalThis.__PACIFIC_API__` backend. For current results, see [VALIDATION](VALIDATION.md) and [README](../README.md).

# Full-stack application — 14 November 2026

The main application now uses React 19 and TypeScript, with a Python FastAPI API and SQLAlchemy database. The root HTML is only the browser entrypoint. The offline HTML is a generated demonstration of the same React application.

## Responsibilities

| Layer | Implementation | Responsibilities |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite | Routing, page components, forms, filtering, account UI, loading/errors, local CSV state |
| Visualizations | Existing JavaScript renderers behind React components | Globe, compatibility canvas, radar comparison, geographic maps, conceptual animations |
| API | Python, FastAPI, Pydantic | Prepared data, weather/place proxies, validation, sessions, private datasets, optional AI |
| Database | SQLAlchemy; SQLite locally; PostgreSQL in production | Accounts, hashed sessions, observations, shared upstream cache and rate limits |
| Scientific processing | Existing Python scripts | Discovery, calibration, raster preparation and dated context snapshots |

React owns page state and mounts dedicated containers for the graphics modules. Hidden globe and radar rendering is suspended through component effects. Camera, reduced-motion and graphics-context recovery behavior is preserved.

## Start and build

Use Node 22.12+ and Python 3.13. From the repository root:

~~~powershell
npm.cmd ci
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
npm.cmd run dev
~~~

The launcher starts FastAPI on 8000, waits for health, then starts Vite on 5173. Vite proxies /api to Python, keeping cookies and requests on the frontend origin. Ctrl+C stops both children. API_PORT changes the backend port; pass Vite flags through npm run dev -- --port 5174.

For a production build on your machine:

~~~powershell
npm.cmd run build
npm.cmd start
~~~

Open http://127.0.0.1:4173. FastAPI serves compiled React files and /api. PORT changes this port. API documentation is at /api/docs; the specification is at /api/openapi.json. Writes require X-Pacific-Request: 1.

On macOS/Linux use npm and .venv/bin/python. PYTHON can override the launcher's Python executable.

## Persistent observations

Importing a CSV only updates browser storage and globe points. In My data:

1. Import valid observations.
2. Create an account or sign in.
3. Choose a dataset name and press Save to account.
4. Open a saved dataset to restore it in this browser and on the globe.
5. Update it, save a copy, download CSV or explicitly delete the server copy.

Clearing local observations does not delete server datasets. Signing out does not erase browser observations. Server deletion does not erase a dataset already opened locally.

SQLite is stored at .storage/pacific.db, outside public/ and dist/. It survives restarts. Tests use separate temporary databases. For PostgreSQL, set DATABASE_URL in an untracked .env or the process environment. postgres:// and postgresql:// URLs normalize to the psycopg SQLAlchemy driver.

Production refuses SQLite. A serverless instance's local filesystem must not be used for account storage.

## API surface

| Method | Path | Behavior |
| --- | --- | --- |
| GET | /api/health | API and database connectivity |
| GET | /api/bootstrap | Study sites, news archive, NOAA snapshot and sources |
| GET | /api/data/{path} | Allowlisted prepared JSON data |
| GET | /api/weather/{site_id} | ERA5 proxy, one-hour shared cache and snapshot fallback |
| GET | /api/geocode?q=... | Photon search with a one-day shared cache |
| GET | /api/auth/me | Current account or null |
| POST | /api/auth/register, /api/auth/login | Create account / start session |
| POST | /api/auth/logout | Revoke session |
| GET, POST | /api/datasets | List / create the current account's datasets |
| GET, PUT, DELETE | /api/datasets/{id} | Read / update / delete an owned dataset |
| GET | /api/datasets/{id}/export.csv | Download an owned dataset |
| POST | /api/analyze | Optional, authenticated, rate-limited provider call |

Writes require JSON where a body is present and the X-Pacific-Request: 1 header. Cross-origin writes are rejected. Invalid data return field messages without echoing inputs. Failed saves preserve local observations.

Passwords use Argon2id. Random session tokens are stored only as SHA-256 hashes and delivered in HttpOnly, SameSite cookies; production cookies require HTTPS. Sessions expire after seven days and are revoked on logout. Dataset operations filter by owner. Database-backed rate limits cover login attempts and optional AI use. Each account may store 100 datasets of up to 2,000 validated observations.

These are username accounts. Email verification, password recovery, account administration and multi-factor authentication are not implemented.

## Vercel deployment

The repository uses the FastAPI framework preset with backend.main:app as its entrypoint. Vite builds React. FastAPI mounts dist/; Vercel's static-mount integration promotes it to the CDN. Original /api paths are preserved. See the [official FastAPI deployment documentation](https://vercel.com/docs/frameworks/backend/fastapi) and [Python runtime configuration](https://vercel.com/docs/functions/runtimes/python).

1. Provision persistent PostgreSQL and set DATABASE_URL for the deployment.
2. Set APP_ENV=production and APP_ORIGIN to the exact HTTPS origin visitors will use.
3. Initialize the empty database once with .venv\Scripts\python.exe -m backend.manage init-db using those environment variables.
4. Import the repository into Vercel. Tracked configuration selects FastAPI and builds React with npm ci --include=dev && npm run build. Python dependencies are in requirements.txt.
5. Keep preview and production databases separate. Set APP_ORIGIN for each environment.
6. Verify /api/health and exercise sign-in/save/reload on the deployed origin.

The initial schema initializer creates missing tables idempotently. It does not perform schema updates; future changes need reviewed migrations. Production does not create tables during requests.

This migration was verified locally with SQLite. No PostgreSQL service, deployment credentials or published environment were supplied. Hosted PostgreSQL behavior and Vercel publication have not been exercised.

## Verification recorded

- Strict TypeScript check and production React build passed.
- 8 core JavaScript tests passed.
- 22 API cases passed: persistence across app recreation, ownership isolation, session revocation/expiry, validation, size limits, CSRF, throttling, weather caching/fallback and disabled AI.
- 7 full-stack browser scenarios passed against the real API and database.
- 14 original browser checks and 15 restored-interaction groups passed.
- WebGL 2, WebGL 1 and canvas fallback passed, including graphics-context recovery.
- Initial browser resources: 557,894 bytes, below the existing 3 MB budget.
- Generated offline React preview opened from disk with zero HTTP requests.
- Mobile checked at 390 × 844 in browser emulation.

The backend tests emit Starlette's deprecation notice for the httpx test transport; all cases pass. Scientific preprocessing was unchanged. Live keyed AI and quantitative findings from the pending team radar data remain unverified.

Reports and screenshots are in ignored .artifacts/. Run npm run check for unit/API tests, types and build. Against npm start, run npm run test:browser, npm run test:fullstack. Rebuild the offline preview with npm run demo before checks that open it.
