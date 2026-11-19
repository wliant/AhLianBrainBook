from typing import Literal

from pydantic import BaseModel

QuestionType = Literal["free_text", "single_choice", "multi_choice"]


class ReviewQARequest(BaseModel):
    neuron_title: str
    content_text: str
    question_count: int = 5
    brain_name: str = ""
    tags: list[str] = []
    # Whether the caller wants multiple-choice questions at all. False means
    # free-text recall only.
    allow_choice_questions: bool = True
    # Gates web search. Off means LLM-only distractors, which are easier and unverified.
    tools_enabled: bool = False


class ReviewChoiceOption(BaseModel):
    id: str
    text: str
    correct: bool = False
    rationale: str = ""
    source_url: str | None = None


class ReviewQAItem(BaseModel):
    question: str
    answer: str
    # Defaults keep the pre-choices {question, answer} contract valid.
    question_type: QuestionType = "free_text"
    choices: list[ReviewChoiceOption] = []
    explanation: str = ""
    # True only when web research actually backed the distractors or verified the key.
    researched: bool = False


class ReviewQAResponse(BaseModel):
    items: list[ReviewQAItem] = []
    error: str | None = None
