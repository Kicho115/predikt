"use client";

import { useEffect, useRef } from "react";

import styles from "./LandingPage.module.css";

const SQUARE = 2;
const GAP = 1.35;
const CELL = SQUARE + GAP;
const ROWS = 62;
const CYCLE_SECONDS = 22;
const SCROLL_SPAN = 3.1;
const VIEW_WIDTH = 2.55;

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function valueNoise(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const smooth = f * f * (3 - 2 * f);

  return hash(i) * (1 - smooth) + hash(i + 1) * smooth;
}

function fbm(x: number, octaves: number): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;

  for (let o = 0; o < octaves; o += 1) {
    value += amplitude * valueNoise(x * frequency);
    amplitude *= 0.52;
    frequency *= 2.08;
  }

  return value;
}

function financeHeight(u: number): number {
  const macro = fbm(u * 0.72 + 14.5, 4);
  const meso = fbm(u * 2.4 + 6.2, 3) * 0.38;
  const micro = fbm(u * 6.8 + 1.7, 2) * 0.16;

  const spikeA = Math.max(0, valueNoise(u * 11.5 + 2.1) - 0.58);
  const spikeB = Math.max(0, valueNoise(u * 19.2 + 8.4) - 0.72);
  const spikes = (spikeA * spikeA * 2.1 + spikeB * spikeB * 3.2) * 0.55;

  const dipA = Math.max(0, 0.42 - valueNoise(u * 9.3 + 4.6));
  const dipB = Math.max(0, 0.38 - valueNoise(u * 14.8 + 11.2));
  const dips = (dipA * dipA + dipB * dipB) * 0.65;

  const centerValley =
    Math.exp(-Math.pow((u - 0.48) / 0.11, 2)) * 0.22;

  const raw = macro * 0.62 + meso + micro + spikes - dips - centerValley;
  return Math.max(0.07, Math.min(0.93, raw));
}

function scrollPhase(time: number): number {
  return (time / CYCLE_SECONDS) * SCROLL_SPAN;
}

export function HeroTerrain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = parent.clientWidth;
      const height = parent.clientHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (time: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const t = time * 0.001;
      const phase = scrollPhase(t);

      ctx.clearRect(0, 0, width, height);

      const cols = Math.max(2, Math.floor((width - GAP) / CELL));
      const gridWidth = cols * CELL - GAP;
      const offsetX = (width - gridWidth) / 2;
      const rowPitch = (height * 0.9) / ROWS;
      const baseY = height - GAP;

      for (let col = 0; col < cols; col += 1) {
        const screenU = col / (cols - 1);
        const sampleU = screenU * VIEW_WIDTH - phase;
        const graphH = financeHeight(sampleU);
        const surfaceRows = Math.floor(graphH * (ROWS - 12) + 10);

        for (let row = 0; row <= surfaceRows; row += 1) {
          const rowDepth = row / ROWS;
          const layer = row / Math.max(surfaceRows, 1);
          const edgeTrim = Math.floor(rowDepth * rowDepth * cols * 0.2);

          if (col < edgeTrim || col >= cols - edgeTrim) continue;

          const crest = row === surfaceRows ? 0.18 : 0;
          const alpha = 0.26 + layer * 0.48 + graphH * 0.18 + crest;

          const x = offsetX + col * CELL;
          const y = baseY - row * rowPitch;

          if (y + SQUARE < 0 || y > height) continue;

          ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, alpha)})`;
          ctx.fillRect(x, y, SQUARE, SQUARE);
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    resize();
    animationId = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className={styles.heroTerrain} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.heroTerrainCanvas} />
    </div>
  );
}
