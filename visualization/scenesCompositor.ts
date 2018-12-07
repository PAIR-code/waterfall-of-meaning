/** Composite all the scenes together. */
import { RainBlendShader } from './rainBlendShader'
import { SceneBlender } from './sceneBlenderShader'

export function makeCompositor(rainScene, axisWordScene, wordScene, camera, width, height) {

  // Create renderer screen element and add to DOM.
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);
  renderer.autoClear = false;
  document.body.appendChild(renderer.domElement);

  // Make our composer, and render passes.
  const composer = new THREE.EffectComposer(renderer);
  var renderPassAxis = new THREE.RenderPass(axisWordScene, camera);
  var renderPassWords = new THREE.RenderPass(wordScene, camera);
  var renderPassRain = new THREE.RenderPass(rainScene, camera);

  // Parameters that apply to the rendering of all scenes.

  var renderTargetParameters = {
    // FYI: Using 'THREE.NearestMipMapNearestFilter' instead these makes rain
    // render as dots rather than blurred streaks.
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    stencilBuffer: false,
  };

  // Each scene gets a save pass, so that we can blend them together.
  var savePassAxisWords = new THREE.SavePass(new THREE.WebGLRenderTarget(width, height, renderTargetParameters));
  var savePassWords = new THREE.SavePass(new THREE.WebGLRenderTarget(width, height, renderTargetParameters));
  var savePassRain = new THREE.SavePass(new THREE.WebGLRenderTarget(width, height, renderTargetParameters));

  // Blend passes for rain and words, so that they have motion blur.
  var blendPassRain = new THREE.ShaderPass(RainBlendShader, 'tDiffuse1');
  blendPassRain.uniforms['tDiffuse2'].value = savePassRain.renderTarget.texture;
  var blendPassWords = new THREE.ShaderPass(THREE.BlendShader, 'tDiffuse1');
  blendPassWords.uniforms['tDiffuse2'].value = savePassWords.renderTarget.texture;

  // Blend EVERYTHING together
  var blendPass = new THREE.ShaderPass(SceneBlender, 'tDiffuse1');
  blendPass.uniforms['tDiffuse2'].value = savePassWords.renderTarget.texture;
  blendPass.uniforms['tDiffuse3'].value = savePassAxisWords.renderTarget.texture;

  // output pass
  var outputPass = new THREE.ShaderPass(THREE.CopyShader);
  outputPass.renderToScreen = true;

  // Composite everything together (order matters here!)
  composer.addPass(renderPassWords);
  composer.addPass(blendPassWords);
  composer.addPass(savePassWords);

  composer.addPass(renderPassAxis);
  composer.addPass(savePassAxisWords);

  composer.addPass(renderPassRain);
  composer.addPass(blendPassRain);
  composer.addPass(savePassRain);

  composer.addPass(blendPass);
  composer.addPass(outputPass);

  return composer;
}
