import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRunMock, deleteRunMock, isRunActiveMock } = vi.hoisted(() => ({
  getRunMock: vi.fn(),
  deleteRunMock: vi.fn(),
  isRunActiveMock: vi.fn(),
}));

vi.mock("@/lib/db/queries", () => ({
  getRun: getRunMock,
  deleteRun: deleteRunMock,
}));

vi.mock("@/lib/engine/run-registry", () => ({
  isRunActive: isRunActiveMock,
}));

vi.mock("@/lib/utils/request-security", () => ({
  requireTrustedLocalRequest: vi.fn(() => null),
  enforceRouteRateLimit: vi.fn(() => null),
}));

import { DELETE } from "../../src/app/api/evolution/[id]/route";

describe("DELETE /api/evolution/[id]", () => {
  beforeEach(() => {
    getRunMock.mockReset();
    deleteRunMock.mockReset();
    isRunActiveMock.mockReset();
  });

  it("returns 409 for an active run", async () => {
    getRunMock.mockReturnValue({ id: "run-1", status: "running" });
    isRunActiveMock.mockReturnValue(true);

    const response = await DELETE(new Request("http://localhost/api/evolution/run-1", {
      method: "DELETE",
    }), {
      params: Promise.resolve({ id: "run-1" }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        error: expect.stringContaining("Cannot delete an active run"),
      }),
    );
    expect(deleteRunMock).not.toHaveBeenCalled();
  });

  it("deletes a completed run", async () => {
    getRunMock.mockReturnValue({ id: "run-2", status: "completed" });
    isRunActiveMock.mockReturnValue(false);

    const response = await DELETE(new Request("http://localhost/api/evolution/run-2", {
      method: "DELETE",
    }), {
      params: Promise.resolve({ id: "run-2" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deleted: true });
    expect(deleteRunMock).toHaveBeenCalledWith("run-2");
  });
});
