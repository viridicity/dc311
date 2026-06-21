import { categoryShapeIcon } from '../../lib/requestFlowCategoryShapes';

const SWATCH_PX = 10;

interface RequestFlowShapeSwatchProps {
  shapeIcon?: string;
  category?: string;
  color?: string;
  size?: number;
  className?: string;
}

/** Legend glyph — monospace ASCII matching on-map markers. */
export default function RequestFlowShapeSwatch({
  shapeIcon,
  category,
  color = '#2563EB',
  size = SWATCH_PX,
  className = '',
}: RequestFlowShapeSwatchProps) {
  const glyph = shapeIcon ?? (category ? categoryShapeIcon(category) : '?');

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center font-mono font-semibold leading-none ${className}`}
      style={{ width: size, height: size, color, fontSize: Math.round(size * 0.95) }}
      aria-hidden="true"
    >
      {glyph}
    </span>
  );
}
