export interface ExecutionResult {
  stdout: string;
  stderr: string;
  error: string | null;
  duration: number;
}
