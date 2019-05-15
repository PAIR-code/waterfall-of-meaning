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

/** Is the y value near the top value? (Within 10.) */
export function isNear(y: number, top: number) {
  return (y < top && y > top - 10)
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

  const returns = filterWords(words, embeddings);
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

  export function filterWords(words: string[], embeddings: Float32Array) {
    const embeddingsArr = Array.from(embeddings);
    const dim = embeddings.length / words.length;
    const filteredWords = [];
    const filteredEmbs = [];
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordInBlacklist = BadWords.BadWords.indexOf(word) > -1;
      const wordHasSexSubstr =  word.includes('sex');
      const multipleWords = word.includes('_');

      if (!wordInBlacklist && !wordHasSexSubstr && !multipleWords) {
        filteredWords.push(word);
        filteredEmbs.push(...embeddingsArr.slice(i * dim, (i + 1) * dim));
      }
    }

  words = filteredWords;
  embeddings = new Float32Array(filteredEmbs);
  return {words, embeddings};
}

// Taken from
// https://stackoverflow.com/questions/118241/calculate-text-width-with-javascript
export function stringWidth(str: string, fontsize: number) {
  var f = fontsize + 'px Roboto Condensed',
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

/** Refresh the page at midnight.
 *  Taken from https://stackoverflow.com/questions/21512551/how-to-update-your-homepage-at-a-certain-time.
 * */
export function refreshAtMidnight() {
  const now = new Date();
  const night = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1, // the next day, ...
      0, 0, 0 // ...at 00:00:00 hours
  );
  const msTillMidnight = night.getTime() - now.getTime();
  setTimeout(() => document.location.reload(), msTillMidnight);
}
