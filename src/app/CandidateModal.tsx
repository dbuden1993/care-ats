'use client';
import { useState, useEffect } from 'react';

interface Props { 
  onClose: () => void; 
  onSave: (data: any) => void; 
  jobs: any[]; 
}

export default function CandidateModal({ onClose, onSave, jobs }: Props) {
  const [form, setForm] = useState({ 
    name: '', 
    phone: '', 
    email: '', 
    job_id: '', 
    source: 'direct', 
    roles: '', 
    experience: '', 
    driver: '', 
    dbs: '', 
    training: '', 
    start_date: '', 
    notes: '' 
  });
  const [step, setStep] = useState(1);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 200);
  };

  const sources = [
    { id: 'direct', label: 'Direct', icon: '👤' },
    { id: 'indeed', label: 'Indeed', icon: '💼' },
    { id: 'linkedin', label: 'LinkedIn', icon: '🔗' },
    { id: 'referral', label: 'Referral', icon: '🤝' },
    { id: 'agency', label: 'Agency', icon: '🏢' },
    { id: 'website', label: 'Website', icon: '🌐' },
    { id: 'other', label: 'Other', icon: '📋' },
  ];

  const handleSubmit = () => { 
    onSave(form); 
    handleClose(); 
  };

  const canProceed = () => {
    if (step === 1) return form.name.trim() && form.phone.trim();
    return true;
  };

  const styles = `
    @keyframes modalFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes modalSlideIn {
      from { opacity: 0; transform: scale(0.95) translateY(20px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    
    @keyframes modalFadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    
    @keyframes modalSlideOut {
      from { opacity: 1; transform: scale(1) translateY(0); }
      to { opacity: 0; transform: scale(0.95) translateY(20px); }
    }
    
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
      animation: modalFadeIn 0.2s ease-out forwards;
    }
    
    .modal-overlay.closing {
      animation: modalFadeOut 0.2s ease-out forwards;
    }
    
    .modal-container {
      background: white;
      border-radius: var(--radius-2xl);
      width: 100%;
      max-width: 580px;
      max-height: 90vh;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      animation: modalSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    
    .modal-overlay.closing .modal-container {
      animation: modalSlideOut 0.2s ease-out forwards;
    }
    
    .modal-header {
      padding: 24px 28px 20px;
      border-bottom: 1px solid var(--gray-100);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .modal-title {
      font-family: var(--font-display);
      font-size: 20px;
      font-weight: 700;
      color: var(--gray-900);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .modal-title-icon {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }
    
    .modal-close {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: var(--gray-100);
      border-radius: var(--radius-md);
      cursor: pointer;
      font-size: 18px;
      color: var(--gray-500);
      transition: all var(--transition-fast);
    }
    
    .modal-close:hover {
      background: var(--gray-200);
      color: var(--gray-700);
    }
    
    .steps-container {
      display: flex;
      padding: 20px 28px;
      background: var(--gray-50);
      border-bottom: 1px solid var(--gray-100);
      gap: 12px;
    }
    
    .step-item {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-radius: var(--radius-lg);
      font-size: 13px;
      font-weight: 500;
      color: var(--gray-400);
      transition: all var(--transition-normal);
    }
    
    .step-number {
      width: 28px;
      height: 28px;
      border-radius: var(--radius-full);
      background: var(--gray-200);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      transition: all var(--transition-normal);
    }
    
    .step-item.active {
      background: white;
      color: var(--primary);
      box-shadow: var(--shadow-sm);
    }
    
    .step-item.active .step-number {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
      color: white;
    }
    
    .step-item.done {
      color: var(--success);
    }
    
    .step-item.done .step-number {
      background: var(--success-light);
      color: var(--success);
    }
    
    .modal-body {
      padding: 28px;
      max-height: calc(90vh - 280px);
      overflow-y: auto;
    }
    
    .form-section {
      margin-bottom: 24px;
    }
    
    .form-section:last-child {
      margin-bottom: 0;
    }
    
    .form-section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--gray-400);
      margin-bottom: 16px;
    }
    
    .form-row {
      margin-bottom: 20px;
    }
    
    .form-row:last-child {
      margin-bottom: 0;
    }
    
    .form-label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: var(--gray-700);
      margin-bottom: 8px;
    }
    
    .form-label .required {
      color: var(--danger);
      margin-left: 2px;
    }
    
    .form-input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid var(--gray-200);
      border-radius: var(--radius-lg);
      font-size: 14px;
      font-family: var(--font-body);
      color: var(--gray-800);
      background: white;
      transition: all var(--transition-fast);
    }
    
    .form-input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 4px var(--primary-50);
    }
    
    .form-input::placeholder {
      color: var(--gray-400);
    }
    
    .form-input.textarea {
      min-height: 100px;
      resize: vertical;
    }
    
    .form-row-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    
    .radio-group {
      display: flex;
      gap: 10px;
    }
    
    .radio-btn {
      flex: 1;
      padding: 14px 16px;
      border: 2px solid var(--gray-200);
      border-radius: var(--radius-lg);
      background: white;
      cursor: pointer;
      text-align: center;
      font-size: 13px;
      font-weight: 500;
      color: var(--gray-600);
      transition: all var(--transition-fast);
    }
    
    .radio-btn:hover {
      border-color: var(--gray-300);
      background: var(--gray-50);
    }
    
    .radio-btn.active {
      border-color: var(--primary);
      background: var(--primary-50);
      color: var(--primary);
    }
    
    .source-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }
    
    @media (max-width: 500px) {
      .source-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    
    .source-btn {
      padding: 16px 12px;
      border: 2px solid var(--gray-200);
      border-radius: var(--radius-lg);
      background: white;
      cursor: pointer;
      text-align: center;
      transition: all var(--transition-fast);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    
    .source-btn:hover {
      border-color: var(--gray-300);
      transform: translateY(-2px);
    }
    
    .source-btn.active {
      border-color: var(--primary);
      background: var(--primary-50);
    }
    
    .source-btn-icon {
      font-size: 20px;
    }
    
    .source-btn-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--gray-600);
    }
    
    .source-btn.active .source-btn-label {
      color: var(--primary);
    }
    
    .modal-footer {
      padding: 20px 28px;
      border-top: 1px solid var(--gray-100);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--gray-50);
    }
    
    .modal-btn {
      padding: 12px 24px;
      border-radius: var(--radius-lg);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .modal-btn.secondary {
      background: white;
      border: 2px solid var(--gray-200);
      color: var(--gray-700);
    }
    
    .modal-btn.secondary:hover {
      border-color: var(--gray-300);
      background: var(--gray-50);
    }
    
    .modal-btn.primary {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
      border: none;
      color: white;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }
    
    .modal-btn.primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
    }
    
    .modal-btn.primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
  `;

  return (
    <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <style>{styles}</style>
      
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <div className="modal-title-icon">👤</div>
            Add New Candidate
          </div>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>
        
        <div className="steps-container">
          <div className={`step-item ${step === 1 ? 'active' : step > 1 ? 'done' : ''}`}>
            <div className="step-number">{step > 1 ? '✓' : '1'}</div>
            <span>Basic Info</span>
          </div>
          <div className={`step-item ${step === 2 ? 'active' : step > 2 ? 'done' : ''}`}>
            <div className="step-number">{step > 2 ? '✓' : '2'}</div>
            <span>Qualifications</span>
          </div>
          <div className={`step-item ${step === 3 ? 'active' : ''}`}>
            <div className="step-number">3</div>
            <span>Source & Job</span>
          </div>
        </div>
        
        <div className="modal-body">
          {step === 1 && (
            <>
              <div className="form-section">
                <div className="form-section-title">Contact Information</div>
                <div className="form-row-grid">
                  <div className="form-row">
                    <label className="form-label">
                      Full Name <span className="required">*</span>
                    </label>
                    <input 
                      className="form-input" 
                      placeholder="e.g. John Smith" 
                      value={form.name} 
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      autoFocus
                    />
                  </div>
                  <div className="form-row">
                    <label className="form-label">
                      Phone Number <span className="required">*</span>
                    </label>
                    <input 
                      className="form-input" 
                      placeholder="e.g. 07xxx xxx xxx" 
                      value={form.phone} 
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label className="form-label">Email Address</label>
                  <input 
                    className="form-input" 
                    type="email" 
                    placeholder="e.g. john@email.com" 
                    value={form.email} 
                    onChange={e => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="form-section">
                <div className="form-section-title">Background</div>
                <div className="form-row">
                  <label className="form-label">Roles Interested In</label>
                  <input 
                    className="form-input" 
                    placeholder="e.g. Care Assistant, Support Worker, HCA" 
                    value={form.roles} 
                    onChange={e => setForm({ ...form, roles: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <label className="form-label">Experience Summary</label>
                  <textarea 
                    className="form-input textarea" 
                    placeholder="Brief summary of their care experience..." 
                    value={form.experience} 
                    onChange={e => setForm({ ...form, experience: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}
          
          {step === 2 && (
            <>
              <div className="form-section">
                <div className="form-section-title">Compliance & Qualifications</div>
                <div className="form-row">
                  <label className="form-label">Driver's License</label>
                  <div className="radio-group">
                    {['Yes', 'No', 'Learning'].map(v => (
                      <button 
                        key={v} 
                        className={`radio-btn ${form.driver === v ? 'active' : ''}`} 
                        onClick={() => setForm({ ...form, driver: v })}
                      >
                        {v === 'Yes' ? '🚗 ' : v === 'No' ? '🚶 ' : '📖 '}{v}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-row">
                  <label className="form-label">DBS on Update Service</label>
                  <div className="radio-group">
                    {['Yes', 'No', 'Pending'].map(v => (
                      <button 
                        key={v} 
                        className={`radio-btn ${form.dbs === v ? 'active' : ''}`} 
                        onClick={() => setForm({ ...form, dbs: v })}
                      >
                        {v === 'Yes' ? '✅ ' : v === 'No' ? '❌ ' : '⏳ '}{v}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-row">
                  <label className="form-label">Mandatory Training Complete</label>
                  <div className="radio-group">
                    {['Yes', 'No', 'Partial'].map(v => (
                      <button 
                        key={v} 
                        className={`radio-btn ${form.training === v ? 'active' : ''}`} 
                        onClick={() => setForm({ ...form, training: v })}
                      >
                        {v === 'Yes' ? '🎓 ' : v === 'No' ? '📚 ' : '📝 '}{v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="form-section">
                <div className="form-section-title">Availability</div>
                <div className="form-row">
                  <label className="form-label">Earliest Start Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={form.start_date} 
                    onChange={e => setForm({ ...form, start_date: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}
          
          {step === 3 && (
            <>
              <div className="form-section">
                <div className="form-section-title">Source</div>
                <div className="form-row">
                  <label className="form-label">Where did they come from?</label>
                  <div className="source-grid">
                    {sources.map(s => (
                      <button 
                        key={s.id} 
                        className={`source-btn ${form.source === s.id ? 'active' : ''}`} 
                        onClick={() => setForm({ ...form, source: s.id })}
                      >
                        <span className="source-btn-icon">{s.icon}</span>
                        <span className="source-btn-label">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="form-section">
                <div className="form-section-title">Job Assignment</div>
                <div className="form-row">
                  <label className="form-label">Apply to Job (Optional)</label>
                  <select 
                    className="form-input" 
                    value={form.job_id} 
                    onChange={e => setForm({ ...form, job_id: e.target.value })}
                  >
                    <option value="">No specific job</option>
                    {jobs.map(j => (
                      <option key={j.id} value={j.id}>{j.title} - {j.location}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label className="form-label">Additional Notes</label>
                  <textarea 
                    className="form-input textarea" 
                    placeholder="Any other relevant information..." 
                    value={form.notes} 
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}
        </div>
        
        <div className="modal-footer">
          <button 
            className="modal-btn secondary" 
            onClick={() => step > 1 ? setStep(step - 1) : handleClose()}
          >
            {step > 1 ? '← Back' : 'Cancel'}
          </button>
          {step < 3 ? (
            <button 
              className="modal-btn primary" 
              onClick={() => setStep(step + 1)} 
              disabled={!canProceed()}
            >
              Next Step →
            </button>
          ) : (
            <button className="modal-btn primary" onClick={handleSubmit}>
              ✓ Add Candidate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
