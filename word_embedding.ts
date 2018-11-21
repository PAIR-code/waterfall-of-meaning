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
  private cachedDirections: {[name: string]: tf.Tensor1D} = {};
  private embeddingInds: {[name: string]: any};
  private embeddingTensor: tf.Tensor2D;
  private words: string[];
  async init(embeddingURL: string) {
    const result = await fetch(embeddingURL);
    const json = await result.json();
    const words = Object.keys(json);

    // Round # words to closest 10th index till tfjs prime number bug is fixed
    let embLen = words.length;
    if (embLen > 10000) {
      embLen = Math.floor(embLen / 10) * 10;
    }

    this.embeddingInds = {};
    let embArray = [];
    for (let i = 0; i < embLen; i++) {
      const word = words[i];
      this.embeddingInds[word] = i;
      embArray.push(json[word]);
    }
    this.embeddingTensor = await tf.tensor2d(embArray);
    this.words = words.slice(0, embLen);
  }

  getEmbedding(word: string): tf.Tensor1D {
    return this.embeddingTensor.gather(this.embeddingInds[word]).squeeze();
  }

  hasWord(word: string): boolean {
    return this.embeddingInds.hasOwnProperty(word);
  }

  computeBiasDirection(word1: string, word2: string): tf.Tensor1D {
    const leftAxisWordTensor = this.getEmbedding(word1);
    const rightAxisWordTensor = this.getEmbedding(word2);
    const direction = rightAxisWordTensor.sub(leftAxisWordTensor);
    const directionLength = direction.norm();
    return direction.div(directionLength);
  }

  nearest(word: string, numNeighbors: number): string[] {
    const wordEmbedding = this.getEmbedding(word);
    const wordCosines = this.embeddingTensor.dot(wordEmbedding);
    const nearest = tf.topk(wordCosines, numNeighbors, true);
    const nearestInds = nearest.indices.dataSync();
    const nearestWords = [];
    for (let i = 0; i < nearestInds.length; i++) {
      nearestWords.push(this.words[nearestInds[i]]);
    }
    return nearestWords;
  }

  project(word: string, axisLeft: string, axisRight: string): number {
    const wordEmbedding = this.getEmbedding(word);
    let dotProduct: number;
    let biasDirection: tf.Tensor1D;
    const mergedKey = axisLeft + axisRight;
    if (mergedKey in this.cachedDirections) {
      biasDirection = this.cachedDirections[mergedKey];
    } else {
      biasDirection = this.computeBiasDirection(axisLeft, axisRight);
      this.cachedDirections[mergedKey] = biasDirection;
    }
    tf.tidy(() => {
      dotProduct = wordEmbedding.dot(biasDirection).dataSync()[0];
    });
    return dotProduct;
  }

  projectNearest(word: string, axisLeft: string, axisRight: string,
    numNeighbors: number): [string, number][] {
    const nearestWords = this.nearest(word, numNeighbors);
    let dirSimilarities: [string, number][] = [];
    for (let i = 0; i < nearestWords.length; i++) {
      const word = nearestWords[i];
      const sim = this.project(word, axisLeft, axisRight);
      dirSimilarities.push([word, sim]);
    }
    // Sort words w.r.t. their direction similarity
    dirSimilarities.sort((left, right) => {return left[1] < right[1] ? -1 : 1});
    return dirSimilarities;
  }
}
