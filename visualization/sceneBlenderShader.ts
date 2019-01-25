/**
 * @author alteredq / http://alteredqualia.com/
 * (forked from, and then ereif edited some more.)
 *
 * Blend three textures
 */
import * as THREE from 'three'

export const SceneBlender = new THREE.ShaderMaterial({

  uniforms: {

    "tDiffuse1": { value: null },
    "tDiffuse2": { value: null },
  },

  vertexShader: [

    "varying vec2 vUv;",
    "void main() {",

    "vUv = uv;",
    "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

    "}"

  ].join("\n"),

  fragmentShader: [

    "uniform float opacity;",
    "uniform sampler2D tDiffuse1;",
    "uniform sampler2D tDiffuse2;",
    "varying vec2 vUv;",

    "void main() {",

    "vec4 texel1 = texture2D( tDiffuse1, vUv );", // Rain texture
    "vec4 texel2 = texture2D( tDiffuse2, vUv );", // Words texture

    "gl_FragColor = texel2 + min(texel1, vec4(0.5)) * 0.2;",

    "}"
  ].join("\n")
});

