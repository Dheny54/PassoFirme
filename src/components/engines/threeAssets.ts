import * as THREE from 'three';

export function detectSoftwareGl(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export function createStoneFlagstoneTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#1b263b';
  ctx.fillRect(0, 0, 512, 512);

  const rows = 4;
  const cols = 4;
  const tileW = 512 / cols;
  const tileH = 512 / rows;
  const tones = ['#23314a', '#1f2b42', '#263550', '#1c283d'];

  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 1 ? tileW * 0.5 : 0;
    for (let col = -1; col <= cols; col++) {
      const x = col * tileW + offset;
      const y = r * tileH;
      const tone = tones[(r * 3 + col + 4) % tones.length];
      ctx.fillStyle = tone;
      ctx.fillRect(x + 3, y + 3, tileW - 6, tileH - 6);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 6, y + 6, tileW - 12, tileH - 12);
    }
  }

  for (let i = 0; i < 420; i++) {
    const sx = ((i * 73) % 509) + 1;
    const sy = ((i * 137) % 509) + 1;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(10,15,28,0.12)';
    ctx.fillRect(sx, sy, 2 + (i % 3), 2 + (i % 2));
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  tex.anisotropy = Math.min(4, maxAnisotropy);
  return tex;
}

export function createWoodPlankTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#5b3c26';
  ctx.fillRect(0, 0, 256, 256);

  const plankCount = 4;
  const plankW = 256 / plankCount;
  const tones = ['#6b472d', '#5d3d26', '#724c30', '#583822'];

  for (let i = 0; i < plankCount; i++) {
    ctx.fillStyle = tones[i % tones.length];
    ctx.fillRect(i * plankW + 2, 0, plankW - 4, 256);
    ctx.fillStyle = '#331e11';
    ctx.fillRect(i * plankW, 0, 3, 256);

    ctx.strokeStyle = 'rgba(40, 22, 10, 0.25)';
    ctx.lineWidth = 1.5;
    for (let g = 0; g < 6; g++) {
      const gx = i * plankW + 8 + g * 8;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.bezierCurveTo(gx + 3, 85, gx - 3, 170, gx, 256);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 3);
  tex.anisotropy = Math.min(4, maxAnisotropy);
  return tex;
}

export function createHazardStripeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 256, 128);

  ctx.fillStyle = '#f59e0b';
  for (let x = -128; x < 384; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 128);
    ctx.lineTo(x + 24, 128);
    ctx.lineTo(x + 74, 0);
    ctx.lineTo(x + 50, 0);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 256, 14);
  ctx.fillRect(0, 114, 256, 14);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(3, 1);
  tex.anisotropy = Math.min(4, maxAnisotropy);
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(2, 6, 23, 0.72)');
  grad.addColorStop(0.55, 'rgba(2, 6, 23, 0.32)');
  grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Stylized Articulated 3D Knight (cohesive with Chapter 3 & 4 2D Knight).
 * Origin at bottom-center (feet y = 0). Forward direction = -Z.
 */
export function buildStylizedKnight3D(shadowTex: THREE.CanvasTexture, castShadow: boolean) {
  const root = new THREE.Group();
  const visualRoot = new THREE.Group();
  root.add(visualRoot);

  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 1.35),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.78,
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.03;
  root.add(contactShadow);

  const tunicMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.58, metalness: 0.12 });
  const cloakMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.1, side: THREE.DoubleSide });
  const armorMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.38, metalness: 0.55 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.78 });
  const ivoryMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.42, metalness: 0.08 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.25, metalness: 0.5 });
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.28,
    roughness: 0.2,
    metalness: 0.85,
  });
  const eyeGlowMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.4,
    roughness: 0.15,
  });

  const pelvisPivot = new THREE.Group();
  pelvisPivot.position.set(0, 0.56, 0);
  visualRoot.add(pelvisPivot);

  const makeLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.17, 0, 0);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.14, 4, 8), armorMat);
    thigh.position.set(0, -0.14, 0);
    thigh.castShadow = castShadow;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.27, 0);
    hip.add(knee);

    const calf = new THREE.Mesh(new THREE.CapsuleGeometry(0.088, 0.13, 4, 8), armorMat);
    calf.position.set(0, -0.11, 0);
    calf.castShadow = castShadow;

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.13, 0.31), armorMat);
    boot.position.set(0, -0.22, -0.045);
    boot.castShadow = castShadow;

    const bootTrim = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.32), goldMat);
    bootTrim.position.set(0, -0.15, -0.045);

    knee.add(calf, boot, bootTrim);
    return { hip, knee };
  };
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);
  pelvisPivot.add(leftLeg.hip, rightLeg.hip);

  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0.04, 0);
  pelvisPivot.add(torsoPivot);

  const tunicPoints = [
    new THREE.Vector2(0.01, 0.0),
    new THREE.Vector2(0.35, 0.02),
    new THREE.Vector2(0.32, 0.24),
    new THREE.Vector2(0.27, 0.52),
    new THREE.Vector2(0.23, 0.68),
    new THREE.Vector2(0.01, 0.7),
  ];
  const tunicGeo = new THREE.LatheGeometry(tunicPoints, 12);
  tunicGeo.scale(1.08, 1.0, 0.85);
  const tunicMesh = new THREE.Mesh(tunicGeo, tunicMat);
  tunicMesh.castShadow = castShadow;
  torsoPivot.add(tunicMesh);

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.31, 0.09, 12), armorMat);
  belt.scale.set(1.08, 1, 0.86);
  belt.position.set(0, 0.22, 0);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.06), goldMat);
  buckle.position.set(0, 0.22, -0.26);
  const brooch = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), eyeGlowMat);
  brooch.position.set(0, 0.52, -0.22);
  torsoPivot.add(belt, buckle, brooch);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.075, 6, 14), cloakMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.67, 0);
  torsoPivot.add(collar);

  const capePivot = new THREE.Group();
  capePivot.position.set(0, 0.64, 0.18);
  torsoPivot.add(capePivot);

  const capeUpper = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.44, 0.06), cloakMat);
  capeUpper.position.set(0, -0.22, 0.03);
  capeUpper.castShadow = castShadow;
  capePivot.add(capeUpper);

  const capeTipPivot = new THREE.Group();
  capeTipPivot.position.set(0, -0.44, 0.03);
  capePivot.add(capeTipPivot);

  const capeLower = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.42, 4), cloakMat);
  capeLower.rotation.x = Math.PI;
  capeLower.rotation.y = Math.PI / 4;
  capeLower.scale.set(1.0, 1.0, 0.22);
  capeLower.position.set(0, -0.18, 0.02);
  capeTipPivot.add(capeLower);

  const leftShoulderPivot = new THREE.Group();
  leftShoulderPivot.position.set(-0.34, 0.56, 0);
  const lPauldron = new THREE.Mesh(new THREE.SphereGeometry(0.145, 8, 8), armorMat);
  const lUpperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.13, 4, 8), tunicMat);
  lUpperArm.position.set(-0.02, -0.11, 0);

  const leftElbowPivot = new THREE.Group();
  leftElbowPivot.position.set(-0.03, -0.21, 0);
  const lForearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.12, 4, 8), armorMat);
  lForearm.position.set(0, -0.09, -0.02);
  const buckler = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 8), armorMat);
  buckler.rotation.z = Math.PI / 2;
  buckler.position.set(-0.08, -0.14, -0.07);
  const bucklerBoss = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), goldMat);
  bucklerBoss.position.set(-0.11, -0.14, -0.07);
  leftElbowPivot.add(lForearm, buckler, bucklerBoss);
  leftShoulderPivot.add(lPauldron, lUpperArm, leftElbowPivot);
  torsoPivot.add(leftShoulderPivot);

  const rightShoulderPivot = new THREE.Group();
  rightShoulderPivot.position.set(0.34, 0.56, 0);
  const rPauldron = new THREE.Mesh(new THREE.SphereGeometry(0.145, 8, 8), armorMat);
  const rUpperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.13, 4, 8), tunicMat);
  rUpperArm.position.set(0.02, -0.11, 0);

  const rightElbowPivot = new THREE.Group();
  rightElbowPivot.position.set(0.03, -0.21, 0);
  const rForearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.12, 4, 8), armorMat);
  rForearm.position.set(0, -0.09, -0.02);
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), goldMat);
  hilt.rotation.x = Math.PI / 2;
  hilt.position.set(0.02, -0.15, -0.12);
  const crossguard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.05), goldMat);
  crossguard.position.set(0.02, -0.15, -0.21);
  const blade = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.62, 4), bladeMat);
  blade.rotation.x = -Math.PI / 2;
  blade.scale.set(0.45, 1, 1.1);
  blade.position.set(0.02, -0.15, -0.52);
  rightElbowPivot.add(rForearm, hilt, crossguard, blade);
  rightShoulderPivot.add(rPauldron, rUpperArm, rightElbowPivot);
  torsoPivot.add(rightShoulderPivot);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.74, 0);
  torsoPivot.add(headPivot);

  const maskGeo = new THREE.SphereGeometry(0.28, 14, 12);
  maskGeo.scale(1.05, 1.02, 0.94);
  const maskMesh = new THREE.Mesh(maskGeo, ivoryMat);
  maskMesh.position.set(0, 0.23, 0);
  maskMesh.castShadow = castShadow;
  headPivot.add(maskMesh);

  const visorGeo = new THREE.BoxGeometry(0.36, 0.15, 0.08);
  const visorMesh = new THREE.Mesh(visorGeo, visorMat);
  visorMesh.position.set(0, 0.21, -0.23);
  headPivot.add(visorMesh);

  const eyeGeo = new THREE.SphereGeometry(0.055, 8, 8);
  eyeGeo.scale(0.85, 1.35, 0.5);
  const leftEye = new THREE.Mesh(eyeGeo, eyeGlowMat);
  leftEye.position.set(-0.1, 0.22, -0.26);
  const rightEye = new THREE.Mesh(eyeGeo, eyeGlowMat);
  rightEye.position.set(0.1, 0.22, -0.26);
  headPivot.add(leftEye, rightEye);

  const makeHorn = (side: -1 | 1) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.18, 0.36, 0.02),
      new THREE.Vector3(side * 0.3, 0.56, 0.04),
      new THREE.Vector3(side * 0.24, 0.76, -0.04),
      new THREE.Vector3(side * 0.14, 0.86, -0.09),
    ]);
    const horn = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.045, 7, false), ivoryMat);
    horn.castShadow = castShadow;
    return horn;
  };
  headPivot.add(makeHorn(-1), makeHorn(1));

  return {
    root,
    visualRoot,
    contactShadow,
    pelvisPivot,
    leftHipPivot: leftLeg.hip,
    leftKneePivot: leftLeg.knee,
    rightHipPivot: rightLeg.hip,
    rightKneePivot: rightLeg.knee,
    torsoPivot,
    leftShoulderPivot,
    leftElbowPivot,
    rightShoulderPivot,
    rightElbowPivot,
    capePivot,
    capeTipPivot,
    headPivot,
    leftEye,
    rightEye,
  };
}

export function buildFirstPersonCaster() {
  const group = new THREE.Group();
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.32, metalness: 0.72 });
  const tealShell = new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.38, metalness: 0.4 });
  const goldRail = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.78 });
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 1.25,
    roughness: 0.15,
  });

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.42), darkMetal);
  const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.28), tealShell);
  shroud.position.set(0, 0.03, -0.04);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.34, 8), darkMetal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.28);

  const railLeft = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.24), goldRail);
  railLeft.position.set(-0.06, 0.03, -0.08);
  const railRight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.24), goldRail);
  railRight.position.set(0.06, 0.03, -0.08);

  const crystalCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), crystalMat);
  crystalCore.position.set(0, 0.08, -0.06);

  const muzzleGlow = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.012, 6, 14), crystalMat);
  muzzleGlow.position.set(0, 0.02, -0.45);

  group.add(receiver, shroud, barrel, railLeft, railRight, crystalCore, muzzleGlow);
  return { group, crystalCore };
}

export function buildFirstPersonMeleeBlade() {
  const pivot = new THREE.Group();
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.28, metalness: 0.8 });
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xe0e7ff,
    emissive: 0x8b5cf6,
    emissiveIntensity: 0.55,
    roughness: 0.18,
    metalness: 0.88,
  });

  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.16, 6), goldMat);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.04), goldMat);
  guard.position.set(0, 0.08, 0);
  const blade = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.58, 4), bladeMat);
  blade.scale.set(0.4, 1, 1.15);
  blade.position.set(0, 0.38, 0);

  pivot.add(hilt, guard, blade);
  return pivot;
}

export function buildStylizedTree(x: number, z: number, scale: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4b3326, roughness: 0.88, metalness: 0.04 });
  const leafDark = new THREE.MeshStandardMaterial({ color: 0x0f514b, roughness: 0.72, metalness: 0.04 });
  const leafMid = new THREE.MeshStandardMaterial({ color: 0x116b62, roughness: 0.65, metalness: 0.05 });
  const leafTip = new THREE.MeshStandardMaterial({ color: 0x14b8a6, roughness: 0.58, metalness: 0.05 });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 1.9, 7), trunkMat);
  trunk.position.y = 0.95;
  const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.45, 2.1, 7), leafDark);
  c1.position.y = 2.35;
  const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.12, 1.85, 7), leafMid);
  c2.position.y = 3.45;
  const c3 = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.5, 7), leafTip);
  c3.position.y = 4.4;
  g.add(trunk, c1, c2, c3);
  return g;
}

export function animateKnightPose3D(
  knight3D: ReturnType<typeof buildStylizedKnight3D>,
  params: {
    moving: boolean;
    sprinting: boolean;
    crouching: boolean;
    sliding?: boolean;
    grounded: boolean;
    vy: number;
    walkPhase: number;
    elapsed: number;
    turnRate?: number;
    landSquash?: number;
    dt: number;
  }
) {
  const {
    moving,
    sprinting,
    crouching,
    sliding = false,
    grounded,
    vy,
    walkPhase,
    elapsed,
    turnRate = 0,
    landSquash = 0,
    dt,
  } = params;

  const targetBank = sliding ? 0.14 : moving ? THREE.MathUtils.clamp(turnRate * 0.032, -0.18, 0.18) : 0;
  knight3D.visualRoot.rotation.z = THREE.MathUtils.damp(knight3D.visualRoot.rotation.z, targetBank, 11, dt);

  // When sliding, pitch entire body forward/back into a fast low baseball/hero slide!
  const slideTilt = sliding ? 0.55 : 0;
  knight3D.visualRoot.rotation.x = THREE.MathUtils.damp(knight3D.visualRoot.rotation.x, slideTilt, 16, dt);

  let targetScaleX = 1;
  let targetScaleY = 1;
  if (!grounded) {
    const stretch = THREE.MathUtils.clamp(vy * 0.018, -0.1, 0.14);
    targetScaleY = 1 + stretch;
    targetScaleX = 1 - stretch * 0.5;
  } else if (landSquash > 0) {
    targetScaleY = 1 - landSquash * 0.16;
    targetScaleX = 1 + landSquash * 0.12;
  }
  knight3D.visualRoot.scale.x = THREE.MathUtils.damp(knight3D.visualRoot.scale.x, targetScaleX, 18, dt);
  knight3D.visualRoot.scale.y = THREE.MathUtils.damp(knight3D.visualRoot.scale.y, targetScaleY, 18, dt);
  knight3D.visualRoot.scale.z = knight3D.visualRoot.scale.x;

  const crouchDrop = sliding ? -0.32 : crouching ? -0.22 : 0;
  const runBounce = moving && grounded && !sliding ? Math.abs(Math.sin(walkPhase)) * (sprinting ? 0.085 : 0.042) : 0;
  const idleBreath = !moving && grounded ? Math.sin(elapsed * 2.4) * 0.016 : 0;
  const hipSwayX = moving && grounded && !sliding ? Math.sin(walkPhase) * 0.035 : 0;
  const hipRollZ = moving && grounded && !sliding ? Math.cos(walkPhase) * 0.045 : 0;

  knight3D.pelvisPivot.position.y = THREE.MathUtils.damp(
    knight3D.pelvisPivot.position.y,
    0.56 + crouchDrop + runBounce + idleBreath,
    16,
    dt
  );
  knight3D.pelvisPivot.position.x = THREE.MathUtils.damp(knight3D.pelvisPivot.position.x, hipSwayX, 14, dt);
  knight3D.pelvisPivot.rotation.z = THREE.MathUtils.damp(knight3D.pelvisPivot.rotation.z, hipRollZ, 14, dt);

  const leftStride = sliding
    ? 0.95
    : !grounded
      ? 0.55
      : moving
        ? Math.sin(walkPhase) * (sprinting ? 0.72 : 0.5)
        : 0;
  const rightStride = sliding
    ? -0.35
    : !grounded
      ? -0.25
      : moving
        ? -Math.sin(walkPhase) * (sprinting ? 0.72 : 0.5)
        : 0;

  const leftKneeBend = sliding
    ? -0.22
    : !grounded
      ? -0.78
      : crouching
        ? -0.52
        : moving
          ? -Math.max(0, Math.cos(walkPhase)) * (sprinting ? 0.85 : 0.58)
          : 0;
  const rightKneeBend = sliding
    ? -0.95
    : !grounded
      ? -0.45
      : crouching
        ? -0.52
        : moving
          ? -Math.max(0, -Math.cos(walkPhase)) * (sprinting ? 0.85 : 0.58)
          : 0;

  knight3D.leftHipPivot.rotation.x = THREE.MathUtils.damp(knight3D.leftHipPivot.rotation.x, leftStride, 16, dt);
  knight3D.rightHipPivot.rotation.x = THREE.MathUtils.damp(knight3D.rightHipPivot.rotation.x, rightStride, 16, dt);
  knight3D.leftKneePivot.rotation.x = THREE.MathUtils.damp(knight3D.leftKneePivot.rotation.x, leftKneeBend, 16, dt);
  knight3D.rightKneePivot.rotation.x = THREE.MathUtils.damp(knight3D.rightKneePivot.rotation.x, rightKneeBend, 16, dt);

  const targetLean = sliding ? -0.15 : crouching ? 0.34 : sprinting ? 0.24 : moving ? 0.09 : 0;
  const torsoTwist =
    moving && grounded && !sliding
      ? -Math.sin(walkPhase) * (sprinting ? 0.14 : 0.08)
      : Math.sin(elapsed * 1.4) * 0.03;
  knight3D.torsoPivot.rotation.x = THREE.MathUtils.damp(knight3D.torsoPivot.rotation.x, -targetLean, 12, dt);
  knight3D.torsoPivot.rotation.y = THREE.MathUtils.damp(knight3D.torsoPivot.rotation.y, torsoTwist, 12, dt);

  const armSwing = sliding
    ? 0.65
    : !grounded
      ? 0.45
      : moving
        ? Math.sin(walkPhase) * (sprinting ? 0.62 : 0.42)
        : 0.06 * Math.sin(elapsed * 2.0);
  knight3D.leftShoulderPivot.rotation.x = THREE.MathUtils.damp(knight3D.leftShoulderPivot.rotation.x, -armSwing, 15, dt);
  knight3D.rightShoulderPivot.rotation.x = THREE.MathUtils.damp(knight3D.rightShoulderPivot.rotation.x, armSwing + 0.12, 15, dt);

  const leftElbowBend = !grounded ? 0.65 : moving ? 0.45 + Math.max(0, -armSwing) * 0.45 : 0.22;
  const rightElbowBend = !grounded ? 0.55 : moving ? 0.52 + Math.max(0, armSwing) * 0.4 : 0.28 + Math.sin(elapsed * 2.2) * 0.05;
  knight3D.leftElbowPivot.rotation.x = THREE.MathUtils.damp(knight3D.leftElbowPivot.rotation.x, leftElbowBend, 14, dt);
  knight3D.rightElbowPivot.rotation.x = THREE.MathUtils.damp(knight3D.rightElbowPivot.rotation.x, rightElbowBend, 14, dt);

  const capeLift = sliding
    ? 0.95
    : !grounded
      ? 0.65
      : moving
        ? (sprinting ? 0.72 : 0.36) + Math.sin(walkPhase * 2) * 0.09
        : 0.12 + Math.sin(elapsed * 2.1) * 0.04;
  knight3D.capePivot.rotation.x = THREE.MathUtils.damp(knight3D.capePivot.rotation.x, capeLift, 11, dt);
  knight3D.capeTipPivot.rotation.x = THREE.MathUtils.damp(
    knight3D.capeTipPivot.rotation.x,
    capeLift * 0.45 + Math.cos(elapsed * 4.5) * 0.07,
    10,
    dt
  );

  knight3D.headPivot.rotation.y = THREE.MathUtils.damp(
    knight3D.headPivot.rotation.y,
    !moving ? Math.sin(elapsed * 1.1) * 0.16 : -torsoTwist * 0.55,
    10,
    dt
  );
}
