// input.js — keyboard and mouse state, kept in one place so the game loop
// and the menus read the same keys. Keys are tracked by their `code`
// (KeyW, ArrowUp, Space...) so layouts do not matter.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // keys pressed since the last frame was consumed
  const mouse = { x: 0, y: 0, down: false, clicked: false, rightDown: false };

  const down = (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
  };
  const up = (e) => keys.delete(e.code);

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    // A click counts even without a prior mouse move: record the position here.
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
    if (e.button === 2) mouse.rightDown = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
    if (e.button === 2) mouse.rightDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    keys,
    mouse,
    down(code) { return keys.has(code); },
    /** True once, the frame the key went down. */
    wasPressed(code) { return pressed.has(code); },
    /** WASD/arrows as a -1..1 pair, normalised. */
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      return { x, y };
    },
    /** Clear the one-frame edges after the game has read them. */
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
  };
}
