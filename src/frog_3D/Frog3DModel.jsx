import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
const frogModelUrl = `${import.meta.env.BASE_URL}FROG_3D.glb`;

let cachedGLTF = null;
let gltfLoadingPromise = null;
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);

function loadFrogGLTF() {
  if (cachedGLTF) return Promise.resolve(cachedGLTF);
  if (gltfLoadingPromise) return gltfLoadingPromise;

  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  gltfLoadingPromise = new Promise((resolve, reject) => {
    loader.load(
      frogModelUrl,
      (gltf) => {
        cachedGLTF = gltf;
        gltfLoadingPromise = null;
        resolve(gltf);
      },
      undefined,
      (err) => {
        gltfLoadingPromise = null;
        reject(err);
      }
    );
  });
  return gltfLoadingPromise;
}

const recoloredRingTextureCache = new Map();

function recolorRingTextureToEarColor(sourceTexture) {
  if (!sourceTexture || !sourceTexture.image) return sourceTexture;
  if (recoloredRingTextureCache.has(sourceTexture)) {
    return recoloredRingTextureCache.get(sourceTexture);
  }

  try {
    const image = sourceTexture.image;
    const width = image.width || 1024;
    const height = image.height || 1024;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // Recolor green ring and ear shell pixels to exact face neon yellow #EAFF00,
    // while preserving the black center circle, black recess, and black markings
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 10) continue;

      // Keep black center circle, dark graphite recess, and black markings ("02 HAULO") intact
      if (r < 35 && g < 35 && b < 35) {
        continue;
      }

      // Convert green shell/ring pixels to face neon yellow #EAFF00 (r: 234, g: 255, b: 0)
      if (g > 35 && g > b * 1.15) {
        // Full face electric neon yellow (#EAFF00 = 234, 255, 0)
        // With smooth anti-aliased blend at boundary edges
        const alpha = Math.min(1.0, Math.max(0.0, (g - 35) / 65));
        data[i] = Math.round(234 * alpha);     // R: 234
        data[i + 1] = Math.round(255 * alpha); // G: 255
        data[i + 2] = 0;                       // B: 0
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const newTexture = new THREE.CanvasTexture(canvas);
    newTexture.colorSpace = THREE.SRGBColorSpace;
    newTexture.channel = sourceTexture.channel !== undefined ? sourceTexture.channel : 0;
    newTexture.wrapS = sourceTexture.wrapS;
    newTexture.wrapT = sourceTexture.wrapT;
    if (sourceTexture.repeat) newTexture.repeat.copy(sourceTexture.repeat);
    if (sourceTexture.offset) newTexture.offset.copy(sourceTexture.offset);
    if (sourceTexture.center) newTexture.center.copy(sourceTexture.center);
    newTexture.rotation = sourceTexture.rotation;
    newTexture.flipY = sourceTexture.flipY;
    newTexture.generateMipmaps = true;
    newTexture.minFilter = THREE.LinearMipmapLinearFilter;
    newTexture.magFilter = THREE.LinearFilter;
    newTexture.needsUpdate = true;

    recoloredRingTextureCache.set(sourceTexture, newTexture);
    return newTexture;
  } catch (err) {
    console.warn('[Frog3D] Error recoloring ring texture:', err);
    return sourceTexture;
  }
}

// Config per word action personality: grounded hero stance matching reference images
const WORD_ACTIONS = [
  // 0: HAULO — Sovereign, balanced hero stance
  {
    scale: 1.30,
    position: [0.00, -0.47, 0],
    rotation: [0.00, 0.00, 0.02],
    yaw: -0.70,
    camY: 0.30,
    camZ: 2.12,
    targetY: 0.08,
  },
  // 1: DESIGN TO — Architectural stance
  {
    scale: 1.37,
    position: [0, -0.47, 0],
    rotation: [0.02, 0.10, -0.02],
    yaw: -0.65,
    camY: 0.32,
    camZ: 2.12,
    targetY: 0.08,
  },
  // 2: THINK — Contemplative angle
  {
    scale: 1.30,
    position: [0, -0.47, 0],
    rotation: [-0.02, -0.10, 0.02],
    yaw: -0.60,
    camY: 0.32,
    camZ: 2.12,
    targetY: 0.08,
  },
  // 3: BUILD — Mechanical ready stance
  {
    scale: 1.35,
    position: [0, -0.47, 0],
    rotation: [0.03, 0.12, -0.02],
    yaw: -0.66,
    camY: 0.32,
    camZ: 2.12,
    targetY: 0.08,
  },
  // 4: AND EVOLVE — Interactive 3D showcase stance
  {
    scale: 1.32,
    position: [0, -0.47, 0],
    rotation: [0.00, 0.00, 0.00],
    yaw: -0.62,
    camY: 0.32,
    camZ: 2.12,
    targetY: 0.08,
  },
];

// Scratch objects for high-performance zero-allocation matrix updates
const _tempEuler = new THREE.Euler();
const _tempQuat = new THREE.Quaternion();
const _qSpaceForward = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, Math.PI / 2, 'XYZ'));
// Bottom face angle: Head points DOWN (-Y) with dorsal spine facing camera (+Z)
const _qSpaceDownward = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, -Math.PI / 2, 0, 'XYZ'));
const _qSpace = new THREE.Quaternion();
const _qGround = new THREE.Quaternion();
const _qOsc = new THREE.Quaternion();

// Exact 5 section poses matching the 5 reference images:
// Paws remain solidly anchored on the floor plane while rear leg folds and stances articulate
const SECTION_POSES = [
  // 0: HAULO
  {
    bodyOffsetY: 0.0,
    bodyPitch: 0.0,
    bodyRoll: 0.0,
    thighL: [0, 0, 0],
    shinL: [0, 0, 0],
    hockL: [0, 0, 0],
    palmL: [0, 0, 0],
    thighR: [0, 0, 0],
    shinR: [0, 0, 0],
    hockR: [0, 0, 0],
    palmR: [0, 0, 0],
    armL: [0, 0, 0],
    forearmL: [0, 0, 0],
    armR: [0, 0, 0],
    forearmR: [0, 0, 0],
  },
  // 1: DESIGN TO - Asymmetrical architectural stance with left knee flared
  {
    bodyOffsetY: 0.0,
    bodyPitch: 0.0,
    bodyRoll: 0.0,
    thighL: [0.12, 0.08, -0.12],
    shinL: [-0.08, 0.0, 0.06],
    hockL: [0.02, 0.0, -0.02],
    palmL: [0.0, 0.0, 0.0],
    thighR: [-0.04, 0.0, 0.04],
    shinR: [0.04, 0.0, -0.04],
    hockR: [0.0, 0.0, 0.0],
    palmR: [0.0, 0.0, 0.0],
    armL: [0, 0, 0],
    forearmL: [0, 0, 0],
    armR: [0, 0, 0],
    forearmR: [0, 0, 0],
  },
  // 2: THINK - Compact tightly-folded crouch (hind legs tightly compressed into flank)
  {
    bodyOffsetY: 0.0,
    bodyPitch: 0.0,
    bodyRoll: 0.0,
    thighL: [0.24, -0.08, 0.16],
    shinL: [0.18, 0.04, -0.12],
    hockL: [-0.10, 0.0, 0.0],
    palmL: [0.0, 0.0, 0.0],
    thighR: [0.24, 0.08, -0.16],
    shinR: [0.18, -0.04, 0.12],
    hockR: [-0.10, 0.0, 0.0],
    palmR: [0.0, 0.0, 0.0],
    armL: [0, 0, 0],
    forearmL: [0, 0, 0],
    armR: [0, 0, 0],
    forearmR: [0, 0, 0],
  },
  // 3: BUILD - Wide mechanical push-up stance with wide flared hind legs
  {
    bodyOffsetY: 0.0,
    bodyPitch: 0.0,
    bodyRoll: 0.0,
    thighL: [-0.10, 0.14, -0.18],
    shinL: [0.10, 0.0, 0.08],
    hockL: [0.04, 0.0, -0.04],
    palmL: [0.0, 0.0, 0.0],
    thighR: [-0.10, -0.14, 0.18],
    shinR: [0.10, 0.0, -0.08],
    hockR: [0.04, 0.0, 0.04],
    palmR: [0.0, 0.0, 0.0],
    armL: [0, 0, 0],
    forearmL: [0, 0, 0],
    armR: [0, 0, 0],
    forearmR: [0, 0, 0],
  },
  // 4: AND EVOLVE - Extended low aerodynamic stance with unfolded left hind leg
  {
    bodyOffsetY: 0.0,
    bodyPitch: 0.0,
    bodyRoll: 0.0,
    thighL: [-0.28, 0.20, -0.28],
    shinL: [-0.18, -0.08, 0.15],
    hockL: [0.14, 0.0, -0.06],
    palmL: [0.0, 0.0, 0.0],
    thighR: [-0.12, -0.08, 0.12],
    shinR: [0.04, 0.0, -0.04],
    hockR: [0.0, 0.0, 0.0],
    palmR: [0.0, 0.0, 0.0],
    armL: [0, 0, 0],
    forearmL: [0, 0, 0],
    armR: [0, 0, 0],
    forearmR: [0, 0, 0],
  },
  // 5: EDITORIAL HERO — Left-facing balanced hero stance
  {
    bodyOffsetY: 0.0,
    bodyPitch: 0.0,
    bodyRoll: 0.0,
    thighL: [0, 0, 0],
    shinL: [0, 0, 0],
    hockL: [0, 0, 0],
    palmL: [0, 0, 0],
    thighR: [0, 0, 0],
    shinR: [0, 0, 0],
    hockR: [0, 0, 0],
    palmR: [0, 0, 0],
    armL: [0, 0, 0],
    forearmL: [0, 0, 0],
    armR: [0, 0, 0],
    forearmR: [0, 0, 0],
  },
];

export default function Frog3D({ wordIndex = 0, className = '', style = {}, facingRef = null }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const actionConfig = WORD_ACTIONS[wordIndex] || WORD_ACTIONS[0];

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let animFrameId = null;
    let isMounted = true;
    let controls = null;

    // ---- RENDERER ----
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1.10;

    // ---- SCENE ----
    const scene = new THREE.Scene();

    let modelInstance = null;
    let mixer = null;
    let animClipDuration = 0;
    let bodyBone = null;
    let rootBone = null;
    let bones = null;
    const bodyWorldPosition = new THREE.Vector3();
    const bodyScreenOffset = { x: 0, y: 0 };
    let currentPRel = wordIndex || 0;
    const floorY = actionConfig.position[1]; // Ground baseline elevation

    let isHeroVisible = true;
    let isMountedInRing = false;
    let startHeroRenderLoop = () => {};
    let stopHeroRenderLoop = () => {};

    // ---- CAMERA ----
    const width = container.clientWidth || 1000;
    const height = container.clientHeight || 600;
    const initialAspect = width / height;
    const camera = new THREE.PerspectiveCamera(44, initialAspect, 0.1, 50);
    if (initialAspect < 1.0) {
      camera.fov = 44 + (1.0 - initialAspect) * 16;
      camera.position.set(0, actionConfig.camY, actionConfig.camZ * (1 + (1.0 - initialAspect) * 0.28));
    } else {
      camera.position.set(0, actionConfig.camY, actionConfig.camZ);
    }
    camera.lookAt(0, actionConfig.targetY, 0);

    // ---- STUDIO LIGHTING FOR VOLUMETRIC FORM & CRISP SPECULAR HIGHLIGHTS (Symmetrical for scroll-up/down) ----
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(3, 7, 5);
    scene.add(keyLight);

    const bottomKeyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    bottomKeyLight.position.set(-3, -7, 5);
    scene.add(bottomKeyLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 1.3);
    rimLight.position.set(-4, 5, -3);
    scene.add(rimLight);

    const bottomRimLight = new THREE.DirectionalLight(0xffffff, 1.3);
    bottomRimLight.position.set(4, -5, -3);
    scene.add(bottomRimLight);

    const topRimLight = new THREE.DirectionalLight(0xffffff, 0.9);
    topRimLight.position.set(0, 6, -2);
    scene.add(topRimLight);

    const bottomTopRimLight = new THREE.DirectionalLight(0xffffff, 0.9);
    bottomTopRimLight.position.set(0, -6, -2);
    scene.add(bottomTopRimLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 1.1);
    fillLight.position.set(-5, 6, 6);
    scene.add(fillLight);

    const bottomFillLight = new THREE.DirectionalLight(0xffffff, 1.1);
    bottomFillLight.position.set(5, -6, 6);
    scene.add(bottomFillLight);

    // ---- ROOT GROUP ----
    const rootGroup = new THREE.Group();
    rootGroup.userData.spaceDirTurn = 0;
    scene.add(rootGroup);
    let heroFacingYaw = actionConfig.yaw !== undefined ? actionConfig.yaw : -0.70;
    let targetJumpFrac = 0;

    // Interactive jump state (Spacebar / Canvas click impulse)
    let isInteractiveJumping = false;
    let interactiveJumpProgress = 0;

    const triggerInteractiveJump = () => {
      if (isInteractiveJumping) return;
      isInteractiveJumping = true;
      interactiveJumpProgress = 0;
    };

    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !isInteractiveJumping) {
        e.preventDefault();
        triggerInteractiveJump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const handleCanvasClick = () => {
      if (!isInteractiveJumping && (!controls || !controls.enabled)) {
        triggerInteractiveJump();
      }
    };
    canvas.addEventListener('click', handleCanvasClick);

    // ---- ORBIT CONTROLS ----
    controls = new OrbitControls(camera, canvas);
    controls.enableZoom = false; // Never block page scroll
    controls.enablePan = false;  // Keep grounded on shadow
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, actionConfig.targetY, 0);
    controls.minPolarAngle = Math.PI / 4.5;
    controls.maxPolarAngle = Math.PI / 2 + 0.05; // Do not go under floor
    controls.minAzimuthAngle = -Math.PI / 2;
    controls.maxAzimuthAngle = Math.PI / 2;

    // Manual rotation disabled for 1st 4 areas, enabled ONLY for 5th area ("AND EVOLVE")
    const isFifthAreaInitial = wordIndex === 4;
    controls.enabled = isFifthAreaInitial;
    let isSpaceFloat = false;
    let spaceFloatT = 0;
    let targetSpaceScrollPhase = 0;
    let spaceModelScale = 1.0;
    let spaceDirTurn = 0;
    let currentSpaceDirTurn = 0;
    let spaceScrollDir = 1;
    let ambientSwimProgress = 0;
    let swimActivity = 0;
    let lastSpaceScrollPhase = 1.0;
    let targetSpaceOffsetY = 0;
    let currentSpaceOffsetY = 0;

    if (facingRef) {
      facingRef.current = (yaw, pRel = 0, jumpFrac = 0, isSpace = false, scrollPhase = 0, modelScale = 1.0, dirTurn = 0, scrollDir = 1, spaceOffsetY = 0) => {
        if (typeof yaw === 'number') {
          heroFacingYaw = yaw;
        }
        currentPRel = Math.max(0, Math.min(5, pRel));
        targetJumpFrac = Math.max(0, Math.min(1, jumpFrac));
        isSpaceFloat = Boolean(isSpace);
        targetSpaceScrollPhase = typeof scrollPhase === 'number' ? scrollPhase : 0;
        if (typeof modelScale === 'number' && modelScale > 0) {
          spaceModelScale = modelScale;
        }
        if (typeof dirTurn === 'number') {
          spaceDirTurn = Math.max(0, Math.min(1, dirTurn));
        }
        if (typeof scrollDir === 'number') {
          spaceScrollDir = scrollDir;
        }
        if (typeof spaceOffsetY === 'number') {
          targetSpaceOffsetY = spaceOffsetY;
        }

        // Enable manual rotation only for the 5th area ("AND EVOLVE", 3.65 <= pRel <= 4.05)
        const isFifthArea = pRel >= 3.65 && pRel <= 4.05;
        if (controls) {
          if (controls.enabled !== isFifthArea) {
            controls.enabled = isFifthArea;
            canvas.style.cursor = isFifthArea ? 'grab' : 'default';
          }
        }
      };
      // Screen-space location of the animated torso relative to the canvas
      // center. HeroExperience uses this to align the same swimmer's body with
      // the ring opening instead of aligning the canvas frame alone.
      facingRef.current.getBodyScreenOffset = () => bodyScreenOffset;
      facingRef.current.getSharedRoot = () => rootGroup;
      facingRef.current.setMountedInRing = (mounted) => {
        isMountedInRing = Boolean(mounted);
        if (isMountedInRing) {
          stopHeroRenderLoop();
        } else if (isHeroVisible && rootGroup.parent === scene) {
          startHeroRenderLoop();
        }
      };
      facingRef.current.restoreSharedRoot = () => {
        if (rootGroup.parent !== scene) scene.add(rootGroup);
        isMountedInRing = false;
        if (isHeroVisible) {
          startHeroRenderLoop();
        }
      };
      facingRef.current.renderNow = () => {
        renderer.render(scene, camera);
      };

      // Immediately apply initial orientation and lock controls
      facingRef.current(heroFacingYaw, currentPRel, 0, false, 0);
    }

    let isUserDragging = false;
    let targetParallaxY = 0;
    let targetParallaxX = 0;
    let currentParallaxY = 0;
    let currentParallaxX = 0;

    controls.addEventListener('start', () => {
      isUserDragging = true;
      canvas.style.cursor = 'grabbing';
    });
    controls.addEventListener('end', () => {
      isUserDragging = false;
      canvas.style.cursor = 'grab';
    });

    const onPointerMove = (e) => {
      if (isUserDragging || controls.enabled) return;
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      targetParallaxY = nx * 0.07;
      targetParallaxX = -ny * 0.04;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    // ---- RESIZE HANDLER ----
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 1000;
      const h = container.clientHeight || 600;
      const aspect = w / h;
      camera.aspect = aspect;

      const isMobile = window.innerWidth < 768;
      const targetDPR = isMobile
        ? Math.min(window.devicePixelRatio || 1, 1.5)
        : Math.min(window.devicePixelRatio || 1, 2);

      if (renderer.getPixelRatio() !== targetDPR) {
        renderer.setPixelRatio(targetDPR);
      }

      // On portrait mobile (aspect < 1.0), adjust FOV and camera distance
      // so the frog's splayed legs and swimming action remain fully visible without clipping.
      // On landscape/desktop (aspect >= 1.0), aspect compensation is ZERO (100% desktop fidelity).
      if (aspect < 1.0) {
        camera.fov = 44 + (1.0 - aspect) * 16;
        camera.position.z = actionConfig.camZ * (1 + (1.0 - aspect) * 0.28);
      } else {
        camera.fov = 44;
        camera.position.z = actionConfig.camZ;
      }

      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      const isPortrait = aspect < 1.0;
      const meshScaleMultiplier = isPortrait ? 0.62 : 1.0;
      if (modelInstance) modelInstance.scale.setScalar(actionConfig.scale * meshScaleMultiplier);
    };
    onResize();
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    // ---- LOAD MODEL & EMBEDDED ANIMATION ACTION ----
    loadFrogGLTF()
      .then((gltf) => {
        if (!isMounted) return;

        // Use SkeletonUtils to clone skinned meshes with full skeletal rebinding
        const model = SkeletonUtils.clone(gltf.scene);
        const materialInstances = new Map();

        // Eye orb material to unify the eye sphere in solid glowing neon green (#EAFF00)
        const eyeOrbCoreMaterial = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#EAFF00'),
          emissive: new THREE.Color('#B8FF00'),
          emissiveIntensity: 0.22,
          roughness: 0.14,
          metalness: 0.02,
          side: THREE.DoubleSide,
        });

        let sourceRearPadMesh = null;

        // Turn OFF internal Blender 35,000-lumen lights to prevent blowout
        model.traverse((child) => {
          if (child.isLight) {
            child.visible = false;
            child.intensity = 0;
          }
          if (child.isMesh && child.material) {
            const rawMeshName = (child.name || '').toLowerCase();
            const meshName = rawMeshName.replace(/_/g, ' ');
            const geoName = (child.geometry && child.geometry.name ? child.geometry.name : '').toLowerCase().replace(/_/g, ' ');
            const matName = (child.material && child.material.name ? child.material.name : '').toLowerCase();

            // Track genuine rear pad mesh for restoring backside finger suction pads
            if (rawMeshName.includes('shell 084')) {
              sourceRearPadMesh = child;
            }

            // Hide plain graphite closures so restored pads sit flush on finger tips
            if (rawMeshName.includes('rear finger closure')) {
              child.visible = false;
            }

            // Remove the black eyelid wing flap from shell 120 (R) and shell 125 (L)
            // which previously occluded the eye sphere with a black crescent
            const isEyeRingShell =
              meshName.includes('shell 120') ||
              meshName.includes('shell 125') ||
              meshName.includes('béziercurve.121') ||
              meshName.includes('béziercurve.126') ||
              geoName.includes('béziercurve.121') ||
              geoName.includes('béziercurve.126');

            if (isEyeRingShell && child.geometry && child.geometry.attributes && child.geometry.attributes.position && child.geometry.index) {
              child.geometry = child.geometry.clone();
              const posAttr = child.geometry.attributes.position;
              const indices = child.geometry.index.array;
              const newIndices = [];
              for (let i = 0; i < indices.length; i += 3) {
                const a = indices[i];
                const b = indices[i + 1];
                const c = indices[i + 2];
                const da = Math.hypot(posAttr.getX(a) - 0.165, posAttr.getY(a) - 0.288);
                const db = Math.hypot(posAttr.getX(b) - 0.165, posAttr.getY(b) - 0.288);
                const dc = Math.hypot(posAttr.getX(c) - 0.165, posAttr.getY(c) - 0.288);
                // Skip the eyelid flap that extends into the eye opening (< 0.0255)
                if ((da + db + dc) / 3 < 0.0255) {
                  continue;
                }
                newIndices.push(a, b, c);
              }
              child.geometry.setIndex(newIndices);
              child.geometry.index.needsUpdate = true;
            }

            // Eye orb core (shell 109 / 110): solid uniform glowing face green (#EAFF00)
            const isEyeOrbCore =
              meshName.includes('shell 109') ||
              meshName.includes('shell 110') ||
              meshName.includes('béziercurve.110') ||
              meshName.includes('béziercurve.111') ||
              geoName.includes('béziercurve.110') ||
              geoName.includes('béziercurve.111');

            if (isEyeOrbCore) {
              const applySolidGreenEyeMaterial = (sourceMat) => {
                const mat = sourceMat ? sourceMat.clone() : new THREE.MeshStandardMaterial();
                mat.color.set('#EAFF00');
                mat.map = null;
                mat.emissive.set('#B8FF00');
                mat.emissiveIntensity = 0.22;
                mat.roughness = 0.14;
                mat.metalness = 0.02;
                mat.side = THREE.DoubleSide;
                mat.needsUpdate = true;
                return mat;
              };

              child.material = Array.isArray(child.material)
                ? child.material.map(applySolidGreenEyeMaterial)
                : applySolidGreenEyeMaterial(child.material);
              return;
            }

            // Eye wings / eyelids (HAULO flush side blink eyelid L/R): fully solid black
            const isEyelidWing =
              meshName.includes('eyelid') ||
              matName.includes('eyelid');

            if (isEyelidWing) {
              const applySolidBlackWingMaterial = (sourceMat) => {
                const mat = sourceMat ? sourceMat.clone() : new THREE.MeshStandardMaterial();
                mat.color.set('#0a0a0a');
                mat.map = null;
                mat.emissive.set('#000000');
                mat.emissiveIntensity = 0;
                mat.roughness = 0.20;
                mat.metalness = 0.15;
                mat.side = THREE.DoubleSide;
                mat.needsUpdate = true;
                return mat;
              };

              child.material = Array.isArray(child.material)
                ? child.material.map(applySolidBlackWingMaterial)
                : applySolidBlackWingMaterial(child.material);
              return;
            }

            const makeMaterial = (sourceMaterial) => {
              if (!sourceMaterial) return sourceMaterial;
              let mat = materialInstances.get(sourceMaterial);
              if (!mat) {
                mat = sourceMaterial.clone();
                materialInstances.set(sourceMaterial, mat);
              }

              const materialName = mat.name.toLowerCase();
              const isRingOrNailPad =
                materialName.includes('complete ring') ||
                materialName.includes('black center') ||
                materialName.includes('ring');

              const isEar = /\bear\b/i.test(materialName);
              const isTexturedGreenShell = isRingOrNailPad || isEar;

              const isGreenSurface =
                materialName.includes('_green') ||
                materialName.includes('neon') ||
                materialName === 'eye' ||
                materialName.startsWith('material.003') ||
                materialName.startsWith('material.004') ||
                isTexturedGreenShell;

              if (isTexturedGreenShell) {
                // Joint rings, toe nail pads, and ears: match exact face neon yellow (#EAFF00)
                // while preserving authentic black center circle, inner ear recess, and "02 HAULO" markings
                mat.color.set('#FFFFFF');
                if (mat.map) {
                  const recoloredTex = recolorRingTextureToEarColor(mat.map);
                  mat.map = recoloredTex;
                  mat.map.colorSpace = THREE.SRGBColorSpace;
                  mat.map.needsUpdate = true;
                  mat.emissiveMap = recoloredTex;
                }
                mat.emissive.set('#B8FF00');
                mat.emissiveIntensity = 0.22;
                mat.roughness = 0.14;
                mat.metalness = 0.02;

                // Shader safety to guarantee identical diffuse and emissive to face
                mat.onBeforeCompile = (shader) => {
                  shader.fragmentShader = shader.fragmentShader
                    .replace(
                      '#include <map_fragment>',
                      `
                      #include <map_fragment>
                      // Remap any green/yellow shell texels to exact face color (#EAFF00)
                      if (diffuseColor.g > 0.08 && diffuseColor.g > diffuseColor.b * 1.15 && diffuseColor.g >= diffuseColor.r * 0.85) {
                        diffuseColor.rgb = vec3(0.8228, 1.0, 0.0);
                      }
                      `
                    )
                    .replace(
                      '#include <emissivemap_fragment>',
                      `
                      #ifdef USE_EMISSIVEMAP
                        vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
                        // Uniform emissive matching face on ear shell; 0.0 on black recess and markings
                        float isShell = step(0.05, max(emissiveColor.r, emissiveColor.g));
                        totalEmissiveRadiance *= isShell;
                      #endif
                      `
                    );
                };
                mat.customProgramCacheKey = () => 'frog_textured_face_yellow_exact_v3';
              } else if (isGreenSurface) {
                // High-chroma electric lemon-neon matching reference images
                const isEyeOrAccent = materialName === 'eye' || materialName.includes('neon');
                mat.color.set('#EAFF00');
                mat.map = null;
                mat.emissive.set(isEyeOrAccent ? '#D8FF00' : '#B8FF00');
                mat.emissiveIntensity = isEyeOrAccent ? 0.48 : 0.22;
                mat.roughness = 0.14;
                mat.metalness = 0.02;
              } else if (mat.map) {
                mat.map.colorSpace = THREE.SRGBColorSpace;
                mat.map.needsUpdate = true;
              }
              mat.needsUpdate = true;
              return mat;
            };
            child.material = Array.isArray(child.material)
              ? child.material.map(makeMaterial)
              : makeMaterial(child.material);
          }
        });

        // Restore neon yellow pads with black center nails on the 2 backside fingers of both rear legs
        if (sourceRearPadMesh && sourceRearPadMesh.skeleton) {
          const makeRestoredPad = (targetCenter, targetNormal, scale, boneIndex, name) => {
            const srcGeo = sourceRearPadMesh.geometry;
            const geo = srcGeo.clone();
            const srcCenter = new THREE.Vector3(-0.2580, 0.0316, -0.4425);
            const srcNormal = new THREE.Vector3(0.0224, 0.9987, -0.0448).normalize();

            geo.translate(-srcCenter.x, -srcCenter.y, -srcCenter.z);
            const q = new THREE.Quaternion().setFromUnitVectors(srcNormal, targetNormal.clone().normalize());
            geo.applyQuaternion(q);
            geo.scale(scale, scale, scale);
            geo.translate(targetCenter.x, targetCenter.y, targetCenter.z);

            const vCount = geo.attributes.position.count;
            const skinIndices = new Uint16Array(vCount * 4);
            const skinWeights = new Float32Array(vCount * 4);
            for (let i = 0; i < vCount; i++) {
              skinIndices[i * 4] = boneIndex;
              skinWeights[i * 4] = 1.0;
            }
            geo.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndices, 4));
            geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeights, 4));

            const padMesh = new THREE.SkinnedMesh(geo, sourceRearPadMesh.material);
            padMesh.name = name;
            padMesh.bind(sourceRearPadMesh.skeleton, sourceRearPadMesh.bindMatrix);
            padMesh.castShadow = true;
            padMesh.receiveShadow = true;
            sourceRearPadMesh.parent.add(padMesh);
            return padMesh;
          };

          // 1. Left Rear Leg - Lower Backside Finger
          makeRestoredPad(
            new THREE.Vector3(-0.255, 0.054, -0.366),
            new THREE.Vector3(0.508, 0.160, -0.755),
            0.72,
            8,
            'Restored_Rear_Pad_L_Lower'
          );

          // 2. Left Rear Leg - Upper Backside Finger
          makeRestoredPad(
            new THREE.Vector3(-0.341, 0.124, -0.331),
            new THREE.Vector3(-0.122, 0.991, -0.056),
            0.72,
            8,
            'Restored_Rear_Pad_L_Upper'
          );

          // 3. Right Rear Leg - Lower Backside Finger
          makeRestoredPad(
            new THREE.Vector3(-0.257, 0.055, 0.364),
            new THREE.Vector3(0.508, 0.160, 0.755),
            0.72,
            15,
            'Restored_Rear_Pad_R_Lower'
          );

          // 4. Right Rear Leg - Upper Backside Finger
          makeRestoredPad(
            new THREE.Vector3(-0.341, 0.122, 0.330),
            new THREE.Vector3(-0.122, 0.991, 0.056),
            0.72,
            15,
            'Restored_Rear_Pad_R_Upper'
          );
        }

        // Initialize AnimationMixer using the model's authentic 72-channel animation action
        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model);
          const clip = gltf.animations[0];
          animClipDuration = clip.duration || 0;
          const clipAction = mixer.clipAction(clip);
          clipAction.setLoop(THREE.LoopOnce, 1);
          clipAction.clampWhenFinished = true;
          clipAction.play();
          mixer.setTime(0.0416); // Set initial resting posture
        }

        bodyBone = model.getObjectByName('BODY');
        rootBone = model.getObjectByName('ROOT');
        bones = {
          body: bodyBone,
          thighL: model.getObjectByName('Rear_Thigh.L'),
          shinL: model.getObjectByName('Rear_Shin.L'),
          hockL: model.getObjectByName('Rear_Hock.L'),
          palmL: model.getObjectByName('Rear_Palm.L'),
          thighR: model.getObjectByName('Rear_Thigh.R'),
          shinR: model.getObjectByName('Rear_Shin.R'),
          hockR: model.getObjectByName('Rear_Hock.R'),
          palmR: model.getObjectByName('Rear_Palm.R'),
          armL: model.getObjectByName('Front_Upper.L'),
          forearmL: model.getObjectByName('Front_Lower.L'),
          armR: model.getObjectByName('Front_Upper.R'),
          forearmR: model.getObjectByName('Front_Lower.R'),
        };

        // Set action-specific position, scale, and attitude
        model.position.set(...actionConfig.position);
        modelInstance = model;
        const curAspect = (container.clientWidth || 1000) / (container.clientHeight || 600);
        const initialMeshScaleMult = curAspect < 1.0 ? 0.62 : 1.0;
        model.scale.setScalar(actionConfig.scale * initialMeshScaleMult);
        model.rotation.set(...actionConfig.rotation);
        rootGroup.add(model);
        if (isHeroVisible && !isMountedInRing && rootGroup.parent === scene) {
          startHeroRenderLoop();
        }
      })
      .catch((err) => {
        console.error('[Frog3D] Error rendering frog model:', err);
      });

    // ---- RENDER LOOP & ANIMATION LIFECYCLE ----
    let lastTime = performance.now();
    const startTime = performance.now();
    let wasJumping = false;
    let lastLandTime = -999;

    function tickFrogAnimation(delta, now) {
      const elapsed = (now - startTime) / 1000;

      if (modelInstance && mixer) {
        let jumpProgress = 0;

        if (isInteractiveJumping) {
          // Play interactive jump in real-time with snappy speed (~0.65s leap duration)
          interactiveJumpProgress += delta * 1.55;
          if (interactiveJumpProgress >= 1) {
            interactiveJumpProgress = 1;
            isInteractiveJumping = false;
          }
          jumpProgress = interactiveJumpProgress;
        } else if (targetJumpFrac > 0.001) {
          jumpProgress = targetJumpFrac;
        }

        if (isSpaceFloat) {
          // Direct scroll coupling during flight (0.0 -> 1.0) and in ring sections
          if (targetSpaceScrollPhase <= 1.0) {
            spaceFloatT = Math.max(0, Math.min(1, targetSpaceScrollPhase));
          } else {
            spaceFloatT = 1.0;
          }

          // Authentic Swimming Action (adapts smoothly to animation clip duration)
          const hasDedicatedSwim = animClipDuration >= 13.80;
          let swimAnimTime;
          if (targetSpaceScrollPhase <= 1.0) {
            // Flight between Editorial Hero floor and Ring 0 entrance
            const p = Math.max(0, Math.min(1, targetSpaceScrollPhase));
            if (spaceScrollDir === -1) {
              // Backward: descending from swimming glide back onto floor
              if (p > 0.04) {
                wasJumping = true;
              }
              if (hasDedicatedSwim) {
                if (p > 0.35) {
                  // Swimming glide returning towards floor
                  swimAnimTime = 13.80 - ((1.0 - p) / 0.65) * (13.80 - 11.80);
                } else if (p > 0.10) {
                  // Airborne descent towards touchdown (2.04s -> 2.79s)
                  const t = (0.35 - p) / (0.35 - 0.10);
                  swimAnimTime = 2.04 + t * (2.79 - 2.04);
                } else {
                  // Feet contact floor cushion & settle into landed rest pose (2.79s -> 3.70s)
                  const u = (0.10 - p) / 0.10;
                  swimAnimTime = 2.79 + u * (3.70 - 2.79);
                }
              } else {
                if (p > 0.35) {
                  swimAnimTime = 2.04 - ((1.0 - p) / 0.65) * (2.04 - 1.50);
                } else if (p > 0.10) {
                  const t = (0.35 - p) / (0.35 - 0.10);
                  swimAnimTime = 2.04 + t * (2.79 - 2.04);
                } else {
                  const u = (0.10 - p) / 0.10;
                  swimAnimTime = 2.79 + u * (3.70 - 2.79);
                }
              }
            } else {
              // Forward: push-off -> continuous streamlined swimming kick into ring
              if (hasDedicatedSwim) {
                if (p < 0.20) {
                  swimAnimTime = 1.00 + (p / 0.20) * (1.50 - 1.00); // Push-off from floor
                } else {
                  // Continuous unbroken swimming kick gliding into the ring aperture
                  swimAnimTime = 11.80 + ((p - 0.20) / 0.80) * (13.80 - 11.80);
                }
              } else {
                if (p < 0.35) {
                  swimAnimTime = 1.00 + (p / 0.35) * (1.60 - 1.00);
                } else {
                  swimAnimTime = 1.60 + ((p - 0.35) / 0.65) * (2.04 - 1.60);
                }
              }
            }
          } else {
            // Inside the ring section: legs swim constantly both while moving
            // between rings and while staying inside a ring.
            const scrollDelta = Math.abs(targetSpaceScrollPhase - lastSpaceScrollPhase);
            lastSpaceScrollPhase = targetSpaceScrollPhase;
            const isMovingBetweenRings = scrollDelta > 0.00008;

            if (isMovingBetweenRings) {
              swimActivity += (1.0 - swimActivity) * Math.min(1, delta * 6.0);
            } else {
              swimActivity *= Math.exp(-delta / 0.45);
            }

            // Constant unbroken swimming: baseline steady swim rate (~0.38) while staying inside the ring,
            // accelerating smoothly up to active swim rate (~0.54) while moving between rings.
            const currentSwimRate = 0.38 + 0.16 * swimActivity;
            ambientSwimProgress += delta * currentSwimRate;
            const strokeCycle = ((ambientSwimProgress % 1.0) + 1.0) % 1.0;

            if (hasDedicatedSwim) {
              swimAnimTime = 11.80 + strokeCycle * 2.00;
            } else {
              swimAnimTime = 1.60 + strokeCycle * (2.40 - 1.60);
            }

            // Dynamic zero-g swimming pitch and roll banking (smooth on both mobile and desktop)
            const kickSin = Math.sin(strokeCycle * Math.PI * 2);
            const swimPitch = -0.06 * kickSin; // Slight streamline dip on kick thrust
            const swimRoll = (spaceDirTurn - 0.5) * 0.12;

            modelInstance.rotation.x = actionConfig.rotation[0] + swimPitch;
            modelInstance.rotation.z = actionConfig.rotation[2] + swimRoll;
          }

          mixer.setTime(swimAnimTime);

          // Neutralize root motion drift so the frog swims in-place at the center of the ring volume
          if (bodyBone && rootBone) {
            const forwardOffset = bodyBone.position.x - (-0.060);
            rootBone.position.x = -forwardOffset;
            const verticalOffset = bodyBone.position.z - 0.370;
            rootBone.position.z = -verticalOffset;
          }

          // In zero-g space ring sections, smoothly position the frog
          // right in the center aperture of the ring so it swims inside the ring
          const spaceElevY = 0.040;
          modelInstance.position.y = floorY + (spaceElevY - floorY) * spaceFloatT;
        } else {
          modelInstance.rotation.z = actionConfig.rotation[2];
          spaceFloatT = 0.0;
          if (jumpProgress > 0.001) {
            wasJumping = true;
            // Piecewise keyframe timing synchronized with section arrival:
            // 0.00 -> 0.06: immediate crouch spring compression on floor (1.00s -> 1.33s)
            // 0.06 -> 0.50: airborne launch up to peak apex (1.33s -> 2.04s)
            // 0.50 -> 0.94: airborne flight & descent towards touchdown (2.04s -> 2.79s)
            // 0.94 -> 1.00: feet contact touchdown cushion & settle right as area arrives (2.79s -> 3.70s)
            let animTime = 1.00;
            if (jumpProgress < 0.06) {
              animTime = 1.00 + (jumpProgress / 0.06) * (1.33 - 1.00);
            } else if (jumpProgress < 0.50) {
              const p = (jumpProgress - 0.06) / (0.50 - 0.06);
              animTime = 1.33 + p * (2.04 - 1.33);
            } else if (jumpProgress < 0.94) {
              const p = (jumpProgress - 0.50) / (0.94 - 0.50);
              animTime = 2.04 + p * (2.79 - 2.04);
            } else {
              const p = (jumpProgress - 0.94) / (1.00 - 0.94);
              animTime = 2.79 + p * (3.70 - 2.79);
            }
            mixer.setTime(animTime);

            // In-place root motion compensation
            if (bodyBone && rootBone) {
              const forwardOffset = bodyBone.position.x - (-0.060);
              rootBone.position.x = -forwardOffset;
            }

            // Real 3D continuous physical elevation & gentle flight pitch
            // Stays airborne across 0.06 -> 0.94 so landing coincides with area arrival
            let elevY = 0;
            let pitchTilt = 0;

            if (jumpProgress < 0.06) {
              // Smooth crouch spring compression
              const tC = jumpProgress / 0.06;
              elevY = -0.03 * Math.sin(tC * Math.PI);
              pitchTilt = 0.04 * Math.sin(tC * Math.PI);
            } else if (jumpProgress <= 0.94) {
              // Airborne flight arc spanning all the way across to destination area
              const w = (jumpProgress - 0.06) / (0.94 - 0.06);
              elevY = 0.36 * Math.sin(w * Math.PI);
              pitchTilt = (w < 0.50 ? 0.18 : -0.14) * Math.sin(w * Math.PI);
            } else {
              // Touchdown cushion & soft ground settling as area completes arrival
              const v = (jumpProgress - 0.94) / 0.06;
              elevY = 0.02 * Math.sin(v * Math.PI) * (1 - v);
              pitchTilt = -0.04 * (1 - v) * (1 - v);
            }

            modelInstance.position.y = floorY + elevY;
            modelInstance.rotation.x = actionConfig.rotation[0] + pitchTilt;
          } else {
            // When landing from a jump, record the landing timestamp
            if (wasJumping) {
              wasJumping = false;
              lastLandTime = elapsed;
            }

            // Lively head dance holds still for 1.0 second after landing, then smoothly begins
            const timeSinceLand = elapsed - lastLandTime;
            let danceWeight = 1.0;
            if (timeSinceLand < 1.0) {
              danceWeight = 0.0;
            } else if (timeSinceLand < 1.35) {
              const t = (timeSinceLand - 1.0) / 0.35;
              danceWeight = t * t * (3 - 2 * t);
            }

            // LIVELY RESTING STANCE: ORGANIC HEAD DANCING & RESPIRATORY PULSE
            const primaryPulse = Math.sin(elapsed * 2.2);
            const microPulse = Math.sin(elapsed * 4.4) * 0.25;
            const combinedCycle = (primaryPulse + microPulse + 1.25) / 2.5; // Normalized 0.0 -> 1.0
            const clampedCycle = Math.max(0, Math.min(1, combinedCycle));
            // When danceWeight = 0 (first 1s after landing): holds still at 0.35s landed pose
            const breatheTime = 0.35 + clampedCycle * 0.50 * danceWeight;
            mixer.setTime(breatheTime);

            if (bodyBone && rootBone) {
              const forwardOffset = bodyBone.position.x - (-0.060);
              rootBone.position.x = -forwardOffset;
            }

            modelInstance.position.y = floorY;
            modelInstance.rotation.x = actionConfig.rotation[0];
          }
        }

        // Apply calibrated held pose & leg folds matching reference images for the 5 sections
        if (bones && bones.body) {
          const clampedPRel = Math.max(0, Math.min(5, currentPRel));
          const idx = Math.min(4, Math.floor(clampedPRel));
          const frac = clampedPRel - idx;
          const smoothT = frac * frac * (3 - 2 * frac);

          const poseA = SECTION_POSES[idx];
          const poseB = SECTION_POSES[Math.min(5, idx + 1)];

          // Blend pose smoothly with jump: during airborne jump flight (0.06..0.94),
          // let the dynamic jump animation take over, and ease smoothly back into the landing pose
          let poseWeight = 1.0;
          if (spaceFloatT > 0.01) {
            poseWeight = Math.max(0, 1.0 - spaceFloatT);
          } else if (jumpProgress > 0.06 && jumpProgress < 0.94) {
            const flightT = (jumpProgress - 0.06) / (0.94 - 0.06);
            poseWeight = 1.0 - Math.sin(flightT * Math.PI) * 0.85;
          }

          const applyBoneRot = (bone, key) => {
            if (!bone || !poseA[key] || !poseB[key]) return;
            const a = poseA[key];
            const b = poseB[key];
            const rx = (a[0] + (b[0] - a[0]) * smoothT) * poseWeight;
            const ry = (a[1] + (b[1] - a[1]) * smoothT) * poseWeight;
            const rz = (a[2] + (b[2] - a[2]) * smoothT) * poseWeight;
            if (Math.abs(rx) > 0.0001 || Math.abs(ry) > 0.0001 || Math.abs(rz) > 0.0001) {
              _tempEuler.set(rx, ry, rz);
              _tempQuat.setFromEuler(_tempEuler);
              bone.quaternion.multiply(_tempQuat);
            }
          };

          applyBoneRot(bones.thighL, 'thighL');
          applyBoneRot(bones.shinL, 'shinL');
          applyBoneRot(bones.hockL, 'hockL');
          applyBoneRot(bones.palmL, 'palmL');

          applyBoneRot(bones.thighR, 'thighR');
          applyBoneRot(bones.shinR, 'shinR');
          applyBoneRot(bones.hockR, 'hockR');
          applyBoneRot(bones.palmR, 'palmR');

          applyBoneRot(bones.armL, 'armL');
          applyBoneRot(bones.forearmL, 'forearmL');

          applyBoneRot(bones.armR, 'armR');
          applyBoneRot(bones.forearmR, 'forearmR');

          // Torso pitch, roll, and elevation offset
          const bodyOffsetY = (poseA.bodyOffsetY + (poseB.bodyOffsetY - poseA.bodyOffsetY) * smoothT) * poseWeight;
          const bodyPitch = (poseA.bodyPitch + (poseB.bodyPitch - poseA.bodyPitch) * smoothT) * poseWeight;
          const bodyRoll = (poseA.bodyRoll + (poseB.bodyRoll - poseA.bodyRoll) * smoothT) * poseWeight;

          bones.body.position.y += bodyOffsetY;
          if (Math.abs(bodyPitch) > 0.0001 || Math.abs(bodyRoll) > 0.0001) {
            _tempEuler.set(bodyPitch, 0, bodyRoll);
            _tempQuat.setFromEuler(_tempEuler);
            bones.body.quaternion.multiply(_tempQuat);
          }
        }
      }

      controls.update();

      if (!isUserDragging) {
        currentParallaxX += (targetParallaxX - currentParallaxX) * 0.05;
        currentParallaxY += (targetParallaxY - currentParallaxY) * 0.05;

        // Ground orientation (Sections 1 & 2)
        const groundRotX = actionConfig.rotation[0] || 0;
        const groundRotY = heroFacingYaw + currentParallaxY + Math.sin(elapsed * 0.5) * 0.008;
        const groundRotZ = actionConfig.rotation[2] + currentParallaxX + Math.cos(elapsed * 0.7) * 0.005;
        _qGround.setFromEuler(_tempEuler.set(groundRotX, groundRotY, groundRotZ, 'XYZ'));

        // Space Ring Orientation (Section 3 Space Rings)
        // Forward/Upward: Head UP (+Y)
        // Downward: Head DOWN (-Y, bottom face angle)
        // Dorsal spine stays facing the camera in both angles
        currentSpaceDirTurn += (spaceDirTurn - currentSpaceDirTurn) * 0.12;
        rootGroup.userData.spaceDirTurn = currentSpaceDirTurn;
        _qSpace.copy(_qSpaceForward).slerp(_qSpaceDownward, currentSpaceDirTurn);

        // Gentle zero-g floating micro-oscillations & parallax
        const oscPitch = Math.sin(elapsed * 1.5) * 0.03;
        const oscYaw = currentParallaxY * 0.25;
        const oscRoll = Math.cos(elapsed * 1.2) * 0.03 + currentParallaxX * 0.25;
        _qOsc.setFromEuler(_tempEuler.set(oscPitch, oscYaw, oscRoll, 'XYZ'));
        _qSpace.multiply(_qOsc);

        // Blend between Ground and Space
        rootGroup.quaternion.copy(_qGround).slerp(_qSpace, spaceFloatT);

        // Apply 3D model scale and vertical elevation in space ring sections
        // so the DOM frame stays full fit 100vw x 100vh without clipping legs or feet
        if (isSpaceFloat) {
          rootGroup.scale.setScalar(spaceModelScale);
          currentSpaceOffsetY += (targetSpaceOffsetY - currentSpaceOffsetY) * 0.18;
          rootGroup.position.y = currentSpaceOffsetY * spaceFloatT;
        } else {
          currentSpaceOffsetY = 0;
          rootGroup.position.y = 0;
          const isPortraitMode = (container.clientWidth / (container.clientHeight || 1)) < 1.0;
          if (isPortraitMode && currentPRel > 4.0) {
            // Smoothly tune frog size exclusively for the Editorial Hero section on mobile
            const tHero = Math.max(0, Math.min(1, currentPRel - 4.0));
            const heroScaleBoost = 1.0 + 0.18 * tHero;
            rootGroup.scale.setScalar(heroScaleBoost);
          } else if (currentPRel > 4.0) {
            // Editorial Hero on desktop: consistent 3D model scale matching space landing (0.95)
            const tHero = Math.max(0, Math.min(1, currentPRel - 4.0));
            const heroScale = 1.0 + (0.95 - 1.0) * tHero;
            rootGroup.scale.setScalar(heroScale);
          } else {
            rootGroup.scale.setScalar(1.0);
          }
        }
      }

      rootGroup.updateMatrixWorld(true);

      if (bodyBone && modelInstance && rootGroup.parent === scene) {
        bodyBone.getWorldPosition(bodyWorldPosition).project(camera);
        bodyScreenOffset.x = bodyWorldPosition.x * (container.clientWidth || width) * 0.5;
        bodyScreenOffset.y = -bodyWorldPosition.y * (container.clientHeight || height) * 0.5;
      }
    }

    // Expose animation tick so the active mechanical ring can drive the frog directly
    rootGroup.tickFrogAnimation = tickFrogAnimation;

    startHeroRenderLoop = () => {
      if (animFrameId || !isMounted || !isHeroVisible || isMountedInRing || rootGroup.parent !== scene) return;
      lastTime = performance.now();

      const animate = () => {
        if (!isMounted || !isHeroVisible || isMountedInRing || rootGroup.parent !== scene) {
          animFrameId = null;
          return;
        }
        animFrameId = requestAnimationFrame(animate);

        const now = performance.now();
        const delta = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        tickFrogAnimation(delta, now);

        renderer.render(scene, camera);
      };

      animate();
    };

    stopHeroRenderLoop = () => {
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
    };

    // ---- VIEWPORT INTERSECTION OBSERVER FOR HERO FROG ----
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isHeroVisible = entry.isIntersecting;
        if (isHeroVisible) {
          startHeroRenderLoop();
        } else {
          stopHeroRenderLoop();
        }
      },
      {
        rootMargin: '300px 0px 300px 0px',
        threshold: 0.01,
      }
    );
    if (container) {
      intersectionObserver.observe(container);
    }

    startHeroRenderLoop();

    // ---- CLEANUP ----
    return () => {
      isMounted = false;
      stopHeroRenderLoop();
      if (intersectionObserver) {
        intersectionObserver.disconnect();
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('click', handleCanvasClick);
      if (facingRef) facingRef.current = null;
      ro.disconnect();
      if (controls) controls.dispose();
      renderer.dispose();
    };
  }, [wordIndex, facingRef, actionConfig]);

  return (
    <div
      ref={containerRef}
      className={`frog-3d-wrapper ${className}`}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
        pointerEvents: wordIndex === 4 ? 'auto' : 'none',
        touchAction: 'none',
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          cursor: wordIndex === 4 ? 'grab' : 'default',
          pointerEvents: wordIndex === 4 ? 'auto' : 'none',
        }}
      />
    </div>
  );
}
