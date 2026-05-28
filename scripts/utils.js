export function isTruthyValue(value) {
  if (Array.isArray(value)) return value.some(isTruthyValue);
  return value === true || value === "true" || value === 1 || value === "1" || value === "on";
}

export function cloneConfig(config) {
  return structuredClone(config ?? {});
}

export function hasClassAncestor(element, className) {
  let parent = element.parentElement;

  while (parent) {
    if (parent.className?.split(" ").includes(className)) return true;
    parent = parent.parentElement;
  }

  return false;
}

export function getHTMLElement(html) {
  if (typeof HTMLElement !== "undefined" && html instanceof HTMLElement) return html;
  if (typeof html?.querySelector === "function") return html;
  if (Array.isArray(html)) return html[0] ?? null;
  if (html?.jquery) return html[0] ?? null;
  if (typeof html?.get === "function") return html.get(0) ?? null;
  return null;
}

export function drawCircle(graphics, shape) {
  if (typeof graphics.circle === "function") {
    graphics.circle(shape.x, shape.y, shape.radius).fill({ color: shape.fill, alpha: shape.alpha });
    strokeShape(graphics, shape);
    return;
  }

  drawLegacyShape(graphics, shape, () => {
    graphics.drawCircle(shape.x, shape.y, shape.radius);
  });
}

export function drawEllipse(graphics, shape) {
  if (typeof graphics.ellipse === "function") {
    graphics
      .ellipse(shape.x, shape.y, shape.width, shape.height)
      .fill({ color: shape.fill, alpha: shape.alpha })
      .stroke({ color: shape.stroke, alpha: 0.95, width: shape.strokeWidth });
    return;
  }

  drawLegacyShape(graphics, shape, () => {
    graphics.drawEllipse(shape.x, shape.y, shape.width, shape.height);
  });
}

export function drawRoundedRect(graphics, shape) {
  if (typeof graphics.roundRect === "function") {
    graphics
      .roundRect(shape.x, shape.y, shape.width, shape.height, shape.radius)
      .fill({ color: shape.fill, alpha: shape.alpha })
      .stroke({ color: shape.stroke, alpha: 0.86, width: shape.strokeWidth });
    return;
  }

  drawLegacyShape(graphics, shape, () => {
    graphics.drawRoundedRect(shape.x, shape.y, shape.width, shape.height, shape.radius);
  });
}

export function drawPolygon(graphics, shape) {
  if (typeof graphics.poly === "function") {
    graphics
      .poly(shape.points)
      .fill({ color: shape.fill, alpha: shape.alpha })
      .stroke({ color: shape.stroke, alpha: 0.85, width: shape.strokeWidth });
    return;
  }

  drawLegacyShape(graphics, shape, () => {
    graphics.drawPolygon(shape.points);
  });
}

export function drawLine(graphics, shape) {
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

function drawLegacyShape(graphics, shape, draw) {
  graphics.beginFill(shape.fill, shape.alpha);
  lineStyle(graphics, shape);
  draw();
  graphics.endFill();
}

function lineStyle(graphics, shape) {
  if (shape.stroke === undefined || !shape.strokeWidth) return;
  graphics.lineStyle(shape.strokeWidth, shape.stroke, shape.strokeAlpha ?? 0.95);
}
