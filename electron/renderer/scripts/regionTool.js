const overlay = document.getElementById("regionOverlay");
const rectEl = document.getElementById("regionRect");

const MIN_SIZE = 32;
let displayOffset = { x: 0, y: 0 };
let overlayBounds = { width: window.innerWidth, height: window.innerHeight };
let selection = { x: 0, y: 0, width: 0, height: 0 };
let pointerId = null;
let startPoint = null;
let selectionVisible = false;
let fallbackRegion = null;
let hasSelection = false;

function clampSelection(sel) {
  const clamped = { ...sel };
  clamped.width = Math.max(0, Math.min(clamped.width, overlayBounds.width));
  clamped.height = Math.max(0, Math.min(clamped.height, overlayBounds.height));
  clamped.x = Math.max(0, Math.min(clamped.x, overlayBounds.width - clamped.width));
  clamped.y = Math.max(0, Math.min(clamped.y, overlayBounds.height - clamped.height));
  return clamped;
}

function showSelection() {
  selectionVisible = true;
  hasSelection = true;
  rectEl.style.display = "block";
  applySelection();
}

function hideSelection() {
  selectionVisible = false;
  hasSelection = false;
  rectEl.style.display = "none";
}

function applySelection() {
  const clamped = clampSelection(selection);
  selection = clamped;
  if (!selectionVisible) return;
  rectEl.style.left = `${clamped.x}px`;
  rectEl.style.top = `${clamped.y}px`;
  rectEl.style.width = `${clamped.width}px`;
  rectEl.style.height = `${clamped.height}px`;
}

function relativeToOverlay(initialRegion) {
  if (!initialRegion) return null;
  return {
    x: initialRegion.x - displayOffset.x,
    y: initialRegion.y - displayOffset.y,
    width: initialRegion.width,
    height: initialRegion.height
  };
}

function toAbsolutePayload(sel) {
  return {
    x: Math.round(sel.x + displayOffset.x),
    y: Math.round(sel.y + displayOffset.y),
    width: Math.round(sel.width),
    height: Math.round(sel.height)
  };
}

function confirmSelectionIfValid() {
  if (hasSelection) {
    if (selection.width >= MIN_SIZE && selection.height >= MIN_SIZE) {
      window.regionToolAPI?.confirm(toAbsolutePayload(selection));
      return true;
    }
    if (fallbackRegion) {
      window.regionToolAPI?.confirm(toAbsolutePayload(fallbackRegion));
      return true;
    }
  } else if (fallbackRegion) {
    window.regionToolAPI?.confirm(toAbsolutePayload(fallbackRegion));
    return true;
  }
  return false;
}

function cancelSelection() {
  hideSelection();
  window.regionToolAPI?.cancel();
}

function beginDraw(event) {
  if (event.button !== 0) return;
  if (pointerId) return;
  pointerId = event.pointerId;
  startPoint = { x: event.clientX, y: event.clientY };
  selection = {
    x: startPoint.x,
    y: startPoint.y,
    width: 1,
    height: 1
  };
  overlay.setPointerCapture(pointerId);
  showSelection();
  event.preventDefault();
}

overlay.addEventListener("pointerdown", (event) => {
  if (event.button === 2) {
    cancelSelection();
    return;
  }
  beginDraw(event);
});

overlay.addEventListener("pointermove", (event) => {
  if (!pointerId || event.pointerId !== pointerId) return;
  const dx = event.clientX - startPoint.x;
  const dy = event.clientY - startPoint.y;

  selection = {
    x: dx >= 0 ? startPoint.x : startPoint.x + dx,
    y: dy >= 0 ? startPoint.y : startPoint.y + dy,
    width: Math.abs(dx),
    height: Math.abs(dy)
  };

  applySelection();
});

function finalizeDraw(event) {
  if (!pointerId || event.pointerId !== pointerId) return;
  overlay.releasePointerCapture(pointerId);
  pointerId = null;
  startPoint = null;

  requestAnimationFrame(() => {
    if (!confirmSelectionIfValid()) {
      hideSelection();
    }
  });
}

overlay.addEventListener("pointerup", finalizeDraw);
overlay.addEventListener("pointercancel", () => {
  if (!pointerId) return;
  overlay.releasePointerCapture(pointerId);
  pointerId = null;
  startPoint = null;
  hideSelection();
});

overlay.addEventListener("contextmenu", (event) => event.preventDefault());

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    cancelSelection();
  } else if (event.key === "Enter") {
    if (!confirmSelectionIfValid()) {
      hideSelection();
    }
  }
});

window.regionToolAPI?.onInit((payload = {}) => {
  displayOffset = payload.displayBounds || { x: 0, y: 0 };
  overlayBounds = {
    width: window.innerWidth,
    height: window.innerHeight
  };

  const rel = relativeToOverlay(payload.initialRegion);
  fallbackRegion =
    rel && rel.width >= MIN_SIZE && rel.height >= MIN_SIZE ? clampSelection(rel) : null;
  selection = { x: 0, y: 0, width: 0, height: 0 };
  hideSelection();
});

window.addEventListener("resize", () => {
  overlayBounds = {
    width: window.innerWidth,
    height: window.innerHeight
  };
  applySelection();
});
