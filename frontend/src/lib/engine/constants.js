// Confirmed Color Palette from Recon (Module 57806 & Module 50986)
export const PALETTE = {
  blue: {
    stroke: '#3B82F6',
    fill: 'rgba(59, 130, 246, 0.15)',
    boldFill: '#3B82F6',
    text: '#93C5FD'
  },
  green: {
    stroke: '#10B981',
    fill: 'rgba(16, 185, 129, 0.15)',
    boldFill: '#10B981',
    text: '#6EE7B7'
  },
  red: {
    stroke: '#EF4444',
    fill: 'rgba(239, 68, 68, 0.15)',
    boldFill: '#EF4444',
    text: '#FCA5A5'
  },
  orange: {
    stroke: '#F59E0B',
    fill: 'rgba(245, 158, 11, 0.15)',
    boldFill: '#F59E0B',
    text: '#FCD34D'
  },
  purple: {
    stroke: '#8B5CF6',
    fill: 'rgba(139, 92, 246, 0.15)',
    boldFill: '#8B5CF6',
    text: '#C4B5FD'
  },
  yellow: {
    stroke: '#EAB308',
    fill: 'rgba(234, 179, 8, 0.15)',
    boldFill: '#EAB308',
    text: '#FDE047'
  },
  black: {
    stroke: '#4B5563',
    fill: 'rgba(31, 41, 55, 0.7)',
    boldFill: '#1F2937',
    text: '#E5E7EB'
  },
  white: {
    stroke: '#9CA3AF',
    fill: 'rgba(255, 255, 255, 0.1)',
    boldFill: '#F3F4F6',
    text: '#FFFFFF'
  },
  default: {
    stroke: '#4F566B',
    fill: 'rgba(30, 33, 44, 0.8)',
    boldFill: '#2E3440',
    text: '#E2E8F0'
  }
};

/**
 * Returns shape fill, stroke, and text color based on recon colorMode:
 * - pastel (default): soft translucent tinted fill, colored stroke, light text
 * - bold: saturated solid fill, high-contrast text
 * - outline: transparent fill, colored stroke, colored text
 */
export function getNodeColors(colorName, colorMode = 'pastel') {
  const base = PALETTE[colorName] || PALETTE.default;
  if (colorMode === 'bold') {
    return {
      fill: base.boldFill || base.stroke,
      stroke: base.stroke,
      text: (colorName === 'white' || colorName === 'yellow') ? '#0F172A' : '#FFFFFF',
      isBold: true
    };
  }
  if (colorMode === 'outline') {
    return {
      fill: 'none',
      stroke: base.stroke,
      text: base.stroke,
      isOutline: true
    };
  }
  // pastel (default)
  return {
    fill: base.fill,
    stroke: base.stroke,
    text: base.text,
    isPastel: true
  };
}

// Confirmed Shapes (Module 35731)
export const SHAPES = [
  'rectangle',
  'parallelogram',
  'trapezoid',
  'diamond',
  'cylinder',
  'hexagon',
  'circle',
  'ellipse',
  'oval',
  'triangle',
  'document',
  'star'
];

// Connection Operators (Module 35731 & Module 67713)
export const CONNECTION_OPERATORS = {
  '>': { type: 'FORWARD', dashed: false },
  '->': { type: 'FORWARD', dashed: false },
  '-->': { type: 'FORWARD_DASHED', dashed: true },
  '<': { type: 'BACKWARD', dashed: false },
  '<-': { type: 'BACKWARD', dashed: false },
  '<--': { type: 'BACKWARD_DASHED', dashed: true },
  '<>': { type: 'BIDIRECTIONAL', dashed: false },
  '<->': { type: 'BIDIRECTIONAL', dashed: false },
  '<-->': { type: 'BIDIRECTIONAL_DASHED', dashed: true },
  '-': { type: 'UNDIRECTED', dashed: false },
  '--': { type: 'UNDIRECTED_DASHED', dashed: true }
};

// Open-source embedded SVG icon paths (matching Lucide & Cloud symbols)
export const ICONS = {
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  server: '<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  router: '<rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6.01 18H6"/><path d="M10.01 18H10"/><path d="M15 10v4"/><path d="M17.84 7.17a4 4 0 0 0-5.66 0"/><path d="M20.66 4.34a8 8 0 0 0-11.32 0"/>',
  bucket: '<path d="m19 11-1.38 9.3a2 2 0 0 1-2 1.7H8.38a2 2 0 0 1-2-1.7L5 11"/><path d="M4 11h16"/><path d="M12 3a7 7 0 0 0-7 8"/>',
  queue: '<path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/><path d="m2 7 10 5 10-5"/>',
  lambda: '<path d="M4 20h4l5-12h7"/><path d="m14 14 6 6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
  cpu: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>',
  terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>',
  // AWS / Cloud alias mappings
  'aws-rds': '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>',
  'aws-ecs': '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/>',
  'aws-alb': '<path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/><path d="m2 7 10 5 10-5"/>',
  'aws-s3': '<path d="m19 11-1.38 9.3a2 2 0 0 1-2 1.7H8.38a2 2 0 0 1-2-1.7L5 11"/><path d="M4 11h16"/>',
  'aws-lambda': '<path d="M4 20h4l5-12h7"/><path d="m14 14 6 6"/>',
  'aws-route53': '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>'
};
