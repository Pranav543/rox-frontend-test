import { describe, expect, it } from "vitest";
import { parseExportStreamLine } from "./export-stream";

describe("parseExportStreamLine", () => {
  it("parses progress events", () => {
    const e = parseExportStreamLine(
      '{"type":"progress","percent":40,"stage":"Encoding","step":2,"totalSteps":5}'
    );
    expect(e?.type).toBe("progress");
    if (e?.type === "progress") {
      expect(e.percent).toBe(40);
      expect(e.step).toBe(2);
    }
  });

  it("parses done events", () => {
    const e = parseExportStreamLine(
      '{"type":"done","filename":"out.mp4","downloadUrl":"/api/export/out.mp4","durationSec":90,"segmentCount":3}'
    );
    expect(e?.type).toBe("done");
    if (e?.type === "done") {
      expect(e.filename).toBe("out.mp4");
    }
  });

  it("parses error events", () => {
    const e = parseExportStreamLine('{"type":"error","error":"ffmpeg failed"}');
    expect(e?.type).toBe("error");
  });
});
