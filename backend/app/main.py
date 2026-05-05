import json

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings

settings = get_settings()
is_production = settings.environment.lower() == "production"

DEFAULT_CORS_ORIGINS = [
    "https://gratao-flow-frontend.onrender.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


def parse_cors_origins(raw: str | None) -> list[str]:
    if not raw:
        return DEFAULT_CORS_ORIGINS

    raw = raw.strip()
    if not raw:
        return DEFAULT_CORS_ORIGINS

    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            values = parsed
        elif isinstance(parsed, str):
            values = parsed.split(",")
        else:
            values = []
    except json.JSONDecodeError:
        values = raw.split(",")

    origins = [
        item.strip()
        for item in values
        if isinstance(item, str) and item.strip()
    ]

    origins = [origin for origin in origins if origin != "*"]

    return list(dict.fromkeys([*DEFAULT_CORS_ORIGINS, *origins]))


app = FastAPI(
    title="Gratao Flow API",
    version="0.1.0",
    description="API do fluxo de producao da Gratao Uniformes.",
    docs_url=None if is_production else "/docs",
    redoc_url=None if is_production else "/redoc",
    openapi_url=None if is_production else "/openapi.json",
)

origins = parse_cors_origins(getattr(settings, "cors_origins", None)) or DEFAULT_CORS_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}
