/* ─────────────────────────────────────────────────────────────
   controls.js
   Wires the DOM control panel to the parameter state. Handles:
   - Slider input → param updates → form rebuild
   - Topology / render-mode segmented controls
   - Presets (tower / lattice / twist)
   - Randomise (parameter exploration)
   - Export to .OBJ and .STL
   ───────────────────────────────────────────────────────────── */

import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

/* Default parameter set — also acts as the "reset" target. */
export const DEFAULT_PARAMS = Object.freeze({
  form: 'twistedTorus',
  segments: 120,
  twist: Math.PI * 2.5,    // 2.5π
  height: 3.0,
  radius: 1.4,
  deform: 0.3,
  density: 40,
  mode: 'wireframe',
  autoRotate: true
});

/* Preset configurations — each tells a story.
   Tower: vertical, lattice topology, tight twist.
   Lattice: dense diagrid, moderate height.
   Twist: extreme torsion on the torus. */
export const PRESETS = {
  tower: {
    form: 'lattice',
    segments: 160,
    twist: Math.PI * 1.5,
    height: 6.5,
    radius: 1.1,
    deform: 0.45,
    density: 60
  },
  lattice: {
    form: 'lattice',
    segments: 220,
    twist: Math.PI * 0.8,
    height: 4.0,
    radius: 1.6,
    deform: 0.25,
    density: 80
  },
  twist: {
    form: 'twistedTorus',
    segments: 280,
    twist: Math.PI * 4,
    height: 2.0,
    radius: 1.5,
    deform: 0.6,
    density: 50
  }
};

/* Format helpers for the value displays */
function fmt(key, val) {
  switch (key) {
    case 'twist':
      return `${(val / Math.PI).toFixed(2)}π`;
    case 'segments':
    case 'density':
      return `${Math.round(val)}`;
    default:
      return val.toFixed(2);
  }
}

const SLIDER_KEYS = ['segments', 'twist', 'height', 'radius', 'deform', 'density'];

export class Controls {
  constructor(params, callbacks) {
    this.params = params;
    this.cb = callbacks; // { onParamChange, onFormChange, onModeChange, onAutoRotate, getMesh }

    this._wireSliders();
    this._wireFormSeg();
    this._wireModeSeg();
    this._wirePresets();
    this._wireActions();
    this._wirePanelCollapse();

    this.syncFromParams();
  }

  /* Push current params into all DOM controls */
  syncFromParams() {
    for (const key of SLIDER_KEYS) {
      const slider = document.getElementById(`s-${key}`);
      const out = document.getElementById(`o-${key}`);
      if (slider && out) {
        slider.value = this.params[key];
        out.textContent = fmt(key, this.params[key]);
      }
    }

    // Form segmented
    document.querySelectorAll('#form-seg .seg__btn').forEach(b => {
      b.classList.toggle('is-active', b.dataset.form === this.params.form);
    });
    // Mode segmented
    document.querySelectorAll('#mode-seg .seg__btn').forEach(b => {
      b.classList.toggle('is-active', b.dataset.mode === this.params.mode);
    });
    // Auto-rotate checkbox
    document.getElementById('auto-rotate').checked = this.params.autoRotate;
  }

  _wireSliders() {
    for (const key of SLIDER_KEYS) {
      const slider = document.getElementById(`s-${key}`);
      const out = document.getElementById(`o-${key}`);
      slider.addEventListener('input', e => {
        const val = parseFloat(e.target.value);
        this.params[key] = val;
        out.textContent = fmt(key, val);
        this.cb.onParamChange();
      });
    }
  }

  _wireFormSeg() {
    document.querySelectorAll('#form-seg .seg__btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const form = btn.dataset.form;
        if (form === this.params.form) return;
        this.params.form = form;
        document.querySelectorAll('#form-seg .seg__btn').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.cb.onFormChange();
      });
    });
  }

  _wireModeSeg() {
    document.querySelectorAll('#mode-seg .seg__btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (mode === this.params.mode) return;
        this.params.mode = mode;
        document.querySelectorAll('#mode-seg .seg__btn').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.cb.onModeChange();
      });
    });
  }

  _wirePresets() {
    document.querySelectorAll('.preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const presetKey = btn.dataset.preset;
        const preset = PRESETS[presetKey];
        if (!preset) return;

        Object.assign(this.params, preset);
        this.syncFromParams();
        this.cb.onFormChange();

        // Subtle feedback
        btn.animate(
          [
            { borderColor: 'var(--teal)' },
            { borderColor: 'var(--rule)' }
          ],
          { duration: 600, easing: 'ease-out' }
        );
      });
    });
  }

  _wireActions() {
    // Auto-rotate
    document.getElementById('auto-rotate').addEventListener('change', e => {
      this.params.autoRotate = e.target.checked;
      this.cb.onAutoRotate();
    });

    // Randomise
    document.getElementById('btn-randomize').addEventListener('click', () => {
      const r = (min, max) => min + Math.random() * (max - min);
      const forms = ['twistedTorus', 'mobius', 'lattice'];
      this.params.form = forms[Math.floor(Math.random() * forms.length)];
      this.params.segments = Math.round(r(60, 300));
      this.params.twist = r(0, Math.PI * 4);
      this.params.height = r(1, 6);
      this.params.radius = r(0.8, 2.5);
      this.params.deform = r(0.05, 0.9);
      this.params.density = Math.round(r(20, 90));
      this.syncFromParams();
      this.cb.onFormChange();
    });

    // Reset
    document.getElementById('btn-reset').addEventListener('click', () => {
      Object.assign(this.params, DEFAULT_PARAMS);
      this.syncFromParams();
      this.cb.onFormChange();
    });

    // Export OBJ
    document.getElementById('btn-export-obj').addEventListener('click', () => {
      const mesh = this.cb.getMesh();
      if (!mesh) return;
      const exporter = new OBJExporter();
      const data = exporter.parse(mesh);
      this._download(data, `parametric-form-${Date.now()}.obj`, 'text/plain');
    });

    // Export STL
    document.getElementById('btn-export-stl').addEventListener('click', () => {
      const mesh = this.cb.getMesh();
      if (!mesh) return;
      const exporter = new STLExporter();
      const data = exporter.parse(mesh);
      this._download(data, `parametric-form-${Date.now()}.stl`, 'text/plain');
    });
  }

  _wirePanelCollapse() {
    const btn = document.getElementById('panel-collapse');
    const panel = document.getElementById('panel');
    btn.addEventListener('click', () => {
      panel.classList.toggle('is-collapsed');
    });
  }

  _download(data, filename, mime) {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}
