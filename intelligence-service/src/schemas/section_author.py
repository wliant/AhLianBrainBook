from pydantic import BaseModel, ConfigDict


class SiblingSectionSummary(BaseModel):
    section_id: str
    section_type: str
    order: int
    preview: str


class KnowledgeContextItem(BaseModel):
    neuron_id: str
    title: str
    content_preview: str
    tags: list[str] = []
    relationship: str
    score: float


class NeuronContext(BaseModel):
    neuron_id: str
    neuron_title: str
    section_id: str
    brain_name: str
    cluster_name: str | None = None
    tags: list[str] = []
    sibling_sections_summary: list[SiblingSectionSummary] = []
    knowledge_context: list[KnowledgeContextItem] = []
    brain_id: str = ""


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
    model_config = ConfigDict(populate_by_name=True)

    section_type: str
    current_content: dict | None = None
    user_message: str = ""
    conversation_history: list[ConversationTurn] = []
    question_answers: list[QuestionAnswer] | None = None
    regenerate: bool = False
    tools_enabled: bool = False
    context: NeuronContext


class SectionAuthorResponse(BaseModel):
    response_type: str  # "questions" | "content" | "message"
    questions: list[QuestionItem] | None = None
    section_content: dict | None = None
    message: str | None = None
    message_severity: str | None = None
    explanation: str | None = None
