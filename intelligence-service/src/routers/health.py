import httpx
from fastapi import APIRouter

from src.config import settings
from src.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    ollama_status = "unavailable"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.ollama_base_url}/")
            if resp.status_code == 200:
                ollama_status = "ok"
    except Exception:
        pass

    return HealthResponse(status="ok", ollama=ollama_status)
