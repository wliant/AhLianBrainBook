import httpx
from fastapi import APIRouter

from src.config import settings
from src.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    provider = settings.llm_provider.lower()
    llm_status = "unavailable"

    if provider == "anthropic":
        llm_status = "ok" if settings.anthropic_api_key else "not_configured"
    else:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{settings.ollama_base_url}/")
                if resp.status_code == 200:
                    llm_status = "ok"
        except Exception:
            pass

    return HealthResponse(status="ok", llm_provider=provider, llm_status=llm_status)
