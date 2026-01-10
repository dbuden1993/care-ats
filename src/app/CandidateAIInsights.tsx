'use client';
import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CampaignInteraction {
  id: string;
  campaign_id: string;
  campaign_name: string;
  message_type: string;
  status: string;
  message_preview: string;
  reply_content: string;
  reply_sentiment: string;
  error_message: string;
  sent_at: string;
  delivered_at: string;
  read_at: string;
  replied_at: string;
}

interface AIInsights {
  total_campaigns: number;
  total_messages_sent: number;
  total_delivered: number;
  total_read: number;
  total_replied: number;
  total_failed: number;
  not_on_whatsapp: boolean;
  response_rate: number;
  sentiment_summary: string;
  ai_summary: string;
  ai_recommendation: string;
  engagement_score: number;
  last_campaign_date: string;
  last_response_date: string;
}

interface Props {
  candidateId: string;
  candidateName: string;
}

// AI Analysis Engine
function generateAIAnalysis(interactions: CampaignInteraction[]): { summary: string; recommendation: string; score: number } {
  if (!interactions.length) {
    return {
      summary: "No WhatsApp campaign history yet.",
      recommendation: "new",
      score: 50
    };
  }

  const sent = interactions.filter(i => ['sent', 'delivered', 'read', 'replied'].includes(i.status)).length;
  const delivered = interactions.filter(i => ['delivered', 'read', 'replied'].includes(i.status)).length;
  const read = interactions.filter(i => ['read', 'replied'].includes(i.status)).length;
  const replied = interactions.filter(i => i.status === 'replied').length;
  const failed = interactions.filter(i => i.status === 'failed').length;
  const notOnWhatsApp = interactions.some(i => i.status === 'not_on_whatsapp');
  
  const positiveReplies = interactions.filter(i => i.reply_sentiment === 'positive' || i.reply_sentiment === 'interested').length;
  const negativeReplies = interactions.filter(i => i.reply_sentiment === 'negative' || i.reply_sentiment === 'not_interested').length;
  
  const uniqueCampaigns = new Set(interactions.map(i => i.campaign_id)).size;
  const responseRate = sent > 0 ? (replied / sent) * 100 : 0;
  
  // Calculate engagement score (0-100)
  let score = 50; // Base score
  if (notOnWhatsApp) score = 10;
  else {
    if (delivered > 0) score += 10;
    if (read > 0) score += 15;
    if (replied > 0) score += 25;
    if (positiveReplies > 0) score += 20;
    if (negativeReplies > positiveReplies) score -= 15;
    if (failed > sent / 2) score -= 20;
    if (uniqueCampaigns > 3 && replied === 0) score -= 10; // Many campaigns, no response
  }
  score = Math.max(0, Math.min(100, score));

  // Generate AI summary
  let summary = "";
  const campaignNames = [...new Set(interactions.map(i => i.campaign_name))];
  const lastInteraction = interactions.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())[0];
  const lastDate = new Date(lastInteraction.sent_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  if (notOnWhatsApp) {
    summary = `⚠️ This candidate is NOT registered on WhatsApp. Messages cannot be delivered. Consider alternative contact methods (phone call, email).`;
  } else if (replied > 0) {
    if (positiveReplies > negativeReplies) {
      summary = `✅ Engaged candidate! Responded positively to ${positiveReplies} campaign(s). `;
      summary += `Last contacted on ${lastDate} with "${lastInteraction.campaign_name}". `;
      summary += `Response rate: ${responseRate.toFixed(0)}%. High priority for follow-up.`;
    } else if (negativeReplies > positiveReplies) {
      summary = `❌ This candidate has shown disinterest. Responded negatively to ${negativeReplies} campaign(s). `;
      summary += `Consider removing from future campaigns or waiting before re-engaging.`;
    } else {
      summary = `💬 Mixed responses. Replied to ${replied} of ${sent} messages. `;
      summary += `Last activity: ${lastDate}. May need personalized approach.`;
    }
  } else if (read > 0) {
    summary = `👀 Messages are being read but no replies yet. Sent ${sent} messages across ${uniqueCampaigns} campaign(s). `;
    summary += `${read} read, 0 replies. Consider a different message approach or direct call.`;
  } else if (delivered > 0) {
    summary = `📬 Messages delivered but not read. Sent ${sent} messages across ${uniqueCampaigns} campaign(s). `;
    summary += `May be inactive on WhatsApp or ignoring messages.`;
  } else if (failed > 0) {
    summary = `⚠️ Delivery issues. ${failed} of ${sent} messages failed to send. `;
    summary += `Check phone number validity or WhatsApp status.`;
  } else {
    summary = `📤 Contacted in ${uniqueCampaigns} campaign(s): ${campaignNames.slice(0, 3).join(', ')}${campaignNames.length > 3 ? '...' : ''}. `;
    summary += `Last message sent on ${lastDate}. Awaiting engagement.`;
  }

  // Generate recommendation
  let recommendation = "nurture";
  if (notOnWhatsApp) recommendation = "alt_contact";
  else if (score >= 80) recommendation = "high_priority";
  else if (score >= 60 && replied > 0) recommendation = "keep";
  else if (score < 30) recommendation = "review";
  else if (uniqueCampaigns > 5 && replied === 0) recommendation = "remove";
  else recommendation = "nurture";

  return { summary, recommendation, score };
}

export default function CandidateAIInsights({ candidateId, candidateName }: Props) {
  const [interactions, setInteractions] = useState<CampaignInteraction[]>([]);
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch campaign interactions
      const { data: interactionsData } = await supabase
        .from('campaign_interactions')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('sent_at', { ascending: false });

      const ints = interactionsData || [];
      setInteractions(ints);

      // Generate AI analysis
      const analysis = generateAIAnalysis(ints);
      
      // Calculate stats
      const sent = ints.filter(i => ['sent', 'delivered', 'read', 'replied'].includes(i.status)).length;
      const delivered = ints.filter(i => ['delivered', 'read', 'replied'].includes(i.status)).length;
      const read = ints.filter(i => ['read', 'replied'].includes(i.status)).length;
      const replied = ints.filter(i => i.status === 'replied').length;
      const failed = ints.filter(i => i.status === 'failed').length;
      const notOnWhatsApp = ints.some(i => i.status === 'not_on_whatsapp');
      const uniqueCampaigns = new Set(ints.map(i => i.campaign_id)).size;
      
      const positiveReplies = ints.filter(i => ['positive', 'interested'].includes(i.reply_sentiment)).length;
      const negativeReplies = ints.filter(i => ['negative', 'not_interested'].includes(i.reply_sentiment)).length;
      let sentimentSummary = 'no_responses';
      if (replied > 0) {
        if (positiveReplies > negativeReplies) sentimentSummary = 'mostly_positive';
        else if (negativeReplies > positiveReplies) sentimentSummary = 'mostly_negative';
        else sentimentSummary = 'mixed';
      }

      setInsights({
        total_campaigns: uniqueCampaigns,
        total_messages_sent: sent,
        total_delivered: delivered,
        total_read: read,
        total_replied: replied,
        total_failed: failed,
        not_on_whatsapp: notOnWhatsApp,
        response_rate: sent > 0 ? (replied / sent) * 100 : 0,
        sentiment_summary: sentimentSummary,
        ai_summary: analysis.summary,
        ai_recommendation: analysis.recommendation,
        engagement_score: analysis.score,
        last_campaign_date: ints[0]?.sent_at || '',
        last_response_date: ints.find(i => i.replied_at)?.replied_at || '',
      });

    } catch (e) {
      console.error('Error fetching campaign insights:', e);
    }
    setLoading(false);
  }, [candidateId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div style={{ padding: 16, background: '#f9fafb', borderRadius: 8, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280' }}>
          <span>🤖</span> Loading AI insights...
        </div>
      </div>
    );
  }

  if (!insights || interactions.length === 0) {
    return (
      <div style={{ padding: 16, background: '#f9fafb', borderRadius: 8, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🤖</span>
          <span style={{ fontWeight: 600 }}>AI Campaign Insights</span>
        </div>
        <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: 14 }}>
          No WhatsApp campaign history for this candidate yet.
        </p>
      </div>
    );
  }

  const getRecommendationBadge = (rec: string) => {
    const badges: Record<string, { bg: string; color: string; label: string }> = {
      high_priority: { bg: '#dcfce7', color: '#166534', label: '🌟 High Priority' },
      keep: { bg: '#dbeafe', color: '#1e40af', label: '✅ Keep' },
      nurture: { bg: '#fef3c7', color: '#92400e', label: '🌱 Nurture' },
      review: { bg: '#fee2e2', color: '#991b1b', label: '⚠️ Review' },
      remove: { bg: '#fecaca', color: '#991b1b', label: '❌ Consider Removing' },
      alt_contact: { bg: '#e5e7eb', color: '#374151', label: '📞 Use Alt. Contact' },
      new: { bg: '#f3f4f6', color: '#6b7280', label: '🆕 New' },
    };
    const b = badges[rec] || badges.new;
    return <span style={{ padding: '4px 10px', background: b.bg, color: b.color, borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{b.label}</span>;
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return '#16a34a';
    if (score >= 40) return '#ca8a04';
    return '#dc2626';
  };

  const formatDate = (d: string) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', borderRadius: 12, marginBottom: 16, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      {/* Header */}
      <div 
        style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'white' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🤖</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>AI Campaign Insights</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              {insights.total_campaigns} campaign{insights.total_campaigns !== 1 ? 's' : ''} • {insights.total_messages_sent} message{insights.total_messages_sent !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {getRecommendationBadge(insights.ai_recommendation)}
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: `conic-gradient(${getScoreColor(insights.engagement_score)} ${insights.engagement_score}%, #e5e7eb ${insights.engagement_score}%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: getScoreColor(insights.engagement_score) }}>
              {insights.engagement_score}
            </div>
          </div>
          <span style={{ color: '#9ca3af', fontSize: 18 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* AI Summary */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', background: '#fffbeb' }}>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: '#78350f' }}>
          💡 {insights.ai_summary}
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <>
          {/* Stats */}
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 12, borderTop: '1px solid #e5e7eb' }}>
            <div style={{ textAlign: 'center', padding: 10, background: 'white', borderRadius: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>{insights.total_messages_sent}</div>
              <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>Sent</div>
            </div>
            <div style={{ textAlign: 'center', padding: 10, background: 'white', borderRadius: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#8b5cf6' }}>{insights.total_delivered}</div>
              <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>Delivered</div>
            </div>
            <div style={{ textAlign: 'center', padding: 10, background: 'white', borderRadius: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#06b6d4' }}>{insights.total_read}</div>
              <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>Read</div>
            </div>
            <div style={{ textAlign: 'center', padding: 10, background: 'white', borderRadius: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>{insights.total_replied}</div>
              <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>Replied</div>
            </div>
            <div style={{ textAlign: 'center', padding: 10, background: 'white', borderRadius: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>{insights.total_failed}</div>
              <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>Failed</div>
            </div>
            <div style={{ textAlign: 'center', padding: 10, background: 'white', borderRadius: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>{insights.response_rate.toFixed(0)}%</div>
              <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>Response</div>
            </div>
          </div>

          {/* Campaign History */}
          <div style={{ borderTop: '1px solid #e5e7eb' }}>
            <div style={{ padding: '10px 16px', fontWeight: 600, fontSize: 13, background: '#f9fafb' }}>📋 Campaign History</div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {interactions.map((int, idx) => (
                <div key={int.id || idx} style={{ padding: '10px 16px', borderBottom: '1px solid #f3f4f6', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{int.campaign_name}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                      {formatDate(int.sent_at)}
                    </div>
                    {int.reply_content && (
                      <div style={{ fontSize: 12, color: '#374151', marginTop: 4, padding: '4px 8px', background: '#f3f4f6', borderRadius: 4 }}>
                        💬 "{int.reply_content.slice(0, 100)}{int.reply_content.length > 100 ? '...' : ''}"
                      </div>
                    )}
                    {int.error_message && (
                      <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>
                        ⚠️ {int.error_message}
                      </div>
                    )}
                  </div>
                  <div>
                    {int.status === 'sent' && <span style={{ padding: '2px 8px', background: '#dbeafe', color: '#1e40af', borderRadius: 8, fontSize: 11 }}>✓ Sent</span>}
                    {int.status === 'delivered' && <span style={{ padding: '2px 8px', background: '#e0e7ff', color: '#4338ca', borderRadius: 8, fontSize: 11 }}>✓✓ Delivered</span>}
                    {int.status === 'read' && <span style={{ padding: '2px 8px', background: '#ddd6fe', color: '#6d28d9', borderRadius: 8, fontSize: 11 }}>👁️ Read</span>}
                    {int.status === 'replied' && <span style={{ padding: '2px 8px', background: '#dcfce7', color: '#166534', borderRadius: 8, fontSize: 11 }}>💬 Replied</span>}
                    {int.status === 'failed' && <span style={{ padding: '2px 8px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 11 }}>❌ Failed</span>}
                    {int.status === 'not_on_whatsapp' && <span style={{ padding: '2px 8px', background: '#fef3c7', color: '#92400e', borderRadius: 8, fontSize: 11 }}>📵 No WhatsApp</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
