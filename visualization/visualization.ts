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

/**
 * Master class for visualizing the words, rain, etc of the scene.  It
 * delegates to SceneCompositor for blending and the scenes.
 */
import {start} from 'repl';
import * as THREE from 'three';

import {makeCompositor} from './scenesCompositor'
import * as utils from './utils'

const font = require('../fonts/Raleway_Light.json');
const axisFont = require('../fonts/Raleway_Light.json');

// Width and height of DOM element.
const ELT_WIDTH = 1000;
const ELT_HEIGHT = 2000;

// Parameters in THREEjs space.
const TOP = ELT_HEIGHT / 5;
const BOTTOM = 0;
const LEFT = -TOP / 4;
const RIGHT = TOP / 4;
const WIDTH = RIGHT - LEFT;

// For the physics!
const DT = 1;
const NUM_RAINDROPS = 1000;
const AXIS_COLOR = {
  h: 217,
  s: .60,
  v: .17
};
const BG_COLOR = {
  h: 217,
  s: .48,
  v: .30
};

export class Visualization {
  rainGeometry: any;
  composer: any;
  words: any[];
  blurs: any[];
  font: any;
  axisFont: any;
  wordScene: THREE.Scene;
  rainScene: THREE.Scene;
  yPosToAxesArr: number[];
  axesToYPosArr: number[];
  axesWidths: number[];
  renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({antialias: true});
  animating = false;

  // Controlable params for dat.gui
  numRaindrops: number = NUM_RAINDROPS;
  rainSpeed: number = 1;
  wordSpeed: number = 1;
  axisFontSize: number = 1;
  wordFontSize: number = 1;
  axisColor = AXIS_COLOR;
  bgColor = BG_COLOR;
  wordBrightness = .75;
  qWordBrightness = .2;
  circleBrightness = .75;

  constructor(private axes: string[][]) {
    this.start();
  }
  start() {
    const child = document.body.getElementsByTagName('canvas');
    if (child.length > 0) {
      document.body.removeChild(child[0]);
    }
    this.words = [];
    this.blurs = [];
    this.yPosToAxesArr = [];
    this.axesToYPosArr = [];
    this.axesWidths = [];
    this.init();
    if (!this.animating) {
      this.animate();
    }
  }

  /** Create and set up the visualization. */
  private init() {
    this.font = new THREE.Font(font);
    this.axisFont = new THREE.Font(axisFont);

    // Save some axis/ypos offline to speed up frame rate.
    this.precomputeAxesYPos()

        // Make scene that contains the rain.
        this.rainScene = new THREE.Scene();
    this.makeRain();

    // Make scene that contains the inputted words.
    this.wordScene = new THREE.Scene();
    this.wordScene.background = new THREE.Color(
        utils.toHSL(this.bgColor.h, this.bgColor.s, this.bgColor.v));

    // Make axis words.
    this.axes.forEach(axis => {
      this.makeAxisWord(axis);
    });

    // Add camera and renderer, which
    const camera =
        new THREE.OrthographicCamera(LEFT, RIGHT, TOP, BOTTOM, 2, 2000);
    camera.position.z = 1000;
    this.composer = makeCompositor(
        this.rainScene, this.wordScene, camera, ELT_WIDTH, ELT_HEIGHT,
        this.renderer);
  }

  private precomputeAxesYPos() {
    for (let i = 0; i < TOP; i++) {
      this.yPosToAxesArr.push(this.yPosToAxes(i));
    }
    for (let i = 0; i < this.axes.length; i++) {
      this.axesToYPosArr.push(this.axesToYPos(i));
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
      word: string, similarities: number[], isQueryWord: boolean,
      colorId: number, idxFromQuery: number) {
    word = word.replace('_', ' ');
    this.words.push(
        this.makeWord(word, similarities, isQueryWord, colorId, idxFromQuery));
  }

  /** Animation loop. Updates positions and rerenders. */
  private async animate() {
    this.animating = true;
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
      word: string, similarities: number[], isQueryWord: boolean, id: number,
      idxFromQuery: number) {
    const circleRad = 2 * this.wordFontSize;
    const words = word.split(' ');
    const wordGroup = new THREE.Group();

    // The color scheme is as follows: circle, word, and trail all have the same
    // hue. The circle and word are a lighter version (except the query word),
    // the blur is a darker version.
    const wordColor = new THREE.Color(utils.toHSL(
        id, .50, isQueryWord ? this.qWordBrightness : this.wordBrightness));
    const bgColor = new THREE.Color(utils.toHSL(id, .5, this.circleBrightness));
    const blurColor =
        new THREE.Color(utils.toHSL(id, 1., this.circleBrightness));
    // Make the material for the text itself.
    const textMaterial = new THREE.MeshBasicMaterial({
      color: wordColor,
      opacity: Math.abs(similarities[0] * 2),
      transparent: true
    });
    // Make all of this into a group.
    var group = new THREE.Group();
    group.userData = {vel: 0, pulls: similarities, isQueryWord};
    const startYPos = isQueryWord ? TOP : TOP + idxFromQuery * .1;
    group.position.set(this.centerXPos(), startYPos, 0);

    // The geometry of the word. Use the font created earlier.
    for (let i = 0; i < words.length; i++) {
      const singleWord = words[i];
      const textGeometry = new THREE.TextGeometry(singleWord.toLowerCase(), {
        font: this.font,
        size: 2 * this.wordFontSize,
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
      let yPos = (words.length / 2 - i - 1) * wordHeight;
      yPos += isQueryWord ? circleRad * 2 : circleRad;
      wordMesh.position.set(-wordWidth / 2, yPos, 0);
      wordGroup.add(wordMesh)
    }
    group.add(wordGroup);

    // Make the background circle.
    if (isQueryWord) {
      const circleGeometry = new THREE.CircleGeometry(circleRad * 2, 32);
      const circleMaterial =
          new THREE.MeshBasicMaterial({color: bgColor, transparent: true});
      const circle = new THREE.Mesh(circleGeometry, circleMaterial);
      circle.position.set(0, circleRad * 2, 0)
      group.add(circle);

      // Make the blur trail circle.
      const blurGeometry = new THREE.CircleGeometry(circleRad * 2, 32);
      const blurMaterial =
          new THREE.MeshBasicMaterial({color: blurColor, transparent: false});
      const blurMesh = new THREE.Mesh(blurGeometry, blurMaterial);
      this.rainScene.add(blurMesh);
      this.blurs.push(blurMesh);
    } else {
      this.blurs.push(null);
    }

    this.wordScene.add(group);
    return group;
  }

  /** Create rain (which is a THREE.points) and add it to the rain scene. */
  private makeRain() {
    this.rainGeometry = new THREE.Geometry();
    const sprite = utils.makeSprite()
    for (var i = 0; i < this.numRaindrops; i++) {
      var x = this.randomXPos();
      var y = this.randomRainYPos();
      var z = 0;
      this.rainGeometry.vertices.push(new THREE.Vector3(x, y, z));
    }

    // Store the pulls (random direction of the rain) and velocity.
    this.rainGeometry.userData = {
      pulls: Array.from(
          {length: this.numRaindrops}, () => (Math.random() - 0.5) / 20),
      vels: Array.from({length: this.numRaindrops}, () => 0)
    }

    const material = new THREE.PointsMaterial({size: 2, map: sprite});
    var particles = new THREE.Points(this.rainGeometry, material);
    this.rainGeometry.verticesNeedUpdate = true;
    this.rainScene.add(particles);
  }

  private axisWordMesh(word: string, material: THREE.Material) {
    const textGeometry = new THREE.TextGeometry(word.toUpperCase(), {
      font: this.axisFont,
      size: ELT_WIDTH / 100 * this.axisFontSize,
      height: 5,
      curveSegments: 12,
      bevelThickness: .1,
    });
    const mesh = new THREE.Mesh(textGeometry, material);
    return mesh;
  }


  /**
   * Create an axis word and add it to the scene.
   * @param axis Postive and negative sides of the axis.
   */
  private makeAxisWord(axis: string[]) {
    const textMaterial = new THREE.MeshBasicMaterial({
      color: utils.toHSL(this.axisColor.h, this.axisColor.s, this.axisColor.v)
    });

    // Word for the left side of the axis
    const mesh0 = this.axisWordMesh(axis[0], textMaterial);
    mesh0.position.set(-RIGHT * 3 / 4, 0, 0);

    // Word for the right side of the axis
    const mesh1 = this.axisWordMesh(axis[1], textMaterial);
    mesh1.geometry.computeBoundingBox();
    const bb = mesh1.geometry.boundingBox;
    mesh1.position.set(RIGHT * 3 / 4 - bb.max.x, 0, 0);

    // Group for the words.
    const group = new THREE.Group();
    group.add(mesh0);
    group.add(mesh1);
    const axisIdx = this.axes.indexOf(axis);
    group.position.set(0, this.axesToYPos(axisIdx) - bb.max.y, -5);
    this.axesWidths.push(WIDTH * 3 / 4);
    this.wordScene.add(group);
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
      const isQueryWord = wordGroup.userData.isQueryWord;
      const queryWordScale = 3;
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
      let scale = utils.lerp(blendVal, Math.abs(prevBias), Math.abs(bias)) * 2;
      scale = Math.pow(scale, 3);
      if (!isQueryWord) {
        wordGroup.scale.x = scale;
        wordGroup.scale.y = scale;
      } else {
        wordGroup.scale.x = queryWordScale;
        wordGroup.scale.y = queryWordScale;
      }
      wordGroup.children[0].children[0].material.opacity = scale;

      // Axis width (in 3js space.)
      const axesWidth = this.axesWidths[axesIdx];

      // Target location, (in %.)
      const targetLoc = (axesWidth / WIDTH) * bias;

      // Spring force toward the target location, (in %.)
      const pull = (targetLoc - pos.x / (WIDTH / 2)) / 5;

      let posVel;
      // Caluclate and set the new position.
      posVel =
          this.getNewLoc(pos, vel, pull, false, isQueryWord ? 1 : bias * .99);

      wordGroup.position.set(posVel.x, posVel.y, posVel.z);
      wordGroup.userData.vel = posVel.v;

      // Update the blur trail's poisition and scale.
      if (isQueryWord) {
        const blur = this.blurs[i]
        blur.position.set(
            posVel.x, posVel.y + queryWordScale * this.wordFontSize * 4,
            posVel.z);
        blur.scale.x = queryWordScale;
        blur.scale.y = queryWordScale;
      }
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
    if (wordGroup.userData.isQueryWord) {
      const circle = wordGroupKids[1] as THREE.Mesh;
      this.deleteMesh(circle);  // Circle

      // Delete blur.
      const blur = this.blurs[wordIdx];
      this.deleteMesh(blur);
    }
    this.blurs.splice(wordIdx, 1);

    // Delete words (could be multiple words, like "orthopedic surgeon.")
    // NB: iterating backwards!!
    const words = wordGroupKids[0] as THREE.Group;
    for (let j = words.children.length - 1; j > -1; j--) {
      this.deleteMesh(words.children[j] as THREE.Mesh);
    }
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
      prevPos: THREE.Vector3, prevV: number, xForce: number, isRain: boolean,
      bias = 0) {
    let speed = isRain ? this.rainSpeed : this.wordSpeed;
    speed = speed * Math.abs(Math.pow(bias, 3));

    // Update x position with the force.
    const x = prevPos.x + xForce * DT * speed;

    // Same with Y.
    const fGravity = -1 / 500;
    let v = prevV + fGravity * DT * speed;
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
