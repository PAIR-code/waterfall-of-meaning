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

  const leftAxisWordTensor = embeddings[LEFT_AXIS_WORD];
  const rightAxisWordTensor = embeddings[RIGHT_AXIS_WORD];
  const direction = rightAxisWordTensor.sub(leftAxisWordTensor);
  const directionLength = direction.norm();

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

    tf.tidy(() => {
      const projection = wordEmbedding.sub(leftAxisWordTensor)
                             .dot(direction)
                             .div(direction.dot(direction))
                             .mul(direction);
      const projectionLength = projection.norm();

      const projectionToDirectionLengthRatio =
          projectionLength.dataSync()[0] / directionLength.dataSync()[0];

      const wordDiv = document.createElement('div');
      wordDiv.className = 'word-value';
      wordDiv.innerText = word;
      wordDiv.style.marginLeft = Math.floor(
                                     projectionToDirectionLengthRatio *
                                     wordsContainerElement.offsetWidth) +
          'px';
      wordsContainerElement.appendChild(wordDiv);
    });
  });
}

setup();
