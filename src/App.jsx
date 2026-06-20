import { useEffect, useRef, useState } from 'react';
import wordmark from './assets/libeo-logo.svg';
import { analyzeImage } from './lib/imageAnalysis.js';
import { renderLightGraphic } from './lib/lightRenderer.js';
import { ARCHIVE_META } from './archiveMeta.js';

// src/assets/archive/ 폴더의 이미지를 빌드 타임에 자동 수집
// 파일을 추가/삭제하면 dev 서버가 자동으로 반영합니다
const REAL_PHOTO_GLOB = import.meta.glob(
  './assets/archive/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}',
  { eager: true, query: '?url', import: 'default' },
);

// ─── 상수 ────────────────────────────────────────────────────────────────────

const INK_COLORS = [
  [255, 220, 210], [220, 210, 255], [195, 235, 255],
  [255, 210, 230], [200, 255, 240], [255, 240, 195],
  [230, 215, 255], [210, 245, 255],
];

const RIPPLE_COLORS = [
  [220, 210, 255], [255, 220, 210], [195, 235, 255], [255, 210, 230],
];

const FLOW_STEPS = ['browse', 'select', 'feel', 'analyze', 'generate', 'record'];

const EMOTION_KEYWORDS = [
  { id: 'longing',     ko: '그리움',  en: 'longing' },
  { id: 'flutter',     ko: '설렘',    en: 'flutter' },
  { id: 'stillness',   ko: '고요함',  en: 'stillness' },
  { id: 'sadness',     ko: '슬픔',    en: 'sadness' },
  { id: 'warmth',      ko: '따뜻함',  en: 'warmth' },
  { id: 'emptiness',   ko: '공허함',  en: 'emptiness' },
  { id: 'strangeness', ko: '낯섦',    en: 'strangeness' },
  { id: 'anxiety',     ko: '불안',    en: 'anxiety' },
  { id: 'serenity',    ko: '평온',    en: 'serenity' },
  { id: 'bittersweet', ko: '아련함',  en: 'bittersweet' },
];

// ─── 실제 사진 로드 (src/assets/archive/ 폴더) ────────────────────────────────

function buildRealPhotoList() {
  const entries = Object.entries(REAL_PHOTO_GLOB)
    .sort(([a], [b]) => a.localeCompare(b));

  return entries.map(([path, url], idx) => {
    // 파일명에서 슬롯 번호 추출 (예: "01.jpg" → "01")
    const slotMatch = path.match(/(\d+)\.[^.]+$/);
    const slot = slotMatch
      ? slotMatch[1].padStart(2, '0')
      : String(idx + 1).padStart(2, '0');
    const meta = ARCHIVE_META.find(m => m.slot === slot);
    return {
      id: `IMAGE_${slot}`,
      label: meta?.label ?? '',
      src: url,          // 실제 사진 URL
      dataUrl: url,      // analyzeImage() 호환용 (같은 값)
      isReal: true,
    };
  });
}

// ─── 절차적 블러 플레이스홀더 (사진이 없을 때 fallback) ──────────────────────

// 아카이브 이미지 12장의 블러 블롭 정의
const ARCHIVE_SPECS = [
  { blobs: [{ rgb: [140, 100, 210], x: 0.38, y: 0.42, r: 0.38 }, { rgb: [180, 140, 230], x: 0.65, y: 0.58, r: 0.32 }] },
  { blobs: [{ rgb: [210, 100, 140], x: 0.50, y: 0.35, r: 0.40 }, { rgb: [240, 150, 175], x: 0.62, y: 0.65, r: 0.28 }] },
  { blobs: [{ rgb: [80,  130, 210], x: 0.32, y: 0.50, r: 0.36 }, { rgb: [110, 175, 240], x: 0.68, y: 0.40, r: 0.30 }] },
  { blobs: [{ rgb: [80,  170, 130], x: 0.45, y: 0.55, r: 0.38 }, { rgb: [110, 210, 155], x: 0.60, y: 0.30, r: 0.26 }] },
  { blobs: [{ rgb: [200, 150, 75],  x: 0.40, y: 0.45, r: 0.36 }, { rgb: [230, 190, 110], x: 0.65, y: 0.60, r: 0.30 }] },
  { blobs: [{ rgb: [160, 120, 210], x: 0.30, y: 0.38, r: 0.32 }, { rgb: [190, 155, 230], x: 0.60, y: 0.50, r: 0.34 }, { rgb: [145, 105, 195], x: 0.50, y: 0.70, r: 0.24 }] },
  { blobs: [{ rgb: [65,  165, 185], x: 0.42, y: 0.48, r: 0.38 }, { rgb: [95,  205, 215], x: 0.66, y: 0.35, r: 0.28 }] },
  { blobs: [{ rgb: [195, 120, 160], x: 0.50, y: 0.42, r: 0.40 }, { rgb: [170, 100, 140], x: 0.35, y: 0.62, r: 0.30 }] },
  { blobs: [{ rgb: [60,  80,  185], x: 0.38, y: 0.45, r: 0.36 }, { rgb: [95,  115, 215], x: 0.65, y: 0.55, r: 0.32 }] },
  { blobs: [{ rgb: [205, 165, 85],  x: 0.45, y: 0.40, r: 0.34 }, { rgb: [235, 200, 130], x: 0.60, y: 0.62, r: 0.28 }, { rgb: [180, 145, 70], x: 0.30, y: 0.60, r: 0.24 }] },
];

// 분석 패널의 항목 행 정의
const ANALYSIS_ROWS = [
  { label: 'COLOR',          delay: 0    },
  { label: 'BRIGHTNESS',     delay: 550  },
  { label: 'BLUR',           delay: 1100 },
  { label: 'SPREAD',         delay: 1650 },
  { label: 'CORE STRUCTURE', delay: 2200 },
];

// ─── 절차적 아카이브 이미지 생성 ────────────────────────────────────────────────

function generateArchiveImages() {
  return ARCHIVE_SPECS.map((spec, idx) => {
    const size = 320;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0e0b14';
    ctx.fillRect(0, 0, size, size);

    ctx.filter = 'blur(44px)';
    spec.blobs.forEach(blob => {
      const px = blob.x * size;
      const py = blob.y * size;
      const radius = blob.r * size;
      const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
      grad.addColorStop(0,    `rgba(${blob.rgb[0]},${blob.rgb[1]},${blob.rgb[2]},0.60)`);
      grad.addColorStop(0.40, `rgba(${blob.rgb[0]},${blob.rgb[1]},${blob.rgb[2]},0.25)`);
      grad.addColorStop(1,    `rgba(${blob.rgb[0]},${blob.rgb[1]},${blob.rgb[2]},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    });
    ctx.filter = 'none';

    const slot = String(idx + 1).padStart(2, '0');
    const meta = ARCHIVE_META.find(m => m.slot === slot);
    const dataUrl = canvas.toDataURL('image/png');
    return {
      id: `IMAGE_${slot}`,
      label: meta?.label ?? '',
      src: dataUrl,
      dataUrl,
      isReal: false,
    };
  });
}

// ─── InkBg (배경 잉크 인터랙션) ─────────────────────────────────────────────────

function InkBg() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const particles = [];
    const ripples = [];
    let lastX = -1, lastY = -1;
    let lastAmbient = 0;
    let skipMove = false;
    let animId;

    canvas.style.cursor = 'none';

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.fillStyle = '#0e0b14';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 25; i++) {
      particles.push(makeParticle(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        0.04 + Math.random() * 0.05,
      ));
    }

    function makeParticle(x, y, dirX, dirY, forceAlpha) {
      const c = INK_COLORS[Math.floor(Math.random() * INK_COLORS.length)];
      const baseAngle = Math.atan2(dirY || 0, dirX || 0);
      const angle = baseAngle + (Math.random() - 0.5) * 2.4;
      const speed = 0.2 + Math.random() * 0.3;
      return {
        x, y, c,
        r: 20 + Math.random() * 35,
        alpha: forceAlpha ?? (0.07 + Math.random() * 0.09),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        grow: 0.8 + Math.random() * 1.2,
        fade: 0.018 + Math.random() * 0.012,
      };
    }

    function drawParticle(p) {
      const a = Math.max(0, p.alpha);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g.addColorStop(0,   `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${a.toFixed(4)})`);
      g.addColorStop(0.5, `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${(a * 0.3).toFixed(4)})`);
      g.addColorStop(1,   `rgba(${p.c[0]},${p.c[1]},${p.c[2]},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    const dotEl = document.getElementById('cursor-dot');

    function onMouseMove(e) {
      skipMove = !skipMove;
      if (skipMove) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      const speed = Math.hypot(dx, dy);
      if (dotEl) {
        dotEl.style.left = e.clientX + 'px';
        dotEl.style.top = e.clientY + 'px';
        dotEl.style.opacity = '1';
      }
      if (speed > 1.5) {
        const count = Math.min(Math.floor(1 + speed * 0.2), 3);
        if (particles.length > 80) particles.splice(0, particles.length - 80);
        for (let i = 0; i < count; i++) particles.push(makeParticle(e.clientX, e.clientY, dx, dy));
      }
    }
    window.addEventListener('mousemove', onMouseMove);

    function onClick(e) {
      ripples.push({
        x: e.clientX, y: e.clientY, r: 0,
        maxR: Math.max(window.innerWidth, window.innerHeight) * 0.8,
        alpha: 0.18,
        color: RIPPLE_COLORS[Math.floor(Math.random() * RIPPLE_COLORS.length)],
        speed: 8,
      });
    }
    window.addEventListener('click', onClick);

    function loop(timestamp) {
      const W = canvas.width;
      const H = canvas.height;
      ctx.fillStyle = 'rgba(14,11,20,0.12)';
      ctx.fillRect(0, 0, W, H);

      for (let i = ripples.length - 1; i >= 0; i--) {
        const rip = ripples[i];
        ctx.save();
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${rip.color[0]},${rip.color[1]},${rip.color[2]},${rip.alpha})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, Math.max(0, rip.r - 8), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${rip.color[0]},${rip.color[1]},${rip.color[2]},${rip.alpha * 0.4})`;
        ctx.lineWidth = 12;
        ctx.stroke();
        ctx.restore();
        rip.r += rip.speed;
        rip.alpha -= 0.002;
        rip.speed *= 0.995;
        if (rip.alpha <= 0 || rip.r > rip.maxR) ripples.splice(i, 1);
      }

      if (timestamp - lastAmbient > 800) {
        particles.push(makeParticle(
          Math.random() * W, Math.random() * H,
          (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2,
          0.03 + Math.random() * 0.04,
        ));
        lastAmbient = timestamp;
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        drawParticle(p);
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.98; p.vy *= 0.98;
        p.r += p.grow;
        p.alpha -= p.fade;
        if (p.alpha <= 0) particles.splice(i, 1);
      }

      animId = requestAnimationFrame(loop);
    }

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('click', onClick);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas id="ink-bg" ref={canvasRef} />;
}

// ─── ScanCanvas (분석 중 이미지 위에 표시) ──────────────────────────────────────

function ScanCanvas({ active, size = 240 }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!active) return;
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const cycleDuration = 2800;
    const start = performance.now();
    let animId;

    function loop(now) {
      const progress = ((now - start) % cycleDuration) / cycleDuration;
      ctx.clearRect(0, 0, W, H);
      const scanY = progress * H;
      ctx.fillStyle = `rgba(180,150,255,${(progress * 0.09).toFixed(4)})`;
      ctx.fillRect(0, 0, W, scanY);
      const lineH = 20;
      const grad = ctx.createLinearGradient(0, scanY - lineH, 0, scanY + lineH);
      grad.addColorStop(0,   'rgba(217,207,234,0)');
      grad.addColorStop(0.5, 'rgba(217,207,234,0.28)');
      grad.addColorStop(1,   'rgba(217,207,234,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, scanY - lineH, W, lineH * 2);
      animId = requestAnimationFrame(loop);
    }

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [active]);

  return (
    <canvas
      ref={ref}
      className="scan-overlay"
      width={size}
      height={size}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}

// ─── 메인 앱 ─────────────────────────────────────────────────────────────────

export default function App() {
  // phase: 'browse' | 'selected' | 'feeling' | 'analyzing' | 'generating' | 'projecting' | 'archive'
  const [phase, setPhase] = useState('browse');
  const [archiveImages, setArchiveImages] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [rules, setRules] = useState(null);
  const [analyzePercent, setAnalyzePercent] = useState(0);
  const [activeStage, setActiveStage] = useState(0);
  const [statusText, setStatusText] = useState('ZONE 02 — 색의 잔상');
  const [archiveItems, setArchiveItems] = useState([]);
  const [saved, setSaved] = useState(false);
  const [browseStartTime, setBrowseStartTime] = useState(null);
  const [projectionTimestamp, setProjectionTimestamp] = useState('');
  const [sessionDuration, setSessionDuration] = useState(0);
  const [selectedKeywords, setSelectedKeywords] = useState([]);

  const lightBgCanvasRef = useRef(null);
  const coordsRef = useRef(null);
  const genRunRef = useRef(0);
  const percentIntervalRef = useRef(null);

  // 마운트 시: 실제 사진이 있으면 우선 사용, 없으면 절차적 이미지 fallback
  useEffect(() => {
    const real = buildRealPhotoList();
    setArchiveImages(real.length > 0 ? real : generateArchiveImages());
    setBrowseStartTime(Date.now());
  }, []);

  // 마우스 좌표 표시 (DOM 직접 업데이트)
  useEffect(() => {
    function onMove(e) {
      if (!coordsRef.current) return;
      const nx = String(Math.round((e.clientX / window.innerWidth) * 1000)).padStart(4, '0');
      const ny = String(Math.round((e.clientY / window.innerHeight) * 1000)).padStart(4, '0');
      coordsRef.current.textContent = `${nx} / ${ny}`;
    }
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, []);

  // projecting 진입 시 빛 그래픽 렌더링
  useEffect(() => {
    if (phase !== 'projecting' || !rules) return;
    setSaved(false);
    const timeout = setTimeout(() => {
      try {
        if (lightBgCanvasRef.current) {
          renderLightGraphic(lightBgCanvasRef.current, rules, 1);
        }
      } catch (e) { console.error(e); }
    }, 100);
    return () => clearTimeout(timeout);
  }, [phase, rules]);

  const selectedImage = selectedIdx !== null ? archiveImages[selectedIdx] : null;

  // 이미지 선택
  function selectImage(idx) {
    setSelectedIdx(idx);
    setPhase('selected');
    setActiveStage(1);
  }

  // 키워드 선택 단계로
  function goToFeeling() {
    setSelectedKeywords([]);
    setPhase('feeling');
    setActiveStage(2);
    setStatusText('ZONE 02 — 색의 잔상');
  }

  // 키워드 토글 (최대 2개)
  function toggleKeyword(ko) {
    setSelectedKeywords(prev => {
      if (prev.includes(ko)) return prev.filter(k => k !== ko);
      if (prev.length >= 2) return [...prev.slice(1), ko];
      return [...prev, ko];
    });
  }

  // 분석 시작
  async function startAnalysis() {
    if (!selectedImage) return;
    const runId = ++genRunRef.current;
    setPhase('analyzing');
    setActiveStage(3);
    setAnalyzePercent(0);
    setStatusText(`ANALYZING — ${selectedImage.id}`);

    const totalDuration = 5200;
    const startTime = Date.now();

    if (percentIntervalRef.current) clearInterval(percentIntervalRef.current);
    percentIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(Math.round((elapsed / totalDuration) * 100), 99);
      setAnalyzePercent(pct);
      if (pct >= 99) clearInterval(percentIntervalRef.current);
    }, 80);

    const FALLBACK_ANALYSIS = {
      palette: ['#c8b89a', '#8a9aac', '#4a4a56', '#d4c8b8'],
      paletteWeights: [0.35, 0.28, 0.22, 0.15],
      lightOrigin: { x: 0.5, y: 0.38 },
      brightRegions: [{ x: 0.5, y: 0.38, brightness: 0.7, size: 0.12, strength: 0.6, color: '#c8b89a' }],
      structureAnchors: [],
      averageBrightness: 0.42,
      blurDensity: 0.65,
      motionDirection: { angle: 0, label: 'horizontal drift' },
      structure: { compositionType: 'abstract / unclear', dominantAxis: 'balanced / scattered', shapeEnergy: 'wave-like', spatialWeight: 'centered', balance: { x: 0.5, y: 0.5 }, concentration: 0.4, distribution: 0.5, geometricRhythm: 0.3, diagonalDominance: 0.3, horizontalDominance: 0.5, radialDominance: 0.3, repetition: 0.2, verticalDominance: 0.5 },
    };

    try {
      let analysis;
      try {
        [analysis] = await Promise.all([
          analyzeImage(selectedImage.dataUrl),
          new Promise(r => setTimeout(r, totalDuration)),
        ]);
      } catch (imgErr) {
        console.warn('analyzeImage failed, using fallback:', imgErr);
        await new Promise(r => setTimeout(r, totalDuration));
        analysis = FALLBACK_ANALYSIS;
      }

      if (genRunRef.current !== runId) return;
      clearInterval(percentIntervalRef.current);
      setAnalyzePercent(100);
      setRules({ ...analysis, emotionKeywords: selectedKeywords });

      // generating 단계로 전환
      setTimeout(() => {
        if (genRunRef.current !== runId) return;
        setPhase('generating');
        setActiveStage(4);
        setAnalyzePercent(0);
        setStatusText(`GENERATING — ${selectedImage.id}`);

        const genStart = Date.now();
        const genDuration = 2500;
        const genInterval = setInterval(() => {
          const elapsed = Date.now() - genStart;
          const pct = Math.min(Math.round((elapsed / genDuration) * 100), 99);
          setAnalyzePercent(pct);
          if (pct >= 99) clearInterval(genInterval);
        }, 80);

        setTimeout(() => {
          if (genRunRef.current !== runId) return;
          clearInterval(genInterval);
          setAnalyzePercent(100);

          const now = new Date();
          const ts = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          const dur = Math.round((Date.now() - (browseStartTime || Date.now())) / 1000);

          setProjectionTimestamp(ts);
          setSessionDuration(dur);
          setStatusText(`RECORD SAVED — ${ts}`);
          setActiveStage(5);

          setTimeout(() => {
            if (genRunRef.current === runId) setPhase('projecting');
          }, 400);
        }, genDuration);
      }, 600);

    } catch (err) {
      console.error(err);
      if (genRunRef.current === runId) {
        clearInterval(percentIntervalRef.current);
        setStatusText('ZONE 02 — 색의 잔상');
        setPhase('feeling');
      }
    }
  }

  function saveToArchive() {
    const canvas = lightBgCanvasRef.current;
    if (!canvas) return;
    const offscreen = document.createElement('canvas');
    offscreen.width = 500;
    offscreen.height = 500;
    const offCtx = offscreen.getContext('2d');
    offCtx.drawImage(canvas, 0, 0, 500, 500);
    const dataUrl = offscreen.toDataURL('image/jpeg', 0.6);
    const existing = JSON.parse(localStorage.getItem('libeo-archive') || '[]');
    const entry = {
      id: Date.now(),
      dataUrl,
      createdAt: new Date().toISOString(),
      emotion: selectedKeywords,
      palette: rules?.palette?.slice(0, 3) ?? [],
      brightness: rules ? Math.round(rules.averageBrightness * 100) : null,
      blur: rules ? Math.round(rules.blurDensity * 100) : null,
      spread: rules ? Math.round((rules.structure?.distribution ?? 0) * 100) : null,
    };
    try {
      const updated = [entry, ...existing].slice(0, 30);
      localStorage.setItem('libeo-archive', JSON.stringify(updated));
    } catch (e) { console.error(e); }
    setSaved(true);
  }

  function deleteArchiveItem(id) {
    const updated = archiveItems.filter(item => item.id !== id);
    setArchiveItems(updated);
    try {
      localStorage.setItem('libeo-archive', JSON.stringify(updated));
    } catch (e) { console.error(e); }
  }

  function goToBrowse() {
    setPhase('browse');
    setSelectedIdx(null);
    setActiveStage(0);
    setStatusText('ZONE 02 — 색의 잔상');
    setBrowseStartTime(Date.now());
    setSelectedKeywords([]);
  }

  const vis = p => phase === p;
  const isBrowsing = phase === 'browse' || phase === 'selected';
  const isFeeling = phase === 'feeling';
  const isAnalyzing = phase === 'analyzing' || phase === 'generating';

  return (
    <>
      {/* 커서 dot */}
      <div id="cursor-dot" className="cursor-dot" />

      {/* 잉크 인터랙션 배경 */}
      <InkBg />

      {/* 상단 네비게이션 */}
      <nav className="top-nav">
        <button className="wordmark-link" onClick={goToBrowse} aria-label="home">
          <span className="wordmark-text">UNANSWERED</span>
        </button>
        <span className="nav-status">{statusText}</span>
        <button
          className="archive-nav-btn"
          onClick={() => {
            const items = JSON.parse(localStorage.getItem('libeo-archive') || '[]');
            setArchiveItems(items);
            setPhase('archive');
          }}
        >
          archive
        </button>
      </nav>

      {/* ── STEP 01 + 02: 아카이브 탐색 / 이미지 선택 ── */}
      <div className={`phase-screen browse-screen${isBrowsing ? ' phase-in' : ''}`}>
        <p className="browse-hint">단서처럼 느껴지는 이미지를 선택하세요</p>
        <div className="archive-grid">
          {archiveImages.map((img, idx) => (
            <button
              key={img.id}
              className={`archive-cell${selectedIdx === idx ? ' archive-cell--selected' : ''}${selectedIdx !== null && selectedIdx !== idx ? ' archive-cell--dimmed' : ''}`}
              onClick={() => selectImage(idx)}
              aria-label={img.id}
            >
              <img src={img.src} alt={img.id} className="archive-cell-img" />
              <div className="archive-cell-caption">
                <span className="archive-cell-num">{img.id.replace('IMAGE_', '')}</span>
                {img.label && <span className="archive-cell-title">{img.label}</span>}
              </div>
            </button>
          ))}
        </div>
        {vis('selected') && (
          <button className="pill-btn analyze-start-btn" onClick={goToFeeling}>
            이 사진 선택하기 →
          </button>
        )}
      </div>

      {/* ── STEP 03: 감정 키워드 선택 ── */}
      <div className={`phase-screen feeling-screen${isFeeling ? ' phase-in' : ''}`}>
        {selectedImage && (
          <div className="feeling-layout">
            <div className="feeling-image-wrap">
              <img src={selectedImage.src} alt="selected" className="feeling-preview-img" />
              <p className="feeling-img-label">{selectedImage.label}</p>
            </div>
            <div className="feeling-right">
              <p className="feeling-title">이 사진에서 어떤 감정이 느껴지나요?</p>
              <p className="feeling-subtitle">최대 2개까지 선택할 수 있어요</p>
              <div className="keyword-grid">
                {EMOTION_KEYWORDS.map(kw => (
                  <button
                    key={kw.id}
                    className={`keyword-chip${selectedKeywords.includes(kw.ko) ? ' keyword-chip--selected' : ''}`}
                    onClick={() => toggleKeyword(kw.ko)}
                  >
                    <span className="keyword-chip-ko">{kw.ko}</span>
                    <span className="keyword-chip-en">{kw.en}</span>
                  </button>
                ))}
              </div>
              <button
                className="pill-btn feeling-next-btn"
                onClick={startAnalysis}
                disabled={selectedKeywords.length === 0}
              >
                {selectedKeywords.length === 0 ? '감정을 선택하세요' : `빛 생성 시작 — ${selectedKeywords.join(' · ')} →`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── STEP 04 + 05: 분석 / 생성 프로세스 ── */}
      <div className={`phase-screen${isAnalyzing ? ' phase-in' : ''}`}>
        {selectedImage && (
          <div className="analysis-layout">
            {/* 왼쪽: 선택 이미지 + 스캔 오버레이 */}
            <div className="analysis-image-wrap">
              <img src={selectedImage.src} alt="selected" className="analysis-img" />
              <ScanCanvas active={isAnalyzing} size={240} />
            </div>

            {/* 오른쪽: 분석 패널 */}
            <div className="analysis-panel">
              <p className="analysis-panel-title">
                {phase === 'generating' ? 'GENERATING LIGHT GRAPHIC...' : 'ANALYZING IMAGE...'}
              </p>
              <div className="analysis-rows" key={phase}>
                {ANALYSIS_ROWS.map((row) => (
                  <div key={row.label} className="analysis-row">
                    <span className="analysis-row-label">{row.label}</span>
                    <div className="analysis-bar-track">
                      <div
                        className={`analysis-bar-fill analysis-bar-fill--${phase}`}
                        style={{
                          animationDelay: `${phase === 'generating'
                            ? Math.round(row.delay * 0.22)
                            : row.delay}ms`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="analysis-percent-row">
                <span className="analysis-percent-num">{analyzePercent}%</span>
                <div className="analysis-percent-bar-track">
                  <div
                    className="analysis-percent-bar-fill"
                    style={{ width: `${analyzePercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 풀스크린 빛 그래픽 캔버스 — projecting 단계에서만 표시 */}
      <canvas
        ref={lightBgCanvasRef}
        id="light-bg-canvas"
        width={1000}
        height={1000}
        aria-hidden="true"
        className={`light-bg-canvas${vis('projecting') ? ' light-bg-canvas--visible' : ''}`}
      />

      {/* ── STEP 05: 빛 그래픽 투사 + 기록 ── */}
      <div className={`phase-screen projecting-screen${vis('projecting') ? ' phase-in' : ''}`}>
        {rules && selectedImage && (
          <div className="record-card">
            <p className="record-card-title">RECORD SAVED</p>
            <div className="record-card-row">
              <span className="record-card-label">SELECTED IMAGE</span>
              <img src={selectedImage.src} alt="selected" className="record-card-thumb" />
            </div>
            {selectedKeywords.length > 0 && (
              <div className="record-card-row">
                <span className="record-card-label">EMOTION</span>
                <span className="record-card-value">{selectedKeywords.join(' · ')}</span>
              </div>
            )}
            <div className="record-card-row">
              <span className="record-card-label">MAIN COLOR</span>
              <div className="record-card-dots">
                {(rules.palette || []).slice(0, 3).map((hex, i) => (
                  <span key={i} className="record-card-dot" style={{ background: hex }} />
                ))}
              </div>
            </div>
            <div className="record-card-row">
              <span className="record-card-label">BRIGHTNESS</span>
              <span className="record-card-value">{Math.round(rules.averageBrightness * 100)}%</span>
            </div>
            <div className="record-card-row">
              <span className="record-card-label">BLUR</span>
              <span className="record-card-value">{Math.round(rules.blurDensity * 100)}%</span>
            </div>
            <div className="record-card-row">
              <span className="record-card-label">SPREAD</span>
              <span className="record-card-value">{Math.round((rules.structure?.distribution ?? 0) * 100)}%</span>
            </div>
            <div className="record-card-row">
              <span className="record-card-label">DURATION</span>
              <span className="record-card-value">{sessionDuration}s</span>
            </div>
            <div className="record-card-row">
              <span className="record-card-label">TIMESTAMP</span>
              <span className="record-card-value record-card-ts">{projectionTimestamp}</span>
            </div>
          </div>
        )}
        <div className="projecting-btns">
          <button
            className="pill-btn"
            onClick={saveToArchive}
            disabled={saved}
          >
            {saved ? 'Saved ✓' : 'Save to Archive'}
          </button>
          <button className="pill-btn" onClick={goToBrowse}>
            다른 단서 탐색 →
          </button>
        </div>
      </div>

      {/* ── Archive 뷰 ── */}
      <div className={`phase-screen archive-phase${vis('archive') ? ' phase-in' : ''}`}>
        <div className="archive-phase-header">
          <button className="archive-back-btn" onClick={goToBrowse}>← back</button>
          <h2 className="archive-phase-title">
            archive — {archiveItems.length} records
          </h2>
        </div>
        {archiveItems.length === 0 ? (
          <p className="archive-empty">no records yet</p>
        ) : (
          <div className="archive-phase-grid">
            {archiveItems.map((item) => (
              <div key={item.id} className="archive-phase-item">
                <img src={item.dataUrl} className="archive-phase-img" alt="" />

                {/* 삭제 버튼 */}
                <button
                  className="archive-delete-btn"
                  onClick={() => deleteArchiveItem(item.id)}
                  aria-label="delete"
                >×</button>

                {/* 호버 시 분석 결과 */}
                <div className="archive-hover-info">
                  {item.emotion?.length > 0 && (
                    <div className="archive-info-row">
                      <span className="archive-info-label">감정</span>
                      <span className="archive-info-value">{item.emotion.join(' · ')}</span>
                    </div>
                  )}
                  {item.palette?.length > 0 && (
                    <div className="archive-info-row">
                      <span className="archive-info-label">색상</span>
                      <span className="archive-info-dots">
                        {item.palette.map((hex, i) => (
                          <span key={i} className="archive-info-dot" style={{ background: hex }} />
                        ))}
                      </span>
                    </div>
                  )}
                  {item.brightness != null && (
                    <div className="archive-info-row">
                      <span className="archive-info-label">밝기</span>
                      <span className="archive-info-value">{item.brightness}%</span>
                    </div>
                  )}
                  {item.blur != null && (
                    <div className="archive-info-row">
                      <span className="archive-info-label">블러</span>
                      <span className="archive-info-value">{item.blur}%</span>
                    </div>
                  )}
                  {item.spread != null && (
                    <div className="archive-info-row">
                      <span className="archive-info-label">확산</span>
                      <span className="archive-info-value">{item.spread}%</span>
                    </div>
                  )}
                  <div className="archive-info-row">
                    <span className="archive-info-label">저장</span>
                    <span className="archive-info-value archive-info-date">
                      {new Date(item.createdAt).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <button
                    className="archive-download-btn"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.download = `unanswered-${item.id}.jpg`;
                      link.href = item.dataUrl;
                      link.click();
                    }}
                  >
                    download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 하단 바 */}
      <footer className="bottom-bar">
        <ol className="step-list">
          {FLOW_STEPS.map((step, i) => (
            <li key={step} className={i === activeStage ? 'step-active' : ''}>
              <span>{String(i + 1).padStart(2, '0')} {step}</span>
            </li>
          ))}
        </ol>
        <span className="cursor-coords" ref={coordsRef} aria-hidden="true">0000 / 0000</span>
      </footer>
    </>
  );
}
