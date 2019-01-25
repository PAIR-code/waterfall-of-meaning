/**
 * Master class for visualizing the words, rain, etc of the scene.  It
 * delegates to SceneCompositor for blending and the scenes.
 */
import * as THREE from 'three';

import {makeCompositor} from './scenesCompositor'
import * as utils from './utils'

const font = require('../fonts/Raleway_Light.json');
const axisFont = require('../fonts/Raleway_Light.json');

const ELT_WIDTH = 1000;
const ELT_HEIGHT = 2000;
const TOP = ELT_HEIGHT / 5;
const BOTTOM = 0;
const LEFT = -ELT_WIDTH / 10;
const RIGHT = ELT_WIDTH / 10;
const WIDTH = RIGHT - LEFT;
const DT = 3;
const NUM_RAINDROPS = 1000;
const BG_COLOR = {
  h: 217,
  s: 60,
  l: 17
}

export class Visualization {
  rainGeometry: any;
  composer: any;
  words: any[] = [];
  blurs: any[] = [];
  font: any;
  axisFont: any;
  wordScene: THREE.Scene;
  rainScene: THREE.Scene;
  yPosToAxesArr: number[] = [];
  axesToYPosArr: number[] = [];
  axesWidths: number[] = [];

  constructor(private axes: string[][]) {
    this.init();
    this.animate();
  }

  /** Create and set up the visualization. */
  private init() {
    this.font = new THREE.Font(font);
    this.axisFont = new THREE
                        .Font(axisFont)

                    // Save some axis/ypos offline to speed up frame rate.
                    this.precomputeAxesYPos()

                    // Make scene that contains the rain.
                    this.rainScene = new THREE.Scene();
    this.makeRain();

    // Make scene that contains the inputted words.
    this.wordScene = new THREE.Scene();
    this.wordScene.background = new THREE.Color(0X284472);

    // Make axis words.
    for (const axis of this.axes) {
      this.makeAxisWord(axis);
    }

    // Add camera and renderer, which
    const camera =
        new THREE.OrthographicCamera(LEFT, RIGHT, TOP, BOTTOM, 2, 2000);
    camera.position.z = 1000;
    this.composer = makeCompositor(
        this.rainScene, this.wordScene, camera, ELT_WIDTH, ELT_HEIGHT);
  }

  private precomputeAxesYPos() {
    for (let i = 0; i < TOP; i++) {
      this.yPosToAxesArr.push(this.yPosToAxes(i))
    }
    for (let i = 0; i < this.axes.length; i++) {
      this.axesToYPosArr.push(this.axesToYPos(i))
    }
  }

  /**
   * Adds a user-inputted word to the scene.
   * @param word string to add to the scene.
   * @param similarity polarization along the bias axis.
   * @param isQueryWord Was this the original query word that the user typed in?
   *
   */
  addWord(
      word: string, similarities: number[], isQueryWord: boolean, id: number) {
    word = word.replace('_', ' ');
    this.words.push(this.makeWord(word, similarities, isQueryWord, id));
  }

  /** Animation loop. Updates positions and rerenders. */
  private async animate() {
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
  private makeWord(
      word: string, similarities: number[], isQueryWord: boolean, id: number) {
    const circleRad = 2;
    const words = word.split(' ');
    const wordGroup = new THREE.Group();

    // Make the material for the text itself
    const wordColor = new THREE.Color(utils.toHSL(id, 50, 75));
    const bgColor =
        new THREE.Color(utils.toHSL(id, 50, (isQueryWord ? 10 : 75)));
    const blurColor = new THREE.Color(utils.toHSL(id, 100, 50));
    const textMaterial = new THREE.MeshBasicMaterial({
      color: wordColor,
      opacity: Math.abs(similarities[0] * 2),
      transparent: true
    });

    // The geometry of the word. Use the font created earlier.
    for (let i = 0; i < words.length; i++) {
      const singleWord = words[i];
      const textGeometry = new THREE.TextGeometry(singleWord.toLowerCase(), {
        font: this.font,
        size: 2,
        height: 2.5,
        curveSegments: 12,
        bevelThickness: .1,
      });

      // Add the word mesh
      const wordMesh = new THREE.Mesh(textGeometry, textMaterial);
      textGeometry.computeBoundingBox();
      const bb = textGeometry.boundingBox;
      const wordWidth = (bb.max.x - bb.min.x);
      const wordHeight = (bb.max.y - bb.min.y);
      const yPos = (words.length / 2 - i - 1) * wordHeight;
      wordMesh.position.set(-wordWidth / 2, yPos + circleRad * 2, 0);
      wordGroup.add(wordMesh)
    }

    // Make the background circle.
    const circleGeometry = new THREE.CircleGeometry(circleRad * 2, 32);
    const circleMaterial =
        new THREE.MeshBasicMaterial({color: bgColor, transparent: true});
    const circle = new THREE.Mesh(circleGeometry, circleMaterial);
    circle.position.set(0, circleRad * 2, 0)

    // Make the blur trail circle.
    const blurGeometry = new THREE.CircleGeometry(circleRad * 2, 32);
    const blurMaterial =
        new THREE.MeshBasicMaterial({color: blurColor, transparent: false});
    const blurMesh = new THREE.Mesh(blurGeometry, blurMaterial);

    // Make all of this into a group.
    var group = new THREE.Group();
    group.add(wordGroup);
    group.add(circle);
    group.userData = {vel: 0, pulls: similarities};
    const startYPos = isQueryWord ? TOP : this.randomYPos();
    group.position.set(this.centerXPos(), startYPos, 0);
    this.wordScene.add(group);
    this.rainScene.add(blurMesh);
    this.blurs.push(blurMesh);
    return group;
  }

  /** Create rain (which is a THREE.points) and add it to the rain scene. */
  private makeRain() {
    this.rainGeometry = new THREE.Geometry();
    const sprite = utils.makeSprite()

    for (var i = 0; i < NUM_RAINDROPS; i++) {
      var x = this.randomXPos();
      var y = this.randomRainYPos();
      var z = 0;
      this.rainGeometry.vertices.push(new THREE.Vector3(x, y, z));
    }

    // Store the pulls (random direction of the rain) and velocity.
    this.rainGeometry.userData = {
      pulls:
          Array.from({length: NUM_RAINDROPS}, () => (Math.random() - 0.5) / 20),
      vels: Array.from({length: NUM_RAINDROPS}, () => 0)
    }

    const material = new THREE.PointsMaterial({size: 2, map: sprite});
    var particles = new THREE.Points(this.rainGeometry, material);
    this.rainGeometry.verticesNeedUpdate = true;
    this.rainScene.add(particles);
  }

  /**
   * Create an axis word and add it to the scene.
   * @param axis Postive and negative sides of the axis.
   */
  private makeAxisWord(axis: string[]) {
    const textGeometry = new THREE.TextGeometry(
        axis[0].toUpperCase() + '          ' + axis[1].toUpperCase(), {
          font: this.axisFont,
          size: ELT_WIDTH / 100,
          height: 5,
          curveSegments: 12,
          bevelThickness: .1,
        });

    const textMaterial = new THREE.MeshBasicMaterial(
        {color: utils.toHSL(BG_COLOR.h, BG_COLOR.s, BG_COLOR.l)});

    // Get bounding box to see where to place this.
    textGeometry.computeBoundingBox();
    const bb = textGeometry.boundingBox;
    const mesh = new THREE.Mesh(textGeometry, textMaterial);
    const axisIdx = this.axes.indexOf(axis);
    mesh.position.set(-bb.max.x / 2, this.axesToYPos(axisIdx) - bb.max.y, -5);
    this.axesWidths.push(bb.max.x);
    this.wordScene.add(mesh);
  }

  //////////////////////////////////////////////////////////////////////////////
  // Updating positions, etc                                                  //
  //////////////////////////////////////////////////////////////////////////////

  /** Update the position of the rain drops */
  private updateRain() {
    const verts = this.rainGeometry.vertices;
    for (let i = 0; i < verts.length; i++) {
      const vert = verts[i];
      const pull = this.rainGeometry.userData.pulls[i];
      const vel = this.rainGeometry.userData.vels[i];
      const posVel = this.getNewLoc(vert, vel, pull, true);
      vert.set(posVel.x, posVel.y, posVel.z);
      this.rainGeometry.userData.vels[i] = posVel.v;

      // When the rain hits the bottom, wrap (rather than continuously
      // generating more rain.)
      if (vert.y < BOTTOM) {
        vert.set(this.randomXPos(), TOP * 1.2, 0);
        this.rainGeometry.userData.vels[i] = 0;
      }
    }
    this.rainGeometry.verticesNeedUpdate = true;
  }

  /** Update the position of the words. */
  private updateWords() {
    for (let i = this.words.length - 1; i > -1; i--) {
      let wordGroup = this.words[i];
      const vel = wordGroup.userData.vel;
      const pos = wordGroup.position;

      // Determine which level we are at, and get the pull accordingly (i.e., if
      // we're falling toward the "he/she" axis, use the "he/she" pull.)
      const axesIdx = this.yPosToAxes(pos.y);
      const bias = wordGroup.userData.pulls[axesIdx];

      // Figure out what two axes we are between (with clamping.)
      const axisContinuous = this.axesToYPosContinuous(pos.y);
      const prevBias =
          wordGroup.userData.pulls[this.clampAxis(axisContinuous + 1)];
      const blendVal = Math.max(axisContinuous % 1, 0);

      // The scale the weighted average of those (weighted by position between
      // them.)
      const scale =
          utils.lerp(blendVal, Math.abs(prevBias), Math.abs(bias)) * 3;
      wordGroup.scale.x = scale;
      wordGroup.scale.y = scale;
      wordGroup.children[1].material.opacity = scale / 5;
      wordGroup.children[0].children[0].material.opacity = scale;

      // Axis width (in 3js space.)
      const axesWidth = this.axesWidths[axesIdx];

      // Target location, (in %.)
      const targetLoc = (axesWidth / WIDTH) * bias;

      // Spring force toward the target location, (in %.)
      const pull = (targetLoc - pos.x / (WIDTH / 2)) / 5;

      // Caluclate and set the new position.
      const posVel = this.getNewLoc(pos, vel, pull, false);
      wordGroup.position.set(posVel.x, posVel.y, posVel.z);
      wordGroup.userData.vel = posVel.v;

      // Update the blur trail's poisition and scale.
      const blur = this.blurs[i]
      blur.position.set(posVel.x, posVel.y + scale * 4, posVel.z);
      blur.scale.x = scale;
      blur.scale.y = scale;

      // If the mesh is offscreen, delete all its components.
      if (posVel.y < BOTTOM + 5) {
        this.deleteWord(i, wordGroup);
      }
    }
  }

  /** Remove the word and other shapes associate with it. */
  private deleteWord(wordIdx: number, wordGroup: THREE.Group) {
    this.words.splice(wordIdx, 1);

    const wordGroupKids = wordGroup.children;
    const circle = wordGroupKids[1] as THREE.Mesh;
    this.deleteMesh(circle);  // Circle

    // Delete words (could be multiple words, like "orthopedic surgeon.")
    // NB: iterating backwards!!
    const words = wordGroupKids[0] as THREE.Group;
    for (let j = words.children.length - 1; j > -1; j--) {
      this.deleteMesh(words.children[j] as THREE.Mesh);
    }

    // Delete blur.
    const blur = this.blurs[wordIdx];
    this.blurs.splice(wordIdx, 1);
    this.deleteMesh(blur);
  }

  /**
   * Dispose of the mesh fully.
   * @param obj Mesh to be removed
   */
  private deleteMesh(obj: THREE.Mesh) {
    obj.parent.remove(obj);
    obj.geometry.dispose();
    if (!Array.isArray(obj.material)) {
      obj.material.dispose();
    }
    obj = undefined;
  }

  /**
   *  Get the new position, based on the previous position and velocity.
   * This is done with Euler's Method
   * (http://tutorial.math.lamar.edu/Classes/DE/EulersMethod.aspx)
   * @param prevPos: Position of the word/rain at the last step.
   * @param prevV: Velocity of the word/rain at the last step.
   * @param xForce: Force in the x direction (random for rain, not for word.)
   * @param isRain: Is this rain?
   */
  private getNewLoc(
      prevPos: THREE.Vector3, prevV: number, xForce: number, isRain: boolean) {
    // Update x position with the force.
    const x = prevPos.x + xForce * DT;

    // Same with Y.
    const fGravity = -1 / 5000;
    let v = prevV + fGravity * DT;
    let y = prevPos.y + v * DT;
    let z = prevPos.z;

    // Bounce is less high for words, cause it looks pretty annoying.
    let vBounce;
    if (!isRain) {
      vBounce = 1 / 100 + Math.random() / 20;
    }
    if (isRain) {
      vBounce = -v * Math.random() / 3;
    }

    // Figure out if we're near a word axis, and bounce if so.
    const numAxes = this.axes.length;
    for (let i = 0; i < numAxes; i++) {
      const height = this.axesToYPos(i);
      const widthExtent = this.axesWidths[i] / 2;
      if (utils.isNear(y, height) && prevPos.x < widthExtent &&
          prevPos.x > -widthExtent) {
        if (prevPos.z < numAxes - i) {
          v = vBounce;
          y = height
          z = numAxes - i;
        }
      }
    }
    return {x, y, z, v};
  }

  /** Randomn position, in THREE js units, along the x axis. */
  private randomXPos() {
    return (RIGHT - LEFT) * Math.random() - RIGHT;
  }

  /** Center, in THREE js units, along the x axis. */
  private centerXPos() {
    return (RIGHT - LEFT) / 2 - RIGHT;
  }

  /**
   * Randomn position in y, in THREE js units, *above* the top of the viewport.
   * Used for generating word locations before they fall.
   */
  private randomYPos() {
    return TOP + 2 * TOP * Math.random();
  }

  /** Randomn position, in THREE js units, along the y axis. */
  private randomRainYPos() {
    return TOP * 1.2 * Math.random();
  }

  /** Return the y position given a word axis index. */
  private axesToYPos(axisIdx: number) {
    if (this.axesToYPosArr[axisIdx]) return this.axesToYPosArr[axisIdx];
    const numAxes = this.axes.length;
    return TOP * (axisIdx + 1) / (numAxes + 1);
  }

  private axesToYPosContinuous(y: number) {
    const numAxes = this.axes.length;
    const percentageFromTop = y / TOP;
    let axis = percentageFromTop * (numAxes + 1) - 1;
    return axis
  }

  /** Clamp the axes between 0 and total numAxes. */
  private clampAxis(axis: number) {
    const numAxes = this.axes.length;
    axis = Math.max(0, Math.min(axis, numAxes - 1))
    return Math.floor(axis);
  }

  /** Return the word axis index given the y position. */
  private yPosToAxes(y: number) {
    y = Math.floor(y);
    if (this.yPosToAxesArr[y]) return this.yPosToAxesArr[y];
    let axis = this.axesToYPosContinuous(y)
    return this.clampAxis(axis);
  }
}
