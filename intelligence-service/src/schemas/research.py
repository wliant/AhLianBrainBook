from pydantic import BaseModel


class NeuronSummary(BaseModel):
    neuron_id: str
    title: str
    content_preview: str = ""


class BrainContext(BaseModel):
    brain_name: str
    research_goal: str = ""
    neurons: list[NeuronSummary] = []


class BulletItem(BaseModel):
    id: str
    text: str
    explanation: str = ""
    completeness: str = "none"  # none | partial | good | complete
    linked_neuron_ids: list[str] = []
    children: list["BulletItem"] = []


# --- Goal Generator ---


class GenerateGoalRequest(BaseModel):
    brain_name: str
    neurons: list[NeuronSummary] = []


class GenerateGoalResponse(BaseModel):
    research_goal: str


# --- Topic Generator ---


class GenerateTopicRequest(BaseModel):
    prompt: str
    context: BrainContext


class GenerateTopicResponse(BaseModel):
    title: str
    items: list[BulletItem] = []
    overall_completeness: str = "none"


# --- Topic Scorer ---


class ScoreTopicRequest(BaseModel):
    items: list[BulletItem]
    context: BrainContext


class ScoreTopicResponse(BaseModel):
    items: list[BulletItem]
    overall_completeness: str = "none"


# --- Bullet Expander ---


class ExpandBulletRequest(BaseModel):
    bullet: BulletItem
    parent_context: str = ""
    context: BrainContext


class ExpandBulletResponse(BaseModel):
    children: list[BulletItem] = []
