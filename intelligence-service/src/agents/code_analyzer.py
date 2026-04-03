"""Tree-sitter based code analysis — symbol extraction, definition and reference finding."""

import tree_sitter
import tree_sitter_java
import tree_sitter_python
import tree_sitter_javascript
import tree_sitter_typescript
import tree_sitter_go
import tree_sitter_rust
import tree_sitter_c
import tree_sitter_cpp

from src.schemas.code_intelligence import CodeSymbol, Location

LANGUAGE_MAP: dict[str, tree_sitter.Language] = {
    "java": tree_sitter.Language(tree_sitter_java.language()),
    "python": tree_sitter.Language(tree_sitter_python.language()),
    "javascript": tree_sitter.Language(tree_sitter_javascript.language()),
    "typescript": tree_sitter.Language(tree_sitter_typescript.language_typescript()),
    "tsx": tree_sitter.Language(tree_sitter_typescript.language_tsx()),
    "go": tree_sitter.Language(tree_sitter_go.language()),
    "rust": tree_sitter.Language(tree_sitter_rust.language()),
    "c": tree_sitter.Language(tree_sitter_c.language()),
    "cpp": tree_sitter.Language(tree_sitter_cpp.language()),
}

# Maps language → {node_type: (kind_label, name_child_field)}
DECLARATION_TYPES: dict[str, dict[str, tuple[str, str]]] = {
    "java": {
        "class_declaration": ("class", "name"),
        "interface_declaration": ("interface", "name"),
        "method_declaration": ("method", "name"),
        "constructor_declaration": ("method", "name"),
        "enum_declaration": ("class", "name"),
        "field_declaration": ("variable", "declarator"),
    },
    "python": {
        "class_definition": ("class", "name"),
        "function_definition": ("function", "name"),
    },
    "javascript": {
        "class_declaration": ("class", "name"),
        "function_declaration": ("function", "name"),
        "method_definition": ("method", "name"),
        "variable_declaration": ("variable", "declarator"),
    },
    "typescript": {
        "class_declaration": ("class", "name"),
        "interface_declaration": ("interface", "name"),
        "function_declaration": ("function", "name"),
        "method_definition": ("method", "name"),
        "type_alias_declaration": ("interface", "name"),
        "variable_declaration": ("variable", "declarator"),
    },
    "tsx": {
        "class_declaration": ("class", "name"),
        "interface_declaration": ("interface", "name"),
        "function_declaration": ("function", "name"),
        "method_definition": ("method", "name"),
        "type_alias_declaration": ("interface", "name"),
        "variable_declaration": ("variable", "declarator"),
    },
    "go": {
        "function_declaration": ("function", "name"),
        "method_declaration": ("method", "name"),
        "type_declaration": ("class", "name"),
    },
    "rust": {
        "function_item": ("function", "name"),
        "struct_item": ("class", "name"),
        "impl_item": ("class", "type"),
        "trait_item": ("interface", "name"),
        "enum_item": ("class", "name"),
    },
    "c": {
        "function_definition": ("function", "declarator"),
        "struct_specifier": ("class", "name"),
        "enum_specifier": ("class", "name"),
    },
    "cpp": {
        "function_definition": ("function", "declarator"),
        "class_specifier": ("class", "name"),
        "struct_specifier": ("class", "name"),
        "enum_specifier": ("class", "name"),
    },
}


def parse_code(content: str, language: str) -> tree_sitter.Tree | None:
    """Parse source code with the appropriate tree-sitter grammar."""
    lang = LANGUAGE_MAP.get(language)
    if lang is None:
        return None
    parser = tree_sitter.Parser(lang)
    return parser.parse(content.encode("utf-8"))


def _extract_name(node: tree_sitter.Node, field: str) -> str:
    """Extract the symbol name from a declaration node."""
    child = node.child_by_field_name(field)
    if child is None:
        return ""
    # For variable declarations the name is nested in the declarator
    if child.type in ("variable_declarator", "init_declarator"):
        name_node = child.child_by_field_name("name")
        if name_node:
            return name_node.text.decode("utf-8")
    return child.text.decode("utf-8")


def _is_declaration(node_type: str, lang: str) -> tuple[str, str] | None:
    """Check if a node type is a declaration in the given language. Returns (kind, name_field) or None."""
    decl_map = DECLARATION_TYPES.get(lang, {})
    return decl_map.get(node_type)


def _walk_for_symbols(node: tree_sitter.Node, language: str) -> list[CodeSymbol]:
    """Walk AST children and collect declaration symbols."""
    symbols: list[CodeSymbol] = []
    for child in node.children:
        decl = _is_declaration(child.type, language)
        if decl:
            kind, name_field = decl
            name = _extract_name(child, name_field)
            if not name:
                continue
            children = _walk_for_symbols(child, language)
            symbols.append(
                CodeSymbol(
                    name=name,
                    kind=kind,
                    startLine=child.start_point.row + 1,  # 1-indexed
                    endLine=child.end_point.row + 1,
                    children=children,
                )
            )
        else:
            # Recurse into non-declaration nodes to find nested declarations
            symbols.extend(_walk_for_symbols(child, language))
    return symbols


def extract_symbols(tree: tree_sitter.Tree, language: str) -> list[CodeSymbol]:
    """Extract hierarchical code symbols from a parsed tree."""
    return _walk_for_symbols(tree.root_node, language)


def _get_identifier_at(tree: tree_sitter.Tree, line: int, col: int) -> str | None:
    """Get the identifier text at the given (1-indexed) line and column."""
    # Convert to 0-indexed for tree-sitter
    row = line - 1
    point = tree_sitter.Point(row=row, column=col)
    node = tree.root_node.descendant_for_point_range(point, point)
    if node is None:
        return None
    # Walk up to find the nearest identifier
    while node and node.type != "identifier" and node.type != "type_identifier":
        if node.parent and node.parent.start_point.row == row:
            node = node.parent
        else:
            break
    if node and node.type in ("identifier", "type_identifier"):
        return node.text.decode("utf-8")
    return None


def _find_declaration_nodes(
    node: tree_sitter.Node, name: str, language: str
) -> list[tree_sitter.Node]:
    """Find all declaration nodes matching the given name."""
    results: list[tree_sitter.Node] = []
    decl = _is_declaration(node.type, language)
    if decl:
        _, name_field = decl
        extracted = _extract_name(node, name_field)
        if extracted == name:
            results.append(node)
    for child in node.children:
        results.extend(_find_declaration_nodes(child, name, language))
    return results


def find_definition(
    tree: tree_sitter.Tree, language: str, line: int, col: int
) -> Location | None:
    """Find the definition of the symbol at the given cursor position."""
    identifier = _get_identifier_at(tree, line, col)
    if not identifier:
        return None
    decl_nodes = _find_declaration_nodes(tree.root_node, identifier, language)
    if not decl_nodes:
        return None
    # Return the first declaration found
    target = decl_nodes[0]
    name_child = target.child_by_field_name("name") or target
    return Location(
        line=name_child.start_point.row + 1,
        col=name_child.start_point.column,
    )


def _find_all_identifiers(
    node: tree_sitter.Node, name: str
) -> list[tree_sitter.Node]:
    """Find all identifier nodes with the given name."""
    results: list[tree_sitter.Node] = []
    if node.type in ("identifier", "type_identifier"):
        if node.text.decode("utf-8") == name:
            results.append(node)
    for child in node.children:
        results.extend(_find_all_identifiers(child, name))
    return results


def find_references(
    tree: tree_sitter.Tree, language: str, line: int, col: int
) -> list[Location]:
    """Find all references to the symbol at the given cursor position."""
    identifier = _get_identifier_at(tree, line, col)
    if not identifier:
        return []
    id_nodes = _find_all_identifiers(tree.root_node, identifier)
    return [
        Location(line=n.start_point.row + 1, col=n.start_point.column)
        for n in id_nodes
    ]
