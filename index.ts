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

import * as we from "./word_embedding";

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

textInputElement.addEventListener('change', () => {
  const q_word = textInputElement.value;
  // If the word is not found show the error message,
  if (emb.hasWord(q_word)) {
    errorElement.style.display = 'none';
  } else {
    errorElement.style.display = '';
    return;
  }
  const dirSimilarities = emb.projectNearest(q_word, LEFT_AXIS_WORD,
    RIGHT_AXIS_WORD, NEIGHBOR_COUNT);
  for (let i = 0; i < dirSimilarities.length; i++) {
    let [word, similarity] = dirSimilarities[i];
    similarity = stretchValue(similarity);
    const color = (word == q_word) ? 'blue' : 'black';
    const margin =
      Math.floor(similarity * wordsContainerElement.offsetWidth) + 'px';
    wordsContainerElement.insertBefore(createWordDiv(word, color, margin),
      wordsContainerElement.firstChild);
  }
  wordsContainerElement.insertBefore(createSeparator(),
    wordsContainerElement.firstChild);
  // Insert direction words in middle pane in case we change directions later on
  const wordDiv = createWordDiv(LEFT_AXIS_WORD + '--->' + RIGHT_AXIS_WORD,
    'red', '0px');
  wordDiv.style.textAlign = 'center';
  wordsContainerElement.insertBefore(wordDiv, wordsContainerElement.firstChild);
  wordsContainerElement.insertBefore(createSeparator(),
    wordsContainerElement.firstChild);
});

function createWordDiv(text: string, color: string, margin: string):
  HTMLDivElement {
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

async function setup() {
  emb = new we.WordEmbedding();
  await emb.init(EMBEDDINGS_URL);
  loadingElement.style.display = 'none';
  bodyElement.style.display = '';
}

setup();
