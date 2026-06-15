import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import scan
from app.services.cache import clear_expired


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle events."""
    # Startup: ensure working directories exist
    os.makedirs(settings.tmp_repo_dir, exist_ok=True)
    os.makedirs(settings.cache_dir, exist_ok=True)

    # Clear expired cache entries on boot
    removed = clear_expired()
    if removed:
        print(f"Cleared {removed} expired cache entries")

    yield

    # Shutdown: nothing special needed


app = FastAPI(
    title="VulnaScan API",
    description="AI-powered GitHub repository vulnerability scanner",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins during dev; restrict in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scan.router)


@app.get("/")
def health_check():
    return {
        "status": "ok",
        "service": "VulnaScan API",
        "version": "1.0.0",
    }
