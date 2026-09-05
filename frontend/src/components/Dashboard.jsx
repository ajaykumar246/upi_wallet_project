import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

export default function Dashboard({ user, onLogout }) {
    const [activeTab, setActiveTab] = useState('home');
    
    // Global state
    const [balance, setBalance] = useState('0.00');
    const [history, setHistory] = useState([]);
    
    // Payment State
    const [receiverVpa, setReceiverVpa] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [pin, setPin] = useState('');
    const [payStatus, setPayStatus] = useState({ loading: false, error: '', success: '' });

    // Deposit State
    const [depositAmount, setDepositAmount] = useState('');
    const [depositStatus, setDepositStatus] = useState({ loading: false, error: '', success: '' });

    // Settings (PIN) State
    const [hasPin, setHasPin] = useState(false);
    const [settingsForm, setSettingsForm] = useState({ newPin: '', oldPin: '', password: '', authMethod: 'oldPin' });
    const [pinStatus, setPinStatus] = useState({ loading: false, error: '', success: '' });

    const fetchData = useCallback(async () => {
        try {
            const balRes = await api.getBalance();
            setBalance(balRes.balance.toFixed(2));
            
            const histRes = await api.getHistory();
            setHistory(histRes.transactions || []);
        } catch (err) {
            console.error("Failed to fetch data", err);
        }
    }, []);

    const fetchPinStatus = useCallback(async () => {
        try {
            const res = await api.checkHasPin();
            setHasPin(res.hasPin);
        } catch(err) {
            console.error("Failed to check PIN", err);
        }
    }, []);

    useEffect(() => {
        fetchData();
        fetchPinStatus();
    }, [fetchData, fetchPinStatus]);

    const handleLogout = async () => {
        try {
            await api.logout();
        } catch (e) {
            console.error(e);
        }
        onLogout();
    };

    const handlePay = async (e) => {
        e.preventDefault();
        setPayStatus({ loading: true, error: '', success: '' });
        try {
            const idempotencyKey = crypto.randomUUID();
            await api.pay(receiverVpa, amount, category, pin, idempotencyKey);
            setPayStatus({ loading: false, error: '', success: 'Payment successful!' });
            setReceiverVpa('');
            setAmount('');
            setCategory('');
            setPin('');
            fetchData();
        } catch (err) {
            setPayStatus({ loading: false, error: err.message, success: '' });
        }
    };

    const handleDeposit = async (e) => {
        e.preventDefault();
        setDepositStatus({ loading: true, error: '', success: '' });
        try {
            await api.deposit(depositAmount);
            setDepositStatus({ loading: false, error: '', success: 'Money deposited successfully!' });
            setDepositAmount('');
            fetchData();
        } catch (err) {
            setDepositStatus({ loading: false, error: err.message, success: '' });
        }
    };

    const handlePinSubmit = async (e) => {
        e.preventDefault();
        setPinStatus({ loading: true, error: '', success: '' });
        try {
            if (hasPin) {
                // Update PIN
                const oldPin = settingsForm.authMethod === 'oldPin' ? settingsForm.oldPin : null;
                const password = settingsForm.authMethod === 'password' ? settingsForm.password : null;
                await api.updatePin(settingsForm.newPin, oldPin, password);
                setPinStatus({ loading: false, error: '', success: 'PIN updated successfully!' });
            } else {
                // Create PIN
                await api.createPin(settingsForm.newPin);
                setPinStatus({ loading: false, error: '', success: 'PIN created successfully!' });
                setHasPin(true);
            }
            setSettingsForm({ newPin: '', oldPin: '', password: '', authMethod: 'oldPin' });
        } catch (err) {
            setPinStatus({ loading: false, error: err.message, success: '' });
        }
    };

    const tabs = [
        { id: 'home', label: 'Home' },
        { id: 'pay', label: 'Pay' },
        { id: 'deposit', label: 'Deposit' },
        { id: 'history', label: 'History' },
        { id: 'settings', label: 'Settings' }
    ];

    return (
        <div className="animate-fade-in">
            <nav className="navbar">
                <div className="navbar-brand">UPI Wallet</div>
                <div className="nav-links">
                    <span style={{ color: 'var(--text-secondary)' }}>{user}@upi</span>
                    <button className="btn btn-outline" style={{ padding: '0.4rem 1rem' }} onClick={handleLogout}>Logout</button>
                </div>
            </nav>

            <div className="dashboard-container">
                <div className="tabs-container">
                    <div className="tab-header">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="tab-content">
                        {activeTab === 'home' && (
                            <div className="glass-panel balance-card animate-fade-in">
                                <h3>Available Balance</h3>
                                <div className="balance-amount">₹{balance}</div>
                            </div>
                        )}

                        {activeTab === 'pay' && (
                            <div className="glass-panel animate-fade-in" style={{ maxWidth: '500px', margin: '0 auto' }}>
                                <h3>Send Money</h3>
                                <form onSubmit={handlePay}>
                                    <div className="input-group">
                                        <label>Receiver VPA</label>
                                        <input type="text" required value={receiverVpa} onChange={(e)=>setReceiverVpa(e.target.value)} placeholder="e.g. john@upi" />
                                    </div>
                                    <div className="input-group">
                                        <label>Amount (₹)</label>
                                        <input type="number" required min="1" value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="0.00" />
                                    </div>
                                    <div className="input-group">
                                        <label>Category</label>
                                        <input type="text" required value={category} onChange={(e)=>setCategory(e.target.value)} placeholder="Food, Rent, etc." />
                                    </div>
                                    <div className="input-group mb-4">
                                        <label>UPI PIN</label>
                                        <input type="password" required maxLength="6" value={pin} onChange={(e)=>setPin(e.target.value)} placeholder="••••" />
                                    </div>
                                    <button type="submit" className="btn" disabled={payStatus.loading}>
                                        {payStatus.loading ? 'Processing...' : 'Pay Now'}
                                    </button>
                                    {payStatus.error && <p className="error-message">{payStatus.error}</p>}
                                    {payStatus.success && <p className="success-message">{payStatus.success}</p>}
                                </form>
                            </div>
                        )}

                        {activeTab === 'deposit' && (
                            <div className="glass-panel animate-fade-in" style={{ maxWidth: '500px', margin: '0 auto' }}>
                                <h3>Add Money (Mock)</h3>
                                <form onSubmit={handleDeposit}>
                                    <div className="input-group mb-4">
                                        <label>Amount (₹)</label>
                                        <input type="number" required min="1" value={depositAmount} onChange={(e)=>setDepositAmount(e.target.value)} placeholder="0.00" />
                                    </div>
                                    <button type="submit" className="btn btn-outline" style={{ borderColor: 'var(--success)', color: 'var(--success)' }} disabled={depositStatus.loading}>
                                        {depositStatus.loading ? 'Adding...' : 'Deposit Money'}
                                    </button>
                                    {depositStatus.error && <p className="error-message">{depositStatus.error}</p>}
                                    {depositStatus.success && <p className="success-message">{depositStatus.success}</p>}
                                </form>
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div className="glass-panel animate-fade-in">
                                <h3>Transaction History</h3>
                                {history.length === 0 ? (
                                    <p>No transactions yet.</p>
                                ) : (
                                    <div className="transaction-list">
                                        {history.map(tx => {
                                            const isSender = tx.sender_vpa === `${user}@upi`;
                                            return (
                                                <div key={tx.id} className="transaction-item">
                                                    <div className="transaction-info">
                                                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                                                            {isSender ? `To: ${tx.receiver_vpa}` : `From: ${tx.sender_vpa}`}
                                                        </span>
                                                        <span style={{ fontSize: '0.8rem' }}>{tx.category || 'Transfer'} • {new Date(tx.timestamp).toLocaleDateString()}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                                                        <span className={`transaction-amount ${isSender ? 'negative' : 'positive'}`} style={{ fontWeight: 600 }}>
                                                            {isSender ? '-' : '+'}₹{Number(tx.amount).toFixed(2)}
                                                        </span>
                                                        <span className={`status-badge status-${tx.status.toLowerCase()}`}>
                                                            {tx.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <div className="glass-panel animate-fade-in" style={{ maxWidth: '500px', margin: '0 auto' }}>
                                <h3>{hasPin ? 'Update UPI PIN' : 'Setup UPI PIN'}</h3>
                                <form onSubmit={handlePinSubmit}>
                                    <div className="input-group">
                                        <label>New PIN</label>
                                        <input type="password" required maxLength="6" value={settingsForm.newPin} onChange={(e)=>setSettingsForm({...settingsForm, newPin: e.target.value})} placeholder="Enter 4-6 digit PIN" />
                                    </div>
                                    
                                    {hasPin && (
                                        <>
                                            <div className="input-group mt-2">
                                                <label>Authorize via:</label>
                                                <select 
                                                    value={settingsForm.authMethod} 
                                                    onChange={(e)=>setSettingsForm({...settingsForm, authMethod: e.target.value, oldPin: '', password: ''})}
                                                    style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', color: 'white', borderRadius: '4px' }}
                                                >
                                                    <option value="oldPin">Previous UPI PIN</option>
                                                    <option value="password">Account Password</option>
                                                </select>
                                            </div>

                                            {settingsForm.authMethod === 'oldPin' ? (
                                                <div className="input-group mb-4">
                                                    <label>Old PIN</label>
                                                    <input type="password" required maxLength="6" value={settingsForm.oldPin} onChange={(e)=>setSettingsForm({...settingsForm, oldPin: e.target.value})} placeholder="Enter your previous PIN" />
                                                </div>
                                            ) : (
                                                <div className="input-group mb-4">
                                                    <label>Account Password</label>
                                                    <input type="password" required value={settingsForm.password} onChange={(e)=>setSettingsForm({...settingsForm, password: e.target.value})} placeholder="Enter account password" />
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {!hasPin && <div className="mb-4"></div>}

                                    <button type="submit" className="btn btn-outline" disabled={pinStatus.loading}>
                                        {pinStatus.loading ? 'Processing...' : (hasPin ? 'Update PIN' : 'Set PIN')}
                                    </button>
                                    {pinStatus.error && <p className="error-message">{pinStatus.error}</p>}
                                    {pinStatus.success && <p className="success-message">{pinStatus.success}</p>}
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
