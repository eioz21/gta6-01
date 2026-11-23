// Keyboard + mouse state. One instance, shared by the whole game.
// Keys are tracked by code (KeyW, ArrowUp, ...). justPressed() answers once.
const KEY_ALIASES = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'brake',
  KeyE: 'enter',
  KeyF: 'melee',
  KeyR: 'reload',
  KeyT: 'taxi',
  KeyM: 'mute',
  KeyP: 'pause', Escape: 'pause',
  Enter: 'confirm',
  Digit1: 'weapon1', Digit2: 'weapon2',
  KeyH: 'horn',
  KeyN: 'new',
  KeyQ: 'quit',
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mousePressed = false;
    this.anyKey = false;
    this._onKeyDown = (e) => {
      if (e.code === 'Space') e.preventDefault();
      const action = KEY_ALIASES[e.code];
      if (action) {
        if (!this.down.has(action)) this.pressed.add(action);
        this.down.add(action);
      }
      this.anyKey = true;
    };
    this._onKeyUp = (e) => {
      const action = KEY_ALIASES[e.code];
      if (action) this.down.delete(action);
    };
    this._onMouseMove = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
    };
    this._onMouseDown = (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mousePressed = true;
        this.anyKey = true;
      }
    };
    this._onMouseUp = (e) => { if (e.button === 0) this.mouseDown = false; };
    this._onBlur = () => { this.down.clear(); this.mouseDown = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
  }

  is(action) { return this.down.has(action); }
  justPressed(action) { return this.pressed.has(action); }
  // Call once per frame, after the game has read the input.
  endFrame() { this.pressed.clear(); this.mousePressed = false; this.anyKey = false; }
}
