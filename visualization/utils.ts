import * as THREE from 'three';

export function isNear(y: number, top: number) {
  return (y < top && y > top - 10)
}

/** Make a sprite to use as a rain drop. */
export function makeSprite() {
  const canvas = document.createElement('canvas');
  const size = 16;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');

  context.beginPath();
  context.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI, false);
  context.fillStyle = 'white';
  context.fill();

  const sprite = new THREE.Texture(canvas);
  sprite.needsUpdate = true;
  return sprite
}

export function toHSL(h: number, s: number, l: number) {
  return 'hsl(' + h + ',' + s + '%,' + l + '%)';
}

export function lerp(lerpVal: number, low: number, high: number) {
  return low * lerpVal + high * (1 - lerpVal);
}
