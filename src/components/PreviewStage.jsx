function PreviewStage({ imageUrl, hasGraphic, canvasRef, imageElementRef }) {
  return (
    <div className="preview-stage">
      <figure className="preview-frame">
        <figcaption>original image</figcaption>
        {imageUrl ? (
          <img ref={imageElementRef} src={imageUrl} alt="uploaded source" />
        ) : (
          <div className="empty-preview">
            <span>source image waits here</span>
          </div>
        )}
      </figure>

      <figure className="preview-frame generated-frame">
        <figcaption>generated light graphic</figcaption>
        {hasGraphic ? (
          <canvas
            ref={canvasRef}
            width="1000"
            height="1000"
            aria-label="generated abstract light graphic"
          />
        ) : (
          <div className="empty-preview">
            <span>generated light waits here</span>
          </div>
        )}
      </figure>
    </div>
  );
}

export default PreviewStage;
