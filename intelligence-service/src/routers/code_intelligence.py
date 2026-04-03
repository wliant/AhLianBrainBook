from fastapi import APIRouter, HTTPException

from src.agents.code_analyzer import (
    parse_code,
    extract_symbols,
    find_definition,
    find_references,
)
from src.schemas.code_intelligence import (
    CodeStructureRequest,
    CodeStructureResponse,
    CodeDefinitionRequest,
    CodeDefinitionResponse,
    CodeReferencesRequest,
    CodeReferencesResponse,
)

router = APIRouter()


@router.post("/code/structure", response_model=CodeStructureResponse)
async def get_structure(request: CodeStructureRequest):
    tree = parse_code(request.content, request.language)
    if tree is None:
        raise HTTPException(400, f"Unsupported language: {request.language}")
    symbols = extract_symbols(tree, request.language)
    return CodeStructureResponse(symbols=symbols)


@router.post("/code/definition", response_model=CodeDefinitionResponse)
async def get_definition(request: CodeDefinitionRequest):
    tree = parse_code(request.content, request.language)
    if tree is None:
        raise HTTPException(400, f"Unsupported language: {request.language}")
    location = find_definition(tree, request.language, request.line, request.col)
    return CodeDefinitionResponse(location=location)


@router.post("/code/references", response_model=CodeReferencesResponse)
async def get_references(request: CodeReferencesRequest):
    tree = parse_code(request.content, request.language)
    if tree is None:
        raise HTTPException(400, f"Unsupported language: {request.language}")
    refs = find_references(tree, request.language, request.line, request.col)
    return CodeReferencesResponse(references=refs)
