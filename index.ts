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
import * as dat from 'dat.gui';
import Dexie from 'dexie';

import * as utils from './visualization/utils';
// import {Visualization} from './visualization/visualization'
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


// Parse the params and adjust accordingly.
const params = parseURL();

// Use threejs by default and allow for url param to use other UI in setup().
let USE_3JS = true;
if ('3js' in params) {
  USE_3JS = (params['3js'] === 'true');
}
let LEFT_AXIS_WORD = 'he';
let RIGHT_AXIS_WORD = 'she';
let NEIGHBOR_COUNT = 100;
let emb: WordEmbedding;
let vis: Visualization;

const visAxes = [
  ['good', 'bad'],
  ['expensive', 'cheap'],
  ['weak', 'strong'],
  ['he', 'she'],
];
/**
 * Norm of each axis (that is, the average of all other vocab words projected
 * on to that axis.)
 */
let axisNorms: Float32Array;


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

if (USE_3JS) {
  vis = new Visualization(visAxes);
  const gui = new dat.GUI();
  gui.close();
  gui.add(vis, 'numRaindrops').onChange(() => vis.start());
  gui.add(vis, 'rainSpeed').onChange(() => vis.start());
  gui.add(vis, 'wordSpeed').onChange(() => vis.start());
  gui.add(vis, 'axisFontSize').onChange(() => vis.start());
  gui.add(vis, 'wordFontSize').onChange(() => vis.start());
  gui.add(vis, 'wordBrightness').onChange(() => vis.start());
  gui.add(vis, 'qWordBrightness').onChange(() => vis.start());
  gui.add(vis, 'circleBrightness').onChange(() => vis.start());
  gui.add(vis, 'rainBrightness').onChange(() => vis.start());
  gui.addColor(vis, 'axisColor').onChange(() => vis.start());
  gui.addColor(vis, 'bgColor').onChange(() => vis.start());
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
    const sims: number[] = [];
    for (let j = 0; j < visAxes.length; j++) {
      const axes = visAxes[j];
      let sim = await emb.project(neighbor, axes[0], axes[1]);

      // Subtract the norm of the axis (that is, the average of all other vocab
      // words projected on to that axis.)
      sim -= axisNorms[j];
      sim = stretchValueVis(sim);
      sims.push(sim);
    }

    // Each neighbor has a slightly different color (within a same color range.)
    // The colors are ranked by how polarized they are overall.
    // This color will be a hue (for an hsl color.) So, the id is multiplied by
    // 36 to put it in range of 0-360 (the range for a hue.)
    const averageSim = averageAbs(sims);
    const colorId = Math.floor(id * 36 + averageSim * 100) % 360

    vis.addWord(neighbor, sims, neighbor === word, colorId, i);
  }
}

/** Average the absolute values of the array. */
function averageAbs(sims: number[]): number {
  let sum = 0;
  sims.forEach((sim: number) => {
    sum += Math.abs(sim);
  });
  return sum / sims.length;
}

/** Show results, either with the 3js UI or the standard UI. */
async function showResults(qWord: string = null, colorId: number = null) {
  if (!qWord) {
    qWord = textInputElement.value;
  }
  // If the word is not found show the error message,
  if (emb.hasWord(qWord)) {
    errorElement.style.display = 'none';
  } else {
    errorElement.style.display = '';
    return;
  }

  // Show the results with the 3js UI.
  if (USE_3JS) {
    projectWordsVis(qWord, colorId ? colorId : Math.random() * 360);
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

textInputElement.addEventListener('change', () => showResults());

// Add broadcast channel to receive inputs from input screen.
const bc = new BroadcastChannel('word_flow_channel');
bc.onmessage = message => showResults(message.data.word, message.data.colorId);

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
  const data = await utils.loadDatabase(
      EMBEDDINGS_DIR, EMBEDDINGS_WORDS_URL, EMBEDDINGS_VALUES_URL);

  const words = data.words;
  const embeddings = data.embeddings;
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

  // If it's specified to only use the seperate UI, hide the bar at the top.
  if (('hideInput' in params) && (params['hideInput'] === 'true')) {
    document.getElementById('input_bar').style.display = 'none';
  }
  // Calculate the axis norms.
  axisNorms =
      await emb.computeAverageWordSimilarity(visAxes).data() as Float32Array;
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
