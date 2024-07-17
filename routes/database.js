const { MongoClient } = require('mongodb')
require('dotenv').config()


const url = process.env.DB_URL

let connectDB = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true }).connect()
let forTransaction = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true })
// test는 트랜잭션  session만들기 용
module.exports = { connectDB, forTransaction }


