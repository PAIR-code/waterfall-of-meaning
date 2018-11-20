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

import * as we from "./we";

const EMBEDDINGS_URL =
  'https://storage.googleapis.com/barbican-waterfall-of-meaning/embeddings.json';
let LEFT_AXIS_WORD = "he";
let RIGHT_AXIS_WORD = "she";
let NEIGHBOR_COUNT = 10;
let emb: we.WordEmbedding;

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

numNeighborsInputElement.addEventListener('change', () => {
  const num_neighbors = parseInt(numNeighborsInputElement.value, 10);
  if (!isNaN(num_neighbors)) {
    NEIGHBOR_COUNT = num_neighbors;
  } else {
    numNeighborsInputElement.value = NEIGHBOR_COUNT.toString(10);
  }
});

directionInputElement1.addEventListener('change', () => {
  if (!emb.wordExists(directionInputElement1.value)) {
    directionInputElement1.value = LEFT_AXIS_WORD;
    return;
  }
  LEFT_AXIS_WORD = directionInputElement1.value;
  emb.setBiasDirection(LEFT_AXIS_WORD, RIGHT_AXIS_WORD);
});

directionInputElement2.addEventListener('change', () => {
  if (!emb.wordExists(directionInputElement2.value)) {
    directionInputElement2.value = RIGHT_AXIS_WORD;
    return;
  }
  RIGHT_AXIS_WORD = directionInputElement2.value;
  emb.setBiasDirection(LEFT_AXIS_WORD, RIGHT_AXIS_WORD);
});

textInputElement.addEventListener('change', () => {
  const word = textInputElement.value;
  // If the word is not found show the error message,
  if (emb.wordExists(word)) {
    errorElement.style.display = 'none';
  } else {
    errorElement.style.display = '';
    return;
  }
  const dirSimilarities = emb.getNearest(word, NEIGHBOR_COUNT);
  for (var i = 0; i < dirSimilarities.length; i++) {
    let [word, similarity] = dirSimilarities[i];
    similarity = stretchValue(similarity);
    const wordDiv = document.createElement('div');
    wordDiv.className = 'word-value';
    wordDiv.innerText = word;
    wordDiv.style.marginLeft =
      Math.floor(similarity * wordsContainerElement.offsetWidth) + 'px';
    wordsContainerElement.insertBefore(wordDiv,
      wordsContainerElement.firstChild);
  }
  const hr = document.createElement('hr');
  wordsContainerElement.insertBefore(hr, wordsContainerElement.firstChild);
});

function stretchValue(value) {
  // The dot product is in [-1, 1], so we rescale it to [0, 1].
  // We stretch values between [-0.5, 0.5] to [-1, 1]
  return (1 + Math.max(Math.min(value * 2, 1.0), -1.0)) / 2;
}

async function setup() {
  emb = new we.WordEmbedding();
  await emb.init(EMBEDDINGS_URL);
  emb.setBiasDirection(LEFT_AXIS_WORD, RIGHT_AXIS_WORD);
  loadingElement.style.display = 'none';
  bodyElement.style.display = '';
}

setup();
