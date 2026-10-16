/** A 2 × 2 black-and-white checker drawn on a canvas, so the test needs no image file. */
export const checkerUrl = (): string => {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  const context = canvas.getContext('2d');
  if (context !== null) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 2, 2);
    context.fillStyle = '#000000';
    context.fillRect(0, 0, 1, 1);
    context.fillRect(1, 1, 1, 1);
  }
  return canvas.toDataURL();
};
