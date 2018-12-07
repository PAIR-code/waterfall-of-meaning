export function isNear(y, top) {
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

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function toHSL(color) {
  return 'hsl(' + Math.abs(parseInt(color.h)) + ',' + Math.abs(parseInt(color.s)) + '%,' + Math.abs(parseInt(color.l)) + '%)';
}
