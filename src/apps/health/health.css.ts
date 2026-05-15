import { keyframes, style } from "@vanilla-extract/css";

const shimmer = keyframes({
	"0%": { backgroundPosition: "-200% 0" },
	"100%": { backgroundPosition: "200% 0" },
});

const skeletonBase = {
	borderRadius: "4px",
	background: "linear-gradient(90deg, #e5e5e5 25%, #f0f0f0 50%, #e5e5e5 75%)",
	backgroundSize: "200% 100%",
	animation: `${shimmer} 1.4s infinite linear`,
};

export const cardValueError = style({
	color: "#dc2626",
});

export const skeletonLabel = style({
	...skeletonBase,
	height: "11px",
	width: "42%",
	marginBottom: "0.5rem",
});
export const skeletonValueLg = style({
	...skeletonBase,
	height: "2rem",
	width: "52%",
});
export const skeletonValueMd = style({
	...skeletonBase,
	height: "1rem",
	width: "72%",
});
export const skeletonSub = style({
	...skeletonBase,
	height: "10px",
	width: "58%",
	marginTop: "0.3rem",
});

export const grid = style({
	display: "grid",
	gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
	gap: "1rem",
	maxWidth: "700px",
});

export const card = style({
	background: "#fff",
	border: "1px solid #e5e5e5",
	borderRadius: "10px",
	padding: "1.25rem 1.5rem",
});

export const cardLabel = style({
	fontSize: "0.75rem",
	fontWeight: 600,
	textTransform: "uppercase",
	letterSpacing: "0.06em",
	color: "#888",
	marginBottom: "0.4rem",
});

export const cardValue = style({
	fontSize: "1.5rem",
	fontWeight: 700,
	color: "#111",
	fontVariantNumeric: "tabular-nums",
});

export const cardValueOk = style({
	color: "#16a34a",
});

export const cardValueSmall = style({
	fontSize: "1rem",
});

export const cardSub = style({
	fontSize: "0.8rem",
	color: "#888",
	marginTop: "0.25rem",
});
