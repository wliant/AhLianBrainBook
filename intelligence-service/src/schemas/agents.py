from pydantic import BaseModel


class AgentRequest(BaseModel):
    input: str
    agent_type: str = "placeholder"


class AgentResponse(BaseModel):
    output: str
    agent_type: str
