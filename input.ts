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

import Dexie from 'dexie';
import trie from 'trie-prefix-tree';
import * as utils from './visualization/utils';

const EMBEDDINGS_DIR =
    'https://storage.googleapis.com/waterfall-of-meaning/'
const EMBEDDINGS_WORDS_URL = EMBEDDINGS_DIR + 'embedding-words.json';
const EMBEDDINGS_VALUES_URL = EMBEDDINGS_DIR + 'embedding-values.bin';
const BARBICAN_DATABASE_NAME = 'barbican-database';
const bc = new BroadcastChannel('word_flow_channel');

/** Id of this input. Used when auto-inputing. */
let inputId = 0;
/** Default words to input when no one is interacting. */
let defaultInputsId = 0;
const defaultInputs = [
  'doctor', 'teach',    'nurse', 'politician', 'Witch', 'fear',  'laugh',
  'clever', 'fabulous', 'labor', 'dragon',     'squid', 'shark', 'feline',
  'beer',   'soda',     'Meat',  'pickle',     'fish',  'donut', 'soccer',
  'dance',  'football', 'grass', 'red',        'skull'
];
const AUTO_INPUT_TIMEOUT_MS = 20000;

const button =
    document.getElementById('button').getElementsByClassName('mdl-button')[0];
const textInput = <HTMLInputElement>document.getElementById('wordInput');
const autocomplete = document.getElementById('autocomplete');
const input_side = document.getElementById('input_side');
const error = document.getElementById('error');
let prefixTrie: trie;
let searchId = 0;

///////////////////////////////////////////////////////////////////////////////
// Miscelaneous functions.
///////////////////////////////////////////////////////////////////////////////
function hideAutocomplete(hide: boolean) {
  autocomplete.style.display = hide ? 'none' : 'block';
}

/**
 * Send a word to the front end (w/ animation.)
 * @param word word to send to the other front end
 */
async function sendWord(word: string) {
  word = word.replace(/_/g, ' ').toLowerCase();

  const message = {'word': word};
  bc.postMessage(message);
  textInput.value = '';
  button.setAttribute('disabled', 'true');

  // Deal with circle animation.
  const circle = document.createElement('div');
  circle.classList.add('circle');
  input_side.appendChild(circle);
  circle.innerHTML = word;
  await utils.sleep(10);
  circle.classList.add('bottom');
  await utils.sleep(3000);
  input_side.removeChild(circle);

  searchId++;

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

input_side.onclick = () => hideAutocomplete(true);

/**
 * For dealing with the user typing in the input box.
 */
textInput.onkeyup = (ev: KeyboardEvent) => {
  inputId++;
  clear(autocomplete);
  hideAutocomplete(true);
  error.classList.add('hidden');
  const letters = textInput.value;

  if (letters.length){
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
        const option = autocomplete.appendChild(document.createElement('div'));

        // Bold everything except the prefix.
        option.innerHTML = (letters.toLowerCase().bold() + suffix);
        option.className += ' autocomplete-item';

        // If the user clicks an option, select that one.
        option.onclick = () => {
          textInput.value = word;
        }
      }
    } else {
      hideAutocomplete(true);
    }
  }
};

async function attemptSendWord(word: string) {
  if (prefixTrie.hasWord(word)) {
    sendWord(word);
  }
  else {
    textInput.value = '';
    button.setAttribute('disabled', 'true');
    error.classList.remove('hidden');
    await utils.sleep(3000);
    error.classList.add('hidden');
  }
}

// Load the embeddings from the database. TODO: probably combine this with the
// other one.
async function setup() {
  utils.refreshAtMidnight();
  const data = await utils.loadDatabase(
      EMBEDDINGS_DIR, EMBEDDINGS_WORDS_URL, EMBEDDINGS_VALUES_URL);

  const words = data.words;
  // Make prefix tree.
  for (let i = 0; i < words.length; i++) {
    words[i] = words[i].toLowerCase().replace(/_/g, ' ');
  }
  prefixTrie = trie(words);
  startWaiting();
}

/**
 * Wait and see if anyone inputs a word. If not, auto input one from the
 * predefined list.
 */
async function startWaiting() {
  const lastInput = inputId;
  await utils.sleep(AUTO_INPUT_TIMEOUT_MS);
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
async function typewriter(word: string){
  textInput.value = ''
  hideAutocomplete(true);
  for (let i=0; i<word.length; i++) {
    textInput.value += word[i];
    // Add a little bit of randomness to appear human.
    await utils.sleep(100 + 400 * Math.random());
  }
  await utils.sleep(500);
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
