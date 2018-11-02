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

const EMBEDDINGS_URL =
  'https://storage.googleapis.com/barbican-waterfall-of-meaning/embeddings.json';

const LEFT_AXIS_WORD = 'he';
const RIGHT_AXIS_WORD = 'she';

const NEIGHBOR_COUNT = 50;

const loadingElement = document.getElementById('loading');
const bodyElement = document.getElementById('body');
const errorElement = document.getElementById('error');

const textInputElement =
  document.getElementById('word-input') as HTMLInputElement;
const wordsContainerElement = document.getElementById('words-container');

const width = 1000;

async function setup() {
  const result = await fetch(EMBEDDINGS_URL);
  const json = await result.json();
  const words = Object.keys(json);

  const embeddings = {};
  words.forEach(word => embeddings[word] = tf.tensor1d(json[word]));

  var embArray = [];
  for (var i = 0; i < words.length; i++) {
    embArray.push(json[words[i]]);
  }
  embArray.pop()
  const embeddingsTensor = tf.tensor(embArray)

  const leftAxisWordTensor = embeddings[LEFT_AXIS_WORD];
  const rightAxisWordTensor = embeddings[RIGHT_AXIS_WORD];

  const direction = rightAxisWordTensor.sub(leftAxisWordTensor);
  const directionLength = direction.norm();
  const normalizedDirection = direction.div(directionLength);

  loadingElement.style.display = 'none';
  bodyElement.style.display = '';

  textInputElement.addEventListener('change', () => {
    const word = textInputElement.value;
    const wordEmbedding = embeddings[word];

    // If the word is not found show the error message,
    if (wordEmbedding != null) {
      errorElement.style.display = 'none';
    } else {
      errorElement.style.display = '';
      return;
    }

    const word_cosines = embeddingsTensor.dot(wordEmbedding);
    const nearest_inds = tf.topk(word_cosines, NEIGHBOR_COUNT, true);
    console.log(nearest_inds.values.dataSync());
    console.log(nearest_inds.indices.dataSync());
    const nearest_inds2 = nearest_inds.indices.dataSync()
    for (var i = 0; i < nearest_inds2.length; i++) {
      const word = words[nearest_inds2[i]];
      console.log(word);
      const wordEmbedding = embeddings[word];


      tf.tidy(() => {
        const dotProduct = wordEmbedding.dot(normalizedDirection).dataSync()[0];
        // The dot product is in [-1, 1], so we rescale it to [0, 1].
        const similarity = (1 + dotProduct) / 2;

        const wordDiv = document.createElement('div');
        wordDiv.className = 'word-value';
        wordDiv.innerText = word;
        wordDiv.style.marginLeft =
          Math.floor(similarity * wordsContainerElement.offsetWidth) + 'px';
        wordsContainerElement.appendChild(wordDiv);
      });
    }
  });
}

setup();
