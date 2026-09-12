/**
 * Procedural texture factory.
 *
 * Everything the VFX system needs (sparks, dust, rings, shadows, leaves) is
 * painted once into canvas textures at boot. No binary art to ship, no
 * alignment surprises, and the shapes can be tinted per emitter.
 */

/** List of every generated texture key. */
export const FX_TEXTURES = {
  pixel: 'fx-pixel',
  dot: 'fx-dot',
  spark: 'fx-spark',
  ring: 'fx-ring',
  dust: 'fx-dust',
  shard: 'fx-shard',
  shadow: 'fx-shadow',
  flash: 'fx-flash',
  leaf: 'fx-leaf',
  coin: 'fx-coin',
};

function makeCanvas(scene, key, width, height) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) return null;
  return texture;
}

function radial(ctx, cx, cy, radius, inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.45, inner.replace(/,\s*1\)$/, ',0.85)'));
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

/** Creates every texture used by particles / VFX. Returns the key map. */
export function createFxTextures(scene) {
  const keys = FX_TEXTURES;

  // 1x1 white pixel — the workhorse for tinted bars and rects.
  {
    const texture = makeCanvas(scene, keys.pixel, 4, 4);
    if (texture) {
      const ctx = texture.getContext();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 4, 4);
      texture.refresh();
    }
  }

  // Soft round dot (embers, dust motes, generic particles).
  {
    const size = 64;
    const texture = makeCanvas(scene, keys.dot, size, size);
    if (texture) {
      const ctx = texture.getContext();
      radial(ctx, size / 2, size / 2, size / 2);
      texture.refresh();
    }
  }

  // Four point star used for impact sparks.
  {
    const size = 64;
    const texture = makeCanvas(scene, keys.spark, size, size);
    if (texture) {
      const ctx = texture.getContext();
      const c = size / 2;
      const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.4, 'rgba(255,255,255,0.55)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(c, c, c, 0, Math.PI * 2);
      ctx.fill();

      // Cross shaped flare
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.moveTo(c, 2);
      ctx.lineTo(c + 7, c);
      ctx.lineTo(c, size - 2);
      ctx.lineTo(c - 7, c);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(2, c);
      ctx.lineTo(c, c + 5);
      ctx.lineTo(size - 2, c);
      ctx.lineTo(c, c - 5);
      ctx.closePath();
      ctx.fill();
      texture.refresh();
    }
  }

  // Thin ring (shockwaves, block shields).
  {
    const size = 128;
    const texture = makeCanvas(scene, keys.ring, size, size);
    if (texture) {
      const ctx = texture.getContext();
      const c = size / 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(c, c, c - 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c, c, c - 16, 0, Math.PI * 2);
      ctx.stroke();
      texture.refresh();
    }
  }

  // Soft dust puff (landings, footsteps).
  {
    const size = 96;
    const texture = makeCanvas(scene, keys.dust, size, size);
    if (texture) {
      const ctx = texture.getContext();
      const c = size / 2;
      const gradient = ctx.createRadialGradient(c, c, 4, c, c, c);
      gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
      gradient.addColorStop(0.55, 'rgba(255,255,255,0.35)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(c, c, c, 0, Math.PI * 2);
      ctx.fill();
      texture.refresh();
    }
  }

  // Elongated shard (speed lines, debris, slash streaks).
  {
    const w = 96;
    const h = 12;
    const texture = makeCanvas(scene, keys.shard, w, h);
    if (texture) {
      const ctx = texture.getContext();
      const gradient = ctx.createLinearGradient(0, 0, w, 0);
      gradient.addColorStop(0, 'rgba(255,255,255,0)');
      gradient.addColorStop(0.45, 'rgba(255,255,255,0.9)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.quadraticCurveTo(w / 2, 0, w, h / 2);
      ctx.quadraticCurveTo(w / 2, h, 0, h / 2);
      ctx.fill();
      texture.refresh();
    }
  }

  // Soft elliptical drop shadow.
  {
    const w = 192;
    const h = 96;
    const texture = makeCanvas(scene, keys.shadow, w, h);
    if (texture) {
      const ctx = texture.getContext();
      const gradient = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      gradient.addColorStop(0, 'rgba(0,0,0,0.55)');
      gradient.addColorStop(0.6, 'rgba(0,0,0,0.25)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(1, h / w);
      ctx.beginPath();
      ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      texture.refresh();
    }
  }

  // Big soft flash (impact bloom, screen pops).
  {
    const size = 256;
    const texture = makeCanvas(scene, keys.flash, size, size);
    if (texture) {
      const ctx = texture.getContext();
      radial(ctx, size / 2, size / 2, size / 2, 'rgba(255,255,255,0.95)', 'rgba(255,255,255,0)');
      texture.refresh();
    }
  }

  // Leaf for the ambient jungle drift.
  {
    const size = 32;
    const texture = makeCanvas(scene, keys.leaf, size, size);
    if (texture) {
      const ctx = texture.getContext();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(4, 16);
      ctx.quadraticCurveTo(16, 0, 28, 10);
      ctx.quadraticCurveTo(20, 26, 4, 16);
      ctx.fill();
      texture.refresh();
    }
  }

  // Coin / star used for celebration bursts.
  {
    const size = 48;
    const texture = makeCanvas(scene, keys.coin, size, size);
    if (texture) {
      const ctx = texture.getContext();
      const c = size / 2;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const radius = i % 2 === 0 ? c - 2 : (c - 2) * 0.45;
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const x = c + Math.cos(angle) * radius;
        const y = c + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      texture.refresh();
    }
  }

  return keys;
}
