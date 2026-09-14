/* Batched distant terrain and silhouettes. World intent remains authoritative. */
(function (root) {
  'use strict';
  class HomeWorldLOD {
    constructor(THREE, options) {
      this.THREE = THREE;
      this.options = options;
      this.size = options.size;
      this.chunkSize = 16;
      this.group = new THREE.Group();
      this.group.name = 'home-world-overview';
      options.parent.add(this.group);
      this.geometry = {
        box: new THREE.BoxGeometry(1, 1, 1),
        cone: new THREE.ConeGeometry(.5, 1, 4),
        rock: new THREE.IcosahedronGeometry(.5, 0),
      };
      for (const geometry of Object.values(this.geometry)) geometry.computeBoundingBox();
      this.material = new THREE.MeshLambertMaterial({ color: 0xffffff });
      this.chunks = new Map();
      this.dirty = new Set();
      this.matrix = new THREE.Matrix4();
      this.dummy = new THREE.Object3D();
      this.frustum = new THREE.Frustum();
      this.worldBounds = new THREE.Box3();
      this.ray = new THREE.Ray();
      this.inverse = new THREE.Matrix4();
      this.reset();
    }
    clearChunk(chunk) {
      this.group.remove(chunk.group);
      for (const mesh of chunk.group.children) mesh.dispose(); // release instance buffers; shared assets stay alive
    }
    reset() {
      for (const chunk of this.chunks.values()) this.clearChunk(chunk);
      this.chunks.clear();
      this.dirty.clear();
      for (let x = 0; x < this.size; x += this.chunkSize)
        for (let z = 0; z < this.size; z += this.chunkSize) this.dirty.add(x + ',' + z);
    }
    invalidate(x, z) {
      if (x < 0 || z < 0 || x >= this.size || z >= this.size) return;
      this.dirty.add(Math.floor(x / this.chunkSize) * this.chunkSize + ',' + Math.floor(z / this.chunkSize) * this.chunkSize);
    }
    rebuild(key) {
      const THREE = this.THREE, [x0, z0] = key.split(',').map(Number);
      const chunk = { group: new THREE.Group(), bounds: new THREE.Box3() };
      const buckets = new Map();
      const partBounds = new THREE.Box3();
      const add = (shape, color, x, y, z, sx, sy, sz, cellKey, rotation = 0) => {
        if (sx <= 0 || sy <= 0 || sz <= 0) return;
        const geometry = this.geometry[shape];
        this.dummy.position.set(x, y, z);
        this.dummy.rotation.set(0, rotation, 0);
        this.dummy.scale.set(sx, sy, sz);
        this.dummy.updateMatrix();
        partBounds.copy(geometry.boundingBox).applyMatrix4(this.dummy.matrix);
        chunk.bounds.union(partBounds);
        if (!buckets.has(shape)) buckets.set(shape, []);
        buckets.get(shape).push({ matrix: this.dummy.matrix.clone(), color, key: cellKey });
      };
      for (let x = x0; x < Math.min(this.size, x0 + this.chunkSize); x++) {
        for (let z = z0; z < Math.min(this.size, z0 + this.chunkSize); z++) {
          if (this.options.isDetailed(x, z)) continue;
          this.options.emitCell(x, z, add);
        }
      }
      for (const [shape, parts] of buckets) {
        const mesh = new THREE.InstancedMesh(this.geometry[shape], this.material, parts.length);
        const keys = [];
        parts.forEach((part, i) => {
          mesh.setMatrixAt(i, part.matrix);
          mesh.setColorAt(i, new THREE.Color(part.color));
          keys.push(part.key);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
        mesh.frustumCulled = false; // r128: cull the transformed chunk bounds below, not the unit geometry
        mesh.userData = { isHomeTileInstance: true, isHomeOverview: true, keyAt: keys };
        const raycast = mesh.raycast;
        mesh.raycast = (raycaster, hits) => {
          if (!chunk.group.visible) return;
          this.inverse.copy(this.group.matrixWorld).invert();
          this.ray.copy(raycaster.ray).applyMatrix4(this.inverse);
          if (this.ray.intersectsBox(chunk.bounds)) raycast.call(mesh, raycaster, hits);
        };
        chunk.group.add(mesh);
      }
      const old = this.chunks.get(key);
      if (old) this.clearChunk(old);
      this.chunks.set(key, chunk);
      this.group.add(chunk.group);
    }
    update(camera, budgetMs = 3) {
      const started = performance.now();
      for (const key of this.dirty) {
        this.dirty.delete(key);
        this.rebuild(key);
        if (performance.now() - started >= budgetMs) break;
      }
      camera.updateMatrixWorld();
      this.group.updateWorldMatrix(true, false);
      this.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      this.frustum.setFromProjectionMatrix(this.matrix);
      for (const chunk of this.chunks.values()) {
        this.worldBounds.copy(chunk.bounds).applyMatrix4(this.group.matrixWorld);
        chunk.group.visible = !chunk.bounds.isEmpty() && this.frustum.intersectsBox(this.worldBounds);
      }
    }
    stats() {
      let drawCalls = 0, triangles = 0, instances = 0;
      for (const chunk of this.chunks.values()) if (chunk.group.visible) {
        for (const mesh of chunk.group.children) {
          drawCalls++;
          instances += mesh.count;
          triangles += mesh.count * (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position.count) / 3;
        }
      }
      return { chunks: this.chunks.size, pending: this.dirty.size, drawCalls, triangles, instances };
    }
    dispose() {
      for (const chunk of this.chunks.values()) this.clearChunk(chunk);
      this.group.removeFromParent ? this.group.removeFromParent() : this.options.parent.remove(this.group);
      for (const geometry of Object.values(this.geometry)) geometry.dispose();
      this.material.dispose();
      this.chunks.clear(); this.dirty.clear();
    }
  }
  if (typeof module === 'object' && module.exports) module.exports = HomeWorldLOD;
  else root.HomeWorldLOD = HomeWorldLOD;
})(typeof window === 'object' ? window : globalThis);
