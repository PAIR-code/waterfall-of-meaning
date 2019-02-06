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

/** Composite all the scenes together, and set up blending effects. */

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
    w: number, h: number, renderer: THREE.WebGLRenderer) {
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.autoClear = false;
  document.body.appendChild(renderer.domElement);

  // Make our composer, and render passes.
  const composer = new EffectComposer(renderer);
  var params = {
    // FYI: Using 'THREE.NearestFilter' instead these makes rain
    // render as dots rather than blurred streaks.
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    // stencilBuffer: false,
  };

  // Words passes. Render words and save.
  var renderPassWords = new RenderPass(
      wordScene, camera, undefined, undefined, undefined,
      new THREE.WebGLRenderTarget(w, h, params));
  // var savePassWords = new SavePass(
  //     new THREE.WebGLRenderTarget(width, height, renderTargetParameters));

  // Rain passes. Render, save, and blend with the previous frame for blur.
  var renderPassRain = new RenderPass(
      rainScene, camera, undefined, undefined, undefined,
      new THREE.WebGLRenderTarget(w, h, params));


  var blendPassRain = new ShaderPass(
      RainBlendShader, 'tDiffuse1', new THREE.WebGLRenderTarget(w, h, params));

  var savePassRain = new SavePass(new THREE.WebGLRenderTarget(w, h, params));
  savePassRain.uniforms['tDiffuse'].value = blendPassRain.renderTarget.texture;

  blendPassRain.uniforms['tDiffuse2'].value =
      renderPassRain.renderTarget.texture;
  blendPassRain.uniforms['tDiffuse1'].value = savePassRain.renderTarget.texture;

  // Blend EVERYTHING together
  var blendPass = new ShaderPass(SceneBlender, 'tDiffuse1');
  blendPass.uniforms['tDiffuse1'].value = blendPassRain.renderTarget.texture;
  blendPass.uniforms['tDiffuse2'].value = renderPassWords.renderTarget.texture;

  // output pass
  blendPass.renderToScreen = true;

  // Composite everything together (order matters here!)
  composer.addPass(renderPassRain);
  composer.addPass(blendPassRain);
  composer.addPass(savePassRain);

  composer.addPass(renderPassWords);

  composer.addPass(blendPass);

  return composer;
}


export class ComposerClass {
  passes: Pass2[] = [];
  constructor(private renderer: THREE.Renderer) {}
  addPass(pass: Pass2) {
    this.passes.push(pass);
  }
  render() {
    this.passes.forEach(pass => {
      pass.render(this.renderer);
    })
  }
}

export class Pass2 {
  render(renderer: THREE.renderer) {
    console.error('THREE.Pass: .render() must be implemented in derived pass.');
  }
}

export class RenderPass2 extends Pass2 {
  render(renderer: THREE.Renderer) {}
}
export class SavePass2 extends Pass2 {
  render(renderer: THREE.Renderer) {}
}

export class ShaderPass2 extends Pass2 {
  render(renderer: THREE.Renderer) {}
}
