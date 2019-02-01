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
    'https://storage.googleapis.com/barbican-waterfall-of-meaning/'
const EMBEDDINGS_WORDS_URL = EMBEDDINGS_DIR + 'embedding-words.json';
const EMBEDDINGS_VALUES_URL = EMBEDDINGS_DIR + 'embedding-values.bin';
const BARBICAN_DATABASE_NAME = 'barbican-database';
const bc = new BroadcastChannel('word_flow_channel');

const button =
    document.getElementById('button').getElementsByClassName('mdl-button')[0];
const textInput = <HTMLInputElement>document.getElementById('wordInput');
const autocomplete = document.getElementById('autocomplete');
const main = document.getElementById('main');
let prefixTrie: trie;
let searchId = 0;
const circle = document.getElementById('circle');
circle.style.backgroundColor = getBgColor(0);

///////////////////////////////////////////////////////////////////////////////
// Miscelaneous functions.
///////////////////////////////////////////////////////////////////////////////
function hideAutocomplete(hide: boolean) {
  autocomplete.style.display = hide ? 'none' : 'block';
}

function getBgColor(id: number) {
  return utils.toHSL((id * 36) % 360, 50, 75);
}

/**
 * We want all words in the group to be the same color. So they get an
 * id. But, we want this id different from the one before it, for color
 * variation. Searchid is being incremented by 1 each time, but but we want the
 * color to be visually distinct from the one before). So, since 7 and 10 are
 * relatively prime, this modulo operation will generate a sequence of different
 * colors that are not close to each other and circles through all colors.
 */
function uniqueColorFromId(id: number) {
  return (searchId * 7) % 10;
}

/**
 * Send a word to the front end (w/ animation.)
 * @param word word to send to the other front end
 */
async function sendWord(word: string) {
  word = word.replace(' ', '_');

  const message = {'word': word, 'colorId': uniqueColorFromId(searchId)};
  bc.postMessage(message);
  textInput.value = '';
  button.setAttribute('disabled', 'true');

  // Deal with circle animation.
  circle.classList.add('side');
  await utils.sleep(1000);
  circle.classList.remove('side');

  // Set the circle color to the *next* color.
  searchId++;
  circle.style.backgroundColor = getBgColor(uniqueColorFromId(searchId));
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
        option.innerHTML = (letters + suffix.bold());
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

// Load the embeddings from the database. TODO: probably combine this with the
// other one.
async function setup() {
  const data = await utils.loadDatabase(
      EMBEDDINGS_DIR, EMBEDDINGS_WORDS_URL, EMBEDDINGS_VALUES_URL);

  const words = data.words;
  // Make prefix tree.
  for (let i = 0; i < words.length; i++) {
    words[i] = words[i].replace('_', ' ');
  }
  prefixTrie = trie(words);
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
