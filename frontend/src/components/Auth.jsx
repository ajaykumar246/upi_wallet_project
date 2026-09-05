import { useState } from 'react';
import { api } from '../api';

export default function Auth({ onLogin }) {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                const res = await api.login(username, password);
                localStorage.setItem('token', res.token);
                localStorage.setItem('user', username);
                onLogin(username);
            } else {
                await api.signup(username, password);
                // After signup, automatically login
                const loginRes = await api.login(username, password);
                localStorage.setItem('token', loginRes.token);
                localStorage.setItem('user', username);
                onLogin(username);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container animate-fade-in" style={{ marginTop: '10vh' }}>
            <div className="glass-panel">
                <h1 className="text-center">{isLogin ? 'Welcome Back' : 'Create Account'}</h1>
                <p className="text-center mb-4">
                    {isLogin ? 'Sign in to access your UPI wallet' : 'Join the most premium UPI experience'}
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            placeholder="Enter username"
                        />
                    </div>
                    <div className="input-group mb-4">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                        />
                    </div>

                    <button type="submit" className="btn" disabled={loading}>
                        {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
                    </button>

                    {error && <p className="error-message">{error}</p>}
                </form>

                <p className="text-center mt-4" style={{ fontSize: '0.9rem' }}>
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <span
                        style={{ color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 500 }}
                        onClick={() => { setIsLogin(!isLogin); setError(''); }}
                    >
                        {isLogin ? 'Sign up' : 'Sign in'}
                    </span>
                </p>
            </div>
        </div>
    );
}
