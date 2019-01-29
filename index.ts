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
import * as tf from '@tensorflow/tfjs';
import Dexie from 'dexie';

import {Visualization} from './visualization/visualization'
import {WordEmbedding} from './word_embedding';

const EMBEDDINGS_DIR =
    'https://storage.googleapis.com/barbican-waterfall-of-meaning/'
const EMBEDDINGS_WORDS_URL = EMBEDDINGS_DIR + 'embedding-words.json';
const EMBEDDINGS_VALUES_URL = EMBEDDINGS_DIR + 'embedding-values.bin';
const BARBICAN_DATABASE_NAME = 'barbican-database';

/** Parse the url into params. */
function parseURL(): {[id: string]: string;} {
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

// Use threejs by default and allow for url param to use other UI in setup().
let USE_3JS = true;
let LEFT_AXIS_WORD = 'he';
let RIGHT_AXIS_WORD = 'she';
let NEIGHBOR_COUNT = 10;
let emb: WordEmbedding;
let vis: Visualization;

const visAxes = [
  ['amazing', 'terrible'],
  ['expensive', 'cheap'],
  ['weak', 'strong'],
  ['he', 'she'],
];

const loadingElement = document.getElementById('loading');
const bodyElement = document.getElementById('body');
const errorElement = document.getElementById('error');
const directionInputElement1 =
    document.getElementById('direction-input1') as HTMLInputElement;
const directionInputElement2 =
    document.getElementById('direction-input2') as HTMLInputElement;
const textInputElement =
    document.getElementById('word-input') as HTMLInputElement;
const wordsContainerElement = document.getElementById('words-container');
const numNeighborsInputElement =
    document.getElementById('num-neighbors') as HTMLInputElement;

// Just throwing this constant in willy-nilly for now. Should seperate different
// frontends at some point? But not sure how precise we really want to be here,
// this is art after all :)
if (USE_3JS) {
  vis = new Visualization(visAxes);
  document.getElementById('container').hidden = true;
}

numNeighborsInputElement.addEventListener('change', () => {
  const num_neighbors = parseInt(numNeighborsInputElement.value, 10);
  if (!isNaN(num_neighbors)) {
    NEIGHBOR_COUNT = num_neighbors;
  } else {
    numNeighborsInputElement.value = NEIGHBOR_COUNT.toString(10);
  }
});

directionInputElement1.addEventListener('change', () => {
  if (!emb.hasWord(directionInputElement1.value)) {
    directionInputElement1.value = LEFT_AXIS_WORD;
    return;
  }
  LEFT_AXIS_WORD = directionInputElement1.value;
});

directionInputElement2.addEventListener('change', () => {
  if (!emb.hasWord(directionInputElement2.value)) {
    directionInputElement2.value = RIGHT_AXIS_WORD;
    return;
  }
  RIGHT_AXIS_WORD = directionInputElement2.value;
});

async function projectWordsVis(word: string, id: number) {
  // Similarities for each axis.
  const knn = await emb.nearest(word, NEIGHBOR_COUNT);

  for (let i = 0; i < knn.length; i++) {
    const neighbor = knn[i];

    // Each neighbor has a slightly different color (within a same color range.)
    // The colors are ranked by similarity to the query word.
    // This color will be a hue (for an hsl color.) So, the id is multiplied by
    // 36 to put it in range of 0-360 (the range for a hue.) Then, we add a bit
    // of color variation up through + 70 of the hue.
    const colorId = Math.floor(id * 36 + i / knn.length * 70) % 360

    const sims: number[] = [];
    for (const axes of visAxes) {
      let sim = await emb.project(neighbor, axes[0], axes[1]);
      sim = stretchValueVis(sim);
      sims.push(sim);
    }
    vis.addWord(neighbor, sims, neighbor === word, colorId, i);
  }
}

/** Show results, either with the 3js UI or the standard UI. */
async function showResults() {
  const qWord = textInputElement.value;
  // If the word is not found show the error message,
  if (emb.hasWord(qWord)) {
    errorElement.style.display = 'none';
  } else {
    errorElement.style.display = '';
    return;
  }

  // Show the results with the 3js UI.
  if (USE_3JS) {
    projectWordsVis(qWord, Math.random() * 360);
  }
  // Show results with the other UI.
  else {
    const dirSimilarities = await emb.projectNearest(
        qWord, LEFT_AXIS_WORD, RIGHT_AXIS_WORD, NEIGHBOR_COUNT);

    for (let i = 0; i < dirSimilarities.length; i++) {
      let [word, similarity] = dirSimilarities[i];

      // Otherwise, add the word to the other UI.
      similarity = stretchValue(similarity);
      const color = (word == qWord) ? 'blue' : 'black';
      const margin =
          Math.floor(similarity * wordsContainerElement.offsetWidth) + 'px';
      wordsContainerElement.insertBefore(
          createWordDiv(word, color, margin), wordsContainerElement.firstChild);
    }
    wordsContainerElement.insertBefore(
        createSeparator(), wordsContainerElement.firstChild);

    // Insert direction words in middle pane in case we change directions
    // later on
    const wordDiv =
        createWordDiv(LEFT_AXIS_WORD + '--->' + RIGHT_AXIS_WORD, 'red', '0px');
    wordDiv.style.textAlign = 'center';
    wordsContainerElement.insertBefore(
        wordDiv, wordsContainerElement.firstChild);
    wordsContainerElement.insertBefore(
        createSeparator(), wordsContainerElement.firstChild);
  }
}

textInputElement.addEventListener('change', showResults);

let bc = new BroadcastChannel('word_flow_channel');
bc.onmessage = function(message) {
  projectWordsVis(message.data.word, message.data.colorId);
};


function createWordDiv(
    text: string, color: string, margin: string): HTMLDivElement {
  const wordDiv = document.createElement('div');
  wordDiv.className = 'word-value';
  wordDiv.innerText = text;
  wordDiv.style.color = color;
  wordDiv.style.marginLeft = margin;
  return wordDiv;
}

function createSeparator(): HTMLHRElement {
  return document.createElement('hr');
}

function stretchValue(value: number): number {
  // The dot product is in [-1, 1], so we rescale it to [0, 1].
  // We stretch values between [-0.5, 0.5] to [-1, 1]
  return (1 + Math.max(Math.min(value * 2, 1.0), -1.0)) / 2;
}

function stretchValueVis(value: number): number {
  value = Math.sign(value) * Math.pow(Math.abs(value), 1 / 2) * 2
  return value -= .1;  // TODO get norms for the entire dataset and subtract.
}

async function setup() {
  // Check if we have an entry in the database.
  const db = new Dexie(BARBICAN_DATABASE_NAME);
  db.version(1).stores({embeddings: 'words,values'});

  let words: string[];
  let embeddings: Float32Array;
  const length = await (db as any).embeddings.count();
  if (length == null || length == 0) {
    console.log('Loading embeddings from the network...');
    const wordsRequest = await fetch(EMBEDDINGS_WORDS_URL);
    words = await wordsRequest.json();

    const embeddingsRequest = await fetch(EMBEDDINGS_VALUES_URL);
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

  // Round # words to closest 10th index till tfjs prime number bug is
  // fixed.
  let embLen = words.length;
  if (embLen > 10000) {
    embLen = Math.floor(embLen / 10) * 10;
  }
  const dimensions = embeddings.length / words.length;

  const embeddingTensor = tf.tensor2d(
      embeddings.slice(0, embLen * dimensions), [embLen, dimensions]);
  emb = new WordEmbedding(embeddingTensor, words.slice(0, embLen));

  loadingElement.style.display = 'none';
  bodyElement.style.display = '';


  // Parse the params and adjust accordingly.
  const params = parseURL();
  if ('3js' in params) {
    USE_3JS = (params['3js'] === 'true');
  }

  // If it's specified to only use the seperate UI, hide the bar at the top.
  if (('hideInput' in params) && (params['hideInput'] === 'true')) {
    bodyElement.style.display = 'none';
  }
}

setup();

// Call this from the JavaScript console if you want to clear the IndexedDB
// cache.
(window as any).clearDatabase = async () => {
  const db = new Dexie(BARBICAN_DATABASE_NAME);
  db.version(1).stores({embeddings: 'words,values'});
  await db.delete();
  console.log('Database deleted.');
};
