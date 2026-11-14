// STUB: plain text prompts. The real glyph bar replaces this file (branch feat/input).
import type { Input, Prompt } from '../types';

/** Draws the always-visible prompt bar along the bottom of the screen. */
export function drawPrompts(ctx: CanvasRenderingContext2D, input: Input, prompts: Prompt[]): void {
  const parts = prompts.map((p) => {
    const g = p.action === 'move' ? (input.device === 'keyboard' ? 'WASD' : 'STICK') : input.glyph(p.action);
    return `[${g}] ${p.label}`;
  });
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 540 - 30, 960, 30);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(parts.join('    '), 480, 540 - 15);
  ctx.restore();
}
