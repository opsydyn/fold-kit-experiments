export const barData = ['Jan', 'Feb', 'Mar', 'Apr'].flatMap((month, i) =>
  ['Core', 'Tools', 'Community'].map((series, j) => ({
    id: `${month}-${series}`,
    month,
    series,
    value: 12 + ((i * 13 + j * 19) % 45),
  })),
);
export const barAccessors = {
  key: (d: (typeof barData)[number]) => d.id,
  category: (d: (typeof barData)[number]) => d.month,
  series: (d: (typeof barData)[number]) => d.series,
  value: (d: (typeof barData)[number]) => d.value,
};
