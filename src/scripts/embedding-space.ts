import * as THREE from 'three';

const initEmbeddingSpace = () => {
  const container = document.getElementById('embedding-space') as HTMLElement | null;
  const cardsRoot = document.getElementById('embedding-cards') as HTMLElement | null;
  const dataEl = document.getElementById('embedding-data');
  const clustersEl = document.getElementById('embedding-clusters');
  if (!container || !cardsRoot || !dataEl || !clustersEl) {
    throw new Error('Embedding space elements missing.');
  }

  if (!dataEl.textContent) {
    throw new Error('Embedding data missing.');
  }

  if (!clustersEl.textContent) {
    throw new Error('Embedding clusters missing.');
  }

  const projects = JSON.parse(dataEl.textContent);
  const clusters = JSON.parse(clustersEl.textContent);

  const palette = ['#60a5fa', '#a78bfa', '#34d399', '#f59e0b', '#f97316', '#38bdf8'];
  const categoryColors = new Map(
    clusters.map((cluster, index) => [cluster.category, palette[index % palette.length]]),
  );

  const hashSeed = (value: string) => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) % 997;
    }
    return hash;
  };

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  const nodes = [];
  clusters.forEach((cluster) => {
    const items = projects.filter((project) => project.category === cluster.category);
    if (items.length === 0) {
      return;
    }

    const color = categoryColors.get(cluster.category);
    if (!color) {
      throw new Error(`Missing color for ${cluster.category}`);
    }

    const lon = (cluster.x / 100) * Math.PI * 2;
    const lat = (0.5 - cluster.y / 100) * Math.PI;
    const center = new THREE.Vector3(
      Math.cos(lat) * Math.cos(lon),
      Math.sin(lat),
      Math.cos(lat) * Math.sin(lon),
    );

    const up = Math.abs(center.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(up, center).normalize();
    const v = new THREE.Vector3().crossVectors(center, u).normalize();
    const capRadius = clamp(0.4 + (cluster.size / 600) * 0.25, 0.35, 0.75);

    items.forEach((project, index) => {
      const seed = hashSeed(project.title);
      const t = items.length === 1 ? 0 : index / (items.length - 1);
      const alpha = t * capRadius;
      const phi = (index + seed) * goldenAngle;

      const direction = new THREE.Vector3()
        .copy(center)
        .multiplyScalar(Math.cos(alpha))
        .add(
          new THREE.Vector3()
            .copy(u)
            .multiplyScalar(Math.cos(phi))
            .add(new THREE.Vector3().copy(v).multiplyScalar(Math.sin(phi)))
            .multiplyScalar(Math.sin(alpha)),
        )
        .normalize();

      nodes.push({
        ...project,
        vx: direction.x,
        vy: direction.y,
        vz: direction.z,
        seed,
        color,
      });
    });
  });

  const camera = new THREE.PerspectiveCamera(45, 1, 1, 2000);
  camera.position.set(0, 0, 500);

  const cardElements = nodes.map((node) => {
    const card = document.createElement('div');
    card.className = 'embedding-card';
    card.style.setProperty('--depth-scale', '1');

    const meta = document.createElement('div');
    meta.className = 'embedding-card-meta';
    meta.textContent = node.category;

    const title = document.createElement('div');
    title.className = 'embedding-card-title';
    title.textContent = node.title;

    const tags = document.createElement('div');
    tags.className = 'embedding-card-tags';
    node.tags.slice(0, 3).forEach((tag) => {
      const chip = document.createElement('span');
      chip.className = 'embedding-tag';
      chip.textContent = tag;
      tags.appendChild(chip);
    });

    card.appendChild(meta);
    card.appendChild(title);
    card.appendChild(tags);
    cardsRoot.appendChild(card);
    return card;
  });

  let worldWidth = 0;
  let worldHeight = 0;
  let radius = 0;

  const updateLayout = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    worldWidth = width * 0.9;
    worldHeight = height * 0.9;
    radius = Math.min(worldWidth, worldHeight) * 0.5;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    camera.position.z = Math.max(420, Math.max(width, height));
  };

  updateLayout();
  window.addEventListener('resize', updateLayout);

  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };

  container.addEventListener('pointermove', (event) => {
    const rect = container.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    pointer.sx = event.clientX - rect.left;
    pointer.sy = event.clientY - rect.top;
  });

  const clock = new THREE.Clock();
  const scratch = new THREE.Vector3();
  const rotation = new THREE.Euler();

  const animate = () => {
    const time = clock.getElapsedTime();

    const targetX = pointer.x * worldWidth * 0.03;
    const targetY = pointer.y * worldHeight * 0.03;
    camera.position.x += (targetX - camera.position.x) * 0.05;
    camera.position.y += (-targetY - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);

    rotation.y = time * 0.08;
    rotation.x = Math.sin(time * 0.2) * 0.08;

    nodes.forEach((node, index) => {
      scratch.set(node.vx, node.vy, node.vz).multiplyScalar(radius).applyEuler(rotation);
      const projected = scratch.clone().project(camera);
      const x = (projected.x * 0.5 + 0.5) * worldWidth + (container.clientWidth - worldWidth) / 2;
      const y = (-projected.y * 0.5 + 0.5) * worldHeight + (container.clientHeight - worldHeight) / 2;
      const depth = (scratch.z / radius + 1) / 2;
      const scale = 0.7 + depth * 0.5;

      const card = cardElements[index];
      card.style.left = `${x}px`;
      card.style.top = `${y}px`;
      card.style.opacity = `${0.4 + depth * 0.6}`;
      card.style.setProperty('--depth-scale', scale.toFixed(3));
      card.style.zIndex = `${Math.round(depth * 100)}`;
    });

    requestAnimationFrame(animate);
  };

  animate();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEmbeddingSpace);
} else {
  initEmbeddingSpace();
}
