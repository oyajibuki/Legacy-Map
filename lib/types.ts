export type RiskLevel = 'safe' | 'caution' | 'risk' | 'critical';

export interface RiskFactor {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface FileNode {
  id: string;
  name: string;
  path: string;
  extension: string;
  language: string;
  lines: number;
  imports: string[];
  fileImports: string[];
  deps: string[];
  dependents: string[];
  riskScore: number;
  riskLevel: RiskLevel;
  riskFactors: RiskFactor[];
  hasTests: boolean;
  isTest: boolean;
  eolPackages: EolMatch[];
}

export interface EolMatch {
  name: string;
  eol: string;
  risk: string;
  note: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

export interface GraphStats {
  totalFiles: number;
  criticalFiles: number;
  riskFiles: number;
  cautionFiles: number;
  safeFiles: number;
  languages: string[];
  eolPackages: EolMatch[];
  circularDeps: string[][];
  avgRiskScore: number;
  totalLines: number;
}

export interface DependencyGraph {
  nodes: FileNode[];
  edges: GraphEdge[];
  stats: GraphStats;
}

export interface UploadedFile {
  path: string;
  name: string;
  content: string;
  size: number;
}
