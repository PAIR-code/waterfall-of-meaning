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
import * as d3 from 'd3';
import * as Stats from 'stats-js';
import * as THREE from 'three';

import * as utils from './utils'

// Width and height of DOM element.
const ELT_HEIGHT = 1920;
const ELT_WIDTH = ELT_HEIGHT/2;

const TOP = ELT_HEIGHT / 5;
const BOTTOM = 0;
const LEFT = -ELT_WIDTH * 2 / 5 / 4;
const RIGHT = ELT_WIDTH * 2 / 5 / 4;
const WIDTH = RIGHT - LEFT;

// Maximum number of words to be on the screen at one time.
const MAX_WORDS = 1300;

interface word {
  string: string;
  pulls: number[];
  opacity: number;
  pos: THREE.Vector3;
  currentTargetPos: THREE.Vector3;
  vel: number;
  isQueryWord: boolean;
  isBackgroundWord: boolean;
  width: number;
  scale: number;
  numFrames: number;
  distToAxis: number;
  currentAxis: number;
}

export class Visualization {
  rainGeometry: any;
  parent: any;
  words: word[] = [];
  yPosToAxesArr: number[];
  axesToYPosArr: number[];
  axesWidths: number[];
  animating = false;
  trueFontSize = 100;
  wordSpeed: number = .2;
  // wordSpeed: number = 1;
  stats: any;

  constructor(private axes: string[][]) {
    this.start();
  }
  start() {
    const children = document.body.getElementsByTagName('canvas');
    for (let i = 0; i < children.length; i++) {
      children[i].parentElement.removeChild(children[i]);
    }
    this.addStats();
    this.words = [];
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
    this.setUpParent();

    // Save some axis/ypos offline to speed up frame rate.
    this.precomputeAxesYPos();

    // Make axis words.
    this.axes.forEach(axis => {
      this.makeAxisWord(axis);
    });
  }

  private setUpParent() {
    const holder = d3.select('#vis-holder');
    this.parent = holder.append('canvas').node();

    const ctx = this.parent.getContext('2d');
    ctx.clearRect(0, 0, this.parent.width, this.parent.height);
    this.parent.width = ELT_WIDTH;
    this.parent.height = ELT_HEIGHT;

    const bg = d3.select('#vis-bg');
    bg.style('width', ELT_WIDTH + 'px');
    bg.style('height', ELT_HEIGHT + 'px');
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
      isBackgroundWord: boolean) {
    // Rate limit number of words added.
    const rateLimitExceeded = this.words.length > MAX_WORDS && !isQueryWord;
    if (rateLimitExceeded || this.wordAlreadyAdded(word, isQueryWord)) {
      return;
    }

    word = word.replace(/_/g, ' ').toLowerCase();

    // Make the scale a function of the bias values.
    const absSims: number[] = [];
    similarities.forEach((sim: number) => absSims.push(Math.abs(sim)));
    let scale = Math.max(...absSims);
    if (isQueryWord) {
      scale = 1;
    }

    // Give the scale an exponential dropoff.
    const power = 3;
    const scaleFactor = 5;
    const addFactor = .1;
    scale = Math.pow(scale + addFactor, power) * scaleFactor;
    scale = Math.abs(scale) / 10;
    if (!isBackgroundWord) {
      scale = Math.min(1, scale);
    } else {
      scale /= 2;
    }
    const wordWidth =
        utils.stringWidth(word, Math.ceil(this.trueFontSize * scale));

    // Start the words at the top.
    const startYPos = isBackgroundWord ? this.randomYPos() : TOP + 10;

    // If the word is a background word, make it lighter but with some
    // variation.
    const backgroundOpacity = .15 + .1 * (Math.random() - .5);

    // Finally, create the word object and add it to the scene.
    const wordObj: word = {
      string: word,
      scale,
      opacity: isBackgroundWord ? backgroundOpacity : 1,
      pulls: similarities,
      pos: new THREE.Vector3(this.randomXPos(), startYPos, 0),
      currentTargetPos: new THREE.Vector3(this.randomXPos(), startYPos, 0),
      vel: 0,
      isQueryWord,
      isBackgroundWord,
      width: wordWidth,
      numFrames: Infinity,
      distToAxis: Infinity,
      currentAxis: 0
    };
    this.words.push(wordObj);
  }

  /** Animation loop. Updates positions and rerenders. */
  private async animate() {
    this.stats.begin();
    this.animating = true;
    requestAnimationFrame(() => this.animate());

    const ctx = this.parent.getContext('2d');
    ctx.clearRect(0, 0, this.parent.width, this.parent.height);

    this.updateWords();
    this.stats.end();
  }

  //////////////////////////////////////////////////////////////////////////////
  // Creating geometries                                                      //
  //////////////////////////////////////////////////////////////////////////////

  private drawWord(word: word) {
    word.numFrames++;
    const ctx = this.parent.getContext('2d');

    // Draw the word itself.
    const lerpVal = utils.clamp(word.numFrames / 100, 0, 1)
    const g = utils.lerp(lerpVal, 255, 160);
    const b = utils.lerp(lerpVal, 255, 0);

    if (word.isQueryWord) {
      ctx.fillStyle = `rgb(255, 255, 255, 1)`;
    } else if (!word.isBackgroundWord) {
      ctx.fillStyle = `rgba(255, ${g}, ${b}, ${word.opacity})`;
    } else {
      ctx.fillStyle = `rgba(255, 255, 255, ${word.opacity})`;
    }
    const fontSize = Math.ceil(this.trueFontSize * word.scale);
    ctx.font = fontSize + 'px Roboto Condensed';
    let x = (word.pos.x + RIGHT) * 5 - word.width / 2;
    let y = (TOP - word.pos.y) * 5;
    ctx.fillText(word.string, x, y);


    // Add highlight spotlight.
    if (word.isQueryWord) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 255, 255, .2)`;
      const rady = 70;
      const radx = Math.max(word.width * .6, rady);
      ctx.ellipse(
          (word.pos.x + RIGHT) * 5, y - 20, radx, rady, 0, 0, 2 * Math.PI);
      ctx.fill();
    }

    if (!word.isBackgroundWord) {
      if (word.currentAxis < 1 && word.distToAxis == 0) {
        word.distToAxis = word.numFrames / 600;
      }

      if (word.currentAxis < this.axes.length && word.currentAxis > -1) {
        // Add "x % whatever"
        let bias = Math.round(word.pulls[word.currentAxis] * 50);
        const axis = this.axes[word.currentAxis];
        let label = '';
        if (axis) {
          label = bias > 0 ? axis[1] : axis[0];
        }
        bias = Math.abs(bias) + 50;
        bias = Math.min(100, bias);
        const biasText = `${bias} % ${label}`;
        const distToAxis = Math.abs(word.distToAxis - 0.5);


        let opacity = word.opacity * distToAxis * 2;
        ctx.fillStyle = `rgba(255, 160, 0, ${opacity})`
        ctx.font = Math.ceil(fontSize / 4) + 'px Roboto Condensed';

        const xPosBias = x + word.width;
        const yPosBias = y - fontSize * .6;
        ctx.fillText(biasText, xPosBias, yPosBias);
      }

      // Underline on word
      ctx.beginPath();
      let opacity = (1 - word.distToAxis) * word.opacity * 2;
      if (word.pos.y > TOP - 2) {
        opacity = 0;
      }

      ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
      const yLow = y + 5;
      ctx.lineWidth = word.isQueryWord ? 5 : 1;
      ctx.moveTo(x, yLow);
      ctx.lineTo(x + word.width, yLow);
      ctx.stroke();

      // Add line to target.
      ctx.beginPath();
      x += word.width / 2;
      ctx.beginPath();
      ctx.moveTo(x, yLow);
      let x1 = Math.ceil((word.currentTargetPos.x + RIGHT) * 5);
      let y1 = Math.ceil((TOP - word.currentTargetPos.y) * 5);
      let yavg = Math.ceil((y + y1) / 2);
      ctx.bezierCurveTo(x, yavg, x1, yavg, x1, y1);
      ctx.stroke();
    }
  }

  /**
   * Create an axis word and add it to the scene.
   * @param axis Postive and negative sides of the axis.
   */
  private makeAxisWord(axis: string[]) {

    // Hacky fix to make exhibit projector the correct color.
    // const axisWordColor = 'rgb(255, 160, 0)';
    const axisWordColor = 'rgb(255, 100, 0)';

    // Make div and add axis words.
    const holder = d3.select('#vis-bg');
    const axisDiv = holder.append('div').classed('axis-row', true);

    axisDiv.style('color', axisWordColor);
    axisDiv.append('div').classed('axis', true).text(axis[0].toUpperCase());
    axisDiv.append('div').classed('axis', true).text(axis[1].toUpperCase());

    const axisIdx = this.axes.indexOf(axis);
    const scaleHeight = this.axesToYPos(axisIdx);

    axisDiv.style('top', (TOP - scaleHeight) * 5);
    axisDiv.style('font-size', 50);
    this.axesWidths.push(WIDTH * 3 / 4);

    // Add top bar.
    const bar = holder.append('div').classed('bar', true);
    bar.style('background-color', axisWordColor);
    bar.style('opacity', 0.5)
    bar.style('top', (TOP - scaleHeight) * 5);

    // Add tick marks
    if (true) {
      for (let i = 0; i < 20; i++) {
        const tick = bar.append('div').classed('tick', true);
        tick.style('background-color', axisWordColor);
      }
    }
  }


  //////////////////////////////////////////////////////////////////////////////
  // Updating positions, etc //
  //////////////////////////////////////////////////////////////////////////////


  /** Update the position of the words. */
  updateWords() {
    for (let i = this.words.length - 1; i > -1; i--) {
      let wordObj = this.words[i];

      const vel = wordObj.vel;
      const pos = wordObj.pos;

      // Determine which level we are at, and get the pull accordingly
      // (i.e.,if we're falling toward the "he/she" axis, use the "he/she"
      // pull.)
      const axesIdx = this.yPosToAxes(pos.y);
      const bias = wordObj.pulls[axesIdx];

      // Figure out what two axes we are between (with clamping.)
      const axisContinuous = this.axesToYPosContinuous(pos.y);
      const prevBias = wordObj.pulls[this.clampAxis(axisContinuous + 1)];
      const blendVal = Math.min(Math.max(axisContinuous % 1, 0), 1);

      // The scale the weighted average of those (weighted by position between
      // them.)
      let speed = utils.lerp(blendVal, Math.abs(prevBias), Math.abs(bias));

      // Turn the scale in to an exponential scale. Note that these parameters
      // are chosen purely on aesthetic bases.
      const power = 5;
      const scaleFactor = 3;
      const addFactor = .3;
      speed = Math.pow(speed, power) * scaleFactor + addFactor;
      speed = Math.abs(speed);

      // Axis width (in 3js space.)
      const axesWidth = this.axesWidths[axesIdx];

      // Target location, (in %.)
      const targetLoc = (axesWidth / WIDTH) * utils.clamp(bias, -1, 1);
      const targetLocPrev = (axesWidth / WIDTH) * utils.clamp(prevBias, -1, 1);

      // Spring force toward the target location, (in %.)
      const springForceKNow = .1;
      const springForceKPrev = 1;
      const pullNow = (targetLoc - pos.x / (WIDTH / 2)) / springForceKNow;
      const pullPrev = (targetLocPrev - pos.x / (WIDTH / 2)) / springForceKPrev;
      const pull = utils.lerp(blendVal, pullPrev, pullNow);
      const posVel = this.getNewLoc(pos, vel, pull, speed, wordObj);

      wordObj.pos.x = posVel.x;
      wordObj.pos.y = posVel.y;
      wordObj.pos.z = posVel.z;
      wordObj.vel = posVel.v;

      wordObj.distToAxis = blendVal;
      wordObj.currentAxis = Math.floor(this.axesToYPosContinuous(pos.y) + 0.5);
      wordObj.currentTargetPos.x = targetLoc * (WIDTH / 2);
      wordObj.currentTargetPos.y = this.axesToYPos(axesIdx);
      if (!wordObj.isBackgroundWord) {
        wordObj.opacity = (speed - addFactor) * (1 - .1) + .5;
      }
      this.drawWord(wordObj)

      // If the mesh is offscreen, delete all its components.
      if (posVel.y < BOTTOM - 50) {
        if (wordObj.isBackgroundWord) {
          wordObj.pos.y = TOP;
          wordObj.pos.z = 0;
        } else {
          this.deleteWord(i);
        }
      }
    }
  }

  /** Remove the word and other shapes associate with it. */
  private deleteWord(wordIdx: number) {
    this.words.splice(wordIdx, 1);
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
      prevPos: THREE.Vector3, prevV: number, xForce: number, bias: number,
      word: word) {
    let speed = this.wordSpeed;

    // Unless the word is the query word, make more "interesting" words last
    // longer on the screen.
    if (!word.isQueryWord) {
      speed = speed / bias;
    }

    // Update x position with the force.
    const x = prevPos.x + xForce * speed;

    // Same with Y.
    const fGravity = -1 / 500;
    let v = prevV + fGravity * speed;

    // Add som terminal velocity.
    v = Math.max(v, -this.wordSpeed);
    let y = prevPos.y + v;
    let z = prevPos.z;

    // Bounce is less high for words, cause it looks pretty annoying.
    const bounceDampener = 10;
    let vBounce = 1 / 100 + Math.random() / bounceDampener;
    vBounce = 0;

    // Figure out if we're near a word axis, and bounce if so.
    const numAxes = this.axes.length;
    for (let i = 0; i < numAxes; i++) {
      const height = this.axesToYPos(i);
      if (utils.isNear(y, height)) {
        if (prevPos.z < numAxes - i) {
          v = vBounce;
          y = height
          z = numAxes - i;
          word.numFrames = 0;
        }
      }
    }
    return {x, y, z, v};
  }

  /** Randomn position, in THREE js units, along the x axis. */
  private randomXPos() {
    return (RIGHT - LEFT) * Math.random() - RIGHT;
  }

  /** Randomn position, in THREE js units, along the x axis. */
  private randomYPos() {
    return (TOP - BOTTOM) * Math.random();
  }

  /** Return the y position given a word axis index. */
  private axesToYPos(axisIdx: number) {
    if (this.axesToYPosArr[axisIdx]) return this.axesToYPosArr[axisIdx];
    const numAxes = this.axes.length;
    return TOP * (axisIdx + 1) / (numAxes + 1);
  }

  /** COnvert from axes location to y position. */
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
    y = Math.ceil(y);
    if (this.yPosToAxesArr[y]) return this.yPosToAxesArr[y];
    let axis = this.axesToYPosContinuous(y)
    return this.clampAxis(axis);
  }

  private addStats() {
    this.stats = Stats.default();
    this.stats.showPanel(0);  // 0: fps, 1: ms, 2: mb, 3+: custom
    // document.body.appendChild(this.stats.dom);
  }

  /** Is the word already on screen as a query word? */
  private wordAlreadyAdded(word: string, isQueryWord: boolean) {
    for (let i = 0; i < this.words.length; i++) {
      const wordObj = this.words[i];
      if (wordObj.string == word && wordObj.isQueryWord == isQueryWord) {
        return true;
      }
    }
    return false;
  }
}
