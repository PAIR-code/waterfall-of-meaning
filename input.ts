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

const EMBEDDINGS_DIR =
    'https://storage.googleapis.com/barbican-waterfall-of-meaning/'
const EMBEDDINGS_WORDS_URL = EMBEDDINGS_DIR + 'embedding-words.json';
const BARBICAN_DATABASE_NAME = 'barbican-database';
const bc = new BroadcastChannel('word_flow_channel');

const button =
    document.getElementById('button').getElementsByClassName('mdl-button')[0];
const textInput = <HTMLInputElement>document.getElementById('wordInput');
const autocomplete = document.getElementById('autocomplete');
const main = document.getElementById('main');
const circle = document.getElementById('circle');
circle.style.backgroundColor = getNewBackgroundColor();

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let prefixTrie: trie;

function hideAutocomplete(hide: boolean) {
  autocomplete.style.display = hide ? 'none' : 'block';
}

main.onclick = () => {
  hideAutocomplete(true);
};

function getNewBackgroundColor() {
  return 'hsl(' + Math.random() * 360 + ', 50%, 75%)';
}

/**
 * Send a word to the front end (w/ animation.)
 * @param word word to send to the other front end
 */
async function sendWord(word: string) {
  word = word.replace(' ', '_');
  bc.postMessage(word);
  textInput.value = '';
  button.setAttribute('disabled', 'true');

  // Deal with circle animation.
  circle.classList.add('side');
  await sleep(1000);
  circle.classList.remove('side');
  circle.style.backgroundColor = getNewBackgroundColor();
  circle.classList.add('invisible');
  await sleep(1000);
  circle.classList.remove('invisible');
}

button.onclick = () => {
  const word = textInput.value;
  sendWord(word);
};

/**  Clear all children of an HTML element. */
function clear(div: HTMLElement) {
  while (div.firstChild) {
    div.removeChild(div.firstChild);
  }
}


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
  } else

  // Otherwise, show the autocomplete list.
  {
    // Enable or disable button, depending on if the word is allowed.
    if (prefixTrie.hasWord(letters)) {
      button.removeAttribute('disabled');
    } else {
      button.setAttribute('disabled', true);
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
  // Check if we have an entry in the database.
  const db = new Dexie(BARBICAN_DATABASE_NAME);
  db.version(1).stores({embeddings: 'words,values'});
  console.log(db)
  let words: string[];
  const length = await (db as any).embeddings.count();
  if (length == null || length == 0) {
    console.log('Loading embeddings from the network...');
    const wordsRequest = await fetch(EMBEDDINGS_WORDS_URL);
    words = await wordsRequest.json();
  } else {
    console.log('Loading embeddings from IndexedDB cache...');
    const results = await (db as any).embeddings.toArray();
    words = results[0].words;
    await db.close();
  }
  // Make prefix tree.
  for (let i = 0; i < words.length; i++) {
    words[i] = words[i].replace('_', ' ');
  }
  prefixTrie = trie(words);

  // Round # words to closest 10th index till tfjs prime number bug is
  // fixed.
  let embLen = words.length;
  if (embLen > 10000) {
    embLen = Math.floor(embLen / 10) * 10;
  }
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
