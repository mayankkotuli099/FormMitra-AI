import asyncio
import contextlib

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import UPLOAD_FOLDER, GENERATED_FOLDER, CORS_ORIGINS
from core.logging_config import setup_logging

logger = setup_logging()

from api.routes import router as http_router
from api.websocket import router as websocket_router
from services.session_manager import cleanup_expired_sessions

_SESSION_CLEANUP_INTERVAL_SECONDS = 600


async def _session_cleanup_loop():
    while True:
        await asyncio.sleep(_SESSION_CLEANUP_INTERVAL_SECONDS)
        removed = cleanup_expired_sessions()
        if removed:
            print(f"Session cleanup: evicted {removed} expired session(s)")


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_session_cleanup_loop())
    try:
        yield
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="FormMitra AI Backend", lifespan=lifespan)

# allow_credentials=True cannot be combined with a wildcard origin (the
# browser will reject it); CORS_ORIGINS is now an explicit list (see
# core/config.py) so this actually works instead of silently failing in
# production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/uploads",
    StaticFiles(directory=UPLOAD_FOLDER),
    name="uploads"
)

app.mount(
    "/generated",
    StaticFiles(directory=GENERATED_FOLDER),
    name="generated"
)

app.include_router(http_router, prefix="/api")
app.include_router(websocket_router, prefix="/api/ws")


@app.get("/")
async def root():
    return {"message": "FormMitra AI Backend is running."}