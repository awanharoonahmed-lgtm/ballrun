import * as THREE from 'three';
import './style.css';

const $ = (id) => document.getElementById(id);
const gameRoot = $('game');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080d18);
scene.fog = new THREE.Fog(0x080d18, 17, 65);

const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 120);
camera.position.set(0, 5.4, 9.5);
camera.lookAt(0, 0, -3);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
gameRoot.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0x9acbff, 0x172035, 1.7));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(-4, 9, 5);
keyLight.castShadow = true;
scene.add(keyLight);
const blueLight = new THREE.PointLight(0x168cff, 22, 30);
blueLight.position.set(4, 3, -8);
scene.add(blueLight);

const ballMaterial = new THREE.MeshStandardMaterial({ color: 0x57c9ff, metalness: 0.62, roughness: 0.2 });
const ball = new THREE.Mesh(new THREE.SphereGeometry(0.43, 32, 24), ballMaterial);
ball.position.set(0, 0.48, 1.5);
ball.castShadow = true;
scene.add(ball);

const ballGlow = new THREE.PointLight(0x35aaff, 2.5, 5);
ballGlow.position.copy(ball.position);
scene.add(ballGlow);

const trackGroup = new THREE.Group();
scene.add(trackGroup);
const trackMat = new THREE.MeshStandardMaterial({ color: 0x17283e, metalness: 0.45, roughness: 0.55 });
const edgeMat = new THREE.MeshStandardMaterial({ color: 0x3bbcff, emissive: 0x0875b5, emissiveIntensity: 1.3 });
const stripeMat = new THREE.MeshStandardMaterial({ color: 0x3e5978, emissive: 0x102c49, emissiveIntensity: 0.5 });

for (let i = 0; i < 18; i++) {
  const z = -i * 5;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.35, 5.08), trackMat);
  slab.position.set(0, -0.25, z);
  slab.receiveShadow = true;
  trackGroup.add(slab);
  for (const x of [-3.48, 3.48]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 5.05), edgeMat);
    rail.position.set(x, 0.02, z);
    trackGroup.add(rail);
  }
  for (const x of [-1.17, 1.17]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.012, 4.7), stripeMat);
    stripe.position.set(x, -0.065, z);
    trackGroup.add(stripe);
  }
}

const stars = new THREE.Group();
const starGeometry = new THREE.BufferGeometry();
const starPositions = [];
for (let i = 0; i < 260; i++) {
  starPositions.push((Math.random() - 0.5) * 75, Math.random() * 28 - 2, -Math.random() * 100);
}
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
const starPoints = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0x6c9ec8, size: 0.09, transparent: true, opacity: 0.65 }));
scene.add(starPoints);

const obstacleGroup = new THREE.Group();
scene.add(obstacleGroup);
const obstacleMaterials = [
  new THREE.MeshStandardMaterial({ color: 0xff536e, emissive: 0x5d1025, emissiveIntensity: 0.55, metalness: 0.25, roughness: 0.35 }),
  new THREE.MeshStandardMaterial({ color: 0xffb44d, emissive: 0x61300a, emissiveIntensity: 0.45, metalness: 0.2, roughness: 0.4 })
];
let obstacles = [];
let running = false;
let paused = false;
let selectedMode = 'easy';
let elapsed = 0;
let speed = 8;
let spawnClock = 0;
let lane = 0;
let targetLane = 0;
let lastFrame = 0;
let startX = null;
let startY = null;
let jumpVelocity = 0;
let isJumping = false;
let landingSquash = 0;
const BALL_GROUND_Y = 0.48;
const JUMP_FORCE = 9.2;
const GRAVITY = 22;

const settings = {
  easy:   { start: 7.5, max: 17, ramp: 0.20, interval: 1.55 },
  medium: { start: 16, max: 30, ramp: 0.48, interval: 1.08 },
  hard:   { start: 19, max: 34, ramp: 0.58, interval: 0.92 }
};

function makeObstacle() {
  const laneIndex = Math.floor(Math.random() * 3) - 1;
  const height = 0.8 + Math.random() * 0.65;
  const width = 1.05 + Math.random() * 0.35;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.85), obstacleMaterials[Math.random() > 0.5 ? 0 : 1]);
  mesh.position.set(laneIndex * 2.25, height / 2 - 0.04, -47);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  obstacleGroup.add(mesh);
  obstacles.push({ mesh, lane: laneIndex, height, passed: false });
}

function clearObstacles() {
  for (const o of obstacles) obstacleGroup.remove(o.mesh);
  obstacles = [];
}

function formatTime(seconds, tenths = true) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  const tenth = Math.floor((seconds % 1) * 10);
  return `${mins}:${secs}${tenths ? '.' + tenth : ''}`;
}
function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function weekKey(date = new Date()) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day + 3);
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3);
  const week = 1 + Math.round((d - firstThursday) / 604800000);
  return `${d.getFullYear()}-W${String(week).padStart(2,'0')}`;
}
function loadRecords() {
  try { return JSON.parse(localStorage.getItem('rollRushRecords') || '{}'); }
  catch { return {}; }
}
function saveRecord(mode, time) {
  const records = loadRecords();
  const today = dateKey();
  const week = weekKey();
  records[mode] ||= { allTime: 0, daily: {}, weekly: {} };
  const r = records[mode];
  const isNew = time > (r.allTime || 0);
  r.allTime = Math.max(r.allTime || 0, time);
  r.daily[today] = Math.max(r.daily[today] || 0, time);
  r.weekly[week] = Math.max(r.weekly[week] || 0, time);
  localStorage.setItem('rollRushRecords', JSON.stringify(records));
  return { isNew, best: r.allTime };
}
function getRecord(mode, period) {
  const r = loadRecords()[mode];
  if (!r) return 0;
  if (period === 'allTime') return r.allTime || 0;
  if (period === 'daily') return r.daily?.[dateKey()] || 0;
  return r.weekly?.[weekKey()] || 0;
}

function showScreen(id) {
  ['home', 'hud', 'pause-screen', 'gameover', 'records'].forEach(name => $(name).classList.add('hidden'));
  if (id) $(id).classList.remove('hidden');
}
function startGame() {
  elapsed = 0; spawnClock = 0; lane = 0; targetLane = 0;
  speed = settings[selectedMode].start;
  clearObstacles();
  ball.position.set(0, BALL_GROUND_Y, 1.5);
  ball.scale.set(1, 1, 1);
  jumpVelocity = 0; isJumping = false; landingSquash = 0;
  ball.rotation.set(0,0,0);
  $('hud-mode').textContent = selectedMode.toUpperCase();
  $('timer').textContent = '00:00.0';
  $('speed').textContent = '1.0x';
  running = true; paused = false;
  showScreen('hud');
}
function endGame() {
  running = false;
  const result = saveRecord(selectedMode, elapsed);
  $('final-time').textContent = formatTime(elapsed);
  $('result-mode').textContent = selectedMode.toUpperCase();
  $('result-best').textContent = formatTime(result.best);
  $('new-record').classList.toggle('hidden', !result.isNew);
  showScreen('gameover');
}
function drawRecords(period = 'allTime') {
  const list = $('record-list');
  list.innerHTML = '';
  for (const modeName of ['easy','medium','hard']) {
    const row = document.createElement('div');
    row.className = 'record-row';
    const label = document.createElement('span');
    label.textContent = modeName.toUpperCase();
    const value = document.createElement('strong');
    value.textContent = formatTime(getRecord(modeName, period));
    row.append(label, value);
    list.appendChild(row);
  }
}

function updateGame(dt) {
  if (!running || paused) return;
  elapsed += dt;
  const cfg = settings[selectedMode];
  speed = Math.min(cfg.max, cfg.start + elapsed * cfg.ramp);
  $('timer').textContent = formatTime(elapsed);
  $('speed').textContent = `${(speed / cfg.start).toFixed(1)}x`;

  targetLane = THREE.MathUtils.clamp(targetLane, -1, 1);
  ball.position.x = THREE.MathUtils.damp(ball.position.x, targetLane * 2.25, 13, dt);

  // Simple jump physics: tap/click launches the ball, gravity brings it back to the track.
  if (isJumping) {
    jumpVelocity -= GRAVITY * dt;
    ball.position.y += jumpVelocity * dt;
    if (ball.position.y <= BALL_GROUND_Y) {
      ball.position.y = BALL_GROUND_Y;
      jumpVelocity = 0;
      isJumping = false;
      landingSquash = 0.12;
    }
  }
  if (landingSquash > 0) {
    landingSquash = Math.max(0, landingSquash - dt * 1.8);
    const squash = 1 - landingSquash * 0.28;
    ball.scale.set(1 + (1 - squash), squash, 1 + (1 - squash));
  } else {
    ball.scale.set(1, 1, 1);
  }
  ball.rotation.x -= dt * speed * 0.7;
  ball.rotation.z = THREE.MathUtils.damp(ball.rotation.z, (targetLane * 0.12), 8, dt);
  ballGlow.position.set(ball.position.x, 0.7, 1.5);

  spawnClock += dt;
  const interval = Math.max(0.48, cfg.interval - elapsed * 0.006);
  if (spawnClock >= interval) {
    spawnClock = 0;
    makeObstacle();
    if (elapsed > 22 && Math.random() < 0.22) makeObstacle();
  }

  for (const o of obstacles) {
    o.mesh.position.z += speed * dt;
    o.mesh.rotation.y += dt * 0.35;
    if (!o.passed && o.mesh.position.z > 0.65) {
      o.passed = true;
      const sameLane = o.lane === targetLane && Math.abs(ball.position.x - o.mesh.position.x) < 0.9;
      const overlapsBall = Math.abs(o.mesh.position.z - ball.position.z) < 0.9;
      const ballBottom = ball.position.y - 0.43;
      const obstacleTop = o.height - 0.04;
      // A jump clears an obstacle only when the ball is high enough at the moment of crossing.
      if (sameLane && overlapsBall && ballBottom < obstacleTop) {
        endGame();
        return;
      }
    }
  }
  obstacles = obstacles.filter(o => {
    if (o.mesh.position.z > 8) { obstacleGroup.remove(o.mesh); return false; }
    return true;
  });

  // Recycle the track slabs to create an endless moving runway.
  for (const slab of trackGroup.children) {
    slab.position.z += speed * dt;
    if (slab.position.z > 7) slab.position.z -= 90;
  }
  starPoints.position.z += speed * dt * 0.18;
  if (starPoints.position.z > 20) starPoints.position.z = 0;
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastFrame) / 1000 || 0, 0.04);
  lastFrame = now;
  updateGame(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);

function swipeStart(event) {
  if (!running || paused) return;
  startX = event.clientX; startY = event.clientY;
  if (renderer.domElement.setPointerCapture) renderer.domElement.setPointerCapture(event.pointerId);
}
function swipeEnd(event) {
  if (startX === null || !running || paused) { startX = null; startY = null; return; }
  const dx = event.clientX - startX;
  const dy = event.clientY - startY;
  if (Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy) * 1.15) {
    targetLane = THREE.MathUtils.clamp(targetLane + (dx > 0 ? 1 : -1), -1, 1);
  } else if (Math.abs(dx) < 22 && Math.abs(dy) < 22) {
    // A short tap/click on the game area makes the ball jump on both PC and mobile.
    if (!isJumping) { jumpVelocity = JUMP_FORCE; isJumping = true; landingSquash = 0; }
  }
  startX = null; startY = null;
}
renderer.domElement.addEventListener('pointerdown', swipeStart);
renderer.domElement.addEventListener('pointerup', swipeEnd);
renderer.domElement.addEventListener('pointercancel', () => { startX = null; });

document.querySelectorAll('.mode').forEach(button => {
  button.addEventListener('click', () => {
    selectedMode = button.dataset.mode;
    document.querySelectorAll('.mode').forEach(b => b.classList.toggle('selected', b === button));
  });
});
$('play-button').addEventListener('click', startGame);
$('pause-button').addEventListener('click', () => {
  if (!running) return;
  paused = true; $('pause-screen').classList.remove('hidden');
});
$('resume-button').addEventListener('click', () => {
  paused = false; $('pause-screen').classList.add('hidden');
});
$('quit-button').addEventListener('click', () => {
  running = false; paused = false; showScreen('home');
});
$('retry-button').addEventListener('click', startGame);
$('home-button').addEventListener('click', () => showScreen('home'));
$('records-button').addEventListener('click', () => { drawRecords('allTime'); showScreen('records'); });
$('close-records').addEventListener('click', () => showScreen('home'));
document.querySelectorAll('.record-tab').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.record-tab').forEach(b => b.classList.toggle('selected', b === button));
    drawRecords(button.dataset.period);
  });
});

// Decorative background movement while menus are open.
const clock = new THREE.Clock();
function idleAnimation() {
  if (!running) {
    const t = clock.getElapsedTime();
    ball.position.y = BALL_GROUND_Y + Math.sin(t * 1.3) * 0.08;
    ball.rotation.x += 0.002;
    ball.rotation.y += 0.003;
    ballGlow.position.copy(ball.position);
  }
  requestAnimationFrame(idleAnimation);
}
idleAnimation();
