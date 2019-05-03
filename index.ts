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

import * as utils from './visualization/utils';
import {Visualization} from './visualization/visualization'
import {WordEmbedding} from './word_embedding';

const EMBEDDINGS_DIR = 'https://storage.googleapis.com/waterfall-of-meaning/'
const EMBEDDINGS_WORDS_URL = EMBEDDINGS_DIR + 'embedding-words.json';
const EMBEDDINGS_VALUES_URL = EMBEDDINGS_DIR + 'embedding-values.bin';
const BARBICAN_DATABASE_NAME = 'barbican-database';

let NEIGHBOR_COUNT = 30;
let emb: WordEmbedding;

const visAxes = [
  ['machine', 'human'], ['he', 'she'], ['bad', 'good'], ['expensive', 'cheap']
];
let vis = new Visualization(visAxes);

/**
 * Norm of each axis (that is, the average of all other vocab words projected
 * on to that axis.)
 */
let axisNorms: Float32Array;

/** Precalculated projections of the words on each axis. */
let projections: {[key: string]: number[]};


const textInputElement =
    document.getElementById('word-input') as HTMLInputElement;

/**
 * Create background words and add them to the scene.
 * @param projections precalculated projections of all words.
 */
async function createBackgroundWords(projections: any) {
  const words = Object.keys(projections);
  for (let i = 0; i < 1000; i++) {
    const word = words[i];
    const sims = projections[word];
    const isBackgroundWord = true;
    const isQueryWord = false;
    vis.addWord(word, sims, isQueryWord, isBackgroundWord);
  }
}

async function projectWordsVis(word: string) {
  // Similarities for each axis.
  const knn = await emb.nearest(word, NEIGHBOR_COUNT * 5);

  let divisiveNNs: any[] = [];
  for (let i = 0; i < knn.length; i++) {
    const neighbor = knn[i];
    const sims = projections[neighbor];
    const avgSim = utils.averageAbs(sims);
    divisiveNNs.push({neighbor, sims, avgSim});

    // If this is the query word, go ahead and add it.
    if (neighbor === word) {
      const isBackgroundWord = false;
      const isQueryWord = true;
      vis.addWord(word, sims, isQueryWord, isBackgroundWord);
    }
  }

  // Take only the top n most divisive.
  // Sort by the average similarity value stored above.
  divisiveNNs.sort(
      (a, b) => (a.avgSim < b.avgSim) ? 1 : ((b.avgSim < a.avgSim) ? -1 : 0));
  divisiveNNs = divisiveNNs.slice(0, divisiveNNs.length * .75);
  divisiveNNs = utils.shuffle(divisiveNNs);
  for (let i = 0; i < NEIGHBOR_COUNT; i++) {
    const nn = divisiveNNs[i];

    // We've already added the query word above, so don't add it again.
    const isQueryWord = nn.neighbor === word;
    if (!isQueryWord) {
      // Sleep between releasing words so that they are spread out visually.
      await utils.sleep(500);
      vis.addWord(nn.neighbor, nn.sims, isQueryWord, false);
    }
  }
}


/** Show results, either with the 3js UI or the standard UI. */
async function showResults(qWord: string = null) {
  if (!qWord) {
    qWord = textInputElement.value;
  }
  if (emb.hasWord(qWord) && !isInAxes(qWord, visAxes)) {
    projectWordsVis(qWord);
    textInputElement.value = '';
  }
}

textInputElement.addEventListener('change', () => showResults());

// Add broadcast channel to receive inputs from input screen.
const bc = new BroadcastChannel('word_flow_channel');
bc.onmessage = message => showResults(message.data.word);

function stretchValueVis(value: number): number {
  value = Math.sign(value) * Math.pow(Math.abs(value), 1 / 2) * 2;
  return value;
}

/**
 * Precalculate projections of all words onto the axes.
 * @param words dictionary of words to save
 */
async function precalculatProjections(words: string[]) {
  const dists: {[key: string]: number[]} = {};
  const allProjections =
      await emb.computeProjections(visAxes).array() as number[][];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    dists[word] = [];
    for (let j = 0; j < visAxes.length; j++) {
      let projectedVal = allProjections[j][i];
      projectedVal -= axisNorms[j];
      projectedVal = stretchValueVis(projectedVal);
      dists[word].push(projectedVal);
    }
  }
  return dists;
}

async function setup() {
  utils.refreshAtMidnight();
  const data = await utils.loadDatabase(
      EMBEDDINGS_DIR, EMBEDDINGS_WORDS_URL, EMBEDDINGS_VALUES_URL);

  // Load embeddings and words from the database
  // Words should be displayed with no underlines and all in lowercase
  const words = data.words;
  for (let i = 0; i < words.length; i++) {
    words[i] = words[i].replace(/_/g, ' ').toLowerCase();
  }

  // Embeddings are translated to a tf tensor.
  const embeddings = data.embeddings;
  let embLen = words.length;
  const dimensions = embeddings.length / embLen;
  const embeddingTensor = tf.tensor2d(embeddings, [embLen, dimensions]);
  emb = new WordEmbedding(embeddingTensor, words);


  // Parse the params from the url.
  const params = utils.parseURL();

  // If it's specified to only use the other input UI, hide the bar at the top.
  if (('hideInput' in params) && (params['hideInput'] === 'true')) {
    document.getElementById('input_bar').style.display = 'none';
  }
  // Calculate the axis norms.
  axisNorms =
      await emb.computeAverageWordSimilarity(visAxes).data() as Float32Array;

  // Calculate dictionary of every word's similarity to the axes.
  projections = await precalculatProjections(words);
  createBackgroundWords(projections);
}

function isInAxes(word: string, visAxes: string[][]) {
  for (let i = 0; i < visAxes.length; i++) {
    const axis = visAxes[i];
    if (axis.indexOf(word) > -1) {
      return true;
    }
  }
  return false;
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
