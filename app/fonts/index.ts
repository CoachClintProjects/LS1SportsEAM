import localFont from 'next/font/local';

// Bundled under the SIL Open Font License in OFL.txt; no build-time font fetch.
export const workspaceFont = localFont({
  src: './LexendDeca-Variable.ttf',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
});
