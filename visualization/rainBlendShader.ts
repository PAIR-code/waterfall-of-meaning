/**
 * @author alteredq / http://alteredqualia.com/ and ereif edited some stuff.
 *
 * Blend two textures with a custom additive blend.
 */

export const RainBlendShader = {

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

    "vec4 texel1 = texture2D( tDiffuse1, vUv );", // Current step
    "vec4 texel2 = texture2D( tDiffuse2, vUv );", // Previous step

    // Blending happens here. TODO(ereif): make it stable (i.e., not turn more and more white over time)
    "gl_FragColor = texel1 * 0.05 + texel2*.95;",

    "}"
  ].join("\n")
};

