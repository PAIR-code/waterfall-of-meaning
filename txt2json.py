# Copyright 2018 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ==============================================================================
"""Converts txt word embeddings to embeddings.json"""

import json
import numpy as np

FILENAME_GNEWS = 'w2v_gnews_small.txt'
FILENAME_ADDTL_WORDS = 'extra_words.txt'

f = open(FILENAME_GNEWS, 'r')
lines = f.read().split('\n')
f.close()

f = open(FILENAME_ADDTL_WORDS, 'r')
lines += f.read().split('\n')
f.close()
print('read files')

words = []
embeddings = []

for line in lines:
  vals = line.split(' ')

  word = vals[0]
  if word not in words:
    words.append(vals[0])
    embeddings.append([float(val) for val in vals[1:]])

print('translated embeddings')

f = open('embedding-words.json', 'w')
f.write(json.dumps(words))
f.close()

stacked_embeddings = np.stack(embeddings).astype('float32')
f = open('embedding-values.bin', 'w')
f.write(stacked_embeddings.tobytes())
f.close()
