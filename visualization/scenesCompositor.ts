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
import {CopyShader} from './CopyShader';
import {RainBlendShader} from './rainBlendShader';
import {SceneBlender} from './sceneBlenderShader';

export class ScenesCompositor {
  passes: Pass[] = [];
  constructor(
      rainScene: THREE.Scene, wordScene: THREE.Scene, camera: THREE.Camera,
      private w: number, private h: number,
      private renderer: THREE.WebGLRenderer) {
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.autoClear = false;
    document.body.appendChild(renderer.domElement);
    this.w = renderer.getDrawingBufferSize().width;
    this.h = renderer.getDrawingBufferSize().height;

    // Words passes. Render words and save.
    const renderPassWords =
        new RenderPass(wordScene, camera, this.newRenderTarget());

    // Rain passes. Render, save, and blend with the previous frame for blur.
    const renderPassRain =
        new RenderPass(rainScene, camera, this.newRenderTarget());
    const blendPassRain = new ShaderPass(
        RainBlendShader, this.newRenderTarget(this.w / 2, this.h / 2));

    const savePassRain = new ShaderPass(CopyShader, this.newRenderTarget());
    savePassRain.setUniform('tDiffuse', blendPassRain.getRTTexture());
    blendPassRain.setUniform('tDiffuse2', renderPassRain.getRTTexture());
    blendPassRain.setUniform('tDiffuse1', savePassRain.getRTTexture());

    // Blend rain and words together
    const blendPass = new ShaderPass(
        SceneBlender, this.newRenderTarget(this.w / 2, this.h / 2));
    blendPass.setUniform('tDiffuse1', blendPassRain.getRTTexture());
    blendPass.setUniform('tDiffuse2', renderPassWords.getRTTexture());

    // output pass
    blendPass.renderToScreen = true;

    // Composite everything together (order matters here!)
    this.addPass(renderPassRain);
    this.addPass(blendPassRain);
    this.addPass(savePassRain);
    this.addPass(renderPassWords);
    this.addPass(blendPass);
  }

  /** Create a render target with the params. */
  newRenderTarget(w = this.w, h = this.h) {
    const params = {
      // FYI: Using 'THREE.NearestFilter' instead these makes rain
      // render as dots rather than blurred streaks.
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      stencilBuffer: false,
    };
    return new THREE.WebGLRenderTarget(w, h, params);
  }

  /** Add pass to be rendered */
  addPass(pass: Pass) {
    this.passes.push(pass);
  }

  /** Render all passes */
  render() {
    this.passes.forEach(pass => {
      pass.render(this.renderer);
    })
  }
}

/** Generic render pass. */
export class Pass {
  renderToScreen = false;
  protected scene: THREE.Scene;
  protected camera: THREE.Camera;
  protected renderTarget: THREE.WebGLRenderTarget;
  render(renderer: THREE.WebGLRenderer) {
    renderer.render(
        this.scene, this.camera, this.renderToScreen ? null : this.renderTarget,
        true);
  }
  getRTTexture() {
    return this.renderTarget.texture;
  }
}

/** Simple render pass. Renders a scene to the target. */
export class RenderPass extends Pass {
  constructor(
      scene: THREE.Scene, camera: THREE.Camera,
      renderTarget: THREE.WebGLRenderTarget) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.renderTarget = renderTarget;
  }
}

/** Shader pass to apply an effect (or, any shader) to a scene. */
export class ShaderPass extends Pass {
  /** Uniforms of the shader to be passed in. */
  private uniforms: {[key: string]: THREE.IUniform};

  constructor(
      shader: THREE.ShaderMaterial, renderTarget: THREE.WebGLRenderTarget) {
    super();
    this.renderTarget = renderTarget;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new THREE.Scene();
    this.uniforms = shader.uniforms;

    // Add a quad as our render screen;
    const quad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), null);
    quad.frustumCulled = false;  // Avoid getting clipped
    this.scene.add(quad);
    quad.material = shader;
  };

  /**
   * Sets the value for a uniform.
   * @param uniformName  Name of uniform to be set.
   * @param value Value to set this uniform.
   */
  setUniform(uniformName: string, value: THREE.Texture) {
    if (uniformName in this.uniforms) {
      this.uniforms[uniformName].value = value;
    }
  }
}
