export interface SlideData {
  type: 'title' | 'agenda' | 'content' | 'section' | 'closing'
  title: string
  subtitle?: string
  points?: string[]
  notes?: string
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
    description: 'Navy background with gold accents — premium & authoritative',
    colors: { bg: '#0F1C2E', primary: '#C9A84C', text: '#FFFFFF', accent: '#4A9EFF', subtitle: '#94A3B8' },
    preview: 'linear-gradient(135deg, #0F1C2E 0%, #1a2d4a 100%)',
  },
  {
    id: 'clean',
    name: 'Clean Light',
    description: 'White background with blue accents — professional & clear',
    colors: { bg: '#FFFFFF', primary: '#1A56DB', text: '#111827', accent: '#10B981', subtitle: '#6B7280' },
    preview: 'linear-gradient(135deg, #f0f7ff 0%, #ffffff 100%)',
  },
  {
    id: 'bold',
    name: 'Bold Modern',
    description: 'Deep purple with vibrant pinks — dynamic & memorable',
    colors: { bg: '#1A0533', primary: '#A855F7', text: '#FFFFFF', accent: '#EC4899', subtitle: '#C084FC' },
    preview: 'linear-gradient(135deg, #1A0533 0%, #2d0a52 100%)',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Soft gray with indigo accents — understated & elegant',
    colors: { bg: '#F8FAFC', primary: '#4F46E5', text: '#0F172A', accent: '#06B6D4', subtitle: '#475569' },
    preview: 'linear-gradient(135deg, #f1f5f9 0%, #f8fafc 100%)',
  },
  {
    id: 'vibrant',
    name: 'Vibrant Pro',
    description: 'Dark with teal and orange — energetic & modern',
    colors: { bg: '#0A1628', primary: '#00D9FF', text: '#FFFFFF', accent: '#FF6B35', subtitle: '#7DD3FC' },
    preview: 'linear-gradient(135deg, #0A1628 0%, #0f2040 100%)',
  },
]
