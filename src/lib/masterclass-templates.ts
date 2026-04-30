export type SlideType = 'title' | 'agenda' | 'content' | 'quote' | 'exercise' | 'divider' | 'cta' | 'section' | 'closing'

export interface SlideData {
  type: SlideType
  // New schema
  heading?: string
  subtitle?: string
  tagline?: string
  items?: string[]
  bullets?: string[]
  insight?: string
  text?: string
  attribution?: string
  instructions?: string
  reflection?: string
  sectionTitle?: string
  offer?: string
  price?: string
  handle?: string
  notes?: string
  // Legacy compat (old schema used title/points)
  title?: string
  points?: string[]
}

export interface PptTemplate {
  id: string
  name: string
  description: string
  colors: {
    bg: string
    primary: string
    text: string
    accent: string
    subtitle: string
  }
  preview: string
  isCustom?: boolean
}

export const BUILT_IN_TEMPLATES: PptTemplate[] = [
  {
    id: 'executive',
    name: 'Executive Dark',
    description: 'Deep navy + gold — premium & authoritative',
    colors: { bg: '#0f1729', primary: '#c9a84c', text: '#ffffff', accent: '#c9a84c', subtitle: '#94a3b8' },
    preview: 'linear-gradient(135deg, #0f1729 0%, #1a2540 100%)',
  },
  {
    id: 'clean',
    name: 'Clean Light',
    description: 'White + violet — professional & clear',
    colors: { bg: '#ffffff', primary: '#7c3aed', text: '#0f1729', accent: '#7c3aed', subtitle: '#6b7280' },
    preview: 'linear-gradient(135deg, #f5f3ff 0%, #ffffff 100%)',
  },
  {
    id: 'bold',
    name: 'Bold Modern',
    description: 'Split violet/white — editorial & high-contrast',
    colors: { bg: '#ffffff', primary: '#7c3aed', text: '#1a1a2e', accent: '#7c3aed', subtitle: '#6b7280' },
    preview: 'linear-gradient(90deg, #7c3aed 40%, #ffffff 40%)',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Black & white + gold accent — premium print feel',
    colors: { bg: '#ffffff', primary: '#080808', text: '#141414', accent: '#c9a84c', subtitle: '#4b5563' },
    preview: 'linear-gradient(135deg, #f9f9f9 0%, #ffffff 100%)',
  },
  {
    id: 'vibrant',
    name: 'Vibrant Pro',
    description: 'Dark purple + pink — modern spiritual aesthetic',
    colors: { bg: '#1a0533', primary: '#e879f9', text: '#ffffff', accent: '#e879f9', subtitle: '#c084fc' },
    preview: 'linear-gradient(135deg, #1a0533 0%, #0f1729 100%)',
  },
]
