import { useEffect, useRef, useState } from 'react';
import wordmark from './assets/libeo-logo.svg';
import { analyzeImage } from './lib/imageAnalysis.js';
import { renderLightGraphic } from './lib/lightRenderer.js';
// ─── 상수 ────────────────────────────────────────────────────────────────────

// 잉크 파티클에 사용할 색상 팔레트 (보라, 라벤더, 핑크, 스카이블루 계열)
const INK_COLORS = [
  [255, 220, 210],  // peach
  [220, 210, 255],  // lavender
  [195, 235, 255],  // ice blue
  [255, 210, 230],  // rose pink
  [200, 255, 240],  // mint
  [255, 240, 195],  // cream yellow
  [230, 215, 255],  // soft violet
  [210, 245, 255],  // periwinkle
];

const RIPPLE_COLORS = [
  [220, 210, 255],  // lavender
  [255, 220, 210],  // peach
  [195, 235, 255],  // ice blue
  [255, 210, 230],  // rose pink
];

// 하단 바에 표시할 단계 이름
const FLOW_STEPS = ['upload', 'extract', 'transform', 'generate', 'archive'];

// ─── 배경 캔버스 (잉크 인터랙션) ──────────────────────────────────────────────

function InkBg({ phase }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const particles = []; // 현재 화면에 살아있는 파티클 목록
    const ripples = [];
    let lastX = -1, lastY = -1; // 이전 마우스 위치 (속도 계산용)
    let lastAmbient = 0; // 마지막 주변 파티클 생성 시각
    let skipMove = false; // mousemove 이벤트 절반만 처리 (성능 최적화)
    let animId;

    // 이 캔버스 위에서만 기본 커서 숨기기
    canvas.style.cursor = 'none';

    // 창 크기에 맞게 캔버스 크기 조정
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

    // 파티클 하나 생성
    // x, y: 생성 위치 / dirX, dirY: 이동 방향 / forceAlpha: 강제 투명도
    function makeParticle(x, y, dirX, dirY, forceAlpha) {
      const c = INK_COLORS[Math.floor(Math.random() * INK_COLORS.length)];
      const baseAngle = Math.atan2(dirY || 0, dirX || 0);
      const angle = baseAngle + (Math.random() - 0.5) * 2.4; // 방향에서 ±약 140도 범위로 퍼짐
      const speed = 0.2 + Math.random() * 0.3;
      return {
        x, y, c,
        r: 20 + Math.random() * 35,       // 초기 반지름 (20~55px)
        alpha: forceAlpha ?? (0.07 + Math.random() * 0.09), // 초기 투명도
        vx: Math.cos(angle) * speed,       // X 속도
        vy: Math.sin(angle) * speed,       // Y 속도
        grow: 0.8 + Math.random() * 1.2,  // 매 프레임 반지름 증가량
        fade: 0.018 + Math.random() * 0.012, // 매 프레임 투명도 감소량
      };
    }

    // 파티클 하나를 캔버스에 그리기 (방사형 그라디언트)
    function drawParticle(p) {
      const a = Math.max(0, p.alpha);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g.addColorStop(0,   `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${a.toFixed(4)})`);        // 중심: 불투명
      g.addColorStop(0.5, `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${(a * 0.3).toFixed(4)})`); // 중간: 30%
      g.addColorStop(1,   `rgba(${p.c[0]},${p.c[1]},${p.c[2]},0)`);                       // 가장자리: 투명
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 커서 dot 요소를 한 번만 가져옴 (매번 DOM 탐색 방지)
    const dotEl = document.getElementById('cursor-dot');

    function onMouseMove(e) {
      // 매 이벤트마다 처리하지 않고 하나씩 건너뜀 (성능 최적화)
      skipMove = !skipMove;
      if (skipMove) return;

      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      const speed = Math.hypot(dx, dy); // 마우스 이동 속도

      // 커서 dot 위치 업데이트
      if (dotEl) {
        dotEl.style.left = e.clientX + 'px';
        dotEl.style.top = e.clientY + 'px';
        dotEl.style.opacity = '1';
      }

      if (speed > 1.5) {
        // 속도에 비례해서 파티클 생성 (최대 3개)
        const count = Math.min(Math.floor(1 + speed * 0.2), 3);
        // 파티클이 80개 넘으면 오래된 것부터 제거
        if (particles.length > 80) particles.splice(0, particles.length - 80);
        for (let i = 0; i < count; i++) particles.push(makeParticle(e.clientX, e.clientY, dx, dy));
      }
    }
    window.addEventListener('mousemove', onMouseMove);

    function onClick(e) {
      ripples.push({
        x: e.clientX,
        y: e.clientY,
        r: 0,
        maxR: Math.max(window.innerWidth, window.innerHeight) * 0.8,
        alpha: 0.18,
        color: RIPPLE_COLORS[Math.floor(Math.random() * RIPPLE_COLORS.length)],
        speed: 8,
      });
    }
    window.addEventListener('click', onClick);

    // 메인 애니메이션 루프
    function loop(timestamp) {
      const W = canvas.width;
      const H = canvas.height;

      // 매 프레임 배경을 반투명 검정으로 덮어서 잔상 효과 생성
      ctx.fillStyle = 'rgba(14,11,20,0.12)';
      ctx.fillRect(0, 0, W, H);

      // 리플 — 파티클보다 먼저 그려서 파티클이 위에 표시됨
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

      // 파티클 뒤에서부터 순회 (splice 사용 시 인덱스 안전)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        drawParticle(p);
        p.x += p.vx; p.y += p.vy;   // 위치 이동
        p.vx *= 0.98; p.vy *= 0.98; // 마찰로 속도 감소
        p.r += p.grow;               // 반지름 증가 (번지는 효과)
        p.alpha -= p.fade;           // 투명도 감소 (사라지는 효과)
        if (p.alpha <= 0) particles.splice(i, 1); // 완전히 사라지면 제거
      }

      animId = requestAnimationFrame(loop);
    }

    animId = requestAnimationFrame(loop);

    // 컴포넌트 언마운트 시 정리
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('click', onClick);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas id="ink-bg" ref={canvasRef} />;
}

// ─── 스캔 캔버스 (분석 중 이미지 위에 표시) ────────────────────────────────────

// active가 true일 때만 애니메이션 실행
// analyzeImage가 완료되면 phase가 'done'으로 바뀌고 active=false → 자동 정지
function ScanCanvas({ active }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!active) return;
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const cycleDuration = 2800; // 스캔라인 한 번 내려가는 시간 (ms)
    const start = performance.now();
    let animId;

    function loop(now) {
      // 전체 높이에서 현재 스캔 위치 계산 (반복 사이클)
      const progress = ((now - start) % cycleDuration) / cycleDuration;
      ctx.clearRect(0, 0, W, H);

      const scanY = progress * H;

      // 스캔된 영역에 보라빛 오버레이
      ctx.fillStyle = `rgba(180,150,255,${(progress * 0.09).toFixed(4)})`;
      ctx.fillRect(0, 0, W, scanY);

      // 스캔라인 (밝은 수평선)
      const lineH = 20;
      const grad = ctx.createLinearGradient(0, scanY - lineH, 0, scanY + lineH);
      grad.addColorStop(0,   'rgba(217,207,234,0)');
      grad.addColorStop(0.5, 'rgba(217,207,234,0.28)'); // 중앙이 가장 밝음
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
      width={320}
      height={320}
      style={{ width: '320px', height: '320px' }}
    />
  );
}

// ─── 분석 카드 컴포넌트 ──────────────────────────────────────────────────────

// visible이 true가 되면 슬라이드인 애니메이션 실행
function AnalysisCard({ title, visible, style, children }) {
  return (
    <div
      className={`analysis-card${visible ? ' analysis-card--in' : ''}`}
      style={{
        position: 'absolute',
        width: '180px',
        minWidth: 'unset',
        padding: '12px 16px',
        borderRadius: '12px',
        background: 'rgba(238,235,248,0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        ...style,
      }}
    >
      <p className="card-title" style={{ fontSize: '13px', fontWeight: 600 }}>{title}</p>
      {children}
    </div>
  );
}

// ─── 홀로그래픽 배경 (idle 전용) ─────────────────────────────────────────────

// ─── 메인 앱 ─────────────────────────────────────────────────────────────────

export default function App() {
  // 현재 화면 단계: idle → uploaded → scanning → done
  const [phase, setPhase] = useState('idle');
  const [imageUrl, setImageUrl] = useState(null);   // 업로드된 이미지 URL
  const [fileName, setFileName] = useState('');     // 파일 이름 (표시용)
  const [rules, setRules] = useState(null);         // imageAnalysis 결과
  const [cardData, setCardData] = useState(null);   // 분석 카드 표시 데이터
  const [activeStage, setActiveStage] = useState(0); // 하단 단계 표시 (0~4)
  const [statusText, setStatusText] = useState('awaiting memory fragment'); // 우상단 상태 텍스트
  const [cardsIn, setCardsIn] = useState([false, false, false, false]); // 분석 카드 표시 여부
  const [extracting, setExtracting] = useState(false); // extracted 카드 fly-in 트리거
  const [archiveItems, setArchiveItems] = useState([]);

  const fileInputRef = useRef(null);        // 숨겨진 파일 input
  const lightBgCanvasRef = useRef(null);    // done 화면의 풀스크린 빛 그래픽 캔버스
  const miniCanvasRef = useRef(null);       // done 화면의 AFTER 미니 캔버스
  const coordsRef = useRef(null);           // 하단 좌표 표시 (DOM 직접 업데이트)
  const genRunRef = useRef(0);             // 중복 생성 방지용 실행 ID

  // 마우스 좌표를 하단에 표시 (React state 쓰지 않고 DOM 직접 업데이트 → 리렌더링 없음)
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

  // extracted 단계: 카드 fly-in 애니메이션 트리거
  useEffect(() => {
    if (phase !== 'extracted') return;
    setExtracting(false);
    const t = setTimeout(() => setExtracting(true), 50);
    return () => clearTimeout(t);
  }, [phase]);

  // phase가 'done'이 되면 풀스크린 캔버스에 빛 그래픽 렌더링
  // 렌더링 후 미니 캔버스(AFTER)에도 복사
  useEffect(() => {
    if (phase !== 'done' || !rules) return;
    const timeout = setTimeout(() => {
      try {
        if (lightBgCanvasRef.current) {
          renderLightGraphic(lightBgCanvasRef.current, rules, 1);
          if (miniCanvasRef.current) {
            const miniCtx = miniCanvasRef.current.getContext('2d');
            miniCtx.clearRect(0, 0, 1000, 1000);
            miniCtx.drawImage(lightBgCanvasRef.current, 0, 0); // 풀스크린 캔버스를 미니에 복사
          }
        }
      } catch (e) { console.error(e); }
    }, 100); // 캔버스가 DOM에 마운트된 후 실행되도록 100ms 지연
    return () => clearTimeout(timeout);
  }, [phase, rules]);

  // 파일 선택 시 처리
  function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // 같은 파일 재선택 가능하도록 초기화
    const url = URL.createObjectURL(file);
    setImageUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; }); // 이전 URL 메모리 해제
    setFileName(file.name);
    setRules(null);
    setCardData(null);
    setCardsIn([false, false, false, false]);
    setActiveStage(0);
    setStatusText('memory fragment loaded');
    setPhase('uploaded');
  }

  // Generate 버튼 클릭 시 분석 시작
  async function startGenerate() {
    if (!imageUrl) return;
    const runId = ++genRunRef.current; // 새 실행 ID (이전 실행 무효화)
    setPhase('scanning');
    setActiveStage(1);
    setCardsIn([false, false, false, false]);
    setStatusText('reading sensory elements...');

    // 카드 애니메이션 스케줄 (분석 완료와 무관하게 독립 실행)
    const schedule = [
      { delay: 700,  msg: 'extracting color palette...',  stage: 1 },
      { delay: 1500, msg: 'measuring blur density...',     stage: 2 },
      { delay: 2300, msg: 'locating light origin...',      stage: 2 },
      { delay: 3100, msg: 'tracing motion direction...',   stage: 3 },
    ];
    schedule.forEach(({ delay, msg, stage }, i) => {
      setTimeout(() => {
        if (genRunRef.current !== runId) return; // 다른 실행이 시작됐으면 무시
        setCardsIn(prev => { const n = [...prev]; n[i] = true; return n; });
        setStatusText(msg);
        setActiveStage(stage);
      }, delay);
    });

    try {
      // 분석 완료 AND 최소 4500ms 경과, 둘 다 충족해야 다음으로 진행
      // → 카드 애니메이션이 항상 끝까지 보임
      const [analysis] = await Promise.all([
        analyzeImage(imageUrl),
        new Promise(resolve => setTimeout(resolve, 4500)),
      ]);

      if (genRunRef.current !== runId) return;
      setRules(analysis);
      setCardData(analysis);
      setActiveStage(3);
      setStatusText('light record ready');

      // 400ms 추가 여유 후 결과 화면으로 전환
      setTimeout(() => {
        if (genRunRef.current === runId) setPhase('extracted');
      }, 2000);
    } catch (err) {
      console.error(err);
      if (genRunRef.current === runId) {
        setStatusText('analysis failed');
        setPhase('uploaded');
      }
    }
  }

  function saveWithEviction(entry, items) {
    try {
      const updated = [entry, ...items].slice(0, 30);
      localStorage.setItem('libeo-archive', JSON.stringify(updated));
      return true;
    } catch (e) {
      if (items.length > 5) {
        return saveWithEviction(entry, items.slice(0, -5));
      }
      return false;
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
    };

    saveWithEviction(entry, existing);
    setActiveStage(4);
    setStatusText('saved to archive');
  }

  function goBack() {
    setPhase('idle');
  }

  function generateVariation() {
    if (!rules || !lightBgCanvasRef.current) return;
    const nextVariation = Math.floor(Math.random() * 10) + 1;
    renderLightGraphic(lightBgCanvasRef.current, rules, nextVariation);
    if (miniCanvasRef.current) {
      const miniCtx = miniCanvasRef.current.getContext('2d');
      miniCtx.clearRect(0, 0, 1000, 1000);
      miniCtx.drawImage(lightBgCanvasRef.current, 0, 0);
    }
  }

  const vis = p => phase === p; // 현재 phase와 일치하면 true

  return (
    <>
      {/* 커서 dot — 마우스 위치에 따라 InkBg에서 직접 위치 업데이트 */}
      <div
        id="cursor-dot"
        style={{
          position: 'fixed',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.75)',
          pointerEvents: 'none',
          zIndex: 9999,
          opacity: 0,
          transform: 'translate(-50%, -50%)',
          transition: 'opacity 200ms',
        }}
      />

      {/* 잉크 인터랙션 배경 캔버스 (항상 렌더링) */}
      <InkBg phase={phase} />

      {/* 숨겨진 파일 input — idle 화면 클릭 시 열림 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden-file"
        onChange={onFileChange}
      />

      {/* 상단 네비게이션 */}
      <nav className="top-nav">
        <a className="wordmark-link" href="/" aria-label="libeo home">
          <img src={wordmark} alt="LIBEO" className="wordmark-img" />
        </a>
        <span className="nav-status">{statusText}</span>
        <button
          onClick={() => {
            const items = JSON.parse(localStorage.getItem('libeo-archive') || '[]');
            setArchiveItems(items);
            setPhase('archive');
          }}
          style={{
            background: 'none',
            border: '0.5px solid rgba(255,255,255,0.2)',
            borderRadius: '999px',
            padding: '6px 16px',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: '0.08em',
            cursor: 'none',
            fontFamily: 'inherit',
          }}
        >
          archive
        </button>
      </nav>

      {/* ── Phase 1: 대기 화면 ── */}
      <div
        className={`phase-screen${vis('idle') ? ' phase-in' : ''}`}
        onClick={() => vis('idle') && fileInputRef.current?.click()}
        role="button"
        tabIndex={vis('idle') ? 0 : -1}
        aria-label="Click to upload image"
      >
        <div className="idle-content">
          <h1 style={{
            fontSize: 'clamp(48px, 9vw, 72px)',
            fontWeight: 200,
            color: 'rgba(255,255,255,0.88)',
            letterSpacing: '-0.01em',
            lineHeight: 0.96,
            textAlign: 'center',
            textShadow: '0 0 80px rgba(200,180,255,0.3), 0 0 160px rgba(180,150,255,0.15)',
          }}>Light Translation<br/>System</h1>
          <p style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.25)',
            marginTop: '40px',
            letterSpacing: '0.08em',
            textAlign: 'center',
          }}>blurred memory fragments → personal light graphics</p>
          <p style={{
            fontSize: '13px',
            color: 'rgba(221, 192, 255, 0.53)',
            marginTop: '48px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            animation: 'gentlePulse 3s ease-in-out infinite',
          }}>click anywhere to begin</p>
        </div>
      </div>

      {/* ── Shared image container — identical position in uploaded + scanning ── */}
      {imageUrl && (vis('uploaded') || vis('scanning')) && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 11,
          width: '320px',
          height: '320px',
        }}>
          <img
            src={imageUrl}
            className="preview-portrait"
            alt="memory fragment"
            style={{ width: '320px', height: '320px', objectFit: 'cover', borderRadius: '18px', display: 'block' }}
          />
          {/* Scan overlay + cards — only visible during scanning */}
          {vis('scanning') && <ScanCanvas active={true} />}

          {vis('scanning') && (
            <>
              <AnalysisCard title="Color" visible={cardsIn[0]} style={{ top: '60px', left: '-80px', transform: 'rotate(-2deg)' }}>
                <div className="card-palette-row" key={cardData ? 'real' : 'placeholder'}>
                  {cardData?.palette
                    ? cardData.palette.map((hex, i) => <span key={i} className="card-dot" style={{ background: hex }} />)
                    : [0, 1, 2, 3, 4].map(i => <span key={i} className="card-dot" />)}
                </div>
                <p className="card-sub" style={{ fontSize: '11px' }}>dominant palette</p>
              </AnalysisCard>

              <AnalysisCard title="Blur Density" visible={cardsIn[1]} style={{ bottom: '-30px', left: '55%', transform: 'rotate(1.5deg)' }}>
                <div className="card-bar-track">
                  <div
                    key={cardData ? 'real' : 'placeholder'}
                    className={`card-bar-fill${cardsIn[1] ? ' card-bar-fill--go' : ''}`}
                    style={cardData ? { width: `${Math.round(cardData.blurDensity * 100)}%` } : undefined}
                  />
                </div>
                <p className="card-value" key={cardData ? 'real' : 'placeholder'}>{cardData ? Math.round(cardData.blurDensity * 100) + '%' : '—'}</p>
                <p className="card-sub" style={{ fontSize: '11px' }}>soft diffusion</p>
              </AnalysisCard>

              <AnalysisCard title="Light Origin" visible={cardsIn[2]} style={{ top: '-20px', right: '60px', transform: 'rotate(2deg)' }}>
                <p className="card-value" key={cardData ? 'real' : 'placeholder'}>
                  {cardData
                    ? `${Math.round(cardData.lightOrigin.x * 100)} / ${Math.round(cardData.lightOrigin.y * 100)}`
                    : 'locating...'}
                </p>
                <p className="card-sub" style={{ fontSize: '11px' }}>brightest region</p>
              </AnalysisCard>

              <AnalysisCard title="Motion Trace" visible={cardsIn[3]} style={{ top: '45%', right: '-90px', transform: 'rotate(-1deg)' }}>
                <p className="card-value" key={cardData ? 'real' : 'placeholder'}>{cardData?.motionDirection?.label || 'tracing...'}</p>
                <p className="card-sub" style={{ fontSize: '11px' }}>directional drift</p>
              </AnalysisCard>
            </>
          )}
        </div>
      )}

      {/* ── Phase 2: 업로드 완료 — button only ── */}
      <div className={`phase-screen${vis('uploaded') ? ' phase-in' : ''}`}>
        <button
          onClick={startGenerate}
          style={{
            position: 'fixed',
            bottom: '140px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '16px 32px',
            borderRadius: '999px',
            border: '1px solid rgba(217,207,234,0.32)',
            background: 'rgba(217,207,234,0.09)',
            fontSize: '14px',
            color: 'rgba(217,207,234,0.88)',
            fontFamily: 'inherit',
            cursor: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Generate Light Graphic
        </button>
      </div>

      {/* ── Phase 3: 스캔 & 분석 — no content here, handled in shared container ── */}
      <div className={`phase-screen${vis('scanning') ? ' phase-in' : ''}`} />

      {/* ── Phase: extracted — 추출 요약 화면 (3초 후 done으로 자동 전환) ── */}
      <div
        className={`phase-screen${vis('extracted') ? ' phase-in' : ''}`}
        style={{ position: 'fixed', inset: 0, zIndex: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
      >
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '40px' }}>
          extraction complete
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Card 1 — Color Palette */}
          <div className={`extracted-card${extracting ? ' in' : ''}`} style={{ minWidth: '160px', padding: '24px', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '16px', transitionDelay: '0ms' }}>
            <p style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '16px' }}>Color Palette</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              {(rules?.palette || []).map((hex, i) => (
                <span key={i} style={{ width: '28px', height: '28px', borderRadius: '50%', background: hex, display: 'inline-block' }} />
              ))}
            </div>
          </div>

          {/* Card 2 — Blur Density */}
          <div className={`extracted-card${extracting ? ' in' : ''}`} style={{ minWidth: '160px', padding: '24px', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '16px', transitionDelay: '120ms' }}>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '16px' }}>Blur Density</p>
            <p style={{ fontSize: '32px', fontWeight: 200, color: 'rgba(255,255,255,0.85)', lineHeight: 1, marginBottom: '12px' }}>
              {rules ? Math.round(rules.blurDensity * 100) + '%' : '—'}
            </p>
            <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
              <div style={{ height: '100%', width: rules ? `${Math.round(rules.blurDensity * 100)}%` : '0%', background: 'rgba(255,255,255,0.5)', borderRadius: '2px', transition: 'width 800ms ease' }} />
            </div>
          </div>

          {/* Card 3 — Light Origin */}
          <div className={`extracted-card${extracting ? ' in' : ''}`} style={{ minWidth: '160px', padding: '24px', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '16px', transitionDelay: '240ms' }}>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '16px' }}>Light Origin</p>
            <p style={{ fontSize: '32px', fontWeight: 200, color: 'rgba(255,255,255,0.85)', lineHeight: 1 }}>
              {rules ? `${Math.round(rules.lightOrigin.x * 100)} / ${Math.round(rules.lightOrigin.y * 100)}` : '—'}
            </p>
          </div>

          {/* Card 4 — Motion Trace */}
          <div className={`extracted-card${extracting ? ' in' : ''}`} style={{ minWidth: '160px', padding: '24px', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '16px', transitionDelay: '360ms' }}>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '16px' }}>Motion Trace</p>
            <p style={{ fontSize: '24px', fontWeight: 200, color: 'rgba(255,255,255,0.85)', marginBottom: '8px' }}>
              {rules?.motionDirection?.label || '—'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setPhase('done')}
          style={{
            marginTop: '40px',
            padding: '20px 44px',
            borderRadius: '999px',
            border: '1px solid rgba(217,207,234,0.3)',
            background: 'rgba(217,207,234,0.09)',
            fontSize: '14px',
            color: 'rgba(217,207,234,0.88)',
            fontFamily: 'inherit',
            cursor: 'none',
            letterSpacing: '0.02em',
          }}
        >
          generate light graphic →
        </button>
      </div>

      {/* 풀스크린 빛 그래픽 배경 캔버스 — done 단계에서만 보임 */}
      <canvas
        ref={lightBgCanvasRef}
        id="light-bg-canvas"
        width={1000}
        height={1000}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 1,
          objectFit: 'cover',
          display: 'block',
          opacity: phase === 'done' ? 1 : 0,   // done일 때만 표시
          transition: 'opacity 1200ms ease',    // 부드럽게 페이드인
          filter: 'brightness(0.55)',            // 어둡게 해서 UI 가독성 확보
          pointerEvents: 'none',
        }}
      />

      {/* ── Phase 4: 결과 화면 ── */}
      <div
        className={`phase-screen${vis('done') ? ' phase-in' : ''}`}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 6,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p style={{
          fontSize: '13px',
          color: 'rgba(255,255,255,0.35)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: '32px',
        }}>
          light translation complete
        </p>

        {/* Before → After 비교 */}
        <div className="compare-row" style={{ gap: '20px' }}>
          <div className="compare-card" style={{ padding: '12px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
            <span className="compare-label" style={{ fontSize: '13px' }}>BEFORE</span>
            {imageUrl && (
              <img
                src={imageUrl}
                className="compare-img"
                alt="before"
                style={{ width: '200px', height: '200px' }}
              />
            )}
          </div>

          <span className="compare-arrow" style={{ fontSize: '18px' }}>→</span>

          <div className="compare-card" style={{ padding: '12px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
            <span className="compare-label" style={{ fontSize: '13px' }}>AFTER</span>
            {/* 풀스크린 캔버스를 복사한 미니 결과물 */}
            <canvas
              ref={miniCanvasRef}
              width={1000}
              height={1000}
              className="compare-img"
              aria-label="after — generated light graphic"
              style={{ width: '200px', height: '200px' }}
            />
          </div>
        </div>

        {/* 저장 버튼 */}
        <button
          className="pill-btn pill-btn--save"
          onClick={saveToArchive}
          style={{
            marginTop: '32px',
            padding: '16px 32px',
            fontSize: '14px',
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.75)',
          }}
        >
          Save to Archive
        </button>

        <button
          onClick={generateVariation}
          style={{
            marginTop: '12px',
            padding: '16px 32px',
            borderRadius: '999px',
            border: '1px solid rgba(202, 202, 202, 0.52)',
            background: 'transparent',
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.63)',
            fontFamily: 'inherit',
            cursor: 'none',
            letterSpacing: '0.04em',
          }}
        >
          generate variation
        </button>
      </div>

      {/* ── Phase: archive ── */}
      <div
        className={`phase-screen${vis('archive') ? ' phase-in' : ''}`}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 6,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          overflowY: 'auto',
          paddingTop: '80px',
          paddingBottom: '60px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '40px' }}>
          <button
            onClick={goBack}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '13px',
              cursor: 'none',
              fontFamily: 'inherit',
              letterSpacing: '0.06em',
            }}
          >
            ← back
          </button>
          <h2 style={{
            fontSize: '13px',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            margin: 0,
          }}>
            archive — {archiveItems.length} records
          </h2>
        </div>

        {archiveItems.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em' }}>
            no records yet
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 240px)', gap: '16px' }}>
            {archiveItems.map((item) => (
              <div
                key={item.id}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '0.5px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={item.dataUrl}
                  style={{ width: '240px', height: '240px', objectFit: 'cover', display: 'block' }}
                />
                <div style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.05em' }}>
                    {new Date(item.createdAt).toLocaleDateString('ko-KR')}
                  </span>
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.download = `libeo-${item.id}.png`;
                      link.href = item.dataUrl;
                      link.click();
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '0.5px solid rgba(255,255,255,0.15)',
                      borderRadius: '999px',
                      padding: '5px 12px',
                      fontSize: '10px',
                      color: 'rgba(255,255,255,0.5)',
                      cursor: 'none',
                      fontFamily: 'inherit',
                      letterSpacing: '0.05em',
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

      {/* 하단 바 — 단계 표시 + 커서 좌표 */}
      <footer className="bottom-bar">
        <ol className="step-list">
          {FLOW_STEPS.map((step, i) => (
            <li key={step} className={i === activeStage ? 'step-active' : ''}>
              <span style={{ fontSize: '11px', letterSpacing: '0.08em' }}>
                {String(i + 1).padStart(2, '0')} {step}
              </span>
            </li>
          ))}
        </ol>
        {/* 마우스 좌표 — useEffect에서 DOM 직접 업데이트 */}
        <span className="cursor-coords" ref={coordsRef} aria-hidden="true">0000 / 0000</span>
      </footer>
    </>
  );
}