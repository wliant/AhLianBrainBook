from pydantic import BaseModel


class EmbeddingRequest(BaseModel):
    text: str


class EmbeddingResponse(BaseModel):
    embedding: list[float]
    model_name: str
    dimensions: int
