/**
 * @author alteredq / http://alteredqualia.com/ (forked from, and then ereif edited some more.)
 *
 * Blend three textures
 */

export const SceneBlender = {

  uniforms: {

    "tDiffuse1": { value: null },
    "tDiffuse2": { value: null },
    "tDiffuse3": { value: null },
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
    "uniform sampler2D tDiffuse3;",
    "varying vec2 vUv;",

    "void main() {",

    "vec4 texel1 = texture2D( tDiffuse1, vUv );", // Rain texture
    "vec4 texel2 = texture2D( tDiffuse2, vUv );", // Words texture
    "vec4 texel3 = texture2D( tDiffuse3, vUv );", // Axis words texture
    "vec4 bg = texel1 + texel3;",
    "gl_FragColor = texel2 + bg;",
    // "if (any(greaterThan(texel2, vec4(0.2)))) {",
    // // "vec4 color = vec4(.06, .145, .27, 1.);",
    // "vec4 color = vec4(1.);",
    // "gl_FragColor = mix(bg, color, 0.8);",
    // '}',


    // "gl_FragColor = texel3 + max(texel1 - texel2, 0.) ;",
    // "gl_FragColor = step(texel2*10., vec4(0.)) * bg)  + texel2;",

    // "gl_FragColor = texel2 + bg;",
    // "if (any(greaterThan(texel2, vec4(0.2)))) {",
    // "gl_FragColor = vec4(0.);",
    // '}',

    // "gl_FragColor = max(texel1 + texel2 + texel3, texel2);",

    "}"
  ].join("\n")
};

