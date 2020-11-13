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
import trie from 'trie-prefix-tree';
import * as utils from './visualization/utils';
import {Visualization} from './visualization/visualization'
import {WordEmbedding} from './word_embedding';

const EMBEDDINGS_DIR = 'https://storage.googleapis.com/waterfall-of-meaning/'
const EMBEDDINGS_WORDS_URL = EMBEDDINGS_DIR + 'embedding-words.json';
const EMBEDDINGS_VALUES_URL = EMBEDDINGS_DIR + 'embedding-values.bin';

let NEIGHBOR_COUNT = 30;
let emb: WordEmbedding;
let vis: Visualization;

/**
 * NAMES:
 * associated press
 * associated times
 * the daily association
 * the
 *
 *
 * */

const visAxes = [
  ['life', 'death'], ['machine', 'human'], ['expensive', 'cheap'],
  ['new', 'old'],
  // ['easy', 'hard'],
  // ['happy', 'sad'],
  // ['new', 'old'],
  // ['crazy', 'sane'],
  // ['happy', 'sad'],
  // ['mild', 'intense']
  // ['lucky', 'unlucky'],
];
const screenArea = document.getElementById('rhs').getBoundingClientRect();
const visWidth = screenArea.width;
const aspectRatio = Math.min(1, screenArea.width / window.innerHeight);
const scale = visWidth / (2000 * aspectRatio);
const wordsAreWhite = true;
vis = new Visualization(visAxes, scale, wordsAreWhite, aspectRatio);

/** Id of this input. Used when auto-inputing. */
let inputId = 0;
/** Default words to input when no one is interacting. */
let defaultInputsId = 0;
const defaultInputs = [
  'fashioned', 'ugly',     'plant',  'fresh', 'lexicon', 'shirt',
  'doctor',    'teach',    'fear',   'laugh', 'clever',  'fabulous',
  'labor',     'dragon',   'squid',  'shark', 'feline',  'beer',
  'soda',      'meat',     'pickle', 'fish',  'donut',   'soccer',
  'dance',     'football', 'grass',  'red',   'skull'

  // 'witch',
];
const AUTO_INPUT_TIMEOUT_RAFS = 1000;
const NEIGHBOR_WAIT_TIMEOUT_RAFS = 20;
const button =
    document.getElementById('button').getElementsByClassName('mdl-button')[0];
const textInput = <HTMLInputElement>document.getElementById('wordInput');
const autocomplete = document.getElementById('autocomplete');
keepInputFocused();
const error = document.getElementById('error');
let prefixTrie: trie;

///////////////////////////////////////////////////////////////////////////////
// Miscelaneous functions.
///////////////////////////////////////////////////////////////////////////////
function keepInputFocused() {
  textInput.focus();
  textInput.onblur = async () => {
    await utils.sleep(0);
    textInput.focus();
  };
}

function hideAutocomplete(hide: boolean) {
  autocomplete.style.display = hide ? 'none' : 'block';
}

/**
 * Send a word to the front end (w/ animation.)
 * @param word word to send to the other front end
 */
async function sendWord(word: string) {
  word = word.replace(/_/g, ' ').toLowerCase();
  if (emb.hasWord(word) && !utils.isInAxes(word, visAxes)) {
    projectWordsVis(word);
  }
  textInput.value = '';
  button.setAttribute('disabled', 'true');
}

/**  Clear all children of an HTML element. */
function clear(div: HTMLElement) {
  while (div.firstChild) {
    div.removeChild(div.firstChild);
  }
}

///////////////////////////////////////////////////////////////////////////////
// Click handlers.
///////////////////////////////////////////////////////////////////////////////
button.onclick = () => {
  const word = textInput.value;
  attemptSendWord(word);
};


// Add buttons to minimize/expand the info panel on desktop.
const hideShowButtonDesktop = document.getElementById('hide_show_desktop');
const sideBar = document.getElementById('info_side');
function toggleD(show: boolean) {
  if (show) {
    sideBar.classList.remove('minimized');
    hideShowButtonDesktop.innerHTML = 'arrow_back_ios';
  } else {
    sideBar.classList.add('minimized');
    hideShowButtonDesktop.innerHTML = 'menu';
  }
};
hideShowButtonDesktop.onclick = () =>
    toggleD(sideBar.classList.contains('minimized'));

// Add buttons to minimize/expand the info panel on mobile.
const hideShowButtonMobile = document.getElementById('hide_show_mobile');
const infoBarMobile = document.getElementById('info');
function toggleM(show: boolean) {
  if (show) {
    infoBarMobile.classList.remove('minimized');
    hideShowButtonMobile.innerHTML = 'expand_more';
  } else {
    infoBarMobile.classList.add('minimized');
    hideShowButtonMobile.innerHTML = 'expand_less';
  }
};
hideShowButtonMobile.onclick = () =>
    toggleM(infoBarMobile.classList.contains('minimized'));
// When the window resizes, make sure that the menu is open.

window.onresize =
    () => {
      if (window.innerWidth > 768) {
        toggleM(true);
        toggleD(true);
      }
    }

          /**
           * For dealing with the user typing in the input box.
           */
          textInput.onkeyup = (ev: KeyboardEvent) => {
      inputId++;
      clear(autocomplete);
      hideAutocomplete(true);
      error.classList.add('hidden');
      const letters = textInput.value;

      if (letters.length) {
        button.removeAttribute('disabled');
      } else {
        button.setAttribute('disabled', 'true');
      }

      // If the key was "enter," go ahead and submit.
      if (ev.which === 13) {
        hideAutocomplete(true);
        attemptSendWord(letters);
      }

      // Otherwise, show the autocomplete list.
      else {
        // Show all the potential words that start with this substring.
        const numLetters = letters.length;
        if (numLetters > 0) {
          const potentialWords = prefixTrie.getPrefix(letters);
          for (let i = 0; i < Math.min(5, potentialWords.length); i++) {
            hideAutocomplete(false);
            const word = potentialWords[i];
            const suffix = word.substring(numLetters);
            const option =
                autocomplete.appendChild(document.createElement('div'));

            // Bold everything except the prefix.
            option.innerHTML = (letters.toLowerCase().bold() + suffix);
            option.className += ' autocomplete-item';

            // If the user clicks an option, select that one.
            option.onclick = () => {
              textInput.value = word;
              hideAutocomplete(true);
            }
          }
        } else {
          hideAutocomplete(true);
        }
      }
    };

async function attemptSendWord(word: string) {
  if (prefixTrie.hasWord(word)) {
    hideAutocomplete(true);
    sendWord(word);
  } else {
    textInput.value = '';
    button.setAttribute('disabled', 'true');
    error.classList.remove('hidden');
    await utils.sleep(2000);
    error.classList.add('hidden');
  }
}


async function setup() {
  // Parse the params from the url.
  const params = utils.parseURL();

  // If it's specified to only use the other input UI, hide the bar at the
  // top.
  if (('hideInput' in params) && (params['hideInput'] === 'true')) {
    document.getElementById('input_bar').style.display = 'none';
  }
  if (('hideOverflow' in params) && (params['hideOverflow'] === 'true')) {
    document.body.style.overflow = 'hidden';
  }

  utils.refreshAtMidnight();
  const data = await utils.loadDatabase(
      EMBEDDINGS_DIR, EMBEDDINGS_WORDS_URL, EMBEDDINGS_VALUES_URL);

  document.getElementById('vis-bg').classList.remove('hidden');
  document.getElementById('loading').classList.add('hidden');
  textInput.removeAttribute('disabled');
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

  // Calculate the axis norms.
  axisNorms =
      await emb.computeAverageWordSimilarity(visAxes).data() as Float32Array;

  // Calculate dictionary of every word's similarity to the axes.
  projections = await precalculatProjections(words);
  createBackgroundWords(projections);


  prefixTrie = trie(words);
  startWaiting();
}


/**
 * Wait and see if anyone inputs a word. If not, auto input one from the
 * predefined list.
 */
async function startWaiting() {
  const lastInput = inputId;
  await utils.sleepRAF(AUTO_INPUT_TIMEOUT_RAFS);
  if (lastInput === inputId) {
    defaultInputsId++;
    const word = defaultInputs[defaultInputsId % defaultInputs.length];
    await typewriter(word);
    sendWord(word);
  }
  startWaiting();
}

/**
 * Write the word to the input text field.
 * @param word word to be written
 */
async function typewriter(word: string) {
  textInput.value = ''
  hideAutocomplete(true);
  for (let i = 0; i < word.length; i++) {
    textInput.value += word[i];
    // Add a little bit of randomness.
    await utils.sleep(100 + 400 * Math.random());
  }
  await utils.sleep(500);
}

setup();

// Call this from the JavaScript console if you want to clear the IndexedDB
// cache.
(window as any).clearDatabase = async () => {
  const db = new Dexie(EMBEDDINGS_DIR);
  db.version(1).stores({embeddings: 'words,values'});
  await db.delete();
  console.log('Database deleted.');
};



/**
 * Norm of each axis (that is, the average of all other vocab words projected
 * on to that axis.)
 */
let axisNorms: Float32Array;

/** Precalculated projections of the words on each axis. */
let projections: {[key: string]: number[]};


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
      await utils.sleepRAF(NEIGHBOR_WAIT_TIMEOUT_RAFS);
      vis.addWord(nn.neighbor, nn.sims, isQueryWord, false);
    }
  }
}


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
