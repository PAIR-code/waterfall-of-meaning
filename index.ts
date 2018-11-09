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
import {embedding} from '@tensorflow/tfjs-layers/dist/exports_layers';

const EMBEDDINGS_URL =
  'https://storage.googleapis.com/barbican-waterfall-of-meaning/embeddings.json';

let LEFT_AXIS_WORD = 'he';
let RIGHT_AXIS_WORD = 'she';

let NEIGHBOR_COUNT = 10;

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

const width = 1000;

function stretchValue(value) {
  return Math.max(Math.min(value * 2, 1.0), -1.0)
}

async function setup() {
  const result = await fetch(EMBEDDINGS_URL);
  const json = await result.json();
  const words = Object.keys(json);

  const embeddings = {};
  words.forEach(word => embeddings[word] = tf.tensor1d(json[word]));

  function wordExists(word) {
    return embeddings.hasOwnProperty(word)
  }

  let embArray = [];
  for (let i = 0; i < words.length; i++) {
    embArray.push(json[words[i]]);
  }
  embArray.pop()
  const embeddingsTensor = tf.tensor(embArray)

  let leftAxisWordTensor = embeddings[LEFT_AXIS_WORD];
  let rightAxisWordTensor = embeddings[RIGHT_AXIS_WORD];

  let direction = rightAxisWordTensor.sub(leftAxisWordTensor);
  let directionLength = direction.norm();
  let normalizedDirection = direction.div(directionLength);

  loadingElement.style.display = 'none';
  bodyElement.style.display = '';

  numNeighborsInputElement.addEventListener('change', () => {
    if (!isNaN(parseInt(numNeighborsInputElement.value))) {
      NEIGHBOR_COUNT = parseInt(numNeighborsInputElement.value, 10)
    } else {
      numNeighborsInputElement.value = NEIGHBOR_COUNT.toString(10)
    }
  })

  directionInputElement1.addEventListener('change', () => {
    if (!wordExists(directionInputElement1.value)) {
      directionInputElement1.value = LEFT_AXIS_WORD;
      return;
    }
    LEFT_AXIS_WORD = directionInputElement1.value;
    leftAxisWordTensor = embeddings[LEFT_AXIS_WORD];
    direction = rightAxisWordTensor.sub(leftAxisWordTensor);
    directionLength = direction.norm();
    normalizedDirection = direction.div(directionLength);
  })

  directionInputElement2.addEventListener('change', () => {
    if (!wordExists(directionInputElement2.value)) {
      directionInputElement2.value = RIGHT_AXIS_WORD;
      return;
    }
    RIGHT_AXIS_WORD = directionInputElement2.value;
    rightAxisWordTensor = embeddings[RIGHT_AXIS_WORD];
    direction = rightAxisWordTensor.sub(leftAxisWordTensor);
    directionLength = direction.norm();
    normalizedDirection = direction.div(directionLength);
  })

  textInputElement.addEventListener('change', () => {
    const word = textInputElement.value;
    // If the word is not found show the error message,
    if (wordExists(word)) {
      errorElement.style.display = 'none';
    } else {
      errorElement.style.display = '';
      return;
    }

    const wordEmbedding = embeddings[word];
    const word_cosines = embeddingsTensor.dot(wordEmbedding);
    const nearest = tf.topk(word_cosines, NEIGHBOR_COUNT, true);
    const nearestInds = nearest.indices.dataSync()

    let dirSimilarities = [];
    for (var i = 0; i < nearestInds.length; i++) {
      const word = words[nearestInds[i]];
      const wordEmbedding = embeddings[word];
      tf.tidy(() => {
        const dotProduct = wordEmbedding.dot(normalizedDirection).dataSync()[0];
        // The dot product is in [-1, 1], so we rescale it to [0, 1].
        dirSimilarities.push([word, (1 + stretchValue(dotProduct)) / 2]);
      });
    }
    // Sort words w.r.t. their direction similarity
    dirSimilarities.sort((left, right) => {return left[1] < right[1] ? -1 : 1});

    for (var i = 0; i < dirSimilarities.length; i++) {
      let [word, similarity] = dirSimilarities[i]
      const wordDiv = document.createElement('div');
      wordDiv.className = 'word-value';
      wordDiv.innerText = word;
      wordDiv.style.marginLeft =
        Math.floor(similarity * wordsContainerElement.offsetWidth) + 'px';
      wordsContainerElement.insertBefore(wordDiv,
        wordsContainerElement.firstChild);
    }
    let hr = document.createElement('hr')
    wordsContainerElement.insertBefore(hr,
      wordsContainerElement.firstChild);
  });
}

setup();
