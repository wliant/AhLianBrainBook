from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    llm_provider: str
    llm_status: str = "ok"
