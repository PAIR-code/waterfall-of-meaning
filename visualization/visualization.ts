/** Master class for visualizing the words, rain, etc of the scene.  It delegates to SceneCompositor for blending and the scenes.*/

import * as utils from './utils'
import { makeCompositor } from './scenesCompositor'
import { math } from '@tensorflow/tfjs';
const ELT_WIDTH = window.innerWidth;
const ELT_HEIGHT = window.innerHeight;
const TOP = ELT_HEIGHT / 5;
const BOTTOM = 0;
const LEFT = -ELT_WIDTH / 10;
const RIGHT = ELT_WIDTH / 10;
const DT = 3;
const NUM_RAINDROPS = 1000;
const BG_COLOR = { h: 217, s: 60, l: 17 }
export class Visualization {
  rainGeometry: any;
  composer: any;
  words: any[] = [];
  font: any;
  wordScene: any;

  constructor() {
    this.init();
    this.animate();
  }

  /** Create and set up the visualization. */
  private init() {

    // Make scene that contains the rain.
    const rainScene = new THREE.Scene();
    this.makeRain(rainScene);

    // Make scene that contains the inputted words.
    this.wordScene = new THREE.Scene();

    // Make scene that contains the axis word or words.
    const axisWordScene = new THREE.Scene();
    axisWordScene.background = new THREE.Color(0X284472);

    // Load the font and make the axis word or words.
    const loader = new THREE.FontLoader();
    loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', (font) => {
      this.font = font;
      this.makeAxisWord(axisWordScene);
    });

    // Add camera and renderer, which
    const camera = new THREE.OrthographicCamera(LEFT, RIGHT, TOP, BOTTOM, 2, 2000);
    camera.position.z = 1000;
    this.composer = makeCompositor(rainScene, axisWordScene, this.wordScene, camera, ELT_WIDTH, ELT_HEIGHT);
  }

  /**
   * Adds a user-inputted word to the scene.
   * @param word string to add to the scene.
   * @param similarity polarization along the bias axis.
   * @param isQueryWord Was this the original query word that the user typed in?   *
   */
  addWord(word: string, similarity: number, isQueryWord: boolean) {
    word = word.replace('_', ' ')
    this.words.push(this.makeWord(word, similarity, isQueryWord));
  }

  /** Animation loop. Updates positions and rerenders. */
  private async animate() {
    await utils.sleep(DT);
    requestAnimationFrame(() => this.animate());
    this.updateRain();
    this.updateWords();
    this.composer.render();
  }


  //////////////////////////////////////////////////////////////////////////////
  // Creating geometries                                                      //
  //////////////////////////////////////////////////////////////////////////////

  /**
   *  Make the word geometry and add it to the scene.
   * @param word string of the word to add
   * @param similarity polarization of the word along the bias axis
   * @param isQueryWord Was this the original query word that the user typed in?
   */
  private makeWord(word: string, similarity: number, isQueryWord: boolean) {
    const textGeometry = new THREE.TextGeometry(word, {
      font: this.font,
      // The size is proportional to how influenced it is by the axis.
      size: 10 * Math.abs(similarity),
      height: 2.5,
      curveSegments: 12,
      bevelThickness: .1,
    });

    const color = JSON.parse(JSON.stringify(BG_COLOR))
    color.h = similarity * 250;
    const textMaterial = new THREE.MeshBasicMaterial(
      {
        color: isQueryWord ? 'yellow' : 'white',
        opacity: Math.abs(similarity * 2),
        transparent: true
      }
    );

    const mesh = new THREE.Mesh(textGeometry, textMaterial);
    mesh.userData = { vel: 0, pull: similarity };
    const startYPos = isQueryWord ? TOP : this.randomYPos();
    mesh.position.set(this.centerXPos(), startYPos, 0);
    this.wordScene.add(mesh);
    return mesh;
  }

  /** Create rain (which is a THREE.points) and add it to the rain scene. */
  private makeRain(scene) {
    this.rainGeometry = new THREE.Geometry();
    const sprite = utils.makeSprite()
    for (var i = 0; i < NUM_RAINDROPS; i++) {
      var x = this.randomXPos();
      var y = this.randomYPos();
      var z = 0;
      this.rainGeometry.vertices.push(new THREE.Vector3(x, y, z));
    }

    this.rainGeometry.userData = {
      pulls: Array.from({ length: NUM_RAINDROPS }, () => Math.random() - 0.5),
      vels: Array.from({ length: NUM_RAINDROPS }, () => 0)
    }

    const material = new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, map: sprite });
    var particles = new THREE.Points(this.rainGeometry, material);
    this.rainGeometry.verticesNeedUpdate = true;
    scene.add(particles);
  }

  /**
   * Create an axis word and add it to the scene.
   * @param scene scene that contains the axis words.
   */
  private makeAxisWord(scene) {
    const textGeometry = new THREE.TextGeometry("HE      SHE", {
      font: this.font,
      size: 15,
      height: 5,
      curveSegments: 12,
      bevelThickness: .1,
    });

    const textMaterial = new THREE.MeshBasicMaterial(
      { color: utils.toHSL(BG_COLOR) }
    );

    // Get bounding box to see where to place this.
    textGeometry.computeBoundingBox();
    const bb = textGeometry.boundingBox;
    const mesh = new THREE.Mesh(textGeometry, textMaterial);
    mesh.position.set(-bb.max.x / 2, TOP / 2 - bb.max.y, 0);
    scene.add(mesh);
  }

  //////////////////////////////////////////////////////////////////////////////
  // Updating positions, etc                                                  //
  //////////////////////////////////////////////////////////////////////////////

  /** Update the position of the rain drops */
  private updateRain() {
    const verts = this.rainGeometry.vertices;
    for (let i = 0; i < verts.length; i++) {
      const vert = verts[i]
      const pull = this.rainGeometry.userData.pulls[i];
      const vel = this.rainGeometry.userData.vels[i]
      const posVel = this.getNewLoc(vert, vel, pull, true);
      vert.set(posVel.x, posVel.y, posVel.z);
      this.rainGeometry.userData.vels[i] = posVel.v;

      // When the rain hits the bottom, wrap (rather than continuously generating more rain.)
      if (vert.y < BOTTOM) {
        vert.set(this.randomXPos(), this.randomYPos(), 0);
        this.rainGeometry.userData.vels[i] = 0;
      }
    }
    this.rainGeometry.verticesNeedUpdate = true;
  }

  /** Update the position of the words. */
  private updateWords() {
    for (let i = this.words.length - 1; i > -1; i--) {
      const mesh = this.words[i];
      const pull = mesh.userData.pull;
      const vel = mesh.userData.vel;
      const pos = mesh.position;
      const posVel = this.getNewLoc(pos, vel, pull, false);
      mesh.position.set(posVel.x, posVel.y, posVel.z);
      mesh.userData.vel = posVel.v;
      if (posVel.y < BOTTOM + 5) {
        this.wordScene.remove(mesh);
        this.words.splice(i, 1);
      }
    }
  }

  /** Get the new position, based on the previous position and velocity. This is
   * done with Euler's Method (http://tutorial.math.lamar.edu/Classes/DE/EulersMethod.aspx)
  */
  private getNewLoc(prevPos, prevV: number, pull: number, isRain: boolean) {
    let fGravity = -1 / 5000;

    // Make words stick around longer
    if (!isRain) {
      fGravity = -1 / 2000;
    }
    const x = prevPos.x + pull / 20 * DT
    let v = prevV + fGravity * DT;

    let y = prevPos.y + v * DT;
    let z = prevPos.z;

    // Make the bounce proportional to how polarized the word is, so more
    // polarized words stick around for longer.
    let vBounce = - v * 1 / 3 * Math.abs(pull);
    if (!isRain) {
      vBounce *= Math.abs(pull * 5);
    }
    // Hack to bounce on the platforms.
    const checkPlatform = (height: number, xPos: number, width: number) => {
      if (utils.isNear(y, height) && prevPos.x < xPos + width / 2 && prevPos.x > xPos - width / 2) {
        if (prevPos.z < 1) {
          v = vBounce;
          y = height
          z += 1;
        }
      }
    }
    checkPlatform(TOP / 2, 0, 80)
    return { x, y, z, v };
  }

  private randomXPos() {
    return (RIGHT - LEFT) * Math.random() - RIGHT;
  }

  private centerXPos() {
    return (RIGHT - LEFT) / 2 - RIGHT;
  }

  private randomYPos() {
    return TOP + 2 * TOP * Math.random();
  }
}
