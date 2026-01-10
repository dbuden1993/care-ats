'use client';
import { useState } from 'react';
import { createScorecard } from './db';

interface Props { candidate: any; job?: any; interview?: any; onClose: () => void; onSubmit?: () => void; }

const DEFAULT_CRITERIA = [
  { id: '1', criteria: 'Care Experience', description: 'Previous experience in healthcare or social care', weight: 3, category: 'Skills' },
  { id: '2', criteria: 'Communication', description: 'Ability to communicate clearly and empathetically', weight: 2, category: 'Skills' },
  { id: '3', criteria: 'Problem Solving', description: 'Handles unexpected situations appropriately', weight: 2, category: 'Skills' },
  { id: '4', criteria: 'Reliability', description: 'Track record of punctuality and dependability', weight: 3, category: 'Traits' },
  { id: '5', criteria: 'Cultural Fit', description: 'Aligns with company values and team', weight: 1, category: 'Traits' },
  { id: '6', criteria: 'Motivation', description: 'Genuine interest in care work', weight: 2, category: 'Traits' },
];

const QUESTIONS = [
  { q: 'Tell me about your experience in care work.', purpose: 'Assess experience', time: '5 min', tip: 'Look for specific examples and duration' },
  { q: 'Describe a challenging situation with a service user.', purpose: 'Problem solving', time: '5 min', tip: 'Listen for empathy and professionalism' },
  { q: 'How do you prioritize when caring for multiple people?', purpose: 'Time management', time: '3 min', tip: 'Look for organizational skills' },
  { q: 'What does dignity in care mean to you?', purpose: 'Values alignment', time: '3 min', tip: 'Should mention respect, privacy, choice' },
  { q: 'Why do you want to work in care?', purpose: 'Motivation', time: '3 min', tip: 'Genuine passion vs just a job' },
  { q: 'Do you have any questions for us?', purpose: 'Engagement', time: '5 min', tip: 'Shows preparation and interest' },
];

export default function InterviewKitModal({ candidate, job, interview, onClose, onSubmit }: Props) {
  const [activeTab, setActiveTab] = useState<'questions' | 'scorecard'>('questions');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [recommendation, setRecommendation] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async () => {
    if (!recommendation) return;
    setSaving(true);
    try {
      await createScorecard({
        candidate_id: candidate.id,
        interview_id: interview?.id,
        reviewer_name: 'You', // Would come from auth
        scores: DEFAULT_CRITERIA.map(c => ({ criteria: c.criteria, score: scores[c.id] || 0, weight: c.weight })),
        recommendation,
        overall_notes: notes
      });
      setSaved(true);
      setTimeout(() => { onSubmit?.(); onClose(); }, 1500);
    } catch (err) {
      console.error('Failed to submit scorecard:', err);
    }
    setSaving(false);
  };

  const totalScore = DEFAULT_CRITERIA.reduce((sum, c) => sum + (scores[c.id] || 0) * c.weight, 0);
  const maxScore = DEFAULT_CRITERIA.reduce((sum, c) => sum + 5 * c.weight, 0);
  const percentage = Math.round((totalScore / maxScore) * 100);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <style>{`
        .kit-modal{background:#fff;border-radius:16px;width:100%;max-width:850px;max-height:90vh;display:flex;flex-direction:column;animation:slideUp .2s ease}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .kit-header{padding:20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
        .kit-title{font-size:18px;font-weight:600;color:#111}
        .kit-close{width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;border:none;border-radius:8px;cursor:pointer}
        .kit-tabs{display:flex;border-bottom:1px solid #e5e7eb;background:#f9fafb}
        .kit-tab{flex:1;padding:14px;text-align:center;font-size:13px;font-weight:500;color:#6b7280;cursor:pointer;border-bottom:2px solid transparent;transition:all .15s}
        .kit-tab:hover{color:#111}
        .kit-tab.active{color:#4f46e5;border-bottom-color:#4f46e5;background:#fff}
        .kit-body{flex:1;overflow-y:auto;padding:20px}
        .kit-candidate{display:flex;align-items:center;gap:14px;padding:16px;background:#eef2ff;border-radius:12px;margin-bottom:20px}
        .kit-avatar{width:48px;height:48px;background:#4f46e5;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:18px}
        .kit-info h3{font-size:16px;font-weight:600;color:#111;margin:0}
        .kit-info p{font-size:13px;color:#6b7280;margin:4px 0 0}
        .kit-question{background:#f9fafb;border-radius:10px;padding:16px;margin-bottom:12px}
        .kit-question-num{font-size:11px;font-weight:600;color:#6366f1;margin-bottom:6px}
        .kit-question-text{font-size:14px;color:#111;margin-bottom:10px;line-height:1.5}
        .kit-question-meta{display:flex;gap:16px}
        .kit-question-tag{display:flex;align-items:center;gap:4px;font-size:11px;color:#6b7280}
        .kit-question-tip{font-size:12px;color:#059669;background:#ecfdf5;padding:8px 12px;border-radius:6px;margin-top:10px}
        .kit-criteria{background:#f9fafb;border-radius:10px;padding:14px;margin-bottom:10px}
        .kit-criteria-header{display:flex;justify-content:space-between;align-items:start;margin-bottom:8px}
        .kit-criteria-name{font-size:14px;font-weight:500;color:#111}
        .kit-criteria-weight{font-size:10px;color:#6b7280;background:#e5e7eb;padding:2px 6px;border-radius:4px}
        .kit-criteria-desc{font-size:12px;color:#6b7280;margin-bottom:10px}
        .kit-stars{display:flex;gap:6px}
        .kit-star{width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;border:none;border-radius:8px;cursor:pointer;font-size:16px;transition:all .15s}
        .kit-star:hover{background:#fef3c7}
        .kit-star.filled{background:#fef3c7}
        .kit-summary{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:20px;display:flex;align-items:center;gap:16px}
        .kit-score-circle{width:60px;height:60px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#059669;border:3px solid #10b981}
        .kit-score-label{font-size:12px;color:#6b7280}
        .kit-rec{margin-bottom:16px}
        .kit-rec-label{font-size:12px;font-weight:500;color:#374151;margin-bottom:8px}
        .kit-rec-options{display:flex;gap:8px}
        .kit-rec-btn{flex:1;padding:12px;font-size:12px;font-weight:500;border:1px solid #e5e7eb;border-radius:8px;background:#fff;cursor:pointer;transition:all .15s;text-align:center}
        .kit-rec-btn:hover{border-color:#d1d5db}
        .kit-rec-btn.selected{border-color:#4f46e5;background:#eef2ff;color:#4f46e5}
        .kit-rec-btn.strong_yes.selected{border-color:#059669;background:#ecfdf5;color:#059669}
        .kit-rec-btn.yes.selected{border-color:#10b981;background:#ecfdf5;color:#10b981}
        .kit-rec-btn.no.selected{border-color:#f59e0b;background:#fef3c7;color:#b45309}
        .kit-rec-btn.strong_no.selected{border-color:#dc2626;background:#fef2f2;color:#dc2626}
        .kit-notes{margin-bottom:16px}
        .kit-notes-label{font-size:12px;font-weight:500;color:#374151;margin-bottom:8px}
        .kit-notes-input{width:100%;padding:12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;min-height:100px;resize:vertical;font-family:inherit}
        .kit-notes-input:focus{outline:none;border-color:#6366f1}
        .kit-footer{padding:16px 20px;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:8px}
        .kit-btn{padding:10px 20px;font-size:13px;font-weight:500;border-radius:8px;cursor:pointer;border:none;transition:all .15s}
        .kit-btn.secondary{background:#f3f4f6;color:#374151}
        .kit-btn.primary{background:#4f46e5;color:#fff}
        .kit-btn.primary:hover{background:#4338ca}
        .kit-btn.saved{background:#10b981}
        .kit-btn:disabled{opacity:.5;cursor:not-allowed}
      `}</style>
      
      <div className="kit-modal">
        <div className="kit-header">
          <span className="kit-title">📋 Interview Kit</span>
          <button className="kit-close" onClick={onClose}>×</button>
        </div>
        
        <div className="kit-tabs">
          <div className={`kit-tab ${activeTab === 'questions' ? 'active' : ''}`} onClick={() => setActiveTab('questions')}>💬 Questions</div>
          <div className={`kit-tab ${activeTab === 'scorecard' ? 'active' : ''}`} onClick={() => setActiveTab('scorecard')}>⭐ Scorecard</div>
        </div>
        
        <div className="kit-body">
          <div className="kit-candidate">
            <div className="kit-avatar">{(candidate?.name || 'C')[0]}</div>
            <div className="kit-info">
              <h3>{candidate?.name || 'Candidate'}</h3>
              <p>{job?.title || candidate?.roles || 'Care Assistant'} • {interview?.type || 'Video'} Interview</p>
            </div>
          </div>
          
          {activeTab === 'questions' && (
            <>
              {QUESTIONS.map((q, i) => (
                <div key={i} className="kit-question">
                  <div className="kit-question-num">Question {i + 1}</div>
                  <div className="kit-question-text">{q.q}</div>
                  <div className="kit-question-meta">
                    <span className="kit-question-tag">🎯 {q.purpose}</span>
                    <span className="kit-question-tag">⏱️ {q.time}</span>
                  </div>
                  <div className="kit-question-tip">💡 {q.tip}</div>
                </div>
              ))}
            </>
          )}
          
          {activeTab === 'scorecard' && (
            <>
              <div className="kit-summary">
                <div className="kit-score-circle">{percentage}%</div>
                <div>
                  <div style={{fontSize:16,fontWeight:600,color:'#111'}}>Overall Score</div>
                  <div className="kit-score-label">{totalScore} / {maxScore} weighted points</div>
                </div>
              </div>
              
              {DEFAULT_CRITERIA.map(c => (
                <div key={c.id} className="kit-criteria">
                  <div className="kit-criteria-header">
                    <span className="kit-criteria-name">{c.criteria}</span>
                    <span className="kit-criteria-weight">Weight: {c.weight}x</span>
                  </div>
                  <div className="kit-criteria-desc">{c.description}</div>
                  <div className="kit-stars">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} className={`kit-star ${(scores[c.id] || 0) >= n ? 'filled' : ''}`} onClick={() => setScores({ ...scores, [c.id]: n })}>
                        {(scores[c.id] || 0) >= n ? '★' : '☆'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              
              <div className="kit-rec">
                <div className="kit-rec-label">Recommendation</div>
                <div className="kit-rec-options">
                  {[{v:'strong_yes',l:'Strong Yes'},{v:'yes',l:'Yes'},{v:'neutral',l:'Neutral'},{v:'no',l:'No'},{v:'strong_no',l:'Strong No'}].map(r => (
                    <button key={r.v} className={`kit-rec-btn ${r.v} ${recommendation === r.v ? 'selected' : ''}`} onClick={() => setRecommendation(r.v)}>{r.l}</button>
                  ))}
                </div>
              </div>
              
              <div className="kit-notes">
                <div className="kit-notes-label">Overall Notes</div>
                <textarea className="kit-notes-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Key observations, concerns, highlights..." />
              </div>
            </>
          )}
        </div>
        
        <div className="kit-footer">
          <button className="kit-btn secondary" onClick={onClose}>Close</button>
          {activeTab === 'scorecard' && (
            <button className={`kit-btn primary ${saved ? 'saved' : ''}`} onClick={handleSubmit} disabled={!recommendation || saving}>
              {saved ? '✓ Submitted!' : saving ? 'Submitting...' : 'Submit Scorecard'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
