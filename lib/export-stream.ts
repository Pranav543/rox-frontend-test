export type ExportStreamProgress = {
  type: "progress";
  percent: number;
  stage: string;
  step: number;
  totalSteps: number;
};

export type ExportStreamDone = {
  type: "done";
  filename: string;
  downloadUrl: string;
  durationSec: number;
  segmentCount: number;
};

export type ExportStreamError = {
  type: "error";
  error: string;
};

export type ExportStreamEvent =
  | ExportStreamProgress
  | ExportStreamDone
  | ExportStreamError;

export function parseExportStreamLine(line: string): ExportStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const data = JSON.parse(trimmed) as ExportStreamEvent;
  if (
    data.type === "progress" ||
    data.type === "done" ||
    data.type === "error"
  ) {
    return data;
  }
  return null;
}

/** Read NDJSON export stream from POST /api/export */
export async function consumeExportStream(
  response: Response,
  handlers: {
    onProgress?: (event: ExportStreamProgress) => void;
    onDone?: (event: ExportStreamDone) => void;
  }
): Promise<ExportStreamDone> {
  if (!response.body) {
    throw new Error("Export response has no body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let doneEvent: ExportStreamDone | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const event = parseExportStreamLine(line);
      if (!event) continue;
      if (event.type === "progress") {
        handlers.onProgress?.(event);
      } else if (event.type === "done") {
        doneEvent = event;
        handlers.onDone?.(event);
      } else if (event.type === "error") {
        throw new Error(event.error);
      }
    }
  }

  if (buffer.trim()) {
    const event = parseExportStreamLine(buffer);
    if (event?.type === "progress") handlers.onProgress?.(event);
    if (event?.type === "done") {
      doneEvent = event;
      handlers.onDone?.(event);
    }
    if (event?.type === "error") throw new Error(event.error);
  }

  if (!doneEvent) {
    throw new Error("Export finished without a result");
  }

  return doneEvent;
}
