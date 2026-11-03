import React from 'react';
import { Activity } from 'lucide-react';
import type { SampleLesion, PatientMetadata } from '@/types';
import { RISK_TIER_META } from '@/data/samples';

interface PrintReportProps {
  sample: SampleLesion;
  scanId: string;
  patientMeta: PatientMetadata;
}

export function PrintReport({ sample, scanId, patientMeta }: PrintReportProps) {
  const tier = RISK_TIER_META[sample.riskTier];

  return (
    <div className="hidden print:block print:w-full print:bg-white print:text-slate-900">
      {/* PAGE 1: PATIENT METADATA & CASE OVERVIEW */}
      <div className="print-page flex flex-col justify-between p-8">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-6 w-6 text-emerald-600" />
              <h1 className="text-2xl font-bold text-slate-900">Parakh AI Report</h1>
            </div>
            <div className="text-right text-xs text-slate-600">
              <p className="font-semibold text-slate-900">Report ID: #{scanId}</p>
              <p>Generated: {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          {/* Section 1: Executive Summary */}
          <div className="mt-6 rounded-lg bg-slate-50 p-4 border border-slate-200">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Diagnostic Summary</h2>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-slate-900">{sample.primaryPrediction}</p>
                <p className="text-xs text-slate-600">Model Confidence: {(sample.confidence * 100).toFixed(1)}%</p>
              </div>
              <div className="rounded-full px-4 py-1.5 text-xs font-bold" style={{ backgroundColor: `${tier.color}20`, color: tier.color }}>
                {tier.label}
              </div>
            </div>
          </div>

          {/* Section 2: Patient Metadata */}
          <div className="mt-6">
            <h2 className="border-b border-slate-300 pb-1 text-sm font-bold uppercase tracking-wider text-slate-700">Patient Intake Metadata</h2>
            <div className="mt-4 grid grid-cols-2 gap-y-4 gap-x-6 text-xs">
              <div>
                <span className="font-semibold text-slate-500 block">Patient Age:</span>
                <span className="text-sm font-medium text-slate-900">{patientMeta.age ? `${patientMeta.age} years` : 'Not Specified'}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 block">Biological Sex:</span>
                <span className="text-sm font-medium text-slate-900 capitalize">{patientMeta.gender || 'Not Specified'}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 block">Anatomical Site:</span>
                <span className="text-sm font-medium text-slate-900">{patientMeta.anatomicalSite || 'Not Specified'}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 block">Fitzpatrick Skin Phototype:</span>
                <span className="text-sm font-medium text-slate-900">{patientMeta.fitzpatrickSkinType || 'Not Specified'}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 block">Lesion Duration:</span>
                <span className="text-sm font-medium text-slate-900">{patientMeta.durationMonths || 'Not Specified'}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Clinical Symptoms Checklist */}
          <div className="mt-6">
            <h2 className="border-b border-slate-300 pb-1 text-sm font-bold uppercase tracking-wider text-slate-700">Observed Clinical Symptoms</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <SymptomBadge label="Raised / Elevated" active={patientMeta.isElevated} />
              <SymptomBadge label="Pruritic (Itching)" active={patientMeta.hasItching} />
              <SymptomBadge label="Bleeding / Ulcerated" active={patientMeta.hasBleeding} />
              <SymptomBadge label="Recent Growth / Evolution" active={patientMeta.hasChangedRecently} />
            </div>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 text-center border-t border-slate-200 pt-2">Page 1 of 3 — Clinical Patient Intake Record</p>
      </div>

      {/* PAGE BREAK */}
      <div className="page-break" />

      {/* PAGE 2: VISUAL DIAGNOSTIC & GRAD-CAM HEATMAP */}
      <div className="print-page flex flex-col justify-between p-8">
        <div>
          <div className="border-b border-slate-300 pb-2">
            <h2 className="text-lg font-bold text-slate-900">Visual Diagnostic Analysis</h2>
            <p className="text-xs text-slate-500">Scan ID: #{scanId} — Image Inspection & Model Saliency</p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-6">
            {/* Source Photo */}
            <div className="rounded-lg border border-slate-300 p-3 text-center">
              <p className="mb-2 text-xs font-bold text-slate-700">Source Lesion Photo</p>
              <img src={sample.imageUrl} alt="Source Lesion" className="mx-auto h-64 w-64 object-cover rounded-md" />
            </div>

            {/* Grad-CAM Overlay */}
            <div className="rounded-lg border border-slate-300 p-3 text-center">
              <p className="mb-2 text-xs font-bold text-slate-700">Grad-CAM Heatmap Activation</p>
              <img src={sample.heatmapUrl} alt="Grad-CAM" className="mx-auto h-64 w-64 object-cover rounded-md" />
            </div>
          </div>

          {/* Imaging Technical Info */}
          <div className="mt-6 rounded-lg bg-slate-50 p-4 border border-slate-200 text-xs space-y-1.5">
            <p><span className="font-semibold text-slate-700">Quality Assessed:</span> Lighting: {sample.quality.lighting} | Resolution: {sample.quality.resolution}</p>
            <p><span className="font-semibold text-slate-700">Model Architecture:</span> EfficientNet-B0 (ISIC HAM10000 Trained)</p>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 text-center border-t border-slate-200 pt-2">Page 2 of 3 — Diagnostic Visual Evidence</p>
      </div>

      {/* PAGE BREAK */}
      <div className="page-break" />

      {/* PAGE 3: RISK ANALYSIS & ABCDE BREAKDOWN */}
      <div className="print-page flex flex-col justify-between p-8">
        <div>
          <div className="border-b border-slate-300 pb-2">
            <h2 className="text-lg font-bold text-slate-900">Risk Assessment & ABCDE Criteria</h2>
            <p className="text-xs text-slate-500">Scan ID: #{scanId} — Algorithmic Decision Support</p>
          </div>

          {/* Class Distribution */}
          <div className="mt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">Differential Classification Output</h3>
            <div className="space-y-2 text-xs">
              {sample.probabilities.map((prob) => (
                <div key={prob.id} className="flex items-center justify-between border-b border-slate-100 pb-1">
                  <span className="font-medium text-slate-800">{prob.label} ({prob.short})</span>
                  <span className="font-mono text-slate-600">{(prob.probability * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* ABCDE Feature Analysis */}
          <div className="mt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">ABCDE Feature Evaluation</h3>
            <div className="grid grid-cols-1 gap-2 text-xs">
              {sample.abcde.map((item) => (
                <div key={item.letter} className="flex items-start gap-3 rounded-md bg-slate-50 p-2.5 border border-slate-200">
                  <span className="font-bold text-slate-900 bg-slate-200 px-2 py-0.5 rounded">{item.letter}</span>
                  <div>
                    <p className="font-semibold text-slate-900">{item.label}</p>
                    <p className="text-slate-600">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Clinical Disclaimer */}
        <div className="mt-6 border-t border-slate-300 pt-4">
          <p className="text-[10px] text-slate-500 leading-normal">
            <strong>Clinical Disclaimer:</strong> Parakh AI provides decision-support risk stratification based on machine learning probability models. This report is intended solely as an adjunctive triage tool and does not constitute a definitive medical diagnosis or replace formal histopathological evaluation by a licensed dermatologist.
          </p>
          <p className="mt-2 text-[10px] text-slate-400 text-center">Page 3 of 3 — Algorithmic Support Summary</p>
        </div>
      </div>
    </div>
  );
}

function SymptomBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-md border p-2 text-xs ${active ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
      <span>{active ? '✓' : '✗'}</span>
      <span>{label}</span>
    </div>
  );
}