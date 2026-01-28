/**
 * Point Cloud Animation Controller
 *
 * Architecture with per-role point clouds:
 *
 *   ┌──────────────────┐
 *   │ rolePositions[]  │  <- Different PLY per role
 *   │  home: hero.ply  │
 *   │  engineer: rubiks│
 *   │  explorer: random│
 *   │  artist: random  │
 *   └────────┬─────────┘
 *            │ blend(roleA, roleB, t)
 *            ▼
 *   ┌──────────────────┐      ┌─────────────┐      ┌────────────┐
 *   │ targetPositions  │  ->  │ + breathing │  ->  │ GPU buffer │
 *   │ (interpolated)   │      │ displacement│      │ (render)   │
 *   └──────────────────┘      └─────────────┘      └────────────┘
 *                                    │
 *                             ┌──────┴──────┐
 *                             │ mouse/touch │
 *                             │ -> parallax │
 *                             └─────────────┘
 */

import * as THREE from 'three';

export type Role = 'home' | 'engineer' | 'explorer' | 'artist';

interface RoleStyle {
  color: THREE.Color;
  secondaryColor: THREE.Color;
  breathingAmplitude: number;
  breathingSpeed: number;
  pointSize: number;
}

const ROLE_STYLES: Record<Role, RoleStyle> = {
  home: {
    color: new THREE.Color(0x8b5cf6),
    secondaryColor: new THREE.Color(0xa78bfa),
    breathingAmplitude: 0.005,  // Minimal global breathing
    breathingSpeed: 0.5,
    pointSize: 2.0,
  },
  engineer: {
    color: new THREE.Color(0x3b82f6),
    secondaryColor: new THREE.Color(0x60a5fa),
    breathingAmplitude: 0.004,
    breathingSpeed: 0.4,
    pointSize: 1.8,
  },
  explorer: {
    color: new THREE.Color(0x10b981),
    secondaryColor: new THREE.Color(0x34d399),
    breathingAmplitude: 0.006,
    breathingSpeed: 0.6,
    pointSize: 1.9,
  },
  artist: {
    color: new THREE.Color(0xf43f5e),
    secondaryColor: new THREE.Color(0xfb7185),
    breathingAmplitude: 0.007,
    breathingSpeed: 0.7,
    pointSize: 2.1,
  },
};

const ROLES: Role[] = ['home', 'engineer', 'explorer', 'artist'];

export class PointCloudController {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private points: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;

  private pointCount: number;
  private rolePositions: Record<Role, Float32Array>;
  private currentPositions: Float32Array;  // Animated base (spring physics)
  private renderPositions: Float32Array;   // GPU buffer (base + breathing)
  private targetPositions: Float32Array;
  private velocities: Float32Array;
  private phaseOffsets: Float32Array;
  private colorMixes: Float32Array;

  private time = 0;
  private animationFrame = 0;

  // Mouse state
  private mouseX = 0;
  private mouseY = 0;
  private targetMouseX = 0;
  private targetMouseY = 0;

  // Current style (interpolated)
  private currentStyle: RoleStyle;
  private targetStyle: RoleStyle;

  // Current cloud side (used when regenerating targets)
  private currentCloudSide: 'left' | 'right' = 'right';

  // Rotation state for 3D parallax
  private rotationX = 0;
  private rotationY = 0;

  // Repel effect state
  private mouseRay = new THREE.Raycaster();
  private mouseNDC = new THREE.Vector2();
  private repelOffsets: Float32Array;

  // Wandering particles - always drifting across screen
  private isWandering: Uint8Array;
  private wanderTargets: Float32Array;
  private readonly WANDER_FRACTION = 0.50;  // 50% of particles wander

  constructor(
    canvas: HTMLCanvasElement,
    pointCount: number,
    rolePositions: Partial<Record<Role, Float32Array>>,
  ) {
    this.pointCount = pointCount;
    this.currentPositions = new Float32Array(pointCount * 3);
    this.renderPositions = new Float32Array(pointCount * 3);
    this.targetPositions = new Float32Array(pointCount * 3);
    this.velocities = new Float32Array(pointCount * 3);
    this.phaseOffsets = new Float32Array(pointCount);
    this.colorMixes = new Float32Array(pointCount);
    this.repelOffsets = new Float32Array(pointCount * 3);
    this.isWandering = new Uint8Array(pointCount);
    this.wanderTargets = new Float32Array(pointCount * 3);

    // Build rolePositions: use provided or generate random
    this.rolePositions = {} as Record<Role, Float32Array>;
    for (const role of ROLES) {
      if (rolePositions[role]) {
        this.rolePositions[role] = this.resampleToCount(
          rolePositions[role]!,
          pointCount,
        );
      } else {
        this.rolePositions[role] = this.generateRandomCloud(role);
      }
    }

    // Initialize target to home
    this.targetPositions.set(this.rolePositions.home);

    // Start particles SCATTERED - they'll gravitationally drift into shape
    for (let i = 0; i < this.pointCount; i++) {
      this.phaseOffsets[i] = Math.random() * Math.PI * 2;
      this.colorMixes[i] = Math.random();

      const i3 = i * 3;
      // Scatter across screen, will coalesce via gravity
      this.currentPositions[i3] = (Math.random() - 0.5) * 10;
      this.currentPositions[i3 + 1] = (Math.random() - 0.5) * 6;
      this.currentPositions[i3 + 2] = (Math.random() - 0.5) * 2;

      // All particles target the shape (no wandering)
      this.isWandering[i] = 0;

      // Random initial velocities for orbital motion
      this.velocities[i3] = (Math.random() - 0.5) * 0.02;
      this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.02;
      this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.01;
    }

    // Initialize style
    this.currentStyle = { ...ROLE_STYLES.home };
    this.targetStyle = ROLE_STYLES.home;

    // Three.js setup
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    this.camera.position.set(0, 0.1, 5);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Create geometry and material
    this.geometry = new THREE.BufferGeometry();
    this.material = this.createMaterial();
    this.points = new THREE.Points(this.geometry, this.material);
    // Keep mesh at origin - offset is baked into target positions
    this.points.position.set(0, 0, 0);
    this.scene.add(this.points);

    // Initialize geometry attributes
    this.initializeGeometry();

    // Bind events and start
    this.resize();
    this.bindEvents();
    this.animate();
  }

  /**
   * Resample a point cloud to a target count.
   * If source has more points, randomly subsample.
   * If source has fewer points, duplicate randomly.
   */
  private resampleToCount(source: Float32Array, targetCount: number): Float32Array {
    const sourceCount = source.length / 3;
    const result = new Float32Array(targetCount * 3);

    if (sourceCount === targetCount) {
      result.set(source);
      return result;
    }

    const rng = Math.random;
    for (let i = 0; i < targetCount; i++) {
      const srcIdx = Math.floor(rng() * sourceCount);
      result[i * 3] = source[srcIdx * 3];
      result[i * 3 + 1] = source[srcIdx * 3 + 1];
      result[i * 3 + 2] = source[srcIdx * 3 + 2];
    }

    return result;
  }

  /**
   * Generate a random point cloud with role-specific distribution.
   * Tighter distributions to match PLY density.
   */
  private generateRandomCloud(role: Role): Float32Array {
    const positions = new Float32Array(this.pointCount * 3);
    let spread = 1.0;
    let height = 0.8;
    let depth = 0.5;
    let biasY = 0;

    if (role === 'engineer') {
      spread = 1.2;
      height = 0.6;
      depth = 0.4;
    } else if (role === 'explorer') {
      spread = 1.4;
      height = 0.7;
      depth = 0.9;
      biasY = -0.1;
    } else if (role === 'artist') {
      spread = 1.1;
      height = 0.9;
      depth = 0.6;
      biasY = 0.05;
    }

    for (let i = 0; i < this.pointCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = (Math.random() - 0.5) * height + biasY;
      positions[i * 3 + 2] = (Math.random() - 0.5) * depth;
    }

    return positions;
  }

  private createMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uPointSize: { value: this.currentStyle.pointSize },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: `
        attribute float size;
        attribute float alpha;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uPointSize;
        uniform float uPixelRatio;

        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

          // Distance-based alpha (less aggressive fade)
          float dist = length(mvPosition.xyz);
          float distAlpha = smoothstep(10.0, 1.0, dist);
          
          // Combine distance alpha with per-point alpha (settled amount)
          vAlpha = distAlpha * alpha;

          // Size scales with alpha (wandering points are smaller)
          float alphaSize = 0.5 + alpha * 0.5;
          float sizeScale = size * uPointSize * uPixelRatio * alphaSize * (100.0 / -mvPosition.z);
          gl_PointSize = clamp(sizeScale, 1.5, 12.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          if (dist > 0.5) discard;

          // Sharper edge falloff
          float alpha = smoothstep(0.5, 0.05, dist) * vAlpha;

          // Brighter core
          vec3 glow = vColor * (1.0 + smoothstep(0.2, 0.0, dist) * 0.4);

          gl_FragColor = vec4(glow, alpha * 0.85);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }

  private initializeGeometry(): void {
    // Copy initial positions to render buffer
    this.renderPositions.set(this.currentPositions);

    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.renderPositions, 3),
    );

    // Per-point sizes (tighter variation for more defined look)
    const sizes = new Float32Array(this.pointCount);
    for (let i = 0; i < this.pointCount; i++) {
      sizes[i] = 0.8 + Math.random() * 0.4;
    }
    this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Per-point alpha (controlled by settled amount)
    const alphas = new Float32Array(this.pointCount);
    for (let i = 0; i < this.pointCount; i++) {
      alphas[i] = 1.0;
    }
    this.geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

    // Colors
    const colors = new Float32Array(this.pointCount * 3);
    this.updateColors(colors);
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  private updateColors(colors: Float32Array): void {
    const { color, secondaryColor } = this.currentStyle;
    for (let i = 0; i < this.pointCount; i++) {
      const t = this.colorMixes[i];
      colors[i * 3] = color.r * (1 - t) + secondaryColor.r * t;
      colors[i * 3 + 1] = color.g * (1 - t) + secondaryColor.g * t;
      colors[i * 3 + 2] = color.b * (1 - t) + secondaryColor.b * t;
    }
  }

  private resize(): void {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(rect.width, rect.height);
  }

  /**
   * Get cloud's center position in normalized screen coordinates [0,1].
   */
  private getCloudScreenPosition(): { x: number; y: number } {
    const cloudWorldPos = this.points.position.clone();
    cloudWorldPos.project(this.camera);
    // Convert from [-1,1] to [0,1]
    return {
      x: (cloudWorldPos.x + 1) / 2,
      y: (cloudWorldPos.y + 1) / 2,
    };
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => this.resize());

    window.addEventListener('mousemove', (e) => {
      const cloudScreen = this.getCloudScreenPosition();
      const mouseNormX = e.clientX / window.innerWidth;
      const mouseNormY = e.clientY / window.innerHeight;

      // Offset from cloud center (scaled for sensitivity)
      this.targetMouseX = (mouseNormX - cloudScreen.x) * 3;
      this.targetMouseY = (cloudScreen.y - mouseNormY) * 3;

      // Store NDC for raycasting (repel effect)
      this.mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma !== null && e.beta !== null) {
          this.targetMouseX = (e.gamma / 45) * 0.5;
          this.targetMouseY = ((e.beta - 45) / 45) * 0.5;
        }
      });
    }

    window.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length > 0) {
          const touch = e.touches[0];
          const cloudScreen = this.getCloudScreenPosition();
          const touchNormX = touch.clientX / window.innerWidth;
          const touchNormY = touch.clientY / window.innerHeight;

          this.targetMouseX = (touchNormX - cloudScreen.x) * 3;
          this.targetMouseY = (cloudScreen.y - touchNormY) * 3;
        }
      },
      { passive: true },
    );
  }

  /**
   * Animate positions using 1/sqrt(r) force with Brownian noise.
   * Particles are pulled toward targets, naturally settling via damping.
   */
  private animatePositions(): void {
    const { breathingAmplitude, breathingSpeed } = this.currentStyle;

    // Physics constants
    const K = 0.0012;           // Force strength (1/sqrt(r)) - gentle pull
    const DAMPING_FAR = 0.98;   // Low damping when far (fast travel)
    const DAMPING_NEAR = 0.92;  // High damping when close (kill oscillations)
    const DAMPING_DIST = 1.0;   // Distance threshold for damping transition
    const MIN_DIST = 0.02;      // Prevent division by zero
    const MAX_FORCE = 0.03;     // Cap force to prevent snapping
    const NOISE = 0.003;        // Brownian noise strength (keeps particles alive)
    const RANDOM_EJECT_CHANCE = 0.001;  // Chance per frame for random ejection
    const RANDOM_EJECT_SPEED = 0.1;     // How fast random ejections fly

    for (let i = 0; i < this.pointCount; i++) {
      const i3 = i * 3;
      const phase = this.phaseOffsets[i];

      // Random ejection - particles spontaneously fly off
      if (Math.random() < RANDOM_EJECT_CHANCE) {
        const angle = Math.random() * Math.PI * 2;
        const elevation = (Math.random() - 0.5) * Math.PI;
        this.velocities[i3] += Math.cos(angle) * Math.cos(elevation) * RANDOM_EJECT_SPEED;
        this.velocities[i3 + 1] += Math.sin(elevation) * RANDOM_EJECT_SPEED;
        this.velocities[i3 + 2] += Math.sin(angle) * Math.cos(elevation) * RANDOM_EJECT_SPEED * 0.5;
      }

      // Target is always the shape - particles will return
      const targetX = this.targetPositions[i3];
      const targetY = this.targetPositions[i3 + 1];
      const targetZ = this.targetPositions[i3 + 2];
      const forceStrength = K;

      // Distance to current target (shape or wander)
      const dx = targetX - this.currentPositions[i3];
      const dy = targetY - this.currentPositions[i3 + 1];
      const dz = targetZ - this.currentPositions[i3 + 2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist > MIN_DIST) {
        // Force: 1/sqrt(r)
        const force = Math.min(forceStrength / Math.sqrt(dist), MAX_FORCE);
        
        // Apply force in direction of target
        const dirX = dx / dist;
        const dirY = dy / dist;
        const dirZ = dz / dist;
        
        this.velocities[i3] += dirX * force;
        this.velocities[i3 + 1] += dirY * force;
        this.velocities[i3 + 2] += dirZ * force;
      }

      // Brownian noise - small random perturbations keep particles "alive"
      this.velocities[i3] += (Math.random() - 0.5) * NOISE;
      this.velocities[i3 + 1] += (Math.random() - 0.5) * NOISE;
      this.velocities[i3 + 2] += (Math.random() - 0.5) * NOISE * 0.5;

      // Distance-based damping: low when far (fast travel), high when close (no oscillation)
      const t = Math.min(dist / DAMPING_DIST, 1.0);
      const damping = DAMPING_NEAR + t * (DAMPING_FAR - DAMPING_NEAR);
      
      this.velocities[i3] *= damping;
      this.velocities[i3 + 1] *= damping;
      this.velocities[i3 + 2] *= damping;
      
      this.currentPositions[i3] += this.velocities[i3];
      this.currentPositions[i3 + 1] += this.velocities[i3 + 1];
      this.currentPositions[i3 + 2] += this.velocities[i3 + 2];

      // Breathing displacement
      const bdx = Math.sin(this.time * breathingSpeed + phase) * breathingAmplitude;
      const bdy = Math.cos(this.time * breathingSpeed * 0.8 + phase) * breathingAmplitude;
      const bdz = Math.sin(this.time * breathingSpeed * 0.9 + phase * 0.7) * breathingAmplitude;

      // Final render position = current + breathing + repel
      // (cloud offset is baked into targetPositions, not added here)
      this.renderPositions[i3] = this.currentPositions[i3] + bdx + this.repelOffsets[i3];
      this.renderPositions[i3 + 1] = this.currentPositions[i3 + 1] + bdy + this.repelOffsets[i3 + 1];
      this.renderPositions[i3 + 2] = this.currentPositions[i3 + 2] + bdz + this.repelOffsets[i3 + 2];
    }

    this.geometry.attributes.position.needsUpdate = true;
  }

  /**
   * Eject effect: points near mouse get launched away with velocity impulse.
   */
  private applyRepelEffect(): void {
    const EJECT_RADIUS = 0.8;       // Radius of influence (larger = more particles)
    const EJECT_STRENGTH = 0.18;     // Strong velocity impulse
    const OFFSET_DECAY = 0.92;      // Decay for visual offset

    // Update raycaster with current mouse position
    this.mouseRay.setFromCamera(this.mouseNDC, this.camera);
    const rayOrigin = this.mouseRay.ray.origin;
    const rayDir = this.mouseRay.ray.direction;

    // Get world matrix of points for transforming positions
    const worldMatrix = this.points.matrixWorld;
    const invMatrix = worldMatrix.clone().invert();
    const tempPoint = new THREE.Vector3();
    const closestOnRay = new THREE.Vector3();
    const ejectDir = new THREE.Vector3();

    for (let i = 0; i < this.pointCount; i++) {
      const i3 = i * 3;

      // Get point in world space
      tempPoint.set(
        this.currentPositions[i3],
        this.currentPositions[i3 + 1],
        this.currentPositions[i3 + 2],
      );
      tempPoint.applyMatrix4(worldMatrix);

      // Find closest point on ray to this point
      const t = tempPoint.clone().sub(rayOrigin).dot(rayDir);
      closestOnRay.copy(rayDir).multiplyScalar(Math.max(0, t)).add(rayOrigin);

      // Distance from point to ray
      const dist = tempPoint.distanceTo(closestOnRay);

      // Apply eject impulse if within radius
      if (dist < EJECT_RADIUS) {
        // Inverse falloff: stronger when closer
        const normalizedDist = dist / EJECT_RADIUS;
        const falloff = Math.pow(1 - normalizedDist, 2);

        // Eject direction (away from ray center)
        if (dist > 0.001) {
          ejectDir.subVectors(tempPoint, closestOnRay).normalize();
        } else {
          // If exactly on ray, push outward randomly
          ejectDir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.3).normalize();
        }

        // Transform direction back to local space
        ejectDir.transformDirection(invMatrix);

        // Apply velocity impulse (not just offset)
        const impulse = EJECT_STRENGTH * falloff;
        this.velocities[i3] += ejectDir.x * impulse;
        this.velocities[i3 + 1] += ejectDir.y * impulse;
        this.velocities[i3 + 2] += ejectDir.z * impulse * 0.5;

        // Small visual offset for immediate feedback
        this.repelOffsets[i3] += ejectDir.x * impulse * 0.3;
        this.repelOffsets[i3 + 1] += ejectDir.y * impulse * 0.3;
        this.repelOffsets[i3 + 2] += ejectDir.z * impulse * 0.2;
      }

      // Decay visual offsets
      this.repelOffsets[i3] *= OFFSET_DECAY;
      this.repelOffsets[i3 + 1] *= OFFSET_DECAY;
      this.repelOffsets[i3 + 2] *= OFFSET_DECAY;
    }
  }

  /**
   * Animated rotation: slow bouncing motion around the cloud.
   * Uses different frequencies for X/Y to create organic movement.
   */
  private applyParallax(): void {
    // Max rotation (in radians) ~12 degrees
    const MAX_ROT = 0.21;

    // Different frequencies for organic motion
    const rotY = Math.sin(this.time * 1.2) * MAX_ROT;
    const rotX = Math.sin(this.time * 0.9 + 1.5) * MAX_ROT * 0.7;

    // Smooth interpolation for extra smoothness
    this.rotationY += (rotY - this.rotationY) * 0.03;
    this.rotationX += (rotX - this.rotationX) * 0.03;

    // Apply rotation to the points group
    this.points.rotation.y = this.rotationY;
    this.points.rotation.x = this.rotationX;
  }

  /**
   * Interpolate current style toward target style.
   */
  private interpolateStyle(): void {
    const lerpFactor = 0.03;

    this.currentStyle.color.lerp(this.targetStyle.color, lerpFactor);
    this.currentStyle.secondaryColor.lerp(
      this.targetStyle.secondaryColor,
      lerpFactor,
    );
    this.currentStyle.breathingAmplitude +=
      (this.targetStyle.breathingAmplitude -
        this.currentStyle.breathingAmplitude) *
      lerpFactor;
    this.currentStyle.breathingSpeed +=
      (this.targetStyle.breathingSpeed - this.currentStyle.breathingSpeed) *
      lerpFactor;
    this.currentStyle.pointSize +=
      (this.targetStyle.pointSize - this.currentStyle.pointSize) * lerpFactor;

    // Update colors in geometry
    const colors = this.geometry.attributes.color.array as Float32Array;
    this.updateColors(colors);
    this.geometry.attributes.color.needsUpdate = true;

    // Update material uniform
    this.material.uniforms.uPointSize.value = this.currentStyle.pointSize;
  }

  private animate = (): void => {
    this.animationFrame = requestAnimationFrame(this.animate);

    this.time += 0.016; // ~60fps

    // Smooth mouse interpolation
    this.mouseX += (this.targetMouseX - this.mouseX) * 0.05;
    this.mouseY += (this.targetMouseY - this.mouseY) * 0.05;

    // Animation pipeline
    this.interpolateStyle();
    this.applyParallax();

    // Update world matrix before repel (needs transformed positions)
    this.points.updateMatrixWorld();
    this.applyRepelEffect();
    this.animatePositions();

    this.renderer.render(this.scene, this.camera);
  };

  /**
   * Set the target role and cloud side.
   * Offset is baked into target positions so each particle drifts individually.
   */
  setRole(role: Role, cloudSide: 'left' | 'right' = this.currentCloudSide): void {
    this.targetStyle = ROLE_STYLES[role];
    this.currentCloudSide = cloudSide;

    // Bake cloud offset into target positions
    const offsetX = cloudSide === 'left' ? -3.0 : 3.0;
    const offsetY = 0.25;
    const basePositions = this.rolePositions[role];

    for (let i = 0; i < this.pointCount; i++) {
      const i3 = i * 3;
      this.targetPositions[i3] = basePositions[i3] + offsetX;
      this.targetPositions[i3 + 1] = basePositions[i3 + 1] + offsetY;
      this.targetPositions[i3 + 2] = basePositions[i3 + 2];
    }
  }

  destroy(): void {
    cancelAnimationFrame(this.animationFrame);
    this.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
  }
}

// ============================================================================
// PLY Loading Utilities
// ============================================================================

function parsePly(text: string): Float32Array {
  const lines = text.split(/\r?\n/);
  let vertexCount = 0;
  let headerEndIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('element vertex')) {
      vertexCount = Number(line.split(/\s+/)[2]);
    }
    if (line === 'end_header') {
      headerEndIndex = i;
      break;
    }
  }

  if (headerEndIndex < 0 || vertexCount <= 0) {
    throw new Error('Invalid PLY header');
  }

  const points = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) {
    const line = lines[headerEndIndex + 1 + i];
    if (!line) throw new Error('Unexpected end of PLY vertex data');
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) throw new Error('PLY vertex line missing coordinates');
    points[i * 3] = Number(parts[0]);
    points[i * 3 + 1] = Number(parts[1]);
    points[i * 3 + 2] = Number(parts[2]);
  }

  return points;
}

function normalizePoints(
  points: Float32Array,
  targetScale = 1.2,
  zScale = 1.5,
): Float32Array {
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;

  for (let i = 0; i < points.length; i += 3) {
    const x = points[i],
      y = points[i + 1],
      z = points[i + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const range = Math.max(maxX - minX, maxY - minY, maxZ - minZ);

  if (!Number.isFinite(range) || range <= 0) {
    throw new Error('Invalid PLY bounds');
  }

  // Normalize to [-targetScale, targetScale] range
  const scale = range / (2 * targetScale);

  const normalized = new Float32Array(points.length);
  for (let i = 0; i < points.length; i += 3) {
    normalized[i] = (points[i] - centerX) / scale;
    normalized[i + 1] = -((points[i + 1] - centerY) / scale);
    // Scale Z by zScale factor for more depth
    normalized[i + 2] = ((points[i + 2] - centerZ) / scale) * zScale;
  }

  return normalized;
}

async function loadPlyFromUrl(url: string): Promise<Float32Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load PLY: ${response.status}`);
  }
  const text = await response.text();
  return normalizePoints(parsePly(text));
}

// ============================================================================
// Module API
// ============================================================================

let instance: PointCloudController | null = null;

export interface InitOptions {
  plyUrls?: Partial<Record<Role, string>>;
  pointCount?: number;
}

export async function initPointCloud(
  canvas: HTMLCanvasElement,
  options: InitOptions = {},
): Promise<PointCloudController> {
  if (instance) {
    instance.destroy();
  }

  // Load PLY files in parallel
  const rolePositions: Partial<Record<Role, Float32Array>> = {};

  if (options.plyUrls) {
    const loadPromises = Object.entries(options.plyUrls).map(
      async ([role, url]) => {
        if (url) {
          const positions = await loadPlyFromUrl(url);
          rolePositions[role as Role] = positions;
        }
      },
    );
    await Promise.all(loadPromises);
  }

  // Use point count from first loaded PLY, or explicit option, or default
  let pointCount = options.pointCount;
  if (!pointCount) {
    const firstLoaded = Object.values(rolePositions)[0];
    if (firstLoaded) {
      pointCount = firstLoaded.length / 3;
    } else {
      const isMobile =
          /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        );
      pointCount = isMobile ? 500 : 1000;
    }
  }

  instance = new PointCloudController(canvas, pointCount, rolePositions);
  return instance;
}

export function getPointCloudInstance(): PointCloudController | null {
  return instance;
}

export function setRole(role: Role, cloudSide?: 'left' | 'right'): void {
  instance?.setRole(role, cloudSide);
}
