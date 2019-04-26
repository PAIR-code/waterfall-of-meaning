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

const EMBEDDINGS_DIR = 'https://storage.googleapis.com/waterfall-of-meaning/'
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
const main = document.getElementById('main');
let prefixTrie: trie;
let searchId = 0;
const circle = document.getElementById('circle');

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
  circle.classList.add('side');
  await utils.sleep(1000);
  circle.classList.remove('side');

  searchId++;
  circle.classList.add('invisible');
  await utils.sleep(1000);
  circle.classList.remove('invisible');
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
  sendWord(word);
};

main.onclick = () => hideAutocomplete(true);

/**
 * For dealing with the user typing in the input box.
 */
textInput.onkeyup = (ev: KeyboardEvent) => {
  inputId++;
  clear(autocomplete);
  hideAutocomplete(true);
  const letters = textInput.value;

  // If the key was "enter," go ahead and submit.
  if (ev.which === 13 && prefixTrie.hasWord(letters)) {
    hideAutocomplete(true);
    sendWord(letters);
  }

  // Otherwise, show the autocomplete list.
  else {
    // Enable or disable button, depending on if the word is allowed.
    if (prefixTrie.hasWord(letters)) {
      button.removeAttribute('disabled');
    } else {
      button.setAttribute('disabled', 'true');
    }

    // Show all the potential words that start with this substring.
    const numLetters = letters.length;
    if (numLetters > 0) {
      const potentialWords = prefixTrie.getPrefix(letters);
      for (let i = 0; i < Math.min(10, potentialWords.length); i++) {
        hideAutocomplete(false);
        const word = potentialWords[i];
        const suffix = word.substring(numLetters);
        const option = autocomplete.appendChild(document.createElement('div'));

        // Bold everything except the prefix.
        option.innerHTML = (letters.toLowerCase() + suffix.bold());
        option.className += ' autocomplete-item';

        // If the user clicks an option, select that one.
        option.onclick = () => {
          sendWord(word);
        }
      }
    } else {
      hideAutocomplete(true);
    }
  }
};

// Load the embeddings from the database. TODO: probably combine this with the
// other one.
async function setup() {
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
    sendWord(defaultInputs[defaultInputsId % defaultInputs.length]);
  }
  startWaiting();
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
