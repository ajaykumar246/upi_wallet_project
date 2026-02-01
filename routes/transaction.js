const { Client } = require('pg');
const pool = require('../db');
const redisClient = require('../redis');
const bcrypt = require('bcrypt');


const pay=async (req, res) => {

    const {  receiver_vpa, amount,category,pin } = req.body;
    const client = await pool.connect();
    const sender_vpa=req.user.vpa;

    try {
        console.log(`Processing payment: ${amount} from ${sender_vpa} to ${receiver_vpa}`);

        // 1. Check Redis Cache
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
            if (checkSend.rowCount === 0) throw new Error('sender VPA not found');
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

        const result = await client.query('SELECT * FROM npci WHERE vpa = $1', [sender_vpa]);
        if (result.rows.length === 0) return res.status(400).json({ error: 'User not found' });
        
        const user = result.rows[0];

        // Check password
        const validPassword = await bcrypt.compare(pin, user.pin);
        if (!validPassword) return res.status(400).json({ error: 'Invalid Pin' });

        const balance=await client.query('SELECT balance FROM users WHERE vpa=$1',[sender_vpa]);
        const avb=Number(balance.rows[0].balance);
        if(avb<amount)
        throw new Error("insufficient balance 😒")
        // 2. Transaction
        await client.query('BEGIN');
        await client.query('UPDATE users SET balance = balance - $1 WHERE vpa = $2', [amount, sender_vpa]);
        await client.query('UPDATE users SET balance = balance + $1 WHERE vpa = $2', [amount, receiver_vpa]);
        // id | sender_vpa | receiver_vpa | amount | category | status | timestamp
         const tid=await client.query("INSERT INTO transactions (sender_vpa ,receiver_vpa , amount, category , status) VALUES ($1,$2,$3,$4,$5 ) RETURNING id",[sender_vpa ,receiver_vpa ,amount ,category ,"SUCCESS"]);
        await client.query('COMMIT');

    
        res.json({ success: true, message: 'Transaction Successful', transaction_id:tid.rows[0].id });

    } catch (err) {
        await client.query("INSERT INTO transactions (sender_vpa ,receiver_vpa , amount, category , status) VALUES ($1,$2,$3,$4,$5 )",[sender_vpa ,receiver_vpa ,amount ,category ,"FAILED"]);
        await client.query('ROLLBACK');
        res.status(400).json({ error: err.message });
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
        const {rows}=await client.query("SELECT * FROM transactions WHERE sender_vpa= $1 OR receiver_vpa=$1 ORDERBY timestamp DESC",[vpa]);
        res.json({  transactions:rows });

    }
    catch(err){
        res.status(400).json({error:err.message});

    }
    finally{
        client.release();
    }
}

module.exports.pay=pay;
module.exports.balance=balance;
module.exports.createPin=createPin;
module.exports.history=history;