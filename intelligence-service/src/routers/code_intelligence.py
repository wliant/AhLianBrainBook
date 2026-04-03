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
def get_structure(request: CodeStructureRequest):
    tree = parse_code(request.content, request.language)
    if tree is None:
        raise HTTPException(400, f"Unsupported language: {request.language}")
    try:
        symbols = extract_symbols(tree, request.language)
    except Exception as e:
        raise HTTPException(400, f"Failed to extract symbols: {e}")
    return CodeStructureResponse(symbols=symbols)


@router.post("/code/definition", response_model=CodeDefinitionResponse)
def get_definition(request: CodeDefinitionRequest):
    tree = parse_code(request.content, request.language)
    if tree is None:
        raise HTTPException(400, f"Unsupported language: {request.language}")
    try:
        location = find_definition(tree, request.language, request.line, request.col)
    except Exception as e:
        raise HTTPException(400, f"Failed to find definition: {e}")
    return CodeDefinitionResponse(location=location)


@router.post("/code/references", response_model=CodeReferencesResponse)
def get_references(request: CodeReferencesRequest):
    tree = parse_code(request.content, request.language)
    if tree is None:
        raise HTTPException(400, f"Unsupported language: {request.language}")
    try:
        refs = find_references(tree, request.language, request.line, request.col)
    except Exception as e:
        raise HTTPException(400, f"Failed to find references: {e}")
    return CodeReferencesResponse(references=refs)
