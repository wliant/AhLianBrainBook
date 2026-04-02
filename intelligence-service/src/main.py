import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.routers import agents, health


def _configure_logging() -> None:
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    # LangChain / httpx loggers: let them through at DEBUG, suppress at INFO+
    for name in ("langchain", "langchain_core", "langchain_anthropic", "langchain_ollama", "httpx", "httpcore"):
        logging.getLogger(name).setLevel(level if level <= logging.DEBUG else logging.WARNING)


_configure_logging()

app = FastAPI(title="BrainBook Intelligence", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(agents.router, prefix="/api")
