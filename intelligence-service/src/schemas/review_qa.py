from pydantic import BaseModel


class ReviewQARequest(BaseModel):
    neuron_title: str
    content_text: str
    question_count: int = 5
    brain_name: str = ""
    tags: list[str] = []


class ReviewQAItem(BaseModel):
    question: str
    answer: str


class ReviewQAResponse(BaseModel):
    items: list[ReviewQAItem] = []
    error: str | None = None
