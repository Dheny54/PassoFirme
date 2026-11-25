import React, { useEffect, useRef } from 'react';

/**
 * Live interactive showcase canvas matching the exact geometric aesthetic of the actual game arenas.
 * Responds subtly to cursor hover while demonstrating diagonal movement, beacons, and radar aim.
 */
export const LiveHeroPreview: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const VIEW_W = 640;
    const VIEW_H = 380;

    const beacons = [
      { x: 160, y: 110, id: 1 },
      { x: 470, y: 105, id: 2 },
      { x: 495, y: 275, id: 3 },
      { x: 170, y: 270, id: 4 },
    ];

    let targetIdx = 0;
    const bot = { x: 320, y: 190, vx: 0, vy: 0, angle: 0 };
    const pointer = { x: 470, y: 105, active: false };
    const trail: { x: number; y: number; life: number }[] = [];
    let trailTimer = 0;

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const scale = Math.min(r.width / VIEW_W, r.height / VIEW_H);
      const offX = (r.width - VIEW_W * scale) / 2;
      const offY = (r.height - VIEW_H * scale) / 2;
      pointer.x = (e.clientX - r.left - offX) / scale;
      pointer.y = (e.clientY - r.top - offY) / scale;
      pointer.active = true;
    };

    const onLeave = () => {
      pointer.active = false;
    };

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);

    const resize = () => {
      const r = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(240, Math.floor(r.width * dpr));
      canvas.height = Math.max(160, Math.floor(r.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let rafId = 0;
    let last = performance.now();

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // Autopilot gently glides between beacons; if user hovers, bot aims toward cursor
      const goal = beacons[targetIdx];
      const dx = goal.x - bot.x;
      const dy = goal.y - bot.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 18) {
        targetIdx = (targetIdx + 1) % beacons.length;
      } else {
        const speed = 130;
        bot.vx += ((dx / dist) * speed - bot.vx) * Math.min(1, dt * 6);
        bot.vy += ((dy / dist) * speed - bot.vy) * Math.min(1, dt * 6);
        bot.x += bot.vx * dt;
        bot.y += bot.vy * dt;
      }

      const aimX = pointer.active ? pointer.x : beacons[(targetIdx + 1) % beacons.length].x;
      const aimY = pointer.active ? pointer.y : beacons[(targetIdx + 1) % beacons.length].y;
      bot.angle = Math.atan2(aimY - bot.y, aimX - bot.x);

      trailTimer += dt;
      if (trailTimer > 0.05) {
        trailTimer = 0;
        trail.push({ x: bot.x, y: bot.y, life: 0.45 });
      }
      for (let i = trail.length - 1; i >= 0; i--) {
        trail[i].life -= dt;
        if (trail[i].life <= 0) trail.splice(i, 1);
      }

      // Render with uniform 1:1 scale
      const cw = canvas.width;
      const ch = canvas.height;
      const scale = Math.min(cw / VIEW_W, ch / VIEW_H);
      const offX = (cw - VIEW_W * scale) / 2;
      const offY = (ch - VIEW_H * scale) / 2;

      ctx.fillStyle = '#0B111E';
      ctx.fillRect(0, 0, cw, ch);

      ctx.save();
      ctx.translate(offX, offY);
      ctx.scale(scale, scale);

      // Grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx <= VIEW_W; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, VIEW_H);
        ctx.stroke();
      }
      for (let gy = 0; gy <= VIEW_H; gy += 40) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(VIEW_W, gy);
        ctx.stroke();
      }

      // Beveled cover blocks
      const blocks = [
        { x: 270, y: 155, w: 100, h: 24 },
        { x: 270, y: 205, w: 100, h: 24 },
      ];
      for (const b of blocks) {
        ctx.fillStyle = 'rgba(2, 6, 23, 0.5)';
        ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = '#334155';
        ctx.fillRect(b.x, b.y, b.w, 4);
      }

      // Aim Cone
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(bot.x, bot.y);
      ctx.arc(bot.x, bot.y, 210, bot.angle - 0.18, bot.angle + 0.18);
      ctx.closePath();
      const grad = ctx.createRadialGradient(bot.x, bot.y, 10, bot.x, bot.y, 210);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.24)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();

      // Trail
      for (const t of trail) {
        ctx.globalAlpha = (t.life / 0.45) * 0.45;
        ctx.fillStyle = '#14B8A6';
        ctx.beginPath();
        ctx.arc(t.x, t.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Beacons
      for (let i = 0; i < beacons.length; i++) {
        const b = beacons[i];
        const active = i === targetIdx;
        const pulse = 1 + Math.sin(now * 0.005 + b.id) * 0.1;

        ctx.beginPath();
        ctx.arc(b.x, b.y, (active ? 22 : 16) * pulse, 0, Math.PI * 2);
        ctx.fillStyle = active ? 'rgba(245, 158, 11, 0.2)' : 'rgba(20, 184, 166, 0.14)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = active ? '#F59E0B' : '#14B8A6';
        ctx.stroke();

        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(now * 0.002 + b.id);
        const s = active ? 9 : 7;
        ctx.fillStyle = active ? '#FBBF24' : '#2DD4BF';
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Bot
      ctx.save();
      ctx.translate(bot.x, bot.y);
      ctx.rotate(bot.angle);
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fillStyle = '#0D9488';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#99F6E4';
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.fillRect(5, -4, 14, 8);
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(12, -2.5, 6, 5);
      ctx.restore();

      // Crosshair at aim point
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(aimX, aimY, 9, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[260px] rounded-2xl overflow-hidden border border-slate-800 bg-[#0B111E]"
    >
      <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />
      <div className="pointer-events-none absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300">
        Prévia ao vivo da arena · Mova o mouse sobre o pátio
      </div>
    </div>
  );
};
