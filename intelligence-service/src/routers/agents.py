from fastapi import APIRouter, HTTPException

from src.agents.placeholder import invoke_placeholder_agent
from src.agents.section_author import invoke_section_author
from src.agents.research_goal_generator import invoke_research_goal_generator
from src.agents.research_topic_generator import invoke_research_topic_generator
from src.agents.research_topic_scorer import invoke_research_topic_scorer
from src.agents.research_bullet_expander import invoke_research_bullet_expander
from src.schemas.agents import AgentRequest, AgentResponse
from src.schemas.section_author import SectionAuthorRequest, SectionAuthorResponse
from src.schemas.research import (
    GenerateGoalRequest, GenerateGoalResponse,
    GenerateTopicRequest, GenerateTopicResponse,
    ScoreTopicRequest, ScoreTopicResponse,
    ExpandBulletRequest, ExpandBulletResponse,
)

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


@router.post("/agents/research-goal-generator", response_model=GenerateGoalResponse)
async def research_goal_generator(request: GenerateGoalRequest):
    return await invoke_research_goal_generator(request)


@router.post("/agents/research-topic-generator", response_model=GenerateTopicResponse)
async def research_topic_generator(request: GenerateTopicRequest):
    return await invoke_research_topic_generator(request)


@router.post("/agents/research-topic-scorer", response_model=ScoreTopicResponse)
async def research_topic_scorer(request: ScoreTopicRequest):
    return await invoke_research_topic_scorer(request)


@router.post("/agents/research-bullet-expander", response_model=ExpandBulletResponse)
async def research_bullet_expander(request: ExpandBulletRequest):
    return await invoke_research_bullet_expander(request)
