function UploadPanel({
  fileName,
  hasGraphic,
  hasImage,
  isAnalyzing,
  onFileSelected,
  onGenerate,
  onRegenerate,
  onDownload,
}) {
  return (
    <aside className="upload-panel" aria-label="image controls">
      <label className="drop-zone">
        <input
          type="file"
          accept="image/*"
          onChange={(event) => onFileSelected(event.target.files?.[0])}
        />
        <span className="drop-title">{fileName || 'choose a blurred photograph'}</span>
        <span className="drop-meta">
          {fileName ? 'ready for translation' : 'jpg, png, webp, or gif'}
        </span>
      </label>

      <div className="button-row">
        <button type="button" onClick={onGenerate} disabled={!hasImage || isAnalyzing}>
          {isAnalyzing ? 'Reading Light' : 'Generate Light Graphic'}
        </button>
        <button type="button" onClick={onRegenerate} disabled={!hasGraphic || isAnalyzing}>
          Regenerate Variation
        </button>
        <button type="button" onClick={onDownload} disabled={!hasGraphic}>
          Download PNG
        </button>
      </div>
    </aside>
  );
}

export default UploadPanel;
