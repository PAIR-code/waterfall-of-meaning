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
/**
 * This is where we have all functions for word embeddings, rest of the GUI is
 * unaware of tfjs vectors
*/
import * as tf from '@tensorflow/tfjs';

export class WordEmbedding {
  biasDirection: tf.Tensor1D;
  embeddingInds: {[name: string]: any};
  embeddingTensor: tf.Tensor2D;
  words;
  async init(embeddingURL: string) {
    const result = await fetch(embeddingURL);
    const json = await result.json();
    const words = Object.keys(json);
    this.words = words;

    this.embeddingInds = {};
    let embArray = [];
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      this.embeddingInds[word] = i;
      embArray.push(json[word]);
    }
    // Round to closest 10th index till tfjs prime number bug is fixed
    let embLen = embArray.length;
    if (embLen > 10000) {
      embLen = Math.floor(embLen / 10) * 10;
      embArray = embArray.slice(0, embLen);
    }
    this.embeddingTensor = await tf.tensor2d(embArray);
  }

  getEmbedding(word: string) {
    return this.embeddingTensor.gather(this.embeddingInds[word]).squeeze();
  }

  wordExists(word: string) {
    return this.embeddingInds.hasOwnProperty(word);
  }

  setBiasDirection(word1: string, word2: string) {
    const leftAxisWordTensor = this.getEmbedding(word1);
    const rightAxisWordTensor = this.getEmbedding(word2);
    const direction = rightAxisWordTensor.sub(leftAxisWordTensor);
    const directionLength = direction.norm();
    this.biasDirection = direction.div(directionLength);
  }

  getNearest(word: string, numNeighbors: number) {
    const wordEmbedding = this.getEmbedding(word);
    const wordCosines = this.embeddingTensor.dot(wordEmbedding);
    const nearest = tf.topk(wordCosines, numNeighbors, true);
    const nearestInds = nearest.indices.dataSync();

    let dirSimilarities = [];
    for (var i = 0; i < nearestInds.length; i++) {
      const word = this.words[nearestInds[i]];
      const wordEmbedding = this.getEmbedding(word);
      tf.tidy(() => {
        const dotProduct = wordEmbedding.dot(this.biasDirection).dataSync()[0];
        dirSimilarities.push([word, dotProduct]);
      });
    }
    // Sort words w.r.t. their direction similarity
    dirSimilarities.sort((left, right) => {return left[1] < right[1] ? -1 : 1});
    return dirSimilarities;
  }
}
