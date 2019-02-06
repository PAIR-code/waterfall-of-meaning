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
 * @author alteredq / http://alteredqualia.com/
 * (Forked from the above, and then ereif edited some more.)
 *
 * Blend the rain and words together with a custom function.
 */

import * as THREE from 'three'

export const SceneBlender = new THREE.ShaderMaterial({

  uniforms: {

    'tDiffuse1': {value: null},
    'tDiffuse2': {value: null},
  },

  vertexShader: [

    'varying vec2 vUv;', 'void main() {',

    'vUv = uv;',
    'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',

    '}'

  ].join('\n'),

  fragmentShader: [

    'uniform float opacity;', 'uniform sampler2D tDiffuse1;',
    'uniform sampler2D tDiffuse2;', 'varying vec2 vUv;',

    'void main() {',

    'vec4 texel1 = texture2D( tDiffuse1, vUv );',  // Rain texture
    'vec4 texel2 = texture2D( tDiffuse2, vUv );',  // Words texture

    'gl_FragColor = texel2 + min(texel1, vec4(0.5)) * 1.;',

    '}'
  ].join('\n')
});
