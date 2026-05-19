import { DependencyGraph, FileNode, GraphEdge, RiskFactor, RiskLevel, UploadedFile, EolMatch } from './types';
import { EOL_PACKAGES, LEGACY_FILE_PATTERNS, LEGACY_C_INCLUDES } from './eol-patterns';

const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp',
  '.mp4', '.mp3', '.wav', '.pdf', '.zip', '.tar', '.gz',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.lock', '.sum',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', '__pycache__', '.venv', 'venv',
  'dist', 'build', '.cache', 'coverage', '.nyc_output',
]);

// Language detection from extension
function detectLanguage(ext: string): string {
  const map: Record<string, string> = {
    '.ts': 'TypeScript', '.tsx': 'TypeScript (JSX)',
    '.js': 'JavaScript', '.jsx': 'JavaScript (JSX)', '.mjs': 'JavaScript',
    '.py': 'Python',
    '.c': 'C', '.h': 'C Header',
    '.cpp': 'C++', '.cc': 'C++', '.cxx': 'C++', '.hpp': 'C++ Header',
    '.cs': 'C#',
    '.java': 'Java',
    '.rb': 'Ruby',
    '.go': 'Go',
    '.rs': 'Rust',
    '.php': 'PHP',
    '.swift': 'Swift',
    '.kt': 'Kotlin',
    '.dart': 'Dart',
    '.sh': 'Shell', '.bash': 'Shell',
    '.bat': 'Batch', '.cmd': 'Batch',
    '.coffee': 'CoffeeScript',
    '.cob': 'COBOL', '.cbl': 'COBOL', '.cobol': 'COBOL', '.cpy': 'COBOL Copybook',
    '.f': 'Fortran', '.f90': 'Fortran', '.f95': 'Fortran', '.for': 'Fortran',
    '.pas': 'Pascal', '.pp': 'Pascal',
    '.pl': 'Perl', '.pm': 'Perl',
    '.asm': 'Assembly', '.s': 'Assembly',
    '.html': 'HTML', '.htm': 'HTML',
    '.css': 'CSS', '.scss': 'SCSS', '.sass': 'SCSS', '.less': 'Less',
    '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML', '.toml': 'TOML',
    '.md': 'Markdown', '.txt': 'Text',
    '.sql': 'SQL',
  };
  return map[ext.toLowerCase()] || 'Unknown';
}

// Extract JS/TS imports
function extractJsImports(content: string): { packages: string[]; relativeImports: string[] } {
  const packages: string[] = [];
  const relativeImports: string[] = [];

  const patterns = [
    /(?:import|from)\s+['"]([^'"]+)['"]/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const imp = match[1];
      if (imp.startsWith('.')) {
        relativeImports.push(imp);
      } else {
        // Get top-level package name
        const pkg = imp.startsWith('@') ? imp.split('/').slice(0, 2).join('/') : imp.split('/')[0];
        packages.push(pkg);
      }
    }
  }

  return { packages: [...new Set(packages)], relativeImports: [...new Set(relativeImports)] };
}

// Extract Python imports
function extractPyImports(content: string): { packages: string[]; relativeImports: string[]; dottedImports: string[] } {
  const packages: string[] = [];
  const relativeImports: string[] = [];
  const dottedImports: string[] = [];
  const STDLIB = new Set(['os', 'sys', 'io', 're', 'json', 'time', 'math', 'random', 'collections',
    'itertools', 'functools', 'pathlib', 'shutil', 'subprocess', 'threading', 'logging',
    'unittest', 'argparse', 'copy', 'datetime', 'hashlib', 'struct', 'socket', 'typing',
    'enum', 'abc', 'contextlib', 'dataclasses', 'string', 'textwrap', 'csv', 'configparser',
    'builtins', 'warnings', 'traceback', 'inspect', 'types', 'operator', 'weakref',
    'gc', 'platform', 'signal', 'queue', 'asyncio', 'concurrent', 'multiprocessing',
    'urllib', 'http', 'email', 'html', 'xml', 'base64', 'hmac', 'secrets',
  ]);

  // Top-level: import foo or from foo import bar — capture first segment
  const pkgPattern = /^(?:import|from)\s+([a-zA-Z0-9_]+)/gm;
  // Dotted: from foo.bar.baz import → capture full dotted path
  const dottedPattern = /^from\s+([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)\s+import/gm;
  // Dotted import: import foo.bar.baz
  const importDotted = /^import\s+([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)/gm;
  // Relative: from . import or from .module import
  const relPattern = /^from\s+(\.+[a-zA-Z0-9_.]*)\s+import/gm;

  let match;
  while ((match = pkgPattern.exec(content)) !== null) {
    const pkg = match[1];
    if (!STDLIB.has(pkg)) packages.push(pkg);
  }
  while ((match = dottedPattern.exec(content)) !== null) {
    const dotted = match[1];
    const root = dotted.split('.')[0];
    if (!STDLIB.has(root)) dottedImports.push(dotted);
  }
  while ((match = importDotted.exec(content)) !== null) {
    const dotted = match[1];
    const root = dotted.split('.')[0];
    if (!STDLIB.has(root)) dottedImports.push(dotted);
  }
  while ((match = relPattern.exec(content)) !== null) {
    relativeImports.push(match[1]);
  }

  return { packages: [...new Set(packages)], relativeImports: [...new Set(relativeImports)], dottedImports: [...new Set(dottedImports)] };
}

// Extract C/C++ includes
function extractCIncludes(content: string): { packages: string[]; relativeImports: string[] } {
  const packages: string[] = [];
  const relativeImports: string[] = [];

  // System includes: #include <file.h>
  const sysPattern = /#include\s+<([^>]+)>/g;
  // Local includes: #include "file.h"
  const localPattern = /#include\s+"([^"]+)"/g;

  let match;
  while ((match = sysPattern.exec(content)) !== null) {
    packages.push(match[1]);
  }
  while ((match = localPattern.exec(content)) !== null) {
    relativeImports.push('./' + match[1]);
  }

  return { packages: [...new Set(packages)], relativeImports: [...new Set(relativeImports)] };
}

// Extract Swift imports (framework-level)
function extractSwiftImports(content: string): { packages: string[]; relativeImports: string[] } {
  const packages: string[] = [];
  // `import UIKit`, `import Foundation`, `import MyFramework`
  const pattern = /^import\s+([A-Za-z_][A-Za-z0-9_.]+)/gm;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    packages.push(match[1]);
  }
  return { packages: [...new Set(packages)], relativeImports: [] };
}

// Extract Swift type definitions (class/struct/protocol/enum/actor)
function extractSwiftTypeDefs(content: string): string[] {
  const defs: string[] = [];
  const pattern = /\b(?:class|struct|protocol|enum|actor|typealias)\s+([A-Z][A-Za-z0-9_]*)/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    defs.push(match[1]);
  }
  return [...new Set(defs)];
}

// Extract Go imports
function extractGoImports(content: string): { packages: string[]; relativeImports: string[] } {
  const packages: string[] = [];
  // Single: import "pkg/path"
  // Block: import ( "pkg" \n "pkg2" )
  const single = /import\s+"([^"]+)"/g;
  const block = /import\s*\(([^)]+)\)/g;
  let m;
  while ((m = single.exec(content)) !== null) packages.push(m[1].split('/').pop() || m[1]);
  while ((m = block.exec(content)) !== null) {
    const inner = m[1];
    const line = /"([^"]+)"/g;
    let l;
    while ((l = line.exec(inner)) !== null) packages.push(l[1].split('/').pop() || l[1]);
  }
  return { packages: [...new Set(packages)], relativeImports: [] };
}

// Extract COBOL dependencies (COPY books + CALL statements)
function extractCobolDeps(content: string): { packages: string[]; relativeImports: string[] } {
  const relativeImports: string[] = [];
  // COPY FILENAME. or COPY "filename"  — links to .cpy copybooks
  const copyPat = /\bCOPY\s+["']?([A-Z0-9][A-Z0-9-]*)["']?\s*[.\n]/gi;
  // CALL 'PROGRAM' or CALL "PROGRAM" — links to other COBOL programs
  const callPat = /\bCALL\s+["']([A-Z0-9][A-Z0-9-]*)["']/gi;
  let m;
  while ((m = copyPat.exec(content)) !== null) relativeImports.push('./' + m[1]);
  while ((m = callPat.exec(content)) !== null) relativeImports.push('./' + m[1]);
  return { packages: [], relativeImports: [...new Set(relativeImports)] };
}

// Extract Assembly includes
function extractAsmDeps(content: string): { packages: string[]; relativeImports: string[] } {
  const relativeImports: string[] = [];
  // %include "file.asm" / INCLUDE file.asm / .include "file.s"
  const pat = /(?:%include|\.include|INCLUDE)\s+["']?([^\s"';\n]+)["']?/gi;
  let m;
  while ((m = pat.exec(content)) !== null) relativeImports.push('./' + m[1]);
  return { packages: [], relativeImports: [...new Set(relativeImports)] };
}

// Extract Ruby requires
function extractRubyImports(content: string): { packages: string[]; relativeImports: string[] } {
  const packages: string[] = [];
  const relativeImports: string[] = [];
  const reqRel = /require_relative\s+['"]([^'"]+)['"]/g;
  const req    = /^\s*require\s+['"]([^'"]+)['"]/gm;
  let m;
  while ((m = reqRel.exec(content)) !== null) relativeImports.push('./' + m[1]);
  while ((m = req.exec(content)) !== null) {
    const p = m[1];
    if (!p.startsWith('.')) packages.push(p.split('/')[0]);
  }
  return { packages: [...new Set(packages)], relativeImports: [...new Set(relativeImports)] };
}

function extractImports(content: string, ext: string): { packages: string[]; relativeImports: string[]; dottedImports?: string[] } {
  const e = ext.toLowerCase();
  if (['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(e)) return extractJsImports(content);
  if (e === '.py') return extractPyImports(content);
  if (['.c', '.cpp', '.cc', '.cxx', '.h', '.hpp'].includes(e)) return extractCIncludes(content);
  if (e === '.swift') return extractSwiftImports(content);
  if (e === '.go') return extractGoImports(content);
  if (e === '.rb') return extractRubyImports(content);
  if (['.cob', '.cbl', '.cobol', '.cpy'].includes(e)) return extractCobolDeps(content);
  if (['.asm', '.s'].includes(e)) return extractAsmDeps(content);
  return { packages: [], relativeImports: [] };
}

// Resolve relative import to an actual file path
function resolveRelativeImport(fromPath: string, importStr: string, allPaths: string[]): string | null {
  // Normalize the base directory of the importing file
  const fromDir = fromPath.split('/').slice(0, -1).join('/');

  // Remove leading ./ and ../
  let resolved = importStr.replace(/^\.\//, '');
  if (resolved.startsWith('../')) {
    const parts = fromDir.split('/');
    let rel = resolved;
    while (rel.startsWith('../')) {
      parts.pop();
      rel = rel.slice(3);
    }
    resolved = [...parts, rel].join('/');
  } else if (importStr.startsWith('./')) {
    resolved = fromDir ? `${fromDir}/${resolved}` : resolved;
  } else if (importStr.startsWith('.')) {
    // Python relative: .module or ..module
    resolved = fromDir ? `${fromDir}/${resolved.replace(/^\.+/, '')}` : resolved.replace(/^\.+/, '');
  }

  // Try exact match or with extensions
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.c', '.h', '.cpp', '.hpp', ''];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    const found = allPaths.find(p => p === candidate || p.endsWith('/' + candidate) || p.endsWith('\\' + candidate));
    if (found) return found;
  }

  // Try index files
  const indexCandidates = [`${resolved}/index.ts`, `${resolved}/index.tsx`, `${resolved}/index.js`];
  for (const ic of indexCandidates) {
    const found = allPaths.find(p => p === ic || p.endsWith('/' + ic));
    if (found) return found;
  }

  return null;
}

// Detect EOL matches from package list
function detectEolPackages(packages: string[]): EolMatch[] {
  const matches: EolMatch[] = [];
  for (const pkg of packages) {
    const key = pkg.toLowerCase().replace(/[@/]/g, '');
    const entry = EOL_PACKAGES[pkg.toLowerCase()] || EOL_PACKAGES[key];
    if (entry) {
      matches.push({ name: pkg, ...entry });
    }
    // Check C headers for legacy
    const cEntry = LEGACY_C_INCLUDES[pkg.toLowerCase()];
    if (cEntry) {
      matches.push({ name: pkg, ...cEntry });
    }
  }
  return matches;
}

// Calculate risk score for a file
function calculateRisk(
  file: Omit<FileNode, 'riskScore' | 'riskLevel' | 'riskFactors'>,
  allNodes: Omit<FileNode, 'riskScore' | 'riskLevel' | 'riskFactors'>[],
): { score: number; level: RiskLevel; factors: RiskFactor[] } {
  const factors: RiskFactor[] = [];
  let score = 0;

  // Skip test files from high-risk scoring
  if (file.isTest) return { score: 0, level: 'safe', factors: [] };

  // 1. EOL packages
  if (file.eolPackages.length > 0) {
    for (const eol of file.eolPackages) {
      const sev = eol.risk as 'low' | 'medium' | 'high' | 'critical';
      factors.push({ type: 'EOL Dependency', description: eol.note, severity: sev });
      score += sev === 'critical' ? 35 : sev === 'high' ? 25 : sev === 'medium' ? 15 : 5;
    }
  }

  // 2. File size (lines of code)
  if (file.lines > 2000) {
    factors.push({ type: 'God File', description: `${file.lines} lines — extremely large file`, severity: 'high' });
    score += 25;
  } else if (file.lines > 1000) {
    factors.push({ type: 'Large File', description: `${file.lines} lines — consider splitting`, severity: 'medium' });
    score += 15;
  } else if (file.lines > 500) {
    factors.push({ type: 'Big File', description: `${file.lines} lines — getting large`, severity: 'low' });
    score += 5;
  }

  // 3. High coupling (many imports)
  if (file.imports.length > 15) {
    factors.push({ type: 'High Coupling', description: `${file.imports.length} external dependencies`, severity: 'high' });
    score += 20;
  } else if (file.imports.length > 8) {
    factors.push({ type: 'Moderate Coupling', description: `${file.imports.length} external dependencies`, severity: 'medium' });
    score += 10;
  }

  // 4. No tests
  if (!file.hasTests && file.lines > 50 && !['JSON', 'YAML', 'Markdown', 'Text', 'CSS', 'SCSS'].includes(file.language)) {
    factors.push({ type: 'No Tests', description: 'No associated test file found', severity: 'medium' });
    score += 15;
  }

  // 5. Legacy file patterns
  for (const pattern of LEGACY_FILE_PATTERNS) {
    if (pattern.pattern.test(file.name)) {
      factors.push({ type: 'Legacy Pattern', description: pattern.note, severity: pattern.risk });
      score += pattern.risk === 'critical' ? 35 : pattern.risk === 'high' ? 25 : pattern.risk === 'medium' ? 15 : 5;
    }
  }

  // 6. CoffeeScript
  if (file.extension === '.coffee') {
    factors.push({ type: 'CoffeeScript', description: 'CoffeeScript is abandoned. Migrate to TypeScript', severity: 'critical' });
    score += 40;
  }

  // 7. High dependents (many files depend on this one — high blast radius)
  const dependentCount = allNodes.filter(n => n.fileImports.some(fi => fi.includes(file.name.replace(/\.[^.]+$/, '')))).length;
  if (dependentCount > 10) {
    factors.push({ type: 'High Blast Radius', description: `${dependentCount} files depend on this — changes are risky`, severity: 'high' });
    score += 15;
  }

  score = Math.min(100, score);
  const level: RiskLevel = score >= 70 ? 'critical' : score >= 40 ? 'risk' : score >= 15 ? 'caution' : 'safe';

  return { score, level, factors };
}

// Detect circular dependencies (simple cycle detection)
function detectCircularDeps(nodes: FileNode[]): string[][] {
  const adjList = new Map<string, string[]>();
  for (const node of nodes) {
    adjList.set(node.id, node.deps);
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(nodeId: string, path: string[]): void {
    if (inStack.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      if (cycleStart !== -1) {
        cycles.push(path.slice(cycleStart));
      }
      return;
    }
    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    inStack.add(nodeId);

    for (const dep of adjList.get(nodeId) || []) {
      dfs(dep, [...path, nodeId]);
    }

    inStack.delete(nodeId);
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id, []);
    }
  }

  return cycles.slice(0, 10); // limit to first 10
}

const MAX_FILES = 500;
const MAX_FILE_BYTES = 200_000; // 200KB per file

export function analyzeFiles(uploadedFiles: UploadedFile[]): DependencyGraph {
  // Filter out binary/skip files and hidden dirs, and oversized files
  const validFiles = uploadedFiles.filter(f => {
    const ext = '.' + f.name.split('.').pop()!;
    if (SKIP_EXTENSIONS.has(ext.toLowerCase())) return false;
    const parts = f.path.split(/[/\\]/);
    if (parts.some(p => SKIP_DIRS.has(p))) return false;
    if (f.content.length > MAX_FILE_BYTES) return false;
    return true;
  }).slice(0, MAX_FILES);

  const allPaths = validFiles.map(f => f.path);

  // Build partial nodes
  const partialNodes: Omit<FileNode, 'riskScore' | 'riskLevel' | 'riskFactors'>[] = validFiles.map(file => {
    const ext = file.name.includes('.') ? '.' + file.name.split('.').pop()! : '';
    const lines = file.content.split('\n').length;
    const { packages, relativeImports } = extractImports(file.content, ext) as { packages: string[]; relativeImports: string[] };
    const eolPackages = detectEolPackages(packages);
    const isTest = /\.(test|spec)\.(ts|tsx|js|jsx|py)$/.test(file.name) ||
                   /^test_/.test(file.name) ||
                   /__(test|spec)__/.test(file.path);
    const language = detectLanguage(ext);

    return {
      id: file.path,
      name: file.name,
      path: file.path,
      extension: ext,
      language,
      lines,
      imports: packages,
      fileImports: relativeImports,
      deps: [],
      dependents: [],
      hasTests: false,
      isTest,
      eolPackages,
    };
  });

  // Resolve file dependencies
  const edgeMap = new Map<string, number>();

  // Map Python file stems to their paths for internal module resolution
  const pyFileStemMap = new Map<string, string>();
  // Also map dotted paths like "app.models" → "app/models.py"
  const pyDottedMap = new Map<string, string>();
  for (const p of allPaths) {
    if (p.endsWith('.py')) {
      const stem = p.split(/[/\\]/).pop()!.replace(/\.py$/, '');
      pyFileStemMap.set(stem, p);
      // Build dotted key from path: "42.OshiPay/app/models.py" → "app.models"
      const parts = p.replace(/\\/g, '/').split('/');
      const pyParts = parts.slice(1); // skip project root
      if (pyParts.length >= 2) {
        const dotted = pyParts.join('.').replace(/\.py$/, '');
        pyDottedMap.set(dotted, p);
        // Also shorter variants: last 2 segments, last 3 segments
        if (pyParts.length >= 3) {
          const short = pyParts.slice(-2).join('.').replace(/\.py$/, '');
          if (!pyDottedMap.has(short)) pyDottedMap.set(short, p);
        }
      }
    }
  }

  // Swift: build a map of typeName → filePath from all Swift type definitions
  // Used to detect implicit inter-file references (Swift files in same module don't use imports)
  const swiftTypeDefMap = new Map<string, string>(); // typeName → defining file path
  for (const node of partialNodes) {
    if (node.extension === '.swift') {
      const file = validFiles.find(f => f.path === node.id);
      if (file) {
        for (const typeName of extractSwiftTypeDefs(file.content)) {
          swiftTypeDefMap.set(typeName, node.id);
        }
      }
    }
  }

  for (const node of partialNodes) {
    const resolved: string[] = [];

    // Resolve relative imports (all languages)
    for (const fi of node.fileImports) {
      const target = resolveRelativeImport(node.path, fi, allPaths);
      if (target && target !== node.id) {
        resolved.push(target);
        const key = `${node.id}|||${target}`;
        edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
      }
    }

    // Python: also resolve absolute-style imports against local file stems
    // e.g. `from utils import x` → links to utils.py if it exists in the project
    if (node.extension === '.py') {
      const { dottedImports = [] } = extractImports(
        validFiles.find(f => f.path === node.id)?.content || '', '.py'
      ) as { packages: string[]; relativeImports: string[]; dottedImports?: string[] };

      for (const pkg of node.imports) {
        const target = pyFileStemMap.get(pkg);
        if (target && target !== node.id) {
          resolved.push(target);
          const key = `${node.id}|||${target}`;
          edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
        }
      }
      // Resolve dotted imports: `from app.models import User` → app/models.py
      for (const dotted of dottedImports) {
        // Try full dotted path first, then progressively shorter suffixes
        const segs = dotted.split('.');
        for (let start = 0; start < segs.length; start++) {
          const key = segs.slice(start).join('.');
          const target = pyDottedMap.get(key) || pyFileStemMap.get(segs[segs.length - 1]);
          if (target && target !== node.id) {
            resolved.push(target);
            const ekey = `${node.id}|||${target}`;
            edgeMap.set(ekey, (edgeMap.get(ekey) || 0) + 1);
            break; // found — no need to try shorter
          }
        }
      }
    }

    // Swift: detect inter-file type references
    // Swift files in the same module don't import each other, but reference each other's types.
    // Scan file content for any type names defined in OTHER Swift files.
    if (node.extension === '.swift' && swiftTypeDefMap.size > 0) {
      const file = validFiles.find(f => f.path === node.id);
      if (file) {
        // Find all CapitalizedWord references in this file
        const refPattern = /\b([A-Z][A-Za-z0-9_]+)\b/g;
        const seen = new Set<string>();
        let m;
        while ((m = refPattern.exec(file.content)) !== null) {
          const typeName = m[1];
          if (seen.has(typeName)) continue;
          seen.add(typeName);
          const target = swiftTypeDefMap.get(typeName);
          // Only link if the type is defined in a DIFFERENT Swift file
          if (target && target !== node.id) {
            resolved.push(target);
            const key = `${node.id}|||${target}`;
            edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
          }
        }
      }
    }

    node.deps = [...new Set(resolved)];
  }

  // Mark hasTests
  for (const node of partialNodes) {
    if (!node.isTest) {
      const baseName = node.name.replace(/\.[^.]+$/, '');
      node.hasTests = partialNodes.some(n =>
        n.isTest && (n.name.includes(baseName) || n.path.includes(baseName))
      );
    }
  }

  // Set dependents
  for (const node of partialNodes) {
    for (const dep of node.deps) {
      const target = partialNodes.find(n => n.id === dep);
      if (target && !target.dependents.includes(node.id)) {
        target.dependents.push(node.id);
      }
    }
  }

  // Calculate risk for each node
  const nodes: FileNode[] = partialNodes.map(n => {
    const { score, level, factors } = calculateRisk(n, partialNodes);
    return { ...n, riskScore: score, riskLevel: level, riskFactors: factors };
  });

  // Build edges
  const edges: GraphEdge[] = [];
  for (const [key, weight] of edgeMap) {
    const [source, target] = key.split('|||');
    edges.push({ source, target, weight });
  }

  // Detect circular deps
  const circularDeps = detectCircularDeps(nodes);

  // Add circular dep risk factors
  for (const cycle of circularDeps) {
    for (const nodeId of cycle) {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        node.riskFactors.push({
          type: 'Circular Dependency',
          description: `Part of circular dependency chain: ${cycle.map(c => c.split('/').pop()).join(' → ')}`,
          severity: 'high',
        });
        node.riskScore = Math.min(100, node.riskScore + 20);
        if (node.riskScore >= 70) node.riskLevel = 'critical';
        else if (node.riskScore >= 40) node.riskLevel = 'risk';
      }
    }
  }

  // Collect all EOL packages across the project
  const allEol = new Map<string, { name: string; eol: string; risk: string; note: string }>();
  for (const node of nodes) {
    for (const eol of node.eolPackages) {
      allEol.set(eol.name, eol);
    }
  }

  const languages = [...new Set(nodes.map(n => n.language).filter(l => l !== 'Unknown'))];
  const totalLines = nodes.reduce((sum, n) => sum + n.lines, 0);
  const avgRiskScore = nodes.length > 0 ? Math.round(nodes.reduce((s, n) => s + n.riskScore, 0) / nodes.length) : 0;

  return {
    nodes,
    edges,
    stats: {
      totalFiles: nodes.length,
      criticalFiles: nodes.filter(n => n.riskLevel === 'critical').length,
      riskFiles: nodes.filter(n => n.riskLevel === 'risk').length,
      cautionFiles: nodes.filter(n => n.riskLevel === 'caution').length,
      safeFiles: nodes.filter(n => n.riskLevel === 'safe').length,
      languages,
      eolPackages: [...allEol.values()],
      circularDeps,
      avgRiskScore,
      totalLines,
    },
  };
}
