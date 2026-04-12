import {
  normalizeOllamaBaseUrl,
  requireTrustedLocalRequest,
} from "../../src/lib/utils/request-security";

describe("request-security", () => {
  const originalAllowRemoteAccess = process.env.ALLOW_REMOTE_ACCESS;
  const originalAllowedHosts = process.env.OLLAMA_ALLOWED_HOSTS;

  afterEach(() => {
    process.env.ALLOW_REMOTE_ACCESS = originalAllowRemoteAccess;
    process.env.OLLAMA_ALLOWED_HOSTS = originalAllowedHosts;
  });

  it("accepts localhost Ollama URLs in local-only mode", () => {
    process.env.ALLOW_REMOTE_ACCESS = "false";
    process.env.OLLAMA_ALLOWED_HOSTS = "";

    expect(normalizeOllamaBaseUrl("http://localhost:11434")).toBe(
      "http://localhost:11434",
    );
  });

  it("rejects remote Ollama URLs when they are not allowlisted", () => {
    process.env.ALLOW_REMOTE_ACCESS = "false";
    process.env.OLLAMA_ALLOWED_HOSTS = "";

    expect(() => normalizeOllamaBaseUrl("https://example.com")).toThrow(
      /localhost/i,
    );
  });

  it("allows an explicit remote Ollama host only when allowlisted", () => {
    process.env.ALLOW_REMOTE_ACCESS = "true";
    process.env.OLLAMA_ALLOWED_HOSTS = "ollama.internal";

    expect(normalizeOllamaBaseUrl("https://ollama.internal")).toBe(
      "https://ollama.internal",
    );
  });

  it("blocks remote requests in local-only mode", async () => {
    process.env.ALLOW_REMOTE_ACCESS = "false";

    const response = requireTrustedLocalRequest(
      new Request("https://prompt-evolution.app/api/evolution/start"),
      "Evolution start",
    );

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual(
      expect.objectContaining({
        error: expect.stringContaining("local-only mode"),
      }),
    );
  });
});
