import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

export type Frame = { file: string; at: number };

const INTERVAL = 1 / 30;

export async function startCapture(page: Page, dir: string) {
  mkdirSync(dir, { recursive: true });
  const frames: Frame[] = [];
  let running = true;
  let failed = false;

  const loop = (async () => {
    let counter = 0;
    while (running) {
      const began = Date.now() / 1000;
      try {
        const shot = await page.screenshot({
          type: "jpeg",
          quality: 90,
          scale: "device",
        });
        const file = `f${String(counter++).padStart(6, "0")}.jpg`;
        writeFileSync(path.join(dir, file), shot);
        frames.push({ file, at: began });
      } catch (error) {
        if (!failed) {
          failed = true;
          console.error("capture failed:", (error as Error).message);
        }
      }
      const spent = Date.now() / 1000 - began;
      if (spent < INTERVAL) {
        await new Promise((resolve) => setTimeout(resolve, (INTERVAL - spent) * 1000));
      }
    }
  })();

  return async function stop() {
    running = false;
    await loop;
    writeFileSync(path.join(dir, "frames.json"), JSON.stringify(frames));
    return frames.length;
  };
}
