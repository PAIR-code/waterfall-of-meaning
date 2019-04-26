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
import Dexie from 'dexie';
import * as BadWords from '../badwords'
var $ = require('jquery');
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
  context.ellipse(size / 2, size / 2, size / 10, size / 2, 0, 0, 2 * Math.PI);

  context.fillStyle = '#777';
  context.fill();

  const sprite = new THREE.Texture(canvas);
  sprite.needsUpdate = true;
  return sprite
}

/** Convert h, s and l values to a string to be used by THREE.js */
export function toHSL(h: number, s: number, l: number) {
  return 'hsl(' + h + ',' + Math.ceil(s * 100) + '%,' + Math.ceil(l * 100) +
      '%)';
}

/** Linearly interpolate between two values. */
export function lerp(lerpVal: number, low: number, high: number) {
  return low * lerpVal + high * (1 - lerpVal);
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function loadDatabase(
    embUrl: string, embWordUrl: string, embValUrl: string) {
  // Check if we have an entry in the database.
  const db = new Dexie(embUrl);
  db.version(1).stores({embeddings: 'words,values'});

  let words: string[];
  let embeddings: Float32Array;
  const length = await (db as any).embeddings.count();
  if (length == null || length == 0) {
    console.log('Loading embeddings from the network...');
    const wordsRequest = await fetch(embWordUrl);
    words = await wordsRequest.json();

    const embeddingsRequest = await fetch(embValUrl);
    embeddings = new Float32Array(await embeddingsRequest.arrayBuffer());


    const blob = new Blob([embeddings], {type: 'octet/stream'});
    await (db as any).embeddings.put({words, values: blob});
  } else {
    console.log('Loading embeddings from IndexedDB cache...');
    const results = await (db as any).embeddings.toArray();
    words = results[0].words;

    embeddings = await new Promise<Float32Array>((resolve) => {
      const fileReader = new FileReader();
      fileReader.onload = event =>
          resolve(new Float32Array((event.target as any).result));
      fileReader.readAsArrayBuffer(results[0].values);
    });
    await db.close();
  }

  const returns = filterBadWords(words, embeddings);
  words = returns.words;
  embeddings = returns.embeddings;

  return {words, embeddings};
}

export function shuffle(a: any[]) {
  let j, x, i;
  for (i = a.length - 1; i > 0; i--) {
    j = Math.floor(Math.random() * (i + 1));
    x = a[i];
    a[i] = a[j];
    a[j] = x;
  }
  return a;
}

export function filterBadWords(words: string[], embeddings: Float32Array) {
  const embeddingsArr = Array.from(embeddings);
  const dim = embeddings.length / words.length;

  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i];
    if (BadWords.BadWords.indexOf(word) > -1 || word.includes('sex')) {
      words.splice(i, 1);
      embeddingsArr.splice(i * dim, dim);
    }
  }
  embeddings = new Float32Array(embeddingsArr);
  return {words, embeddings};
}

// Taken from
// https://stackoverflow.com/questions/118241/calculate-text-width-with-javascript
export function stringWidth(str: string, scale: number) {
  var f = scale + 'px Roboto Condensed',
      o = $('<div></div>')
              .text(str)
              .css({
                'position': 'absolute',
                'float': 'left',
                'white-space': 'nowrap',
                'visibility': 'hidden',
                'font': f
              })
              .appendTo($('body')),
      w = o.width();
  o.remove();
  return w;
}


export function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}



/** Average the absolute values of the array. */
export function averageAbs(sims: number[]): number {
  let sum = 0;
  sims.forEach(sim => {
    sum += Math.abs(sim);
  });
  return sum / sims.length;
}


/** Parse the url into params. */
export function parseURL(): {[id: string]: string;} {
  const url = window.location.href;
  let paramsArr = url.split('#');
  if (paramsArr.length > 1) {
    paramsArr = paramsArr[1].split('&');
    const params: {[id: string]: string;} = {};
    for (let i = 0; i < paramsArr.length; i++) {
      const keyval = paramsArr[i].split('=');
      params[keyval[0]] = keyval[1];
    }
    return params;
  }
  return {};
}
