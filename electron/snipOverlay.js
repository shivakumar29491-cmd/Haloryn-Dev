const { ipcRenderer } = require('electron');

let startX = 0;
let startY = 0;
let isDragging = false;

const box = document.getElementById("selectionBox");

window.addEventListener("load", () => {
  window.focus();
});

window.addEventListener("mousedown", (e) => {
  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;

  box.style.left = `${startX}px`;
  box.style.top = `${startY}px`;
  box.style.width = "0px";
  box.style.height = "0px";
  box.style.display = "block";
});

window.addEventListener("mousemove", (e) => {
  if (!isDragging) return;

  const x = Math.min(e.clientX, startX);
  const y = Math.min(e.clientY, startY);
  const w = Math.abs(e.clientX - startX);
  const h = Math.abs(e.clientY - startY);

  box.style.left = `${x}px`;
  box.style.top = `${y}px`;
  box.style.width = `${w}px`;
  box.style.height = `${h}px`;
});

window.addEventListener("mouseup", (e) => {
  if (!isDragging) return;
  isDragging = false;

  const rect = {
    x: Math.max(0, parseInt(box.style.left) || 0),
    y: Math.max(0, parseInt(box.style.top) || 0),
    width: Math.max(0, parseInt(box.style.width) || 0),
    height: Math.max(0, parseInt(box.style.height) || 0)
  };

  box.style.display = "none";

  if (rect.width > 4 && rect.height > 4) {
    ipcRenderer.send("screenread:selection", rect);
  } else {
    ipcRenderer.send("screenread:selection-cancel");
  }

  window.close(); // closes overlay window
});

window.addEventListener("keyup", (e) => {
  if (e.key === "Escape") {
    ipcRenderer.send("screenread:selection-cancel");
    window.close();
  }
});
