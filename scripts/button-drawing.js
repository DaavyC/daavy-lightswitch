const SWITCH_SIZE = 28;

const COLORS = {
  onBackground: 0x1e1e1e,
  offBackground: 0x2c2c2c,
  onGold: 0xffd76a,
  onGlow: 0xffe8a0,
  onStroke: 0xfff0a3,
  offGlass: 0x777777,
  offStroke: 0xb8b8b8,
  onBase: 0x8d7840,
  offBase: 0x555555,
  filament: 0x7a5a00,
  white: 0xffffff
};

export function createButtonBackground(off) {
  const graphics = new PIXI.Graphics();
  const fill = off ? COLORS.offBackground : COLORS.onBackground;
  const stroke = off ? COLORS.offStroke : COLORS.onGold;

  drawCircle(graphics, { x: 0, y: 0, radius: SWITCH_SIZE / 2, fill, alpha: 0.88, stroke, strokeWidth: 2 });
  return graphics;
}

export function createButtonIcon(off) {
  const icon = new PIXI.Graphics();
  const palette = getPalette(off);

  drawGlow(icon, off);
  drawBulb(icon, palette);
  drawFilament(icon, off);
  drawBase(icon, palette, off);

  return icon;
}

function getPalette(off) {
  return {
    glass: off ? COLORS.offGlass : COLORS.onGold,
    glassAlpha: off ? 0.42 : 0.95,
    glassStroke: off ? COLORS.offStroke : COLORS.onStroke,
    base: off ? COLORS.offBase : COLORS.onBase,
    baseStroke: off ? 0xa0a0a0 : COLORS.onGold
  };
}

function drawGlow(icon, off) {
  if (off) return;
  drawCircle(icon, { x: 0, y: -3, radius: 11, fill: COLORS.onGold, alpha: 0.16 });
  drawCircle(icon, { x: 0, y: -3, radius: 7, fill: COLORS.onGlow, alpha: 0.2 });
}

function drawBulb(icon, palette) {
  drawEllipse(icon, {
    x: 0,
    y: -5,
    width: 7,
    height: 8,
    fill: palette.glass,
    alpha: palette.glassAlpha,
    stroke: palette.glassStroke,
    strokeWidth: 1.6
  });
  drawPolygon(icon, {
    points: [-4, 2, 4, 2, 3, 6, -3, 6],
    fill: palette.glass,
    alpha: palette.glassAlpha,
    stroke: palette.glassStroke,
    strokeWidth: 1.2
  });
}

function drawFilament(icon, off) {
  if (off) return;
  drawLine(icon, { points: [-3, -4, -1, -1, 1, -4, 3, -1], color: COLORS.filament, width: 1.25, alpha: 0.72 });
  drawCircle(icon, { x: -2.6, y: -8.2, radius: 1.5, fill: COLORS.white, alpha: 0.58 });
}

function drawBase(icon, palette, off) {
  drawBaseTop(icon, palette);
  drawLine(icon, { points: [-3.4, 6.5, 3.4, 6.5], color: off ? COLORS.offStroke : 0xffef9b, width: 0.9, alpha: 0.72 });
  drawBaseBottom(icon, palette);
}

function drawBaseTop(icon, palette) {
  drawRoundedRect(icon, {
    x: -4.8,
    y: 5,
    width: 9.6,
    height: 4.2,
    radius: 1.2,
    fill: palette.base,
    alpha: 0.95,
    stroke: palette.baseStroke,
    strokeWidth: 1.1
  });
}

function drawBaseBottom(icon, palette) {
  drawRoundedRect(icon, {
    x: -3.4,
    y: 9,
    width: 6.8,
    height: 2.3,
    radius: 0.8,
    fill: palette.base,
    alpha: 0.9,
    stroke: palette.baseStroke,
    strokeWidth: 0.8
  });
}

function drawCircle(graphics, shape) {
  if (typeof graphics.circle === "function") {
    graphics.circle(shape.x, shape.y, shape.radius).fill({ color: shape.fill, alpha: shape.alpha });
    strokeShape(graphics, shape);
    return;
  }

  graphics.beginFill(shape.fill, shape.alpha);
  lineStyle(graphics, shape);
  graphics.drawCircle(shape.x, shape.y, shape.radius);
  graphics.endFill();
}

function drawEllipse(graphics, shape) {
  if (typeof graphics.ellipse === "function") {
    graphics
      .ellipse(shape.x, shape.y, shape.width, shape.height)
      .fill({ color: shape.fill, alpha: shape.alpha })
      .stroke({ color: shape.stroke, alpha: 0.95, width: shape.strokeWidth });
    return;
  }

  graphics.beginFill(shape.fill, shape.alpha);
  lineStyle(graphics, shape);
  graphics.drawEllipse(shape.x, shape.y, shape.width, shape.height);
  graphics.endFill();
}

function drawRoundedRect(graphics, shape) {
  if (typeof graphics.roundRect === "function") {
    graphics
      .roundRect(shape.x, shape.y, shape.width, shape.height, shape.radius)
      .fill({ color: shape.fill, alpha: shape.alpha })
      .stroke({ color: shape.stroke, alpha: 0.86, width: shape.strokeWidth });
    return;
  }

  graphics.beginFill(shape.fill, shape.alpha);
  lineStyle(graphics, shape);
  graphics.drawRoundedRect(shape.x, shape.y, shape.width, shape.height, shape.radius);
  graphics.endFill();
}

function drawPolygon(graphics, shape) {
  if (typeof graphics.poly === "function") {
    graphics
      .poly(shape.points)
      .fill({ color: shape.fill, alpha: shape.alpha })
      .stroke({ color: shape.stroke, alpha: 0.85, width: shape.strokeWidth });
    return;
  }

  graphics.beginFill(shape.fill, shape.alpha);
  lineStyle(graphics, shape);
  graphics.drawPolygon(shape.points);
  graphics.endFill();
}

function drawLine(graphics, shape) {
  if (typeof graphics.stroke !== "function") {
    graphics.lineStyle(shape.width, shape.color, shape.alpha);
  }

  graphics.moveTo(shape.points[0], shape.points[1]);
  for (let index = 2; index < shape.points.length; index += 2) {
    graphics.lineTo(shape.points[index], shape.points[index + 1]);
  }

  if (typeof graphics.stroke === "function") {
    graphics.stroke({ color: shape.color, alpha: shape.alpha, width: shape.width });
  }
}

function strokeShape(graphics, shape) {
  if (shape.stroke === undefined || !shape.strokeWidth) return;
  graphics.stroke({ color: shape.stroke, alpha: shape.strokeAlpha ?? 0.95, width: shape.strokeWidth });
}

function lineStyle(graphics, shape) {
  if (shape.stroke === undefined || !shape.strokeWidth) return;
  graphics.lineStyle(shape.strokeWidth, shape.stroke, shape.strokeAlpha ?? 0.95);
}
