import type { ExecutionResult } from "./types";

const TIMEOUT_MS = 5000;

const IFRAME_SRCDOC = `<!DOCTYPE html><html><body><script>
window.addEventListener('message', function(e) {
  if (e.data.type !== 'execute') return;
  var logs = [];
  var origLog = console.log;
  var origWarn = console.warn;
  var origError = console.error;
  console.log = function() { logs.push({ level: 'log', text: Array.prototype.map.call(arguments, String).join(' ') }); };
  console.warn = function() { logs.push({ level: 'warn', text: Array.prototype.map.call(arguments, String).join(' ') }); };
  console.error = function() { logs.push({ level: 'error', text: Array.prototype.map.call(arguments, String).join(' ') }); };
  try {
    var result = (0, eval)(e.data.code);
    parent.postMessage({
      type: 'result',
      logs: logs,
      returnValue: result !== undefined ? String(result) : null,
      error: null
    }, '*');
  } catch (err) {
    parent.postMessage({
      type: 'result',
      logs: logs,
      returnValue: null,
      error: err.message || String(err)
    }, '*');
  }
  console.log = origLog;
  console.warn = origWarn;
  console.error = origError;
});
<\/script></body></html>`;

export function executeJavaScript(code: string): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    const start = performance.now();
    const iframe = document.createElement("iframe");
    iframe.sandbox.add("allow-scripts");
    iframe.srcdoc = IFRAME_SRCDOC;
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    let resolved = false;

    const cleanup = () => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
      window.removeEventListener("message", handleMessage);
    };

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve({
          stdout: "",
          stderr: "",
          error: "Execution timed out (5s limit)",
          duration: TIMEOUT_MS,
        });
      }
    }, TIMEOUT_MS);

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "result") return;
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      cleanup();

      const duration = Math.round(performance.now() - start);
      const logs = event.data.logs || [];
      const stdout = logs
        .filter((l: { level: string }) => l.level === "log" || l.level === "warn")
        .map((l: { text: string }) => l.text)
        .join("\n");
      const stderr = logs
        .filter((l: { level: string }) => l.level === "error")
        .map((l: { text: string }) => l.text)
        .join("\n");

      let fullStdout = stdout;
      if (event.data.returnValue !== null && event.data.returnValue !== "undefined") {
        fullStdout = fullStdout
          ? `${fullStdout}\n→ ${event.data.returnValue}`
          : `→ ${event.data.returnValue}`;
      }

      resolve({
        stdout: fullStdout,
        stderr,
        error: event.data.error,
        duration,
      });
    };

    window.addEventListener("message", handleMessage);

    iframe.onload = () => {
      if (!resolved && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: "execute", code }, "*");
      }
    };
  });
}
