const { Client } = require('pg');
const pool = require('../db');
const redisClient = require('../redis');
const bcrypt = require('bcrypt');


const pay=async (req, res) => {

    const { receiver_vpa, amount, category, pin } = req.body;
    const client = await pool.connect();
    const sender_vpa = req.user.vpa;
    const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || req.body.idempotency_key;
    let idempotencyRedisKey = null;
    let inTransaction = false;

    try {
        console.log(`Processing payment: ${amount} from ${sender_vpa} to ${receiver_vpa}`);

        // 0. Check Idempotency Key
        if (idempotencyKey) {
            idempotencyRedisKey = `idempotency:${sender_vpa}:${idempotencyKey}`;
            const cachedResponse = await redisClient.get(idempotencyRedisKey);

            if (cachedResponse) {
                const parsed = JSON.parse(cachedResponse);
                if (parsed.status === 'PROCESSING') {
                    return res.status(409).json({ error: 'A transaction with this idempotency key is currently being processed' });
                }
                if (parsed.status === 'COMPLETED') {
                    console.log(`Idempotency Hit: Returning cached response for key ${idempotencyKey}`);
                    res.setHeader('Idempotent-Replayed', 'true');
                    return res.status(parsed.code).json(parsed.data);
                }
            }

            // Acquire temporary lock in Redis (TTL 60s)
            await redisClient.set(idempotencyRedisKey, JSON.stringify({ status: 'PROCESSING' }), { EX: 60 });
        }

        // 1. Check Redis Cache for VPA existence
        const cacheKey_rev = `vpa:${receiver_vpa}`;
        const cacheKey_send = `vpa:${sender_vpa}`;
        const cachedReceiver = await redisClient.get(cacheKey_rev);
        const cachedSender = await redisClient.get(cacheKey_send);

        if(cachedReceiver && cachedSender){
            console.log("cache hit");
        }
        else if(!cachedReceiver && cachedSender)  {
            const checkRes = await client.query('SELECT 1 FROM users WHERE vpa = $1', [receiver_vpa]);
            if (checkRes.rowCount === 0) throw new Error('Receiver VPA not found');
            await redisClient.set(cacheKey_rev, 'exists');
        } 
        else if(!cachedSender && cachedReceiver){
            const checkSend = await client.query('SELECT 1 FROM users WHERE vpa = $1', [sender_vpa]);
            if (checkSend.rowCount === 0) throw new Error('Sender VPA not found');
            await redisClient.set(cacheKey_send, 'exists');
        }
        else  {
            console.log("Cache Miss - Querying DB");
            const checkRes = await client.query('SELECT 1 FROM users WHERE vpa = $1', [receiver_vpa]);
            const checkSend = await client.query('SELECT 1 FROM users WHERE vpa = $1', [sender_vpa]);
            if (checkRes.rowCount === 0) throw new Error('Receiver VPA not found');
            if (checkSend.rowCount === 0) throw new Error('Sender VPA not found');
            await redisClient.set(cacheKey_rev, 'exists'); 
            await redisClient.set(cacheKey_send, 'exists');
        }

        // Verify UPI PIN from table `upi` (Fixed table name bug)
        const result = await client.query('SELECT * FROM upi WHERE vpa = $1', [sender_vpa]);
        if (result.rows.length === 0) return res.status(400).json({ error: 'UPI PIN not configured for this user' });
        
        const user = result.rows[0];

        // Check PIN validity
        const validPassword = await bcrypt.compare(pin, user.pin);
        if (!validPassword) return res.status(400).json({ error: 'Invalid Pin' });

        const balanceRes = await client.query('SELECT balance FROM users WHERE vpa=$1', [sender_vpa]);
        const avb = Number(balanceRes.rows[0].balance);
        if (avb < amount) throw new Error("Insufficient balance 😒");

        // 2. Execute DB Transaction
        await client.query('BEGIN');
        inTransaction = true;

        await client.query('UPDATE users SET balance = balance - $1 WHERE vpa = $2', [amount, sender_vpa]);
        await client.query('UPDATE users SET balance = balance + $1 WHERE vpa = $2', [amount, receiver_vpa]);
        
        const tid = await client.query(
            "INSERT INTO transactions (sender_vpa, receiver_vpa, amount, category, status, idempotency_key) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
            [sender_vpa, receiver_vpa, amount, category, "SUCCESS", idempotencyKey || null]
        );
        
        await client.query('COMMIT');
        inTransaction = false;

        const responseData = {
            success: true,
            message: 'Transaction Successful',
            transaction_id: tid.rows[0].id
        };

        // Cache successful completion in Redis (TTL 24 hours = 86400s)
        if (idempotencyRedisKey) {
            await redisClient.set(
                idempotencyRedisKey,
                JSON.stringify({ status: 'COMPLETED', code: 200, data: responseData }),
                { EX: 86400 }
            );
        }

        return res.json(responseData);

    } catch (err) {
        if (inTransaction) {
            await client.query('ROLLBACK');
            inTransaction = false;
        }

        try {
            await client.query(
                "INSERT INTO transactions (sender_vpa, receiver_vpa, amount, category, status, idempotency_key) VALUES ($1, $2, $3, $4, $5, $6)",
                [sender_vpa, receiver_vpa, amount, category, "FAILED", idempotencyKey || null]
            );
        } catch (logErr) {
            console.error("Failed to log transaction failure:", logErr.message);
        }

        // Release Redis lock on failure so user can retry
        if (idempotencyRedisKey) {
            await redisClient.del(idempotencyRedisKey);
        }

        return res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
}

//balance
const balance=async (req,res) => {
    
    const client = await pool.connect();
    try{
        console.log("checking balance...");
        const balance=await client.query('SELECT balance FROM users WHERE vpa=$1',[req.user.vpa]);
        const avb=Number(balance.rows[0].balance);
        
        res.json({balance:avb});
    }
    catch(err){
        res.status(400).json({ error: err.message });
    }
    finally{
        client.release();
    }
}

const createPin=async (req,res)=>{
    const vpa=req.user.vpa;
    const {pin}=req.body;
    const client=await pool.connect();
    try{
        const ispresent=await client.query('SELECT * FROM upi WHERE vpa= $1',[vpa]);
        if (ispresent.rowCount === 1) throw new Error('user already exists');
        const hashedpin=await bcrypt.hash(pin,10);
        const newUser=await client.query('INSERT INTO upi(vpa,pin) VALUES($1,$2)',[vpa,hashedpin]);
        res.json({message:"Pin created successfully..."});
    }
    catch(err){
        res.status(400).json({ error: err.message });
    }
     finally{
        client.release();
    }
}

const history=async(req,res)=>{
    const client = await pool.connect();
    const vpa=req.user.vpa;
    console.log("history");
    try{
        const {rows}=await client.query("SELECT * FROM transactions WHERE sender_vpa= $1 OR receiver_vpa=$1 ORDER BY timestamp DESC",[vpa]);
        res.json({  transactions:rows });

    }
    catch(err){
        res.status(400).json({error:err.message});

    }
    finally{
        client.release();
    }
}

const deposit = async (req, res) => {
    const client = await pool.connect();
    try {
        const vpa = req.user.vpa;
        const { amount } = req.body;
        if (!amount || amount <= 0) throw new Error("Invalid amount");
        
        await client.query('UPDATE users SET balance = balance + $1 WHERE vpa = $2', [amount, vpa]);
        
        await client.query(
            "INSERT INTO transactions (sender_vpa, receiver_vpa, amount, category, status) VALUES ($1, $2, $3, $4, $5)",
            ['mock_bank@upi', vpa, amount, 'Deposit', 'SUCCESS']
        );
        
        res.json({ message: "Deposit successful" });
    } catch (err) {
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
}

const hasPin = async (req, res) => {
    const client = await pool.connect();
    try {
        const vpa = req.user.vpa;
        const result = await client.query('SELECT 1 FROM upi WHERE vpa = $1', [vpa]);
        res.json({ hasPin: result.rowCount > 0 });
    } catch (err) {
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
}

const updatePin = async (req, res) => {
    const client = await pool.connect();
    try {
        const vpa = req.user.vpa;
        const { newPin, oldPin, password } = req.body;
        
        if (!newPin) throw new Error("New PIN is required");
        
        if (oldPin) {
            const upiRes = await client.query('SELECT pin FROM upi WHERE vpa = $1', [vpa]);
            if (upiRes.rowCount === 0) throw new Error("PIN not set");
            const valid = await bcrypt.compare(oldPin, upiRes.rows[0].pin);
            if (!valid) throw new Error("Incorrect old PIN");
        } else if (password) {
            const userRes = await client.query('SELECT password FROM users WHERE vpa = $1', [vpa]);
            if (userRes.rowCount === 0) throw new Error("User not found");
            const valid = await bcrypt.compare(password, userRes.rows[0].password);
            if (!valid) throw new Error("Incorrect account password");
        } else {
            throw new Error("Must provide either old PIN or account password to update");
        }
        
        const hashedPin = await bcrypt.hash(newPin, 10);
        await client.query('UPDATE upi SET pin = $1 WHERE vpa = $2', [hashedPin, vpa]);
        
        res.json({ message: "PIN updated successfully" });
    } catch (err) {
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
}

module.exports.pay=pay;
module.exports.balance=balance;
module.exports.createPin=createPin;
module.exports.history=history;
module.exports.deposit=deposit;
module.exports.hasPin=hasPin;
module.exports.updatePin=updatePin;