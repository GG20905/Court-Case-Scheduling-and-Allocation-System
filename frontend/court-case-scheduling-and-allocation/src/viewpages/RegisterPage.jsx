import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

const ROLES = [
  { label: 'Advocate / Litigant', value: 'litigant' },
  { label: 'Court Administrator', value: 'admin' },
  { label: 'Judge', value: 'judge' },
];

const JUDGE_SPECIALTIES = [
  'Environment and Land Court (ELC)',
  'Employment and Labour Relations Court (ELRC)',
  "Kadhi's Courts",
  'Family and Children Division',
  'Commercial and Tax Division',
  'Constitutional and Human Rights Division',
  'Criminal Division',
  'Anti-Corruption and Economic Crimes Division',
  'Judicial Review Division',
  'Admiralty Division',
  'Civil Division',
  'Sexual and Gender-Based Violence (SGBV) Courts',
  "Children's Courts",
  'Counter-Terrorism Courts',
  'JKIA Courts',
];

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: '',
    name: '',
    password: '',
    confirmPassword: '',
    role: '',
    courtStation: '',
    judgeSpecialty: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (event) => {
    if (event) event.preventDefault();
    const { email, name, password, confirmPassword, role, courtStation, judgeSpecialty } = form;
    if (!email || !name || !password || !confirmPassword || !role)
      return setError('Please fill in all fields.');
    if (password !== confirmPassword)
      return setError('Passwords do not match.');
    if (role === 'judge' && !courtStation)
      return setError('Court station is required for judges.');
    if (role === 'judge' && !judgeSpecialty)
      return setError('Specialty is required for judges.');
    setError('');

    const payload = {
      full_name: name,
      email,
      password,
      role,
    };

    if (role === 'litigant') {
      payload.participant_type = 'litigant';
    }

    if (role === 'judge') {
      payload.court_station = courtStation;
      payload.judge_specialty = judgeSpecialty;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        navigate('/login');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message || 'Registration failed.');
      }
    } catch {
      setError('Unable to reach server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page">
      <Navbar />
      <div className="page-body">
        <form className="card" onSubmit={handleSubmit}>

          <label className="field-label">E-mail</label>
          <input type="email" className="field-input" value={form.email} onChange={handleChange('email')} />

          <label className="field-label">Name</label>
          <input type="text" className="field-input" value={form.name} onChange={handleChange('name')} />

          <label className="field-label">Password</label>
          <input type="password" className="field-input" value={form.password} onChange={handleChange('password')} />

          <label className="field-label">Confirm Password</label>
          <input type="password" className="field-input" value={form.confirmPassword} onChange={handleChange('confirmPassword')} />

          <label className="field-label">Role</label>
          <select
            className="field-select"
            value={form.role}
            onChange={(event) => {
              const nextRole = event.target.value;
              setForm((prev) => ({
                ...prev,
                role: nextRole,
                courtStation: nextRole === 'judge' ? prev.courtStation : '',
                judgeSpecialty: nextRole === 'judge' ? prev.judgeSpecialty : '',
              }));
            }}
          >
            <option value="" disabled>Select a role</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          {form.role === 'judge' && (
            <>
              <label className="field-label">Court Station</label>
              <input
                type="text"
                className="field-input"
                value={form.courtStation}
                onChange={handleChange('courtStation')}
                placeholder="e.g. Nairobi High Court"
              />

              <label className="field-label">Specialty</label>
              <select
                className="field-select"
                value={form.judgeSpecialty}
                onChange={handleChange('judgeSpecialty')}
              >
                <option value="" disabled>Select judge specialty</option>
                {JUDGE_SPECIALTIES.map((specialty) => (
                  <option key={specialty} value={specialty}>{specialty}</option>
                ))}
              </select>
            </>
          )}

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="auth-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Registering...' : 'Register'}
          </button>

          <p className="form-footer">
            Already have an account? <Link to="/login">Login here</Link>
          </p>

        </form>
      </div>
    </div>
  );
}