export interface Segment { start: number; end: number; chord: string; confidence: number | null }
export interface Barre { fret: number; from_string: number; to_string: number }
export interface Diagram {
  chord: string; label: string; frets: number[]; fingers: number[]
  base_fret: number; barre: Barre | null; source: string
}
export interface VideoResult { id: string; title: string; channel: string; thumbnail: string; duration: string | null }
export interface AnalysisInfo {
  id: string; filename: string; status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number; method: string | null; error: string | null; low_confidence: boolean
}
