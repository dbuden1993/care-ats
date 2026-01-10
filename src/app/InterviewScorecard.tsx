'use client';
import { useState } from 'react';
import Avatar from './Avatar';
import Button from './Button';
import ProgressRing from './ProgressRing';

interface Criteria {
  id: string;
  name: string;
  description: string;
  category: string;
  score: number | null;
  notes: string;
}

interface Props {
  candidateId: string;
  candidateName: string;
  interviewType?: string;
  onSave?: (data: any) => void;
  onClose?: () => void;
}

const DEFAULT_CRITERIA: Criteria[] = [
  { id: '1', name: 'Technical Skills', description: 'Relevant experience and technical knowledge', category: 'Skills', score: null, notes: '' },
  { id: '2', name: 'Problem Solving', description: 'Ability to analyze and solve complex problems', category: 'Skills', score: null, notes: '' },
  { id: '3', name: 'Communication', description: 'Clear and effective communication', category: 'Soft Skills', score: null, notes: '' },
  { id: '4', name: 'Teamwork', description: 'Collaboration and interpersonal skills', category: 'Soft Skills', score: null, notes: '' },
  { id: '5', name: 'Cultural Fit', description: 'Alignment with company values and culture', category: 'Culture', score: null, notes: '' },
  { id: '6', name: 'Motivation', description: 'Enthusiasm and career goals alignment', category: 'Culture', score: null, notes: '' },
];

export default function InterviewScorecard({ candidateId, candidateName, interviewType = 'Technical Interview', onSave, onClose }: Props) {
  const [criteria, setCriteria] = useState<Criteria[]>(DEFAULT_CRITERIA);
  const [overallNotes, setOverallNotes] = useState('');
  const [recommendation, setRecommendation] = useState<'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no' | null>(null);
  const [saving, setSaving] = useState(false);

  const updateScore = (id: string, score: number) => {
    setCriteria(prev => prev.map(c => c.id === id ? { ...c, score } : c));
  };

  const updateNotes = (id: string, notes: string) => {
    setCriteria(prev => prev.map(c => c.id === id ? { ...c, notes } : c));
  };

  const scoredCriteria = criteria.filter(c => c.score !== null);
  const averageScore = scoredCriteria.length > 0 
    ? scoredCriteria.reduce((sum, c) => sum + (c.score || 0), 0) / scoredCriteria.length 
    : 0;
  const completionPercent = Math.round((scoredCriteria.length / criteria.length) * 100);

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));
    onSave?.({ criteria, overallNotes, recommendation, averageScore });
    setSaving(false);
  };

  const groupedCriteria = criteria.reduce((acc, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {} as Record<string, Criteria[]>);

  const recommendations = [
    { id: 'strong_yes', label: 'Strong Yes', icon: '🌟', color: '#059669', bg: '#ecfdf5' },
    { id: 'yes', label: 'Yes', icon: '👍', color: '#10b981', bg: '#ecfdf5' },
    { id: 'maybe', label: 'Maybe', icon: '🤔', color: '#f59e0b', bg: '#fef3c7' },
    { id: 'no', label: 'No', icon: '👎', color: '#ef4444', bg: '#fef2f2' },
    { id: 'strong_no', label: 'Strong No', icon: '⛔', color: '#dc2626', bg: '#fef2f2' },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <style>{`
        .scorecard-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid #e5e7eb}
        .scorecard-candidate{display:flex;align-items:center;gap:16px}
        .scorecard-info h2{font-size:20px;font-weight:700;color:#111;margin:0 0 4px}
        .scorecard-info p{font-size:14px;color:#6b7280;margin:0}
        .scorecard-summary{display:flex;align-items:center;gap:24px}
        .scorecard-section{margin-bottom:32px}
        .scorecard-section-title{font-size:14px;font-weight:700;color:#111;margin-bottom:16px;display:flex;align-items:center;gap:8px}
        .scorecard-section-title span{padding:2px 8px;background:#f3f4f6;border-radius:10px;font-size:11px;font-weight:600;color:#6b7280}
        .scorecard-criterion{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px;transition:all .15s}
        .scorecard-criterion:hover{border-color:#d1d5db}
        .scorecard-criterion-header{display:flex;align-items:start;justify-content:space-between;margin-bottom:12px}
        .scorecard-criterion-name{font-size:14px;font-weight:600;color:#111}
        .scorecard-criterion-desc{font-size:12px;color:#6b7280;margin-top:2px}
        .scorecard-scores{display:flex;gap:6px}
        .scorecard-score{width:36px;height:36px;border-radius:10px;border:2px solid #e5e7eb;background:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;cursor:pointer;transition:all .15s}
        .scorecard-score:hover{border-color:#6366f1;background:#eef2ff}
        .scorecard-score.selected{border-color:#4f46e5;background:#4f46e5;color:#fff}
        .scorecard-score.s1.selected{background:#ef4444;border-color:#ef4444}
        .scorecard-score.s2.selected{background:#f97316;border-color:#f97316}
        .scorecard-score.s3.selected{background:#f59e0b;border-color:#f59e0b}
        .scorecard-score.s4.selected{background:#84cc16;border-color:#84cc16}
        .scorecard-score.s5.selected{background:#10b981;border-color:#10b981}
        .scorecard-notes{width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;resize:none;min-height:60px;transition:all .15s}
        .scorecard-notes:focus{outline:none;border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.1)}
        .scorecard-notes::placeholder{color:#9ca3af}
        .scorecard-recommendations{display:flex;gap:10px;flex-wrap:wrap}
        .scorecard-rec{flex:1;min-width:120px;padding:16px;border:2px solid #e5e7eb;border-radius:12px;cursor:pointer;text-align:center;transition:all .15s}
        .scorecard-rec:hover{border-color:#d1d5db}
        .scorecard-rec.selected{border-width:2px}
        .scorecard-rec-icon{font-size:24px;margin-bottom:6px}
        .scorecard-rec-label{font-size:13px;font-weight:600}
        .scorecard-overall{margin-top:24px}
        .scorecard-overall textarea{width:100%;padding:14px;border:1px solid #e5e7eb;border-radius:12px;font-size:14px;resize:none;min-height:120px;line-height:1.6}
        .scorecard-overall textarea:focus{outline:none;border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.1)}
        .scorecard-footer{display:flex;justify-content:flex-end;gap:12px;margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb}
      `}</style>

      <div className="scorecard-header">
        <div className="scorecard-candidate">
          <Avatar name={candidateName} size="lg" />
          <div className="scorecard-info">
            <h2>{candidateName}</h2>
            <p>{interviewType}</p>
          </div>
        </div>
        <div className="scorecard-summary">
          <ProgressRing value={completionPercent} size={60} color="#6366f1" label="Complete" />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: averageScore >= 4 ? '#10b981' : averageScore >= 3 ? '#f59e0b' : '#ef4444' }}>
              {averageScore > 0 ? averageScore.toFixed(1) : '—'}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>AVG SCORE</div>
          </div>
        </div>
      </div>

      {Object.entries(groupedCriteria).map(([category, items]) => (
        <div key={category} className="scorecard-section">
          <div className="scorecard-section-title">
            {category} <span>{items.length} criteria</span>
          </div>
          {items.map(criterion => (
            <div key={criterion.id} className="scorecard-criterion">
              <div className="scorecard-criterion-header">
                <div>
                  <div className="scorecard-criterion-name">{criterion.name}</div>
                  <div className="scorecard-criterion-desc">{criterion.description}</div>
                </div>
                <div className="scorecard-scores">
                  {[1, 2, 3, 4, 5].map(score => (
                    <button
                      key={score}
                      className={`scorecard-score s${score} ${criterion.score === score ? 'selected' : ''}`}
                      onClick={() => updateScore(criterion.id, score)}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                className="scorecard-notes"
                placeholder="Add notes about this criteria..."
                value={criterion.notes}
                onChange={e => updateNotes(criterion.id, e.target.value)}
              />
            </div>
          ))}
        </div>
      ))}

      <div className="scorecard-section">
        <div className="scorecard-section-title">Overall Recommendation</div>
        <div className="scorecard-recommendations">
          {recommendations.map(rec => (
            <div
              key={rec.id}
              className={`scorecard-rec ${recommendation === rec.id ? 'selected' : ''}`}
              style={recommendation === rec.id ? { borderColor: rec.color, background: rec.bg } : {}}
              onClick={() => setRecommendation(rec.id as any)}
            >
              <div className="scorecard-rec-icon">{rec.icon}</div>
              <div className="scorecard-rec-label" style={recommendation === rec.id ? { color: rec.color } : {}}>{rec.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="scorecard-overall">
        <div className="scorecard-section-title">Overall Notes</div>
        <textarea
          placeholder="Summarize your overall impressions, key strengths, concerns, and recommendation rationale..."
          value={overallNotes}
          onChange={e => setOverallNotes(e.target.value)}
        />
      </div>

      <div className="scorecard-footer">
        {onClose && <Button variant="secondary" onClick={onClose}>Cancel</Button>}
        <Button variant="primary" onClick={handleSave} loading={saving}>Save Scorecard</Button>
      </div>
    </div>
  );
}
