const express = require('express')
const session = require('express-session')
const passport = require('passport')
const MongoStore = require('connect-mongo')
const path = require('path')
require('dotenv').config();
const app = express()
var cors = require('cors');

//-------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }))
app.use(passport.initialize())
app.use(cors({
  origin: process.env.DB_CORS,
  credentials: true,
  methods: ["GET", "POST"],
  optionsSuccessStatus: 200
}));
//------------------------------------

app.use(session({
  secret: process.env.SECRET_PASSPORT,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 60 * 60 * 1000,
    secure: false
  },
  store: MongoStore.create({
    mongoUrl: process.env.DB_URL,
    dbName: 'baseball'
  })
}))
app.use(passport.session())
// ----------------------------------

let { connectDB } = require('./routes/database.js')
let db
connectDB.then((client) => {
  console.log('DB연결성공')
  db = client.db('baseball')
  app.listen(process.env.PORT, () => { console.log('server start') })

  app.use(express.static(path.join(__dirname, 'build')));


  app.use('/', require('./routes/login.js'))
  app.use('/mypage', require('./routes/mypage.js'))
  app.use('/write', require('./routes/write.js')) // 팀생성도 같이 
  app.use('/board', require('./routes/board.js'))
  app.use('/post', require('./routes/post.js'))

  app.get('/check_login', async (req, res) => {
    // 로그인상태 체크임, nav 및 필요한 상황에서 사용
    try {
      if (req.user) {
        return res.status(200).send({ success: true, message: '로그인확인' })
      } else {
        return res.status(200).send({ success: false, false_code: 1, message: '비로그인 -> false_code : 1' })
      }
    } catch (err) {
      console.log('Router [check_login] catch')
      return res.send({ success: false, message: err })
    }
  })

  app.get('/reset', async (req, res) => {
    try {
      await db.collection('guest').deleteMany({})
      await db.collection('guest_post').deleteMany({})
      await db.collection('member').deleteMany({})
      await db.collection('notification_post').deleteMany({})
      await db.collection('notification_user').deleteMany({})
      await db.collection('team').deleteMany({})
      await db.collection('bulletin_post').deleteMany({})
      await db.collection('bulletin').deleteMany({})
      await db.collection('bulletin_comment').deleteMany({})
      res.status(200).send({ success: true, message: '리셋' })
      return
    } catch (err) {
      console.log('Router [reset] catch')
      console.log(err)
    }
  })


}).catch((err) => {
  console.log(err)
})
