/** `colour` mixed `amount` of the way towards white: the hovered or pinned bar. */
export const lighten = (colour: number, amount: number): number => {
  const channel = (shift: number): number => {
    const value = (colour >> shift) & 0xff;
    return Math.round(value + (255 - value) * amount) << shift;
  };
  return channel(16) | channel(8) | channel(0);
};
