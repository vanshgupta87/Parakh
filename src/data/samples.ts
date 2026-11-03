import type { SampleLesion, RiskTier } from '@/types';

export const RISK_TIER_META: Record<
  RiskTier,
  { label: string; description: string; color: string; textColor: string; dotClass: string; bgClass: string; borderClass: string }
> = {
  low: {
    label: 'LOW RISK',
    description: 'Benign Profile',
    color: '#10B981',
    textColor: 'text-emerald-400',
    dotClass: 'bg-emerald-500',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/30',
  },
  moderate: {
    label: 'MODERATE RISK',
    description: 'Pre-Cancerous / Atypical',
    color: '#F59E0B',
    textColor: 'text-amber-400',
    dotClass: 'bg-amber-500',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
  },
  high: {
    label: 'HIGH RISK',
    description: 'Suspicious / Biopsy Recommended',
    color: '#F59E0B',
    textColor: 'text-orange-400',
    dotClass: 'bg-orange-500',
    bgClass: 'bg-orange-500/10',
    borderClass: 'border-orange-500/30',
  },
  critical: {
    label: 'CRITICAL RISK',
    description: 'Urgent In-Person Evaluation',
    color: '#F43F5E',
    textColor: 'text-rose-500',
    dotClass: 'bg-rose-500',
    bgClass: 'bg-rose-500/10',
    borderClass: 'border-rose-500/30',
  },
  urgent: {
    label: 'URGENT RISK',
    description: 'Immediate In-Person Evaluation',
    color: '#F43F5E',
    textColor: 'text-rose-500',
    dotClass: 'bg-rose-500',
    bgClass: 'bg-rose-500/10',
    borderClass: 'border-rose-500/30',
  },
};

export function tierFromScore(score: number): RiskTier {
  if (score <= 25) return 'low';
  if (score <= 50) return 'moderate';
  if (score <= 75) return 'high';
  return 'critical';
}

const img1 = 'https://images.pexels.com/photos/6568228/pexels-photo-6568228.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';
const img2 = 'https://images.pexels.com/photos/4046561/pexels-photo-4046561.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';
const img3 = 'https://images.pexels.com/photos/5701547/pexels-photo-5701547.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

export const SAMPLES: SampleLesion[] = [
  {
    id: 'caseA',
    name: 'Atypical Nevus — Benign',
    subtitle: 'Case A — Low Risk',
    imageUrl: img1,
    heatmapUrl: img1,
    primaryPrediction: 'Melanocytic Nevus',
    confidence: 91.2,
    riskScore: 18,
    riskTier: 'low',
    probabilities: [
      { id: 'mel', label: 'Melanoma', short: 'mel', probability: 3.1, color: '#F43F5E' },
      { id: 'bcc', label: 'Basal Cell Carcinoma', short: 'bcc', probability: 1.2, color: '#F59E0B' },
      { id: 'akiec', label: 'Actinic Keratosis', short: 'akiec', probability: 0.8, color: '#EAB308' },
      { id: 'nv', label: 'Melanocytic Nevus', short: 'nv', probability: 91.2, color: '#10B981' },
      { id: 'bkl', label: 'Benign Keratosis', short: 'bkl', probability: 2.9, color: '#0EA5E9' },
      { id: 'df', label: 'Dermatofibroma', short: 'df', probability: 0.5, color: '#A78BFA' },
      { id: 'vasc', label: 'Vascular Lesion', short: 'vasc', probability: 0.3, color: '#EC4899' },
    ],
    abcde: [
      { letter: 'A', label: 'Asymmetry', detail: 'Symmetrical — no irregular axes', flag: false },
      { letter: 'B', label: 'Border', detail: 'Smooth, well-defined margins', flag: false },
      { letter: 'C', label: 'Color', detail: 'Uniform brown pigmentation', flag: false },
      { letter: 'D', label: 'Diameter', detail: '< 5 mm — within normal range', flag: false },
      { letter: 'E', label: 'Evolution', detail: 'No recent change reported', flag: false },
    ],
    action:
      'Routine monitoring recommended. No immediate intervention required. Follow up with a standard annual dermatology screening as part of regular preventive care.',
    quality: { lighting: 'Optimal', resolution: '224×224', focus: '98%' },
  },
  {
    id: 'caseB',
    name: 'Actinic Keratosis — Pre-Cancerous',
    subtitle: 'Case B — Moderate Risk',
    imageUrl: img2,
    heatmapUrl: img2,
    primaryPrediction: 'Actinic Keratosis',
    confidence: 76.8,
    riskScore: 42,
    riskTier: 'moderate',
    probabilities: [
      { id: 'mel', label: 'Melanoma', short: 'mel', probability: 8.4, color: '#F43F5E' },
      { id: 'bcc', label: 'Basal Cell Carcinoma', short: 'bcc', probability: 6.1, color: '#F59E0B' },
      { id: 'akiec', label: 'Actinic Keratosis', short: 'akiec', probability: 76.8, color: '#EAB308' },
      { id: 'nv', label: 'Melanocytic Nevus', short: 'nv', probability: 3.2, color: '#10B981' },
      { id: 'bkl', label: 'Benign Keratosis', short: 'bkl', probability: 4.5, color: '#0EA5E9' },
      { id: 'df', label: 'Dermatofibroma', short: 'df', probability: 0.6, color: '#A78BFA' },
      { id: 'vasc', label: 'Vascular Lesion', short: 'vasc', probability: 0.4, color: '#EC4899' },
    ],
    abcde: [
      { letter: 'A', label: 'Asymmetry', detail: 'Mild asymmetry — one axis', flag: true },
      { letter: 'B', label: 'Border', detail: 'Slightly irregular, scaly margin', flag: true },
      { letter: 'C', label: 'Color', detail: 'Erythematous with scaling', flag: false },
      { letter: 'D', label: 'Diameter', detail: '4-6 mm — borderline range', flag: false },
      { letter: 'E', label: 'Evolution', detail: 'Persistent, slowly enlarging', flag: true },
    ],
    action:
      'Moderate risk detected. Field-directed therapy (e.g. 5-FU or imiquimod) or cryotherapy recommended. Schedule dermatology follow-up within 4 weeks to monitor for progression to SCC.',
    quality: { lighting: 'Optimal', resolution: '224×224', focus: '96%' },
  },
  {
    id: 'caseC',
    name: 'Malignant Melanoma — High Priority',
    subtitle: 'Case C — Critical Risk',
    imageUrl: img3,
    heatmapUrl: img3,
    primaryPrediction: 'Malignant Melanoma',
    confidence: 88.4,
    riskScore: 88,
    riskTier: 'critical',
    probabilities: [
      { id: 'mel', label: 'Melanoma', short: 'mel', probability: 88.4, color: '#F43F5E' },
      { id: 'bcc', label: 'Basal Cell Carcinoma', short: 'bcc', probability: 4.1, color: '#F59E0B' },
      { id: 'akiec', label: 'Actinic Keratosis', short: 'akiec', probability: 3.3, color: '#EAB308' },
      { id: 'nv', label: 'Melanocytic Nevus', short: 'nv', probability: 2.1, color: '#10B981' },
      { id: 'bkl', label: 'Benign Keratosis', short: 'bkl', probability: 1.4, color: '#0EA5E9' },
      { id: 'df', label: 'Dermatofibroma', short: 'df', probability: 0.4, color: '#A78BFA' },
      { id: 'vasc', label: 'Vascular Lesion', short: 'vasc', probability: 0.3, color: '#EC4899' },
    ],
    abcde: [
      { letter: 'A', label: 'Asymmetry', detail: 'Marked asymmetry across both axes', flag: true },
      { letter: 'B', label: 'Border', detail: 'Irregular, notched margins', flag: true },
      { letter: 'C', label: 'Color', detail: 'Heterogeneous — dark brown / black zones', flag: true },
      { letter: 'D', label: 'Diameter', detail: '> 6 mm — exceeds benign threshold', flag: true },
      { letter: 'E', label: 'Evolution', detail: 'Recent growth and color change noted', flag: true },
    ],
    action:
      'Urgent: High confidence of irregular cellular structure. Immediate excisional biopsy and in-person dermatologist consultation recommended within 48-72 hours.',
    quality: { lighting: 'Optimal', resolution: '224×224', focus: '97%' },
  },
];
