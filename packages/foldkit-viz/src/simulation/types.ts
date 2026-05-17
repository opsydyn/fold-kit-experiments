export interface SimNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  index: number;
  fx?: number;
  fy?: number;
}

export interface Force {
  (alpha: number): void;
  initialize(nodes: SimNode[], random: () => number): void;
}
