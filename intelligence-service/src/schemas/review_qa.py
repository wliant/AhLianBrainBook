from typing import Literal

from pydantic import BaseModel

QuestionType = Literal["free_text", "single_choice", "multi_choice"]

# What formats a quiz may contain:
#   free_text   — recall only, no choice questions
#   mixed       — the agent picks a format per question
#   choice_only — every question must be single_choice or multi_choice
QuestionMode = Literal["free_text", "mixed", "choice_only"]


class ReviewQARequest(BaseModel):
    neuron_title: str
    content_text: str
    question_count: int = 5
    brain_name: str = ""
    tags: list[str] = []
    # Which question formats the quiz may contain.
    question_mode: QuestionMode = "mixed"
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
