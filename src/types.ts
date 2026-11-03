export type RiskTier = 'low' | 'moderate' | 'high' | 'critical' | 'urgent';

export interface ClassProbability {
  id: string;
  label: string;
  short: string;
  probability: number;
  color: string;
}

export interface ABCDEItem {
  letter: 'A' | 'B' | 'C' | 'D' | 'E';
  label: string;
  detail: string;
  flag: boolean;
}

export interface SampleLesion {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string;
  imageData?: string;
  heatmapUrl: string;
  primaryPrediction: string;
  confidence: number;
  riskScore: number;
  riskTier: RiskTier;
  probabilities: ClassProbability[];
  abcde: ABCDEItem[];
  action: string;
  quality: { lighting: string; resolution: string; focus: string };
}

export type FitzpatrickSkinType = 'Type I' | 'Type II' | 'Type III' | 'Type IV' | 'Type V' | 'Type VI';

export type AnatomicalSite =
  | 'Head / Neck'
  | 'Torso (Front)'
  | 'Torso (Back)'
  | 'Upper Extremity (Arm/Hand)'
  | 'Lower Extremity (Leg/Foot)'
  | 'Acral (Palms/Soles)'
  | 'Genital / Mucosal';

export interface PatientMetadata {
  age: number | '';
  gender: 'male' | 'female' | 'other' | '';
  anatomicalSite: AnatomicalSite | '';
  fitzpatrickSkinType: FitzpatrickSkinType | '';
  isElevated: boolean;
  hasItching: boolean;
  hasBleeding: boolean;
  hasChangedRecently: boolean;
  durationMonths: string;
}

export interface HistoricalScan {
  id: string;
  date: string;
  createdAt: string;
  imageUrl: string;
  heatmapUrl?: string;
  primaryPrediction: string;
  confidence: number;
  riskTier: RiskTier;
  notes?: string;
}

export interface LesionHistory {
  lesionId: string;
  anatomicalSite: string;
  scans: HistoricalScan[];
}

export type ColorMap = 'jet' | 'inferno' | 'viridis' | 'magma';

export interface ModelUncertainty {
  epistemicRange: [number, number]; // e.g., [0.88, 0.96]
  variance: number;
  entropy: number;
}