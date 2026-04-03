"""Tests for the code intelligence endpoints and tree-sitter code analyzer."""


# --- Symbol extraction tests ---


class TestCodeStructure:
    def test_java_class_with_methods(self, client):
        code = """\
public class Calculator {
    private int value;

    public Calculator() {
        this.value = 0;
    }

    public int add(int a, int b) {
        return a + b;
    }

    public int getValue() {
        return value;
    }
}
"""
        response = client.post(
            "/api/code/structure",
            json={"content": code, "language": "java"},
        )
        assert response.status_code == 200
        data = response.json()
        symbols = data["symbols"]
        assert len(symbols) == 1
        cls = symbols[0]
        assert cls["name"] == "Calculator"
        assert cls["kind"] == "class"
        assert cls["startLine"] == 1
        # Class should have children: constructor + 2 methods
        children = cls["children"]
        child_names = [c["name"] for c in children]
        assert "Calculator" in child_names  # constructor
        assert "add" in child_names
        assert "getValue" in child_names

    def test_python_class_with_functions(self, client):
        code = """\
class Dog:
    def __init__(self, name):
        self.name = name

    def bark(self):
        return "woof"

def standalone():
    pass
"""
        response = client.post(
            "/api/code/structure",
            json={"content": code, "language": "python"},
        )
        assert response.status_code == 200
        symbols = response.json()["symbols"]
        assert len(symbols) == 2
        assert symbols[0]["name"] == "Dog"
        assert symbols[0]["kind"] == "class"
        assert len(symbols[0]["children"]) == 2
        assert symbols[1]["name"] == "standalone"
        assert symbols[1]["kind"] == "function"

    def test_typescript_interface_and_class(self, client):
        code = """\
interface Shape {
    area(): number;
}

class Circle implements Shape {
    constructor(private radius: number) {}

    area(): number {
        return Math.PI * this.radius ** 2;
    }
}
"""
        response = client.post(
            "/api/code/structure",
            json={"content": code, "language": "typescript"},
        )
        assert response.status_code == 200
        symbols = response.json()["symbols"]
        names = [s["name"] for s in symbols]
        assert "Shape" in names
        assert "Circle" in names

    def test_go_functions(self, client):
        code = """\
package main

func Add(a, b int) int {
    return a + b
}

func main() {
    Add(1, 2)
}
"""
        response = client.post(
            "/api/code/structure",
            json={"content": code, "language": "go"},
        )
        assert response.status_code == 200
        symbols = response.json()["symbols"]
        names = [s["name"] for s in symbols]
        assert "Add" in names
        assert "main" in names

    def test_rust_struct_and_impl(self, client):
        code = """\
struct Point {
    x: f64,
    y: f64,
}

impl Point {
    fn new(x: f64, y: f64) -> Self {
        Point { x, y }
    }

    fn distance(&self) -> f64 {
        (self.x * self.x + self.y * self.y).sqrt()
    }
}
"""
        response = client.post(
            "/api/code/structure",
            json={"content": code, "language": "rust"},
        )
        assert response.status_code == 200
        symbols = response.json()["symbols"]
        names = [s["name"] for s in symbols]
        assert "Point" in names

    def test_empty_file(self, client):
        response = client.post(
            "/api/code/structure",
            json={"content": "", "language": "python"},
        )
        assert response.status_code == 200
        assert response.json()["symbols"] == []

    def test_syntax_error_partial_parse(self, client):
        code = """\
def valid_func():
    pass

def broken(
    # missing closing paren and body

class StillFound:
    pass
"""
        response = client.post(
            "/api/code/structure",
            json={"content": code, "language": "python"},
        )
        assert response.status_code == 200
        symbols = response.json()["symbols"]
        names = [s["name"] for s in symbols]
        assert "valid_func" in names

    def test_unsupported_language(self, client):
        response = client.post(
            "/api/code/structure",
            json={"content": "code", "language": "brainfuck"},
        )
        assert response.status_code == 400


# --- Definition finding tests ---


class TestCodeDefinition:
    def test_find_method_definition_java(self, client):
        code = """\
public class Calc {
    public int add(int a, int b) {
        return a + b;
    }

    public void run() {
        int result = add(1, 2);
    }
}
"""
        # Cursor on "add" at line 7 (the call site)
        response = client.post(
            "/api/code/definition",
            json={"content": code, "language": "java", "line": 7, "col": 22},
        )
        assert response.status_code == 200
        location = response.json()["location"]
        assert location is not None
        assert location["line"] == 2  # method declaration line

    def test_find_function_definition_python(self, client):
        code = """\
def greet(name):
    return f"Hello, {name}"

result = greet("World")
"""
        # Cursor on "greet" at line 4
        response = client.post(
            "/api/code/definition",
            json={"content": code, "language": "python", "line": 4, "col": 9},
        )
        assert response.status_code == 200
        location = response.json()["location"]
        assert location is not None
        assert location["line"] == 1

    def test_no_definition_found(self, client):
        code = "x = unknown_func()"
        response = client.post(
            "/api/code/definition",
            json={"content": code, "language": "python", "line": 1, "col": 4},
        )
        assert response.status_code == 200
        # unknown_func has no declaration in this file
        assert response.json()["location"] is None

    def test_unsupported_language(self, client):
        response = client.post(
            "/api/code/definition",
            json={"content": "x", "language": "cobol", "line": 1, "col": 0},
        )
        assert response.status_code == 400


# --- Reference finding tests ---


class TestCodeReferences:
    def test_find_all_references_python(self, client):
        code = """\
def greet(name):
    return f"Hello, {name}"

greet("Alice")
greet("Bob")
"""
        # Cursor on "greet" at line 1 (the definition)
        response = client.post(
            "/api/code/references",
            json={"content": code, "language": "python", "line": 1, "col": 4},
        )
        assert response.status_code == 200
        refs = response.json()["references"]
        # definition + 2 call sites = 3
        assert len(refs) >= 3
        lines = [r["line"] for r in refs]
        assert 1 in lines
        assert 4 in lines
        assert 5 in lines

    def test_no_references(self, client):
        code = "x = 42"
        response = client.post(
            "/api/code/references",
            json={"content": code, "language": "python", "line": 1, "col": 100},
        )
        assert response.status_code == 200
        assert response.json()["references"] == []

    def test_unsupported_language(self, client):
        response = client.post(
            "/api/code/references",
            json={"content": "x", "language": "haskell", "line": 1, "col": 0},
        )
        assert response.status_code == 400
