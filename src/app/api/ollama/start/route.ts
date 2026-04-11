import { NextResponse } from "next/server";
import { exec } from "child_process";

export const dynamic = "force-dynamic";

export async function POST() {
  // Check if ollama binary exists
  const ollamaExists = await new Promise<boolean>((resolve) => {
    exec("which ollama", (err) => resolve(!err));
  });

  if (!ollamaExists) {
    return NextResponse.json(
      {
        success: false,
        error: "Ollama not found. Install from https://ollama.com",
      },
      { status: 404 },
    );
  }

  // Check if already running
  try {
    const res = await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      return NextResponse.json({
        success: true,
        message: "Ollama is already running",
      });
    }
  } catch {
    // Not running — proceed to start
  }

  // Try to start: macOS app first, fallback to CLI
  const started = await new Promise<boolean>((resolve) => {
    exec("open -a Ollama", (err) => {
      if (!err) {
        resolve(true);
        return;
      }
      // Fallback: start ollama serve in background
      const child = exec("ollama serve", { timeout: 0 });
      child.unref();
      resolve(true);
    });
  });

  if (!started) {
    return NextResponse.json(
      { success: false, error: "Failed to start Ollama" },
      { status: 500 },
    );
  }

  // Wait up to 10s for Ollama to come online
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch("http://localhost:11434/api/tags", {
        signal: AbortSignal.timeout(1000),
      });
      if (res.ok) {
        return NextResponse.json({
          success: true,
          message: "Ollama started successfully",
        });
      }
    } catch {
      // Keep waiting
    }
  }

  return NextResponse.json({
    success: true,
    message: "Ollama starting... may take a few seconds",
  });
}
