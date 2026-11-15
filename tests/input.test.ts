import { describe, expect, it } from 'vitest';
import {
  applyDeadzone, createInputCore, stickVertical, type GamepadLike,
  STICK_VERTICAL_HOLD_RATIO, STICK_VERTICAL_RATIO,
} from '../src/input/core';

function makePad(): GamepadLike & { buttons: { pressed: boolean }[]; axes: number[] } {
  return {
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
  };
}

function setup(withPad = true) {
  const pad = makePad();
  let pads: (GamepadLike | null)[] = withPad ? [null, pad] : [];
  const input = createInputCore({ getGamepads: () => pads });
  return { input, pad, setPads: (p: (GamepadLike | null)[]) => { pads = p; } };
}

describe('keyboard', () => {
  it('held and pressed edges', () => {
    const { input } = setup(false);
    input.update();
    expect(input.held('quick')).toBe(false);
    input.keyDown('KeyJ');
    input.update();
    expect(input.pressed('quick')).toBe(true);
    expect(input.held('quick')).toBe(true);
    expect(input.anyPressed()).toBe(true);
    input.update();
    expect(input.pressed('quick')).toBe(false);
    expect(input.held('quick')).toBe(true);
    expect(input.anyPressed()).toBe(false);
    input.keyUp('KeyJ');
    input.update();
    expect(input.held('quick')).toBe(false);
  });

  it('a tap between two steps still registers once', () => {
    const { input } = setup(false);
    input.update();
    input.keyDown('Space');
    input.keyUp('Space');
    input.update();
    expect(input.pressed('confirm')).toBe(true);
    input.update();
    expect(input.held('confirm')).toBe(false);
  });

  it('alternate keys and digital move', () => {
    const { input } = setup(false);
    input.keyDown('ArrowLeft');
    input.keyDown('KeyS');
    input.update();
    expect(input.held('left')).toBe(true);
    expect(input.moveX()).toBe(-1);
    expect(input.moveY()).toBe(1);
    input.keyDown('KeyD');
    input.update();
    expect(input.moveX()).toBe(0);
  });

  it('blur clears keys', () => {
    const { input } = setup(false);
    input.keyDown('ShiftLeft');
    input.update();
    expect(input.held('defend')).toBe(true);
    input.clearKeys();
    input.update();
    expect(input.held('defend')).toBe(false);
  });
});

describe('gamepad', () => {
  it('button edges with a mocked pad, first non-null pad used', () => {
    const { input, pad } = setup();
    input.update();
    pad.buttons[2].pressed = true;
    input.update();
    expect(input.pressed('quick')).toBe(true);
    input.update();
    expect(input.pressed('quick')).toBe(false);
    expect(input.held('quick')).toBe(true);
    pad.buttons[2].pressed = false;
    input.update();
    expect(input.held('quick')).toBe(false);
  });

  it('confirm on A or Start, defend on B or RB', () => {
    const { input, pad } = setup();
    pad.buttons[9].pressed = true;
    pad.buttons[5].pressed = true;
    input.update();
    expect(input.pressed('confirm')).toBe(true);
    expect(input.pressed('defend')).toBe(true);
  });

  it('button 3 fires both heavy and shop', () => {
    const { input, pad } = setup();
    input.update();
    pad.buttons[3].pressed = true;
    input.update();
    expect(input.pressed('heavy')).toBe(true);
    expect(input.pressed('shop')).toBe(true);
  });

  it('stick deadzone and analogue moveX', () => {
    const { input, pad } = setup();
    pad.axes[0] = 0.2;
    input.update();
    expect(input.moveX()).toBe(0);
    expect(input.held('right')).toBe(false);
    pad.axes[0] = 0.4;
    input.update();
    expect(input.moveX()).toBeGreaterThan(0);
    expect(input.moveX()).toBeLessThan(0.5);
    expect(input.held('right')).toBe(false);
    // Steep enough to count as down (|y| >= 1.5|x|); -0.8 here would be a 51 deg tilt, now not down.
    pad.axes[0] = -0.6;
    pad.axes[1] = 1;
    input.update();
    expect(input.moveX()).toBeCloseTo(applyDeadzone(-0.6));
    expect(input.moveY()).toBe(1);
    expect(input.pressed('left')).toBe(true);
    expect(input.pressed('down')).toBe(true);
  });

  it('d-pad gives digital directions', () => {
    const { input, pad } = setup();
    pad.buttons[14].pressed = true;
    pad.buttons[12].pressed = true;
    input.update();
    expect(input.moveX()).toBe(-1);
    expect(input.moveY()).toBe(-1);
    expect(input.pressed('left')).toBe(true);
    expect(input.pressed('up')).toBe(true);
  });

  it('moveX clamps when stick and keys combine', () => {
    const { input, pad } = setup();
    pad.axes[0] = 1;
    input.keyDown('KeyD');
    input.update();
    expect(input.moveX()).toBe(1);
  });

  it('action held on both devices keeps one edge', () => {
    const { input, pad } = setup();
    input.update();
    input.keyDown('KeyJ');
    input.update();
    expect(input.pressed('quick')).toBe(true);
    pad.buttons[2].pressed = true;
    input.update();
    expect(input.pressed('quick')).toBe(false);
    input.keyUp('KeyJ');
    input.update();
    expect(input.held('quick')).toBe(true);
    expect(input.pressed('quick')).toBe(false);
  });

  it('no pad connected or getGamepads throwing is harmless', () => {
    const input = createInputCore({ getGamepads: () => { throw new Error('denied'); } });
    input.update();
    expect(input.moveX()).toBe(0);
    const { input: i2, setPads } = setup();
    setPads([null, null]);
    i2.update();
    expect(i2.held('confirm')).toBe(false);
  });

  it('reads getGamepads freshly every update (pad swapped at runtime)', () => {
    const { input, setPads } = setup(false);
    input.update();
    const pad = makePad();
    pad.buttons[0].pressed = true;
    setPads([pad]);
    input.update();
    expect(input.pressed('confirm')).toBe(true);
  });
});

/** Stick at `deg` off horizontal, magnitude `r`; sx/sy pick the quadrant (sy -1 = up). */
function tilt(pad: { axes: number[] }, deg: number, sx = 1, sy = -1, r = 1) {
  const rad = (deg * Math.PI) / 180;
  pad.axes[0] = sx * r * Math.cos(rad);
  pad.axes[1] = sy * r * Math.sin(rad);
}

const ONSET_DEG = (Math.atan(STICK_VERTICAL_RATIO) * 180) / Math.PI; // ~56.3
const RELEASE_DEG = (Math.atan(STICK_VERTICAL_HOLD_RATIO) * 180) / Math.PI; // ~50.2
const QUADRANTS = [[1, -1], [-1, -1], [1, 1], [-1, 1]] as const;

describe('stick up/down needs a clearly vertical tilt', () => {
  it('stickVertical: magnitude, cone and hysteresis', () => {
    expect(stickVertical(0, -1)).toBe(-1);
    expect(stickVertical(0, 1)).toBe(1);
    expect(stickVertical(0, -0.5)).toBe(-1);
    expect(stickVertical(0, 0.49)).toBe(0);
    expect(stickVertical(0.7071, -0.7071)).toBe(0); // 45 deg
    expect(stickVertical(1, 1)).toBe(0); // square-gate corner
    expect(stickVertical(0.6, -0.9)).toBe(-1); // exactly 1.5
    expect(stickVertical(0.61, -0.9)).toBe(0);
    expect(stickVertical(0.7, -0.9, -1)).toBe(-1); // held: 1.2 is enough
    expect(stickVertical(0.7, -0.9, 1)).toBe(0); // the other way is a fresh press
    expect(stickVertical(0.76, -0.9, -1)).toBe(0);
    expect(stickVertical(0, -0.4, -1)).toBe(0); // magnitude has no hysteresis
    expect(stickVertical(0, Number.NaN)).toBe(0);
  });

  it('pure up and pure down fire exactly as before', () => {
    for (const ay of [-1, -0.51, -0.5]) {
      const { input, pad } = setup();
      input.update();
      pad.axes[1] = ay;
      input.update();
      expect(input.pressed('up')).toBe(true);
      expect(input.held('down')).toBe(false);
    }
    for (const ay of [1, 0.51, 0.5]) {
      const { input, pad } = setup();
      input.update();
      pad.axes[1] = ay;
      input.update();
      expect(input.pressed('down')).toBe(true);
      expect(input.held('up')).toBe(false);
    }
    const { input, pad } = setup();
    pad.axes[1] = -0.49;
    input.update();
    expect(input.held('up')).toBe(false);
  });

  it('a full-tilt walk up to 45 deg off horizontal never jumps or crouches, in every quadrant', () => {
    for (const deg of [0, 15, 30, 45]) {
      for (const [sx, sy] of QUADRANTS) {
        const { input, pad } = setup();
        input.update();
        tilt(pad, deg, sx, sy);
        for (let f = 0; f < 5; f++) {
          input.update();
          expect(input.held('up')).toBe(false);
          expect(input.held('down')).toBe(false);
          expect(input.held(sx > 0 ? 'right' : 'left')).toBe(true);
          expect(input.held(sx > 0 ? 'left' : 'right')).toBe(false);
          expect(input.moveX()).toBe(applyDeadzone(pad.axes[0]));
          expect(input.moveY()).toBe(applyDeadzone(pad.axes[1]));
        }
      }
    }
  });

  it('a clearly vertical tilt with a little sideways lean still fires', () => {
    for (const deg of [60, 70, 80, 90]) {
      for (const [sx, sy] of QUADRANTS) {
        const { input, pad } = setup();
        input.update();
        tilt(pad, deg, sx, sy);
        input.update();
        expect(input.pressed(sy < 0 ? 'up' : 'down')).toBe(true);
        expect(input.held(sy < 0 ? 'down' : 'up')).toBe(false);
        expect(input.moveY()).toBe(applyDeadzone(pad.axes[1]));
      }
    }
    const { input, pad } = setup();
    pad.axes[0] = 0.3;
    pad.axes[1] = -0.9;
    input.update();
    expect(input.pressed('up')).toBe(true);
  });

  it('a slow sweep from horizontal to vertical and back gives one edge, on at ~56 deg, off at ~50', () => {
    for (const sy of [-1, 1] as const) {
      const act = sy < 0 ? 'up' : 'down';
      const { input, pad } = setup();
      input.update();
      const edges: number[] = [];
      let offAt = -1;
      for (let d = 0; d <= 90; d += 0.5) {
        tilt(pad, d, 1, sy);
        input.update();
        if (input.pressed(act)) edges.push(d);
      }
      for (let d = 90; d >= 0; d -= 0.5) {
        tilt(pad, d, 1, sy);
        input.update();
        if (input.pressed(act)) edges.push(d);
        if (offAt < 0 && !input.held(act)) offAt = d;
      }
      expect(edges).toHaveLength(1);
      expect(edges[0]).toBeGreaterThanOrEqual(ONSET_DEG);
      expect(edges[0]).toBeLessThan(ONSET_DEG + 0.5);
      expect(offAt).toBeLessThan(RELEASE_DEG);
      expect(offAt).toBeGreaterThan(RELEASE_DEG - 0.5);
    }
  });

  it('a thumb wobbling around either boundary does not repeat the edge', () => {
    // Deterministic +-2.5 deg wobble plus a little radial noise.
    const wobble = (i: number) => 2.5 * Math.sin(i * 2.1) * Math.cos(i * 0.7);
    const { input, pad } = setup();
    input.update();
    let edges = 0;
    for (let i = 0; i < 300; i++) {
      tilt(pad, ONSET_DEG + 1 + wobble(i), i % 2 ? 1 : -1, -1, 0.97 + 0.03 * Math.sin(i));
      input.update();
      if (input.pressed('up')) edges++;
    }
    expect(edges).toBe(1);

    // Resting just above the release angle from rest never fires at all.
    const b = setup();
    b.input.update();
    for (let i = 0; i < 300; i++) {
      tilt(b.pad, RELEASE_DEG + 3 + wobble(i), 1, 1);
      b.input.update();
      expect(b.input.held('down')).toBe(false);
    }
  });

  it('a 45 deg diagonal releases a held up, and pulling partway back does not refire it', () => {
    const { input, pad } = setup();
    tilt(pad, 90);
    input.update();
    expect(input.held('up')).toBe(true);
    tilt(pad, 45);
    input.update();
    expect(input.held('up')).toBe(false);
    tilt(pad, 53);
    input.update();
    expect(input.held('up')).toBe(false);
  });

  it('losing the pad resets the hysteresis', () => {
    const { input, pad, setPads } = setup();
    tilt(pad, 90);
    input.update();
    tilt(pad, 53);
    input.update();
    expect(input.held('up')).toBe(true);
    setPads([]);
    input.update();
    expect(input.held('up')).toBe(false);
    setPads([pad]);
    input.update();
    expect(input.held('up')).toBe(false);
  });

  it('d-pad stays plain digital: up+right gives both, also with the stick on a diagonal', () => {
    const { input, pad } = setup();
    pad.buttons[12].pressed = true;
    pad.buttons[15].pressed = true;
    input.update();
    expect(input.held('up')).toBe(true);
    expect(input.held('right')).toBe(true);
    expect(input.moveX()).toBe(1);
    expect(input.moveY()).toBe(-1);
    tilt(pad, 45, -1, 1);
    input.update();
    expect(input.held('up')).toBe(true);
    expect(input.held('down')).toBe(false);
  });
});

describe('device switching', () => {
  it('switches both ways and glyphs follow', () => {
    const { input, pad } = setup();
    input.update();
    expect(input.device).toBe('keyboard');
    expect(input.glyph('quick')).toBe('J');
    expect(input.glyph('confirm')).toBe('SPACE');
    pad.buttons[0].pressed = true;
    input.update();
    expect(input.device).toBe('gamepad');
    expect(input.glyph('quick')).toBe('X');
    expect(input.glyph('confirm')).toBe('A');
    expect(input.glyph('defend')).toBe('B');
    expect(input.glyph('heavy')).toBe('Y');
    // Pad button still held: a keydown (even unmapped) wins and stays.
    input.keyDown('KeyQ');
    expect(input.device).toBe('keyboard');
    input.update();
    expect(input.device).toBe('keyboard');
    expect(input.glyph('left')).toBe('A');
  });

  it('stick beyond 0.5 switches to gamepad', () => {
    const { input, pad } = setup();
    input.update();
    pad.axes[1] = -0.7;
    input.update();
    expect(input.device).toBe('gamepad');
  });

  it('stick drift does not flicker the device', () => {
    const { input, pad } = setup();
    input.keyDown('KeyA');
    for (let i = 0; i < 30; i++) {
      pad.axes[0] = i % 2 ? 0.1 : -0.1;
      pad.axes[1] = i % 3 ? 0.1 : 0;
      input.update();
      expect(input.device).toBe('keyboard');
      expect(input.moveX()).toBe(-1);
    }
  });
});

describe('autorepeat and composition', () => {
  it('repeat keydowns keep the key held with exactly one pressed edge', () => {
    const { input } = setup(false);
    let edges = 0;
    input.keyDown('KeyA', 'a');
    for (let i = 0; i < 10; i++) {
      input.update();
      if (input.pressed('left')) edges++;
      expect(input.held('left')).toBe(true);
      expect(input.moveX()).toBe(-1);
      input.keyDown('KeyA', 'a'); // autorepeat
    }
    expect(edges).toBe(1);
    input.keyUp('KeyA', 'a');
    input.update();
    expect(input.held('left')).toBe(false);
  });

  it('a repeat re-asserts the hold after a lost keyup', () => {
    const { input } = setup(false);
    input.keyDown('KeyA', 'a');
    input.update();
    input.keyUp('KeyA', 'a');
    input.keyDown('KeyA', 'a');
    input.update();
    expect(input.held('left')).toBe(true);
  });

  it('composition/dead/process keydowns still map by code', () => {
    const { input } = setup(false);
    expect(input.keyDown('KeyA', 'Process')).toEqual(['left']);
    expect(input.keyDown('KeyD', 'Dead')).toEqual(['right']);
    input.update();
    expect(input.held('left')).toBe(true);
    expect(input.held('right')).toBe(true);
    input.keyUp('KeyA', 'Process');
    input.update();
    expect(input.held('left')).toBe(false);
  });
});

describe('labelled-letter bindings', () => {
  it('AZERTY events move by label', () => {
    const { input } = setup(false);
    input.keyDown('KeyQ', 'a');
    input.keyDown('KeyZ', 'w');
    input.update();
    expect(input.held('left')).toBe(true);
    expect(input.held('up')).toBe(true);
    expect(input.moveX()).toBe(-1);
    expect(input.moveY()).toBe(-1);
  });

  it('US events are unchanged', () => {
    const { input } = setup(false);
    input.keyDown('KeyD', 'd');
    input.keyDown('KeyS', 's');
    input.keyDown('KeyE', 'e');
    input.update();
    expect(input.moveX()).toBe(1);
    expect(input.moveY()).toBe(1);
    expect(input.held('shop')).toBe(true);
    expect(input.held('left')).toBe(false);
  });

  it('action letters bind by label too', () => {
    const { input } = setup(false);
    input.keyDown('Semicolon', 'j');
    input.update();
    expect(input.pressed('quick')).toBe(true);
  });

  it('keyUp releases even when key differs from keyDown', () => {
    const { input } = setup(false);
    input.keyDown('KeyQ', 'a');
    input.update();
    input.keyUp('KeyQ', 'A');
    input.update();
    expect(input.held('left')).toBe(false);
    expect(input.moveX()).toBe(0);
  });

  it('code and key matching together count once', () => {
    const { input } = setup(false);
    expect(input.keyDown('KeyA', 'a')).toEqual(['left']);
    input.keyDown('KeyD', 'd');
    input.keyDown('ArrowRight', 'ArrowRight');
    input.update();
    expect(input.moveX()).toBe(0);
    input.keyUp('KeyD', 'd');
    input.update();
    expect(input.moveX()).toBe(0);
    input.keyUp('ArrowRight', 'ArrowRight');
    input.update();
    expect(input.moveX()).toBe(-1);
  });

  it('blur clears everything', () => {
    const { input } = setup(false);
    input.keyDown('KeyQ', 'a');
    input.keyDown('KeyZ', 'w');
    input.clearKeys();
    input.update();
    expect(input.held('left')).toBe(false);
    expect(input.moveX()).toBe(0);
    expect(input.moveY()).toBe(0);
    input.keyUp('KeyQ', 'a');
    input.update();
    expect(input.held('left')).toBe(false);
  });
});
