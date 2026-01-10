'use client';
import { useState } from 'react';

export default function CandidateSurveyView() {
  const [surveys] = useState([
    { id: '1', candidate: 'John S.', job: 'Care Assistant', nps: 9, feedback: 'Great communication throughout the process', date: '2024-01-20' },
    { id: '2', candidate: 'Emma D.', job: 'Senior Carer', nps: 7, feedback: 'Process was a bit slow but team was friendly', date: '2024-01-18' },
    { id: '3', candidate: 'Mike B.', job: 'Care Assistant', nps: 10, feedback: 'Best application experience I\'ve had!', date: '2024-01-15' },
    { id: '4', candidate: 'Sarah L.', job: 'Night Support', nps: 4, feedback: 'Never heard back after interview', date: '2024-01-12' },
  ]);

  const avgNps = surveys.reduce((s, r) => s + r.nps, 0) / surveys.length;
  const promoters = surveys.filter(s => s.nps >= 9).length;
  const detractors = surveys.filter(s => s.nps <= 6).length;
  const npsScore = Math.round(((promoters - detractors) / surveys.length) * 100);

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        .survey-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
        .survey-stat{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;text-align:center}
        .survey-stat-value{font-size:32px;font-weight:700}
        .survey-stat-label{font-size:12px;color:#6b7280;margin-top:4px}
        .nps-bar{display:flex;height:8px;border-radius:4px;overflow:hidden;margin:24px 0}
        .nps-bar-segment{height:100%}
        .survey-list{background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}
        .survey-header{padding:16px 20px;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:600;color:#111}
        .survey-item{display:flex;align-items:center;gap:16px;padding:16px 20px;border-bottom:1px solid #f3f4f6}
        .survey-item:last-child{border-bottom:none}
        .survey-nps{width:48px;height:48px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700}
        .survey-nps.promoter{background:#ecfdf5;color:#059669}
        .survey-nps.passive{background:#fef3c7;color:#b45309}
        .survey-nps.detractor{background:#fef2f2;color:#dc2626}
        .survey-info{flex:1}
        .survey-candidate{font-size:14px;font-weight:500;color:#111}
        .survey-job{font-size:12px;color:#6b7280}
        .survey-feedback{font-size:13px;color:#374151;font-style:italic;margin-top:4px}
        .survey-date{font-size:12px;color:#9ca3af}
        .survey-config{background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-top:24px}
        .survey-config-title{font-size:14px;font-weight:600;color:#111;margin-bottom:12px}
        .survey-config-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f3f4f6}
        .survey-toggle{width:44px;height:24px;background:#e5e7eb;border-radius:12px;position:relative;cursor:pointer}
        .survey-toggle.on{background:#4f46e5}
        .survey-toggle::after{content:'';position:absolute;width:20px;height:20px;background:#fff;border-radius:50%;top:2px;left:2px;transition:transform .2s}
        .survey-toggle.on::after{transform:translateX(20px)}
      `}</style>
      
      <div className="survey-stats">
        <div className="survey-stat"><div className="survey-stat-value" style={{color:'#4f46e5'}}>{npsScore}</div><div className="survey-stat-label">NPS Score</div></div>
        <div className="survey-stat"><div className="survey-stat-value">{avgNps.toFixed(1)}</div><div className="survey-stat-label">Avg Rating</div></div>
        <div className="survey-stat"><div className="survey-stat-value" style={{color:'#059669'}}>{promoters}</div><div className="survey-stat-label">Promoters (9-10)</div></div>
        <div className="survey-stat"><div className="survey-stat-value" style={{color:'#dc2626'}}>{detractors}</div><div className="survey-stat-label">Detractors (0-6)</div></div>
      </div>
      
      <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:20,marginBottom:24}}>
        <div style={{fontSize:14,fontWeight:600,color:'#111',marginBottom:12}}>NPS Distribution</div>
        <div className="nps-bar">
          <div className="nps-bar-segment" style={{width:`${(detractors/surveys.length)*100}%`,background:'#ef4444'}} />
          <div className="nps-bar-segment" style={{width:`${((surveys.length-promoters-detractors)/surveys.length)*100}%`,background:'#f59e0b'}} />
          <div className="nps-bar-segment" style={{width:`${(promoters/surveys.length)*100}%`,background:'#10b981'}} />
        </div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#6b7280'}}>
          <span>Detractors {Math.round((detractors/surveys.length)*100)}%</span>
          <span>Passives {Math.round(((surveys.length-promoters-detractors)/surveys.length)*100)}%</span>
          <span>Promoters {Math.round((promoters/surveys.length)*100)}%</span>
        </div>
      </div>
      
      <div className="survey-list">
        <div className="survey-header">Recent Feedback</div>
        {surveys.map(s => (
          <div key={s.id} className="survey-item">
            <div className={`survey-nps ${s.nps >= 9 ? 'promoter' : s.nps >= 7 ? 'passive' : 'detractor'}`}>{s.nps}</div>
            <div className="survey-info">
              <div className="survey-candidate">{s.candidate}</div>
              <div className="survey-job">{s.job}</div>
              {s.feedback && <div className="survey-feedback">"{s.feedback}"</div>}
            </div>
            <div className="survey-date">{new Date(s.date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</div>
          </div>
        ))}
      </div>
      
      <div className="survey-config">
        <div className="survey-config-title">Survey Settings</div>
        <div className="survey-config-row"><span style={{fontSize:13,color:'#374151'}}>Send survey after rejection</span><div className="survey-toggle on" /></div>
        <div className="survey-config-row"><span style={{fontSize:13,color:'#374151'}}>Send survey after hire</span><div className="survey-toggle on" /></div>
        <div className="survey-config-row"><span style={{fontSize:13,color:'#374151'}}>Delay before sending</span><span style={{fontSize:13,color:'#6b7280'}}>24 hours</span></div>
      </div>
    </div>
  );
}
