from typing import TypedDict

from langchain_core.messages import BaseMessage, HumanMessage
from langgraph.graph import END, START, StateGraph

from src.llm import get_llm


class AgentState(TypedDict):
    messages: list[BaseMessage]


_compiled_graph = None


def _get_graph():
    global _compiled_graph
    if _compiled_graph is None:
        llm = get_llm()

        def invoke_llm(state: AgentState) -> AgentState:
            response = llm.invoke(state["messages"])
            return {"messages": state["messages"] + [response]}

        graph = StateGraph(AgentState)
        graph.add_node("invoke_llm", invoke_llm)
        graph.add_edge(START, "invoke_llm")
        graph.add_edge("invoke_llm", END)
        _compiled_graph = graph.compile()
    return _compiled_graph


async def invoke_placeholder_agent(user_input: str) -> str:
    agent = _get_graph()
    result = await agent.ainvoke({"messages": [HumanMessage(content=user_input)]})
    return result["messages"][-1].content
