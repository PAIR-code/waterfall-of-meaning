/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

/** Utils for visualization.ts */

import * as THREE from 'three';

/** Is the y value near the top value? (Within 10.) */
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

/** Convert h, s and l values to a string to be used by THREE.js */
export function toHSL(h: number, s: number, l: number) {
  return 'hsl(' + h + ',' + s + '%,' + l + '%)';
}

/** Linearly interpolate between two values. */
export function lerp(lerpVal: number, low: number, high: number) {
  return low * lerpVal + high * (1 - lerpVal);
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
