import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeImage } from './lib/imageAnalysis.js';
import { renderLightGraphic } from './lib/lightRenderer.js';

function formatPercent(value) {
  return `${Math.round((value || 0) * 100)}%`;
}

function getMemoryFieldLabel(rules) {
  if (!rules) return 'waiting';

  const brightCount = rules.brightRegions?.length || 0;
  const rhythm = rules.structure?.geometricRhythm || 0;
  const concentration = rules.structure?.concentration || 0;
  const density = Math.min(1, brightCount * 0.08 + rhythm * 0.36 + concentration * 0.32);

  if (density > 0.72) return 'dense / clustered';
  if (density > 0.48) return 'gathered field';
  if (density > 0.26) return 'balanced field';
  return 'quiet field';
}

const flowSteps = ['Upload', 'Extract', 'Transform', 'Generate', 'Archive'];

function App() {
  const [imageUrl, setImageUrl] = useState(null);
  const [fileName, setFileName] = useState('');
  const [rules, setRules] = useState(null);
  const [variation, setVariation] = useState(1);
  const [status, setStatus] = useState('awaiting memory fragment');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasGraphic, setHasGraphic] = useState(false);
  const [activeStage, setActiveStage] = useState(0);
  const canvasRef = useRef(null);
  const generationRunRef = useRef(0);

  const hasImage = Boolean(imageUrl);
  const canShowGraphic = Boolean(imageUrl && rules && hasGraphic);

  useEffect(() => {
    if (!imageUrl || !rules || !hasGraphic) {
      const canvas = canvasRef.current;
      if (canvas) {
        const context = canvas.getContext('2d');
        context?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    try {
      renderLightGraphic(canvasRef.current, rules, variation);
    } catch (error) {
      console.error(error);
      setStatus(error?.message || 'render failed');
    }
  }, [hasGraphic, imageUrl, rules, variation]);

  const statusCopy = useMemo(() => {
    if (isAnalyzing) return 'extracting sensory elements';
    if (hasGraphic) return 'light record ready';
    if (hasImage) return 'memory fragment loaded';
    return status;
  }, [hasGraphic, hasImage, isAnalyzing, status]);

  const elementCards = useMemo(
    () => [
      {
        label: 'color palette',
        value: rules ? 'dominant colors from the image' : 'empty',
        visualRule: 'Atmospheric Gradient',
        palette: rules?.palette || [],
      },
      {
        label: 'light origin',
        value: rules
          ? `brightest remaining point ${Math.round(rules.lightOrigin.x * 100)} / ${Math.round(rules.lightOrigin.y * 100)}`
          : 'waiting',
        visualRule: 'Sensory Origin',
      },
      {
        label: 'blur density',
        value: rules ? `soft diffusion level ${formatPercent(rules.blurDensity)}` : 'waiting',
        visualRule: 'Soft Circle',
      },
      {
        label: 'motion trace',
        value: rules ? `directional drift ${rules.motionDirection.label}` : 'waiting',
        visualRule: 'Faint Line',
      },
      {
        label: 'structure',
        value: rules ? `visual balance ${rules.structure?.dominantAxis || 'balanced'}, ${rules.structure?.shapeEnergy || 'soft'}` : 'waiting',
        visualRule: 'Glow Intersection',
      },
      {
        label: 'memory field',
        value: rules ? `density and rhythm ${getMemoryFieldLabel(rules)}` : getMemoryFieldLabel(rules),
        visualRule: 'Grain Texture / Memory Field',
      },
    ],
    [rules],
  );

  async function handleImageSelected(file) {
    if (!file) return;

    generationRunRef.current += 1;
    const nextUrl = URL.createObjectURL(file);
    setImageUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return nextUrl;
    });
    setFileName(file.name);
    setRules(null);
    setVariation(1);
    setHasGraphic(false);
    setActiveStage(0);
    setStatus('memory fragment loaded');
  }

  async function generateGraphic(nextVariation = variation) {
    if (!imageUrl) {
      setStatus('choose an image first');
      return;
    }

    const runId = generationRunRef.current + 1;
    generationRunRef.current = runId;
    setIsAnalyzing(true);
    setHasGraphic(false);
    setActiveStage(1);
    setStatus('reading sensory elements');

    try {
      const analysis = await analyzeImage(imageUrl);
      if (generationRunRef.current !== runId) return;
      setRules(analysis);
      setVariation(nextVariation);
      setHasGraphic(true);
      setActiveStage(3);
      setStatus('light graphic generated');
    } catch (error) {
      setStatus('the image could not be read');
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `libeo-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    setActiveStage(4);
    setStatus('saved to archive');
  }

  function stepState(index) {
    if (!hasImage && index === 0) return 'is-waiting';
    if (index < activeStage) return 'is-complete';
    if (index === activeStage) return 'is-active';
    return '';
  }

  return (
    <main className="archive-shell">
      <header className="archive-hero" aria-labelledby="workspace-title">
        <nav className="archive-nav">
          <a className="wordmark" href="/" aria-label="libeo home">
            libeo
          </a>
          <span>{statusCopy}</span>
        </nav>
        <h1 id="workspace-title">Light Translation Archive</h1>
        <p className="archive-subtitle">from blurred image fragments to personal light graphics</p>
      </header>

      <ol className="flow-annotations" aria-label="archive workflow">
        {flowSteps.map((step, index) => (
          <li className={stepState(index)} key={step}>
            {String(index + 1).padStart(2, '0')} {step}
          </li>
        ))}
      </ol>

      <section className="workspace-grid" aria-label="libeo archive workspace">
        <aside className="archive-panel source-panel" aria-label="original photos">
          <div className="panel-title">
            <p>Original Photos</p>
            <span>blurred memory fragments</span>
          </div>

          <label className="compact-upload">
            <input
              type="file"
              accept="image/*"
              onChange={(event) => onFileInput(event, handleImageSelected)}
            />
            <span>{fileName || 'upload fragment'}</span>
            <small>{fileName ? 'ready to extract' : 'jpg / png / webp'}</small>
          </label>

          <div className="source-preview">
            {imageUrl ? (
              <img src={imageUrl} alt="uploaded source" />
            ) : (
              <div className="empty-preview">
                <span>source waits here</span>
              </div>
            )}
          </div>

        </aside>

        <section className="archive-panel workspace-panel" aria-label="workspace">
          <div className="panel-title">
            <p>Workspace</p>
            <span>where blurred images become light graphics</span>
          </div>

          <div className="transformation-stage">
            <figure className="memory-card">
              <figcaption>
                <span>Before</span>
                <small>Memory / Atmosphere</small>
              </figcaption>
              {imageUrl ? (
                <img src={imageUrl} alt="uploaded memory fragment" />
              ) : (
                <div className="empty-preview">
                  <span>original memory</span>
                </div>
              )}
            </figure>

            <div className="transition-mark" aria-hidden="true">
              <span />
            </div>

            <figure className="memory-card generated-card">
              <figcaption>
                <span>After</span>
                <small>Generated Light Translation</small>
              </figcaption>
              {canShowGraphic ? (
                <canvas
                  ref={canvasRef}
                  width="1000"
                  height="1000"
                  aria-label="generated abstract light graphic"
                />
              ) : (
                <div className="empty-preview">
                  <span>light graphic waits here</span>
                </div>
              )}
            </figure>
          </div>

        </section>

        <aside className="archive-panel elements-panel" aria-label="image analysis">
          <div className="panel-title">
            <p>Image Analysis</p>
            <span>source data for light translation</span>
          </div>

          <p className="translation-note">Image data becomes visual rules, and visual rules become a light graphic.</p>

          <div className={`element-stack ${rules ? '' : 'is-empty'}`}>
            {rules ? (
              elementCards.map((item) => (
                <article className="element-card" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  {item.palette?.length ? (
                    <div className="mini-palette">
                      {item.palette.map((color) => (
                        <i key={color} style={{ background: color }} />
                      ))}
                    </div>
                  ) : null}
                  <div className="translation-row">
                    <small>translated into</small>
                    <b>{item.visualRule}</b>
                  </div>
                </article>
              ))
            ) : (
              <div className="elements-empty">image analysis waits here</div>
            )}
          </div>

          <div className="archive-actions">
            <button type="button" onClick={() => generateGraphic(variation)} disabled={!hasImage || isAnalyzing}>
              {isAnalyzing ? 'Extracting Elements' : 'Generate Light Graphic'}
            </button>
            <button type="button" onClick={downloadPng} disabled={!canShowGraphic}>
              Save to Archive
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}

function onFileInput(event, callback) {
  callback(event.target.files?.[0]);
  event.target.value = '';
}

export default App;
