from fastapi import APIRouter, HTTPException

from src.agents.placeholder import invoke_placeholder_agent
from src.agents.section_author import invoke_section_author
from src.schemas.agents import AgentRequest, AgentResponse
from src.schemas.section_author import SectionAuthorRequest, SectionAuthorResponse

router = APIRouter()

AGENT_REGISTRY = {
    "placeholder": invoke_placeholder_agent,
}


@router.post("/agents/invoke", response_model=AgentResponse)
async def invoke_agent(request: AgentRequest):
    agent_fn = AGENT_REGISTRY.get(request.agent_type)
    if agent_fn is None:
        available = list(AGENT_REGISTRY.keys())
        raise HTTPException(
            status_code=400,
            detail=f"Unknown agent_type '{request.agent_type}'. Available: {available}",
        )

    output = await agent_fn(request.input)
    return AgentResponse(output=output, agent_type=request.agent_type)


@router.post("/agents/section-author", response_model=SectionAuthorResponse)
async def section_author(request: SectionAuthorRequest):
    return await invoke_section_author(request)
