'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface TemplateStats {
  id: string;
  template_text: string;
  times_used: number;
  response_count: number;
  positive_response_count: number;
  callback_request_count: number;
  opt_out_count: number;
  response_rate: number;
  positive_rate: number;
}

export default function AIAnalyticsDashboard() {
  const [templates, setTemplates] = useState<TemplateStats[]>([]);
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [hourlyStats, setHourlyStats] = useState<any[]>([]);
  const [overallStats, setOverallStats] = useState({
    totalSent: 0, totalResponses: 0, responseRate: 0, positiveRate: 0,
    avgResponseTime: 0, topIntent: '', optOutRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'all'>('7d');

  useEffect(() => { loadAnalytics(); }, [dateRange]);

  async function loadAnalytics() {
    setLoading(true);
    let dateFilter = dateRange === '7d' ? new Date(Date.now() - 7*24*60*60*1000).toISOString()
      : dateRange === '30d' ? new Date(Date.now() - 30*24*60*60*1000).toISOString() : '';

    const { data: templateData } = await supabase.from('sms_template_stats').select('*').order('times_used', { ascending: false }).limit(10);
    
    let smsQuery = supabase.from('sms_messages').select('*');
    if (dateFilter) smsQuery = smsQuery.gte('created_at', dateFilter);
    const { data: smsData } = await smsQuery;

    if (smsData) {
      const outbound = smsData.filter(s => s.direction === 'outbound');
      const inbound = smsData.filter(s => s.direction === 'inbound');
      const positive = inbound.filter(s => s.ai_sentiment === 'positive' || s.ai_intent === 'interested');
      const optOuts = inbound.filter(s => s.ai_intent === 'stop_request');

      const intents = new Map<string, number>();
      inbound.forEach(s => { if (s.ai_intent) intents.set(s.ai_intent, (intents.get(s.ai_intent) || 0) + 1); });
      const topIntent = [...intents.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

      let totalResponseTime = 0, responseCount = 0;
      inbound.forEach(inMsg => {
        const precedingOut = outbound.filter(o => o.phone_e164 === inMsg.phone_e164 && new Date(o.created_at) < new Date(inMsg.created_at))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        if (precedingOut) {
          const respTime = (new Date(inMsg.created_at).getTime() - new Date(precedingOut.created_at).getTime()) / 1000 / 60;
          if (respTime < 1440) { totalResponseTime += respTime; responseCount++; }
        }
      });

      setOverallStats({
        totalSent: outbound.length,
        totalResponses: inbound.length,
        responseRate: outbound.length > 0 ? Math.round((inbound.length / outbound.length) * 100) : 0,
        positiveRate: inbound.length > 0 ? Math.round((positive.length / inbound.length) * 100) : 0,
        avgResponseTime: responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0,
        topIntent,
        optOutRate: outbound.length > 0 ? Math.round((optOuts.length / outbound.length) * 1000) / 10 : 0
      });

      // Daily stats
      const daily = new Map<string, any>();
      smsData.forEach(msg => {
        const date = new Date(msg.created_at).toISOString().split('T')[0];
        const existing = daily.get(date) || { sent: 0, responses: 0, positive: 0 };
        if (msg.direction === 'outbound') existing.sent++;
        if (msg.direction === 'inbound') { existing.responses++; if (msg.ai_sentiment === 'positive') existing.positive++; }
        daily.set(date, existing);
      });
      setDailyStats([...daily.entries()].map(([date, stats]) => ({ date, ...stats })).sort((a, b) => a.date.localeCompare(b.date)).slice(-14));

      // Hourly stats
      const hourly = new Map<number, any>();
      for (let h = 0; h < 24; h++) hourly.set(h, { sent: 0, responses: 0 });
      outbound.forEach(msg => { const h = new Date(msg.created_at).getHours(); hourly.get(h)!.sent++; });
      inbound.forEach(msg => {
        const precedingOut = outbound.filter(o => o.phone_e164 === msg.phone_e164 && new Date(o.created_at) < new Date(msg.created_at))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        if (precedingOut) { const h = new Date(precedingOut.created_at).getHours(); hourly.get(h)!.responses++; }
      });
      setHourlyStats([...hourly.entries()].map(([hour, stats]) => ({ hour, ...stats, response_rate: stats.sent > 0 ? Math.round((stats.responses / stats.sent) * 100) : 0 })));
    }

    setTemplates(templateData || []);
    setLoading(false);
  }

  const getBestHours = () => hourlyStats.filter(h => h.sent >= 5).sort((a, b) => b.response_rate - a.response_rate).slice(0, 3);
  const formatHour = (hour: number) => hour === 0 ? '12AM' : hour === 12 ? '12PM' : hour > 12 ? `${hour-12}PM` : `${hour}AM`;

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>
      <style>{`
        .ai-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
        .ai-title{font-size:24px;font-weight:700;color:#111}
        .ai-range{display:flex;gap:8px}
        .ai-range-btn{padding:8px 16px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;border:1px solid #e5e7eb;background:#fff}
        .ai-range-btn.active{background:#4f46e5;border-color:#4f46e5;color:#fff}
        .ai-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
        @media(max-width:900px){.ai-stats{grid-template-columns:repeat(2,1fr)}}
        .ai-stat{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px}
        .ai-stat-value{font-size:32px;font-weight:800;color:#111}
        .ai-stat-label{font-size:12px;color:#6b7280;margin-top:4px}
        .ai-stat-sub{font-size:11px;color:#9ca3af;margin-top:8px}
        .ai-grid{display:grid;grid-template-columns:2fr 1fr;gap:24px;margin-bottom:24px}
        @media(max-width:900px){.ai-grid{grid-template-columns:1fr}}
        .ai-panel{background:#fff;border:1px solid #e5e7eb;border-radius:12px}
        .ai-panel-header{padding:16px 20px;border-bottom:1px solid #e5e7eb;font-size:15px;font-weight:600}
        .ai-panel-body{padding:20px}
        .ai-chart{height:180px;display:flex;align-items:flex-end;gap:6px}
        .ai-bar{flex:1;background:#e5e7eb;border-radius:4px 4px 0 0;position:relative;min-height:4px}
        .ai-bar-fill{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,#4f46e5,#818cf8);border-radius:4px 4px 0 0}
        .ai-bar-label{position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);font-size:9px;color:#6b7280}
        .ai-bar-value{position:absolute;top:-16px;left:50%;transform:translateX(-50%);font-size:9px;font-weight:600}
        .ai-hours{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}
        .ai-hour{text-align:center;padding:10px 6px;border-radius:8px;font-size:11px}
        .ai-hour-label{color:#6b7280;margin-bottom:4px}
        .ai-hour-value{font-weight:700}
        .ai-insight{padding:16px;background:#fefce8;border:1px solid #fef08a;border-radius:10px;margin-bottom:20px}
        .ai-insight-header{font-weight:600;color:#854d0e;margin-bottom:6px}
        .ai-insight-text{font-size:13px;color:#a16207}
        .ai-template{padding:14px;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:12px}
        .ai-template-text{font-size:12px;color:#374151;background:#f9fafb;padding:10px;border-radius:6px;margin-bottom:10px;line-height:1.4}
        .ai-template-stats{display:flex;gap:16px;flex-wrap:wrap}
        .ai-template-stat{text-align:center}
        .ai-template-stat-value{font-size:16px;font-weight:700}
        .ai-template-stat-label{font-size:10px;color:#6b7280}
        .ai-empty{text-align:center;padding:40px;color:#9ca3af}
      `}</style>

      <div className="ai-header">
        <h1 className="ai-title">📊 AI Analytics</h1>
        <div className="ai-range">
          {(['7d', '30d', 'all'] as const).map(r => (
            <button key={r} className={`ai-range-btn ${dateRange === r ? 'active' : ''}`} onClick={() => setDateRange(r)}>
              {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="ai-empty">Loading...</div> : (
        <>
          <div className="ai-stats">
            <div className="ai-stat">
              <div className="ai-stat-value">{overallStats.totalSent.toLocaleString()}</div>
              <div className="ai-stat-label">Messages Sent</div>
            </div>
            <div className="ai-stat">
              <div className="ai-stat-value" style={{ color: '#22c55e' }}>{overallStats.responseRate}%</div>
              <div className="ai-stat-label">Response Rate</div>
              <div className="ai-stat-sub">{overallStats.totalResponses} responses</div>
            </div>
            <div className="ai-stat">
              <div className="ai-stat-value" style={{ color: '#4f46e5' }}>{overallStats.positiveRate}%</div>
              <div className="ai-stat-label">Positive Rate</div>
            </div>
            <div className="ai-stat">
              <div className="ai-stat-value">{overallStats.avgResponseTime}m</div>
              <div className="ai-stat-label">Avg Response Time</div>
              <div className="ai-stat-sub">Opt-out: {overallStats.optOutRate}%</div>
            </div>
          </div>

          {getBestHours().length > 0 && (
            <div className="ai-insight">
              <div className="ai-insight-header">🤖 AI Insight</div>
              <div className="ai-insight-text">
                <strong>Best send times:</strong> {getBestHours().map(h => formatHour(h.hour)).join(', ')} ({getBestHours()[0]?.response_rate}% response rate).
                Top response type: <strong>{overallStats.topIntent}</strong>
              </div>
            </div>
          )}

          <div className="ai-grid">
            <div className="ai-panel">
              <div className="ai-panel-header">📈 Daily Activity</div>
              <div className="ai-panel-body">
                {dailyStats.length === 0 ? <div className="ai-empty">No data</div> : (
                  <div className="ai-chart">
                    {dailyStats.map(day => {
                      const max = Math.max(...dailyStats.map(d => d.sent), 1);
                      return (
                        <div key={day.date} className="ai-bar" style={{ height: '100%' }}>
                          <div className="ai-bar-fill" style={{ height: `${(day.sent / max) * 100}%` }} />
                          <div className="ai-bar-value">{day.sent}</div>
                          <div className="ai-bar-label">{new Date(day.date).getDate()}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="ai-panel">
              <div className="ai-panel-header">⏰ Best Hours</div>
              <div className="ai-panel-body">
                <div className="ai-hours">
                  {hourlyStats.filter(h => h.hour >= 8 && h.hour <= 19).map(h => {
                    const maxRate = Math.max(...hourlyStats.map(x => x.response_rate), 1);
                    const intensity = h.response_rate / maxRate;
                    const bg = h.sent < 3 ? '#f3f4f6' : `rgba(79, 70, 229, ${0.15 + intensity * 0.6})`;
                    const color = h.sent < 3 ? '#9ca3af' : intensity > 0.5 ? '#fff' : '#111';
                    return (
                      <div key={h.hour} className="ai-hour" style={{ background: bg, color }} title={`${h.sent} sent`}>
                        <div className="ai-hour-label">{formatHour(h.hour)}</div>
                        <div className="ai-hour-value">{h.response_rate}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="ai-panel">
            <div className="ai-panel-header">📝 Template Performance</div>
            <div className="ai-panel-body">
              {templates.length === 0 ? <div className="ai-empty">No templates tracked yet</div> : (
                templates.slice(0, 5).map(t => (
                  <div key={t.id} className="ai-template">
                    <div className="ai-template-text">"{t.template_text.substring(0, 120)}..."</div>
                    <div className="ai-template-stats">
                      <div className="ai-template-stat">
                        <div className="ai-template-stat-value">{t.times_used}</div>
                        <div className="ai-template-stat-label">Used</div>
                      </div>
                      <div className="ai-template-stat">
                        <div className="ai-template-stat-value" style={{ color: '#22c55e' }}>{t.response_rate?.toFixed(0) || 0}%</div>
                        <div className="ai-template-stat-label">Response</div>
                      </div>
                      <div className="ai-template-stat">
                        <div className="ai-template-stat-value" style={{ color: '#4f46e5' }}>{t.positive_rate?.toFixed(0) || 0}%</div>
                        <div className="ai-template-stat-label">Positive</div>
                      </div>
                      <div className="ai-template-stat">
                        <div className="ai-template-stat-value" style={{ color: '#2563eb' }}>{t.callback_request_count || 0}</div>
                        <div className="ai-template-stat-label">Callbacks</div>
                      </div>
                      <div className="ai-template-stat">
                        <div className="ai-template-stat-value" style={{ color: '#dc2626' }}>{t.opt_out_count || 0}</div>
                        <div className="ai-template-stat-label">Opt-outs</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
