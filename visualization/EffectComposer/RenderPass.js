/**
 * @author alteredq / http://alteredqualia.com/
 */
const {EffectComposer, Pass} = require('./EffectComposer');

export function RenderPass(
    scene, camera, overrideMaterial, clearColor, clearAlpha, renderTarget) {
  Pass.call(this);

  this.scene = scene;
  this.camera = camera;

  this.overrideMaterial = overrideMaterial;

  this.clearColor = clearColor;
  this.clearAlpha = (clearAlpha !== undefined) ? clearAlpha : 0;

  this.clear = true;
  this.clearDepth = false;
  this.needsSwap = false;

  this.renderTarget = renderTarget;
};

RenderPass.prototype = Object.assign(Object.create(Pass.prototype), {

  constructor: RenderPass,

  render: function(renderer, writeBuffer, readBuffer, delta, maskActive) {
    var oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    this.scene.overrideMaterial = this.overrideMaterial;

    var oldClearColor, oldClearAlpha;

    if (this.clearColor) {
      oldClearColor = renderer.getClearColor().getHex();
      oldClearAlpha = renderer.getClearAlpha();

      renderer.setClearColor(this.clearColor, this.clearAlpha);
    }

    if (this.clearDepth) {
      renderer.clearDepth();
    }

    renderer.render(
        this.scene, this.camera, this.renderToScreen ? null : this.renderTarget,
        this.clear);

    if (this.clearColor) {
      renderer.setClearColor(oldClearColor, oldClearAlpha);
    }

    this.scene.overrideMaterial = null;
    renderer.autoClear = oldAutoClear;
  }

});
