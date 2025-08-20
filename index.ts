/**
 * Human demo for browsers
 * @default Human Library
 * @summary <https://github.com/vladmandic/human>
 * @author <https://github.com/vladmandic>
 * @copyright <https://github.com/vladmandic>
 * @license MIT
 */

import * as H from "./human.esm.js";

const width = 1920; // used by webcam config as well as human maximum resultion // can be anything, but resolutions higher than 4k will disable internal optimizations

const humanConfig: Partial<H.Config> = { // user configuration for human, used to fine-tune behavior
  debug: true,
  backend: 'webgl',
  // cacheSensitivity: 0,
  // cacheModels: false,
  // warmup: 'none',
  // modelBasePath: '../../models',
  modelBasePath: 'https://vladmandic.github.io/human-models/models/',
  filter: { enabled: true, equalization: false, flip: false },
  face: { enabled: true, detector: { rotation: false }, mesh: { enabled: true }, attention: { enabled: false }, iris: { enabled: true }, description: { enabled: true }, emotion: { enabled: true }, antispoof: { enabled: true }, liveness: { enabled: true } },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  segmentation: { enabled: false },
  gesture: { enabled: true },
};

const human = new H.Human(humanConfig); // create instance of human with overrides from user configuration

human.env.perfadd = false; // is performance data showing instant or total values
human.draw.options.font = 'small-caps 18px "Lato"'; // set font used to draw labels when using draw methods
human.draw.options.lineHeight = 20;
human.draw.options.drawPoints = true; // draw points on face mesh
// human.draw.options.fillPolygons = true;

const dom = { // grab instances of dom objects so we dont have to look them up later
  video: document.getElementById('video') as HTMLVideoElement,
  canvas: document.getElementById('canvas') as HTMLCanvasElement,
  log: document.getElementById('log') as HTMLPreElement,
  fps: document.getElementById('status') as HTMLPreElement,
  perf: document.getElementById('performance') as HTMLDivElement,
  processButton: document.getElementById('process-button') as HTMLButtonElement,
};
const timestamp = { detect: 0, draw: 0, tensors: 0, start: 0 }; // holds information used to calculate performance and possible memory leaks
const fps = { detectFPS: 0, drawFPS: 0, frames: 0, averageMs: 0 }; // holds calculated fps information for both detect and screen refresh

const log = (...msg) => { // helper method to output messages
  dom.log.innerText += msg.join(' ') + '\n';
  console.log(...msg); // eslint-disable-line no-console
};
const status = (msg) => dom.fps.innerText = msg; // print status element
const perf = (msg) => dom.perf.innerText = 'tensors:' + human.tf.memory().numTensors.toString() + ' | performance: ' + JSON.stringify(msg).replace(/"|{|}/g, '').replace(/,/g, ' | '); // print performance element

async function processSingleFrame() {
  if (timestamp.start === 0) timestamp.start = human.now();
  await human.detect(dom.video);
  const tensors = human.tf.memory().numTensors;
  if (tensors - timestamp.tensors !== 0) log('allocated tensors:', tensors - timestamp.tensors);
  timestamp.tensors = tensors;
  const interpolated = human.next(human.result);
  const processed = await human.image(dom.video);
  human.draw.canvas(processed.canvas as HTMLCanvasElement, dom.canvas);
  const opt: Partial<H.DrawOptions> = { bodyLabels: `person confidence [score] and ${human.result?.body?.[0]?.keypoints.length} keypoints` };
  await human.draw.all(dom.canvas, interpolated, opt);
  perf(interpolated.performance);
  const now = human.now();
  const detectFPS = Math.round(1000 * 1000 / (now - timestamp.detect)) / 1000;
  const drawFPS = Math.round(1000 * 1000 / (now - timestamp.draw)) / 1000;
  timestamp.detect = now;
  timestamp.draw = now;
  status(dom.video.paused ? 'paused' : `fps: ${detectFPS.toFixed(1).padStart(5, ' ')} detect | ${drawFPS.toFixed(1).padStart(5, ' ')} draw`);
}

async function webCam() {
  const devices = await human.webcam.enumerate();
  const id = devices[0].deviceId; // use first available video source
  const webcamStatus = await human.webcam.start({ element: dom.video, crop: false, width, id }); // use human webcam helper methods and associate webcam stream with a dom element
  log(webcamStatus);
  dom.canvas.width = human.webcam.width;
  dom.canvas.height = human.webcam.height;
  dom.canvas.onclick = async () => { // pause when clicked on screen and resume on next click
    if (human.webcam.paused) await human.webcam.play();
    else human.webcam.pause();
  };
}

async function main() { // main entry point
  log('human version:', human.version, '| tfjs version:', human.tf.version['tfjs-core']);
  log('platform:', human.env.platform, '| agent:', human.env.agent);
  status('loading...');
  await human.load(); // preload all models
  log('backend:', human.tf.getBackend(), '| available:', human.env.backends);
  log('models stats:', human.models.stats());
  log('models loaded:', human.models.loaded());
  log('environment', human.env);
  status('initializing...');
  await human.warmup(); // warmup function to initialize backend for future faster detection
  await webCam(); // start webcam
  dom.processButton.addEventListener('click', processSingleFrame);
}

window.onload = main;
