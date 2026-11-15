import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';

export const spec: PlotSpec = {
  width: 440,
  height: 300,
  title: 'Price, rating and sales',
  description: 'Products by price and rating; each bubble is sized by monthly sales.',
  data: [
    { product: 'Laptops', price: 1200, rating: 4.2, sales: 180 },
    { product: 'Headphones', price: 280, rating: 4.5, sales: 320 },
    { product: 'Smartphones', price: 950, rating: 4.3, sales: 290 },
    { product: 'Tablets', price: 650, rating: 4.1, sales: 140 },
    { product: 'Monitors', price: 480, rating: 4.4, sales: 160 },
    { product: 'Keyboards', price: 120, rating: 4.6, sales: 410 },
    { product: 'Mice', price: 80, rating: 4.5, sales: 520 },
    { product: 'Webcams', price: 150, rating: 4.2, sales: 230 },
    { product: 'Speakers', price: 350, rating: 4.4, sales: 280 },
  ],
  x: { label: 'Price ($)' },
  y: { label: 'Rating', domain: [4, 4.7] },
  r: { range: [4, 22] },
  marks: [
    {
      mark: 'dot',
      x: 'price',
      y: 'rating',
      r: 'sales',
      fill: { value: '#6366f1' },
      opacity: 0.55,
      title: 'product',
    },
  ],
};
