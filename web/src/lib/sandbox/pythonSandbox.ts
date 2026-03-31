import type { ExecutionResult } from "./types";

const TIMEOUT_MS = 10000;
const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.mjs";

let pyodidePromise: Promise<unknown> | null = null;

interface PyodideInterface {
  runPython: (code: string) => unknown;
  runPythonAsync: (code: string) => Promise<unknown>;
}

async function loadPyodideRuntime(): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      const { loadPyodide } = await import(/* webpackIgnore: true */ PYODIDE_CDN);
      return await loadPyodide();
    })();
  }
  return pyodidePromise as Promise<PyodideInterface>;
}

export async function executePython(code: string): Promise<ExecutionResult> {
  const start = performance.now();

  try {
    const pyodide = await Promise.race([
      loadPyodideRuntime(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Pyodide loading timed out")), TIMEOUT_MS)
      ),
    ]);

    // Capture stdout/stderr
    const captureCode = `
import sys, io
_stdout = io.StringIO()
_stderr = io.StringIO()
sys.stdout = _stdout
sys.stderr = _stderr
_result = None
try:
    exec(${JSON.stringify(code)})
except Exception as _e:
    print(str(_e), file=sys.stderr)
finally:
    sys.stdout = sys.__stdout__
    sys.stderr = sys.__stderr__
(_stdout.getvalue(), _stderr.getvalue())
`;

    const result = await Promise.race([
      pyodide.runPythonAsync(captureCode),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Execution timed out (10s limit)")), TIMEOUT_MS)
      ),
    ]);

    const duration = Math.round(performance.now() - start);

    // result is a tuple (stdout, stderr)
    const [stdout, stderr] = result as [string, string];

    return {
      stdout: stdout || "",
      stderr: stderr || "",
      error: stderr ? null : null,
      duration,
    };
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    return {
      stdout: "",
      stderr: "",
      error: err instanceof Error ? err.message : String(err),
      duration,
    };
  }
}
