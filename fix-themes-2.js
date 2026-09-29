const fs = require('fs');

const darkCss = `[data-theme='dark'],
.dark {
  --helpers-os-appearance: Dark;
  --hue: 0;
  --chroma: 0;
  --surface: 0.17;
  --elevation-step: 0.02;
  --contrast: 0.5;
  --foreground-lightness: 0.95;
  --muted-foreground-level: 0.8;
  --tertiary-foreground-level: 0.65;
  --field-alpha: 0.12;

  --code-block-5: 0deg 0% 70%;
  --code-block-4: 0deg 0% 75%;
  --code-block-3: 0deg 0% 63%;
  --code-block-2: 0deg 0% 76%;
  --code-block-1: 0deg 0% 61%;

  --secondary-default: 0deg 0% 70%;
  --secondary-400: 0deg 0% 25%;
  --secondary-200: 0deg 0% 11%;
  
  --brand-link: 0deg 0% 90%;
  --brand-default: 0deg 0% 25%;
  --brand-600: 0deg 0% 32%;
  --brand-500: 0deg 0% 25%;
  --brand-400: 0deg 0% 18%;
  --brand-300: 0deg 0% 14%;
  --brand-200: 0deg 0% 10%;
  
  --warning-default: 0deg 0% 70%;
  --warning-600: 0deg 0% 70%;
  --warning-500: 0deg 0% 22%;
  --warning-400: 0deg 0% 15%;
  --warning-300: 0deg 0% 10%;
  --warning-200: 0deg 0% 8%;
  
  --destructive-default: 0deg 0% 70%;
  --destructive-600: 0deg 0% 63%;
  --destructive-500: 0deg 0% 29%;
  --destructive-400: 0deg 0% 21%;
  --destructive-300: 0deg 0% 15%;
  --destructive-200: 0deg 0% 9%;
}
`;

const lightCss = `[data-theme='light'],
.light {
  --helpers-os-appearance: Light;
  --hue: 0;
  --surface-hue: 0;
  --chroma: 0;
  
  --surface: 0.99;
  --elevation-step: -0.015;
  --contrast: 0.53;
  --foreground-lightness: 0.1;
  --muted-foreground-level: 0.65;
  --tertiary-foreground-level: 0.5;
  
  --warning-lightness: 0.68;
  --destructive-lightness: 0.52;
  --info-lightness: 0.54;

  --code-block-5: 0deg 0% 40%;
  --code-block-4: 0deg 0% 45%;
  --code-block-3: 0deg 0% 33%;
  --code-block-2: 0deg 0% 46%;
  --code-block-1: 0deg 0% 31%;

  --code-token-string: #000000;
  --code-token-string-expression: #000000;

  --secondary-default: 0deg 0% 40%;
  --secondary-400: 0deg 0% 85%;
  --secondary-200: 0deg 0% 95%;
  
  --brand-link: 0deg 0% 15%;
  --brand-default: 0deg 0% 15%;
  --brand-600: 0deg 0% 20%;
  --brand-500: 0deg 0% 15%;
  --brand-400: 0deg 0% 65%;
  --brand-300: 0deg 0% 82%;
  --brand-200: 0deg 0% 93%;
  
  --warning-default: 0deg 0% 40%;
  --warning-600: 0deg 0% 40%;
  --warning-500: 0deg 0% 67%;
  --warning-400: 0deg 0% 81%;
  --warning-300: 0deg 0% 91%;
  --warning-200: 0deg 0% 97%;
  
  --destructive-default: 0deg 0% 40%;
  --destructive-600: 0deg 0% 43%;
  --destructive-500: 0deg 0% 79%;
  --destructive-400: 0deg 0% 91%;
  --destructive-300: 0deg 0% 96%;
  --destructive-200: 0deg 0% 99%;
}
`;

fs.writeFileSync('supabase/packages/ui/build/css/themes/dark.css', darkCss);
fs.writeFileSync('supabase/packages/ui/build/css/themes/light.css', lightCss);