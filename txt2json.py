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

FILENAME = 'w2v_gnews_small.txt'

f = open(, 'r')
lines = f.read().split('\n')
f.close()

embeddings = {}
lent = 0
for line in lines:
  vals = line.split(' ')

  embeddings[vals[0]] = [float(val) for val in vals[1:]]

f = open('embeddings.json', 'w')
f.write(json.dumps(embeddings))
f.close()
