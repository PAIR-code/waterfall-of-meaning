/** Composite all the scenes together. */
import * as THREE from 'three';
import {BlendShader, CopyShader} from 'three-shaders';

import {RainBlendShader} from './rainBlendShader';
import {SceneBlender} from './sceneBlenderShader';

const {RenderPass} = require('./EffectComposer/RenderPass');
const {SavePass} = require('./EffectComposer/SavePass');
const {ShaderPass} = require('./EffectComposer/ShaderPass');
const {EffectComposer} = require('./EffectComposer/EffectComposer');

export function makeCompositor(
    rainScene: THREE.Scene, wordScene: THREE.Scene, camera: THREE.Camera,
    width: number, height: number) {
  // Create renderer screen element and add to DOM.
  const renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);
  renderer.autoClear = false;
  document.body.appendChild(renderer.domElement);

  // Make our composer, and render passes.
  const composer = new EffectComposer(renderer);
  var renderTargetParameters = {
    // FYI: Using 'THREE.NearestMipMapNearestFilter' instead these makes rain
    // render as dots rather than blurred streaks.
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    stencilBuffer: false,
  };

  // Words
  var renderPassWords = new RenderPass(wordScene, camera);
  var savePassWords = new SavePass(
      new THREE.WebGLRenderTarget(width, height, renderTargetParameters));
  var blendPassWords = new ShaderPass(BlendShader(), 'tDiffuse1');
  blendPassWords.uniforms['tDiffuse2'].value =
      savePassWords.renderTarget.texture;

  // Rain
  var renderPassRain = new RenderPass(rainScene, camera);
  var savePassRain = new SavePass(
      new THREE.WebGLRenderTarget(width, height, renderTargetParameters));
  var blendPassRain = new ShaderPass(RainBlendShader, 'tDiffuse1');
  blendPassRain.uniforms['tDiffuse2'].value = savePassRain.renderTarget.texture;

  // Blend EVERYTHING together
  var blendPass = new ShaderPass(SceneBlender, 'tDiffuse1');
  blendPass.uniforms['tDiffuse2'].value = savePassWords.renderTarget.texture;

  // output pass
  var outputPass = new ShaderPass(CopyShader());
  outputPass.renderToScreen = true;

  // Composite everything together (order matters here!)
  composer.addPass(renderPassWords);
  composer.addPass(savePassWords);

  composer.addPass(renderPassRain);
  composer.addPass(blendPassRain);
  composer.addPass(savePassRain);

  composer.addPass(blendPass);
  composer.addPass(outputPass);
  return composer;
}
