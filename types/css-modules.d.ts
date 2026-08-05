// Ambient typing for CSS Modules so `tsc --noEmit` resolves `*.module.css`
// imports without a prior `next build`. Next.js handles the real CSS at build.
declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
