export interface EolEntry {
  eol: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  note: string;
}

export const EOL_PACKAGES: Record<string, EolEntry> = {
  // JavaScript - EOL / Legacy
  'angular': { eol: 'Dec 2021', risk: 'critical', note: 'AngularJS (v1.x) EOL. Migrate to Angular 2+' },
  'angularjs': { eol: 'Dec 2021', risk: 'critical', note: 'AngularJS EOL. Migrate to Angular 2+' },
  'bower': { eol: '2017', risk: 'critical', note: 'Bower deprecated 2017. Use npm/yarn' },
  'grunt': { eol: 'declining', risk: 'high', note: 'Grunt declining. Migrate to Vite/esbuild' },
  'gulp': { eol: 'declining', risk: 'medium', note: 'Gulp declining. Consider Vite/esbuild' },
  'coffeescript': { eol: 'abandoned', risk: 'critical', note: 'CoffeeScript abandoned. Migrate to TypeScript' },
  'request': { eol: 'Feb 2020', risk: 'critical', note: '"request" deprecated. Use fetch or axios' },
  'node-sass': { eol: '2022', risk: 'high', note: 'node-sass deprecated. Use "sass" (Dart Sass)' },
  'tslint': { eol: '2019', risk: 'high', note: 'TSLint deprecated 2019. Use ESLint' },
  'backbone': { eol: 'unmaintained', risk: 'high', note: 'Backbone.js unmaintained. Consider React/Vue' },
  'ember': { eol: 'maintained', risk: 'medium', note: 'Ember.js maintained but declining market share' },
  'phonegap': { eol: 'Oct 2020', risk: 'critical', note: 'PhoneGap EOL. Migrate to Capacitor/React Native' },
  'cordova': { eol: 'declining', risk: 'high', note: 'Cordova declining. Migrate to Capacitor' },
  'jquery': { eol: 'legacy', risk: 'medium', note: 'jQuery is legacy. Consider vanilla JS or modern framework' },
  'moment': { eol: 'legacy', risk: 'medium', note: 'Moment.js in legacy mode. Use date-fns or dayjs' },
  'underscore': { eol: 'maintained', risk: 'low', note: 'Underscore.js maintained but superseded by lodash' },
  'webpack': { eol: 'v4 legacy', risk: 'medium', note: 'Webpack v4 EOL. Upgrade to v5 or migrate to Vite' },
  'create-react-app': { eol: '2023', risk: 'critical', note: 'CRA deprecated. Migrate to Vite or Next.js' },

  // Node.js built-in (deprecated APIs)
  'querystring': { eol: 'legacy', risk: 'medium', note: 'querystring module legacy. Use URLSearchParams' },

  // Python
  'python2': { eol: 'Jan 2020', risk: 'critical', note: 'Python 2 EOL. Migrate to Python 3' },
  'django-old': { eol: 'version-based', risk: 'medium', note: 'Check Django version: < 3.2 is EOL' },
  'flask-restplus': { eol: 'unmaintained', risk: 'high', note: 'flask-restplus unmaintained. Use flask-restx' },
  'distribute': { eol: 'merged', risk: 'high', note: 'distribute merged into setuptools 2013' },
  'pil': { eol: '2011', risk: 'critical', note: 'PIL EOL 2011. Use Pillow' },

  // Ruby
  'rails': { eol: 'version-based', risk: 'medium', note: 'Check Rails version for EOL status' },

  // PHP
  'php5': { eol: 'Dec 2018', risk: 'critical', note: 'PHP 5.x EOL Dec 2018. Upgrade to PHP 8+' },

  // Java/JVM
  'log4j': { eol: 'CVE', risk: 'critical', note: 'Log4j has critical CVE-2021-44228. Upgrade immediately' },
  'struts': { eol: 'CVE', risk: 'critical', note: 'Apache Struts has known CVEs. Review carefully' },

  // CSS / Preprocessors
  'compass': { eol: 'unmaintained', risk: 'high', note: 'Compass unmaintained since 2017' },

  // Build tools / Infra
  'travis-ci': { eol: 'declining', risk: 'medium', note: 'Travis CI pricing changed. Consider GitHub Actions' },
};

// File patterns that indicate legacy code
export const LEGACY_FILE_PATTERNS: { pattern: RegExp; note: string; risk: 'low' | 'medium' | 'high' | 'critical' }[] = [
  { pattern: /\.coffee$/i, note: 'CoffeeScript file (abandoned language)', risk: 'critical' },
  { pattern: /\.php$/i, note: 'PHP file — check version compatibility', risk: 'medium' },
  { pattern: /Gruntfile\.(js|ts)$/i, note: 'Grunt build system (legacy)', risk: 'high' },
  { pattern: /Gulpfile\.(js|ts)$/i, note: 'Gulp build system (declining)', risk: 'medium' },
  { pattern: /\.htaccess$/i, note: 'Apache .htaccess (server-side config)', risk: 'low' },
  { pattern: /bower\.json$/i, note: 'Bower package file (deprecated 2017)', risk: 'critical' },
  { pattern: /tslint\.json$/i, note: 'TSLint config (deprecated 2019)', risk: 'high' },
  { pattern: /\.jshintrc$/i, note: 'JSHint config (largely replaced by ESLint)', risk: 'medium' },
  { pattern: /\.babelrc$/i, note: 'Babel config — consider modern build tools', risk: 'low' },
];

// C/C++ system headers that are EOL or platform-specific
export const LEGACY_C_INCLUDES: Record<string, EolEntry> = {
  'windef.h': { eol: 'windows-only', risk: 'medium', note: 'Windows-only header, limits portability' },
  'windows.h': { eol: 'windows-only', risk: 'medium', note: 'Windows-only, not portable to Linux/macOS' },
  'conio.h': { eol: 'non-standard', risk: 'high', note: 'Non-standard DOS-era header (conio.h), non-portable' },
  'io.h': { eol: 'non-standard', risk: 'medium', note: 'MSVC-specific, not standard C' },
  'direct.h': { eol: 'non-standard', risk: 'medium', note: 'MSVC-specific directory functions' },
  'alloca.h': { eol: 'non-standard', risk: 'low', note: 'alloca.h is non-standard (GNU extension)' },
};
