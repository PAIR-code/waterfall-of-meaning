/**
 * @author alteredq / http://alteredqualia.com/
 */
import * as THREE from 'three';
const {EffectComposer, Pass} = require('./EffectComposer');

export function ShaderPass(
    shader, textureID, renderTarget = null, name = null) {
  Pass.call(this);

  this.name = name;

  this.textureID = (textureID !== undefined) ? textureID : 'tDiffuse';
  this.renderTarget = renderTarget;

  if (shader instanceof THREE.ShaderMaterial) {
    this.uniforms = shader.uniforms;

    this.material = shader;

  } else if (shader) {
    this.uniforms = THREE.UniformsUtils.clone(shader.uniforms);

    this.material = new THREE.ShaderMaterial({

      defines: Object.assign({}, shader.defines),
      uniforms: this.uniforms,
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader

    });
  }

  this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  this.scene = new THREE.Scene();

  this.quad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), null);
  this.quad.frustumCulled = false;  // Avoid getting clipped
  this.scene.add(this.quad);
};

ShaderPass.prototype = Object.assign(Object.create(Pass.prototype), {

  constructor: ShaderPass,

  render: function(renderer, writeBuffer, readBuffer, delta, maskActive) {
    this.quad.material = this.material;

    if (this.renderToScreen) {
      renderer.render(this.scene, this.camera);

    } else {
      renderer.render(this.scene, this.camera, this.renderTarget, this.clear);
    }
  }

});
