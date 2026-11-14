// STUB: keyboard only. The real keyboard + gamepad layer replaces this file (branch feat/input).
import type { Action, Device, Input } from '../types';

const KEYS: Record<Action, string[]> = {
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
  confirm: ['Space', 'Enter'], quick: ['KeyJ'], heavy: ['KeyK'],
  defend: ['KeyL', 'ShiftLeft', 'ShiftRight'], shop: ['KeyE'],
};
const GLYPH: Record<Action, string> = {
  left: 'A', right: 'D', up: 'W', down: 'S', confirm: 'SPACE', quick: 'J', heavy: 'K', defend: 'L', shop: 'E',
};

export function createInput(target: Window = window): Input {
  const down = new Set<string>();
  let now = new Set<Action>();
  let prev = new Set<Action>();
  target.addEventListener('keydown', (e) => {
    down.add(e.code);
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  target.addEventListener('keyup', (e) => down.delete(e.code));
  target.addEventListener('blur', () => down.clear());
  const device: Device = 'keyboard';
  return {
    update() {
      prev = now;
      now = new Set((Object.keys(KEYS) as Action[]).filter((a) => KEYS[a].some((k) => down.has(k))));
    },
    held: (a) => now.has(a),
    pressed: (a) => now.has(a) && !prev.has(a),
    moveX: () => (now.has('right') ? 1 : 0) - (now.has('left') ? 1 : 0),
    moveY: () => (now.has('down') ? 1 : 0) - (now.has('up') ? 1 : 0),
    anyPressed: () => [...now].some((a) => !prev.has(a)),
    device,
    glyph: (a) => GLYPH[a],
  };
}
