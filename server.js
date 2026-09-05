const express = require('express');
const cors = require('cors');
const authRouter=require('./routes/auth');
const authenticateToken=require('./middleware/auth');
const transaction=require('./routes/transaction')


const app = express();
app.use(express.json());
app.use(cors());
//authentication
app.use('/api/auth',authRouter);
// Payment Route
app.post('/api/createpin',authenticateToken,transaction.createPin);
app.get('/api/haspin', authenticateToken, transaction.hasPin);
app.put('/api/pin', authenticateToken, transaction.updatePin);
app.post('/api/pay', authenticateToken,transaction.pay);
app.post('/api/deposit', authenticateToken,transaction.deposit);
app.get('/api/balance',authenticateToken,transaction.balance);
app.get('/api/history',authenticateToken,transaction.history);


app.listen(3000, () => console.log('Node App running on port 3000'));