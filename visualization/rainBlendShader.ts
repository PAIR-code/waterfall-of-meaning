/**
 * @author alteredq / http://alteredqualia.com/ and ereif edited some stuff.
 *
 * Blend two textures with a custom blend.
 */
import * as THREE from 'three'

export const RainBlendShader = new THREE.ShaderMaterial({

  uniforms: {
    'tDiffuse1': {value: null},
    'tDiffuse2': {value: null},
  },

  vertexShader: [

    'varying vec2 vUv;', 'void main() {', 'vUv = uv;',
    'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
    '}'

  ].join('\n'),

  fragmentShader: [

    'uniform float opacity;',

    'uniform sampler2D tDiffuse1;',
    'uniform sampler2D tDiffuse2;',

    'varying vec2 vUv;',

    'void main() {',

    'vec4 texel1 = texture2D( tDiffuse1, vUv );',  // Current step
    'vec4 texel2 = texture2D( tDiffuse2, vUv );',  // Previous step

    'gl_FragColor = texel1  + texel2 - 0.002;',
    'if (any(greaterThan(gl_FragColor, vec4(.99)))) {',
    'gl_FragColor = texel1 * .7;',
    '}',
    '}',
  ].join('\n')
})
