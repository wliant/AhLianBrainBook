from pydantic import BaseModel


class SiblingSectionSummary(BaseModel):
    section_id: str
    section_type: str
    order: int
    preview: str


class NeuronContext(BaseModel):
    neuron_id: str
    neuron_title: str
    section_id: str
    brain_name: str
    cluster_name: str | None = None
    tags: list[str] = []
    sibling_sections_summary: list[SiblingSectionSummary] = []


class QuestionItem(BaseModel):
    id: str
    text: str
    input_type: str  # "single-select" | "multi-select" | "free-text"
    options: list[str] | None = None
    required: bool = True


class QuestionAnswer(BaseModel):
    question_id: str
    value: str | list[str]


class ConversationTurn(BaseModel):
    role: str  # "user" | "assistant"
    content: dict


class SectionAuthorRequest(BaseModel):
    section_type: str
    current_content: dict | None = None
    user_message: str = ""
    conversation_history: list[ConversationTurn] = []
    question_answers: list[QuestionAnswer] | None = None
    regenerate: bool = False
    context: NeuronContext


class SectionAuthorResponse(BaseModel):
    response_type: str  # "questions" | "content" | "message"
    questions: list[QuestionItem] | None = None
    section_content: dict | None = None
    message: str | None = None
    message_severity: str | None = None
    explanation: str | None = None
