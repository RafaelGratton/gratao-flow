from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings

settings = get_settings()
is_production = settings.environment.lower() == "production"


def get_cors_origins() -> list[str]:
    cors_origins = settings.cors_origins.strip().removeprefix("[").removesuffix("]")
    configured_origins = [
        origin.strip()
        for origin in cors_origins.split(",")
        if origin.strip() and origin.strip() != "*"
    ]

    if is_production:
        return configured_origins

    development_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    return list(dict.fromkeys([*development_origins, *configured_origins]))


app = FastAPI(
    title="Gratao Flow API",
    version="0.1.0",
    description="API do fluxo de producao da Gratao Uniformes.",
    docs_url=None if is_production else "/docs",
    redoc_url=None if is_production else "/redoc",
    openapi_url=None if is_production else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}
