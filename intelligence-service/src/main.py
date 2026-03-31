from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.routers import agents, health

app = FastAPI(title="BrainBook Intelligence", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(agents.router, prefix="/api")
