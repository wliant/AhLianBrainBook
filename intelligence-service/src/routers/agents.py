import logging
import time

from fastapi import APIRouter, HTTPException

from src.agents.placeholder import invoke_placeholder_agent
from src.agents.section_author import invoke_section_author
from src.agents.research_goal_generator import invoke_research_goal_generator
from src.agents.research_topic_generator import invoke_research_topic_generator
from src.agents.research_topic_scorer import invoke_research_topic_scorer
from src.agents.research_bullet_expander import invoke_research_bullet_expander
from src.agents.review_qa_generator import invoke_review_qa_generator
from src.schemas.agents import AgentRequest, AgentResponse
from src.schemas.section_author import SectionAuthorRequest, SectionAuthorResponse
from src.schemas.research import (
    GenerateGoalRequest, GenerateGoalResponse,
    GenerateTopicRequest, GenerateTopicResponse,
    ScoreTopicRequest, ScoreTopicResponse,
    ExpandBulletRequest, ExpandBulletResponse,
)
from src.schemas.review_qa import ReviewQARequest, ReviewQAResponse

logger = logging.getLogger(__name__)

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
    neuron_title = getattr(request.context, "neuron_title", "?") if request.context else "?"
    logger.info("agent=section-author section_type=%s neuron=%s", request.section_type, neuron_title[:80])
    start = time.time()
    try:
        result = await invoke_section_author(request)
        logger.info("agent=section-author status=ok response_type=%s duration=%.2fs", result.response_type, time.time() - start)
        return result
    except Exception:
        logger.exception("agent=section-author status=error duration=%.2fs", time.time() - start)
        raise


@router.post("/agents/research-goal-generator", response_model=GenerateGoalResponse)
async def research_goal_generator(request: GenerateGoalRequest):
    logger.info("agent=research-goal-generator brain=%r description=%r", request.brain_name, request.brain_description[:80])
    start = time.time()
    try:
        result = await invoke_research_goal_generator(request)
        logger.info("agent=research-goal-generator status=ok goal_length=%d duration=%.2fs", len(result.research_goal), time.time() - start)
        return result
    except Exception:
        logger.exception("agent=research-goal-generator status=error duration=%.2fs", time.time() - start)
        raise


@router.post("/agents/research-topic-generator", response_model=GenerateTopicResponse)
async def research_topic_generator(request: GenerateTopicRequest):
    logger.info("agent=research-topic-generator prompt=%r brain=%r", request.prompt[:80], request.context.brain_name)
    start = time.time()
    try:
        result = await invoke_research_topic_generator(request)
        logger.info("agent=research-topic-generator status=ok title=%r items=%d duration=%.2fs", result.title, len(result.items), time.time() - start)
        return result
    except Exception:
        logger.exception("agent=research-topic-generator status=error duration=%.2fs", time.time() - start)
        raise


@router.post("/agents/research-topic-scorer", response_model=ScoreTopicResponse)
async def research_topic_scorer(request: ScoreTopicRequest):
    logger.info("agent=research-topic-scorer items=%d brain=%r", len(request.items), request.context.brain_name)
    start = time.time()
    try:
        result = await invoke_research_topic_scorer(request)
        logger.info("agent=research-topic-scorer status=ok completeness=%s duration=%.2fs", result.overall_completeness, time.time() - start)
        return result
    except Exception:
        logger.exception("agent=research-topic-scorer status=error duration=%.2fs", time.time() - start)
        raise


@router.post("/agents/research-bullet-expander", response_model=ExpandBulletResponse)
async def research_bullet_expander(request: ExpandBulletRequest):
    logger.info("agent=research-bullet-expander bullet=%r brain=%r", request.bullet.text[:80], request.context.brain_name)
    start = time.time()
    try:
        result = await invoke_research_bullet_expander(request)
        logger.info("agent=research-bullet-expander status=ok children=%d duration=%.2fs", len(result.children), time.time() - start)
        return result
    except Exception:
        logger.exception("agent=research-bullet-expander status=error duration=%.2fs", time.time() - start)
        raise


@router.post("/agents/review-qa-generator", response_model=ReviewQAResponse)
async def review_qa_generator(request: ReviewQARequest):
    logger.info("agent=review-qa-generator neuron=%r questions=%d brain=%r", request.neuron_title[:80], request.question_count, request.brain_name)
    start = time.time()
    try:
        result = await invoke_review_qa_generator(request)
        logger.info("agent=review-qa-generator status=ok items=%d duration=%.2fs", len(result.items), time.time() - start)
        return result
    except Exception:
        logger.exception("agent=review-qa-generator status=error duration=%.2fs", time.time() - start)
        raise
