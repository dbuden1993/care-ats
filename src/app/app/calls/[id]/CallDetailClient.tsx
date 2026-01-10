'use client';

// src/app/app/calls/[id]/CallDetailClient.tsx
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Define types inline (no external imports)
type CallData = {
  id: string;
  callId: string;
  candidateId: string | null;
  phone: string;
  callTime: Date | null;
  direction: 'inbound' | 'outbound' | null;
  durationMs: number | null;
  transcript: string | null;
  recordingUrl: string | null;
  recapBullets: string[];
  qualityAssessment: string | null;
  followUpQuestions: string[];
  energyScore: number | null;
  isProcessed: boolean;
  processedAt: string | null;
};

type Candidate = {
  id: string;
  name: string | null;
  phone_e164: string;
  status: string | null;
  roles: string | null;
};

type Props = {
  call: CallData;
  candidate: Candidate | null;
};

function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  const colors = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-green-100 text-green-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
  };
  
  return (
    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${colors[color as keyof typeof colors] || colors.gray}`}>
      {children}
    </span>
  );
}

function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return '0s';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

function getEnergyColor(score: number | null): string {
  if (!score) return 'gray';
  if (score >= 4) return 'green';
  if (score >= 3) return 'yellow';
  return 'red';
}

export default function CallDetailClient({ call, candidate }: Props) {
  const router = useRouter();
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const [jsonExpanded, setJsonExpanded] = useState(false);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="mb-4 text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
          >
            ← Back to Calls
          </button>
          <h1 className="text-4xl font-bold text-gray-900">Call Detail</h1>
          <p className="mt-2 text-lg text-gray-600">
            {call.callTime ? new Date(call.callTime).toLocaleString() : 'Unknown time'}
          </p>
        </div>
        
        <div className="flex gap-3">
          {call.recordingUrl && (
            <a
              href={call.recordingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              🎧 Listen to Recording
            </a>
          )}
        </div>
      </div>
      
      {/* Call Metadata */}
      <Card title="Call Information">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-500 font-medium mb-1">Phone Number</p>
            <p className="text-lg font-semibold text-gray-900">{call.phone}</p>
          </div>
          
          <div>
            <p className="text-sm text-gray-500 font-medium mb-1">Direction</p>
            <Badge color={call.direction === 'inbound' ? 'blue' : 'gray'}>
              {call.direction === 'inbound' ? '📞 Inbound' : '📱 Outbound'}
            </Badge>
          </div>
          
          <div>
            <p className="text-sm text-gray-500 font-medium mb-1">Duration</p>
            <p className="text-lg font-semibold text-gray-900">{formatDuration(call.durationMs)}</p>
          </div>
          
          <div>
            <p className="text-sm text-gray-500 font-medium mb-1">Energy Score</p>
            <Badge color={getEnergyColor(call.energyScore)}>
              ⚡ {call.energyScore || 'N/A'}/5
            </Badge>
          </div>
        </div>
        
        {candidate && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 font-medium mb-2">Linked Candidate</p>
            <Link
              href={`/app/candidates/${candidate.id}`}
              className="inline-flex items-center gap-2 text-lg font-semibold text-blue-600 hover:text-blue-700"
            >
              {candidate.name || 'Unknown'} →
            </Link>
            {candidate.status && (
              <Badge color="gray">{candidate.status}</Badge>
            )}
          </div>
        )}
        
        {!candidate && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 font-medium mb-2">Candidate</p>
            <button
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
              onClick={() => alert('Link candidate feature coming soon!')}
            >
              + Link to Candidate
            </button>
          </div>
        )}
      </Card>
      
      {/* AI Recap */}
      <Card title="🤖 AI Recap">
        {call.recapBullets.length > 0 ? (
          <ul className="space-y-3">
            {call.recapBullets.map((bullet, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                  {idx + 1}
                </span>
                <span className="text-gray-700 text-lg leading-relaxed">{bullet}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 italic">No AI recap available</p>
        )}
      </Card>
      
      {/* Quality Assessment */}
      {call.qualityAssessment && (
        <Card title="📊 Quality Assessment">
          <div className="flex items-center gap-3">
            <Badge color={
              call.qualityAssessment.toUpperCase().includes('HIGH') ? 'green' :
              call.qualityAssessment.toUpperCase().includes('MEDIUM') ? 'yellow' : 'red'
            }>
              {call.qualityAssessment}
            </Badge>
          </div>
        </Card>
      )}
      
      {/* Follow-up Questions */}
      {call.followUpQuestions.length > 0 && (
        <Card title="❓ Follow-up Questions">
          <ul className="space-y-3">
            {call.followUpQuestions.map((question, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="flex-shrink-0 text-2xl">❓</span>
                <span className="text-gray-700 text-lg leading-relaxed">{question}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      
      {/* Transcript */}
      {call.transcript && (
        <Card title="📝 Full Transcript">
          <div>
            <button
              onClick={() => setTranscriptExpanded(!transcriptExpanded)}
              className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg font-medium text-gray-700 transition-colors flex items-center justify-between"
            >
              <span>{transcriptExpanded ? 'Hide' : 'Show'} Transcript</span>
              <span className="text-xl">{transcriptExpanded ? '−' : '+'}</span>
            </button>
            
            {transcriptExpanded && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono leading-relaxed">
                  {call.transcript}
                </pre>
              </div>
            )}
          </div>
        </Card>
      )}
      
      {/* Raw JSON */}
      <Card title="🔧 Raw Data (JSON)">
        <div>
          <button
            onClick={() => setJsonExpanded(!jsonExpanded)}
            className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg font-medium text-gray-700 transition-colors flex items-center justify-between"
          >
            <span>{jsonExpanded ? 'Hide' : 'Show'} Raw JSON</span>
            <span className="text-xl">{jsonExpanded ? '−' : '+'}</span>
          </button>
          
          {jsonExpanded && (
            <div className="mt-4 p-4 bg-gray-900 rounded-lg max-h-96 overflow-y-auto">
              <pre className="text-sm text-green-400 font-mono leading-relaxed">
                {JSON.stringify(call, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </Card>
      
      {/* Actions */}
      <div className="flex gap-3">
        {!call.isProcessed && (
          <button
            className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
            onClick={() => alert('Mark as processed feature coming soon!')}
          >
            ✓ Mark as Processed
          </button>
        )}
        
        {call.isProcessed && (
          <div className="px-6 py-3 bg-gray-100 text-gray-600 rounded-lg font-semibold">
            ✓ Processed {call.processedAt ? `on ${new Date(call.processedAt).toLocaleDateString()}` : ''}
          </div>
        )}
      </div>
    </div>
  );
}
