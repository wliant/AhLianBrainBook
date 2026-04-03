from fastapi import APIRouter, HTTPException

from src.config import settings
from src.embedding import get_embeddings
from src.schemas.embeddings import EmbeddingRequest, EmbeddingResponse

router = APIRouter()


@router.post("/embeddings", response_model=EmbeddingResponse)
async def compute_embedding(request: EmbeddingRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text must not be empty")

    embeddings = get_embeddings()
    vector = await embeddings.aembed_query(request.text)

    return EmbeddingResponse(
        embedding=vector,
        model_name=settings.ollama_embedding_model,
        dimensions=len(vector),
    )
