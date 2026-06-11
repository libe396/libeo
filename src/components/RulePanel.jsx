function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function RulePanel({ rules }) {
  return (
    <aside className="rule-panel" aria-label="extracted rule values">
      <div className="panel-heading">
        <p>extracted rules</p>
        <span>client-side reading</span>
      </div>

      <div className="palette-row" aria-label="dominant color palette">
        {rules.palette.map((color) => (
          <span key={color} style={{ background: color }} title={color} />
        ))}
      </div>

      <dl className="rule-list">
        <div>
          <dt>light origin</dt>
          <dd>
            {Math.round(rules.lightOrigin.x * 100)} /{' '}
            {Math.round(rules.lightOrigin.y * 100)}
          </dd>
        </div>
        <div>
          <dt>average brightness</dt>
          <dd>{formatPercent(rules.averageBrightness)}</dd>
        </div>
        <div>
          <dt>blur density</dt>
          <dd>{formatPercent(rules.blurDensity)}</dd>
        </div>
        <div>
          <dt>motion direction</dt>
          <dd>
            {rules.motionDirection.label}, {Math.round(rules.motionDirection.angle)} deg
          </dd>
        </div>
        {rules.structure ? (
          <div>
            <dt>structure reading</dt>
            <dd>
              {rules.structure.dominantAxis || rules.structure.type},{' '}
              {rules.structure.shapeEnergy || 'unread'}
            </dd>
          </div>
        ) : null}
      </dl>
    </aside>
  );
}

export default RulePanel;
