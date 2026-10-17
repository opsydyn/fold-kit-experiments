/** Font files bundled with the e2e pages: Bun's file loader imports each as its URL. */
declare module '*.woff' {
  const url: string;
  export default url;
}
