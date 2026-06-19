import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

const ROLES = ['Advocate / Litigant', 'Court Administrator', 'Judge'];

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: '',
    name: '',
    password: '',
    confirmPassword: '',
    role: '',
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async () => {
    const { email, name, password, confirmPassword, role } = form;
    if (!email || !name || !password || !confirmPassword || !role)
      return setError('Please fill in all fields.');
    if (password !== confirmPassword)
      return setError('Passwords do not match.');
    setError('');
    // TODO: call your backend registration API here
    // const res = await fetch('/api/auth/register', {
    //   method: 'POST',
    //   body: JSON.stringify(form),
    // });
    // navigate('/login');
  };

  return (
    <div className="page">
      <Navbar />
      <div className="page-body">
        <div className="card">

          <label className="field-label">E-mail</label>
          <input type="email" className="field-input" value={form.email} onChange={handleChange('email')} />

          <label className="field-label">Name</label>
          <input type="text" className="field-input" value={form.name} onChange={handleChange('name')} />

          <label className="field-label">Password</label>
          <input type="password" className="field-input" value={form.password} onChange={handleChange('password')} />

          <label className="field-label">Confirm Password</label>
          <input type="password" className="field-input" value={form.confirmPassword} onChange={handleChange('confirmPassword')} />

          <label className="field-label">Role</label>
          <select className="field-select" value={form.role} onChange={handleChange('role')}>
            <option value="" disabled>Select a role</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {error && <p className="form-error">{error}</p>}

          <p className="form-footer">
            Already have an account? <Link to="/login">Login here</Link>
          </p>

        </div>
      </div>
    </div>
  );
}