/* ─────────────────────────────────────────────────────────────
   geometry.js
   Parametric form generation. Three distinct topologies built
   from pure mathematical functions. No loaded models.

   Each generator returns a THREE.BufferGeometry. The vertex
   positions are computed from parametric equations of (u, v)
   over the domain [0,1] × [0,1], then perturbed by a noise
   function controlled by `deform`.
   ───────────────────────────────────────────────────────────── */

import * as THREE from 'three';

const TAU = Math.PI * 2;

/* Smooth pseudo-noise — a cheap deterministic perturbation.
   Not Perlin-quality, but stable and parameter-driven so
   identical inputs always yield identical forms (important
   for export reproducibility). */
function noise3(x, y, z) {
  const s = Math.sin(x * 1.7 + y * 2.3 + z * 1.1) * 0.5;
  const t = Math.cos(x * 2.9 - y * 1.3 + z * 2.7) * 0.3;
  const u = Math.sin((x + y + z) * 3.7) * 0.2;
  return s + t + u;
}

/* ─────────────────────────────────────────────────────────────
   1. TWISTED TORUS
   A torus whose tube is twisted around its sweep axis.

   Parametric equations (u, v ∈ [0, 2π]):
     x(u,v) = (R + r·cos(v + τu)) · cos(u)
     y(u,v) = (R + r·cos(v + τu)) · sin(u)
     z(u,v) = r · sin(v + τu) + h·sin(2u)

   where:
     R  = main sweep radius (params.radius)
     r  = tube radius (derived: radius * 0.4)
     τ  = twist angle (params.twist)
     h  = vertical modulation (params.height fraction)
   ───────────────────────────────────────────────────────────── */
export function buildTwistedTorus(params) {
  const segU = params.segments;
  const segV = Math.max(8, Math.floor(params.density * 0.6));

  const R = params.radius;
  const r = params.radius * 0.4;
  const twist = params.twist;
  const heightMod = params.height * 0.25;
  const deform = params.deform;

  const positions = [];
  const indices = [];
  const normals = [];

  for (let i = 0; i <= segU; i++) {
    const u = (i / segU) * TAU;
    for (let j = 0; j <= segV; j++) {
      const v = (j / segV) * TAU;
      const vTwist = v + twist * (u / TAU);

      // Base torus
      let x = (R + r * Math.cos(vTwist)) * Math.cos(u);
      let y = (R + r * Math.cos(vTwist)) * Math.sin(u);
      let z = r * Math.sin(vTwist) + heightMod * Math.sin(2 * u);

      // Deformation field
      if (deform > 0) {
        const n = noise3(x, y, z) * deform;
        x += n * Math.cos(u) * 0.3;
        y += n * Math.sin(u) * 0.3;
        z += n * 0.4;
      }

      positions.push(x, y, z);
    }
  }

  // Build indices for triangulated surface
  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * (segV + 1) + j;
      const b = (i + 1) * (segV + 1) + j;
      const c = (i + 1) * (segV + 1) + (j + 1);
      const d = i * (segV + 1) + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.center();
  return geo;
}

/* ─────────────────────────────────────────────────────────────
   2. MÖBIUS-INSPIRED RIBBON
   A Möbius strip extended into a ribbon with vertical extrusion
   and width modulation, producing a single-sided architectural
   surface.

   Parametric equations (u ∈ [0, 2π], v ∈ [-w, w]):
     x(u,v) = (R + v·cos(u/2)) · cos(u)
     y(u,v) = (R + v·cos(u/2)) · sin(u)
     z(u,v) = v · sin(u/2) · n_loops + h·sin(u·n_loops)

   The number of half-twists is derived from twist; multiple
   turns produce extended Möbius generalizations.
   ───────────────────────────────────────────────────────────── */
export function buildMobius(params) {
  const segU = params.segments;
  const segV = Math.max(4, Math.floor(params.density * 0.3));

  const R = params.radius;
  const w = params.radius * 0.6;            // ribbon half-width
  const nLoops = Math.max(0.5, params.twist / Math.PI); // half-twists
  const heightMod = params.height * 0.4;
  const deform = params.deform;

  const positions = [];
  const indices = [];

  for (let i = 0; i <= segU; i++) {
    const u = (i / segU) * TAU;
    for (let j = 0; j <= segV; j++) {
      const t = j / segV;
      const v = (t - 0.5) * 2 * w;

      const halfU = (u / 2) * nLoops;

      let x = (R + v * Math.cos(halfU)) * Math.cos(u);
      let y = (R + v * Math.cos(halfU)) * Math.sin(u);
      let z = v * Math.sin(halfU) + heightMod * Math.sin(u * nLoops);

      if (deform > 0) {
        const n = noise3(x * 1.5, y * 1.5, z * 1.5) * deform;
        x += n * 0.25;
        y += n * 0.25;
        z += n * 0.4;
      }

      positions.push(x, y, z);
    }
  }

  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * (segV + 1) + j;
      const b = (i + 1) * (segV + 1) + j;
      const c = (i + 1) * (segV + 1) + (j + 1);
      const d = i * (segV + 1) + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.center();
  return geo;
}

/* ─────────────────────────────────────────────────────────────
   3. PROCEDURAL LATTICE
   A vertical helical lattice — two interlocking helices joined
   by horizontal struts, producing a structural diagrid common
   in tall-building exoskeletons (think Hearst Tower, Gherkin).

   For each strut endpoint:
     x(t,k) = R(t) · cos(τ·t·n + k·π + s(t))
     y(t,k) = R(t) · sin(τ·t·n + k·π + s(t))
     z(t)   = h · (t - 0.5)

   where R(t) tapers via params.deform, n = twist count,
   k ∈ {0, 1} indexes the two opposing helices.
   ───────────────────────────────────────────────────────────── */
export function buildLattice(params) {
  const rings = Math.max(8, Math.floor(params.segments / 4));
  const helices = 2 + Math.floor(params.density / 20);  // 2..7 strands
  const R0 = params.radius;
  const H = params.height * 1.5;
  const twistN = params.twist / TAU;     // full revolutions
  const deform = params.deform;

  const positions = [];
  const indices = [];
  const tubeRadius = 0.04 + params.radius * 0.015;
  const tubeSeg = 6;

  // Pre-compute the helix points
  const helixPoints = [];
  for (let k = 0; k < helices; k++) {
    const helix = [];
    for (let t = 0; t <= rings; t++) {
      const ti = t / rings;
      // Tapered radius — barrel curve
      const taper = 1 - deform * 0.6 * Math.pow(2 * ti - 1, 2);
      const R = R0 * taper;
      const angle = TAU * ti * twistN + (k / helices) * TAU + deform * Math.sin(ti * Math.PI * 4) * 0.3;
      const x = R * Math.cos(angle);
      const y = R * Math.sin(angle);
      const z = H * (ti - 0.5);
      helix.push(new THREE.Vector3(x, y, z));
    }
    helixPoints.push(helix);
  }

  // Build tubes along each helix segment & connecting struts
  const segments = [];

  // Helix segments
  for (let k = 0; k < helices; k++) {
    for (let t = 0; t < rings; t++) {
      segments.push([helixPoints[k][t], helixPoints[k][t + 1]]);
    }
  }

  // Cross-bracing: connect adjacent helices at each ring
  for (let t = 0; t <= rings; t++) {
    for (let k = 0; k < helices; k++) {
      const next = (k + 1) % helices;
      segments.push([helixPoints[k][t], helixPoints[next][t]]);
    }
  }

  // Tessellate each segment as a tube (cylinder)
  let vertOffset = 0;
  for (const [p1, p2] of segments) {
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    if (len < 1e-6) continue;
    dir.normalize();

    // Build orthonormal basis around dir
    const up = Math.abs(dir.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const side = new THREE.Vector3().crossVectors(dir, up).normalize();
    const up2 = new THREE.Vector3().crossVectors(side, dir).normalize();

    for (let s = 0; s < tubeSeg; s++) {
      const a = (s / tubeSeg) * TAU;
      const cs = Math.cos(a) * tubeRadius;
      const sn = Math.sin(a) * tubeRadius;

      // start ring vertex
      positions.push(
        p1.x + side.x * cs + up2.x * sn,
        p1.y + side.y * cs + up2.y * sn,
        p1.z + side.z * cs + up2.z * sn
      );
      // end ring vertex
      positions.push(
        p2.x + side.x * cs + up2.x * sn,
        p2.y + side.y * cs + up2.y * sn,
        p2.z + side.z * cs + up2.z * sn
      );
    }

    // Indices: connect ring s to ring s+1, two triangles per quad
    for (let s = 0; s < tubeSeg; s++) {
      const sNext = (s + 1) % tubeSeg;
      const a = vertOffset + s * 2;
      const b = vertOffset + s * 2 + 1;
      const c = vertOffset + sNext * 2 + 1;
      const d = vertOffset + sNext * 2;
      indices.push(a, b, c, a, c, d);
    }

    vertOffset += tubeSeg * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.center();
  return geo;
}

/* ─────────────────────────────────────────────────────────────
   Dispatcher
   ───────────────────────────────────────────────────────────── */
export const FORMS = {
  twistedTorus: { name: 'Twisted Torus', build: buildTwistedTorus },
  mobius:       { name: 'Möbius Ribbon', build: buildMobius },
  lattice:      { name: 'Helical Lattice', build: buildLattice }
};

export function buildForm(formKey, params) {
  const form = FORMS[formKey] || FORMS.twistedTorus;
  return form.build(params);
}
