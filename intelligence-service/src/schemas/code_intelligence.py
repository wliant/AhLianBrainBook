from pydantic import BaseModel


class CodeStructureRequest(BaseModel):
    content: str
    language: str


class CodeSymbol(BaseModel):
    name: str
    kind: str  # "class", "interface", "method", "function", "variable", etc.
    startLine: int
    endLine: int
    children: list["CodeSymbol"] = []


class CodeStructureResponse(BaseModel):
    symbols: list[CodeSymbol]


class CodeDefinitionRequest(BaseModel):
    content: str
    language: str
    line: int
    col: int


class Location(BaseModel):
    file: str | None = None
    line: int
    col: int


class CodeDefinitionResponse(BaseModel):
    location: Location | None = None


class CodeReferencesRequest(BaseModel):
    content: str
    language: str
    line: int
    col: int


class CodeReferencesResponse(BaseModel):
    references: list[Location]
