const router = require('express').Router()
const passport = require('passport')
const LocalStrategy = require('passport-local')
const { ObjectId } = require('mongodb')
const bcrypt = require('bcrypt')
const moment = require('moment');

let { connectDB } = require('./database.js')

let db
connectDB.then((client) => {
  db = client.db('baseball')

}).catch((err) => {
  console.log(err)
})

passport.use(new LocalStrategy(async (입력한아이디, 입력한비번, cb) => {
  let result = await db.collection('user').findOne({ username: 입력한아이디 })
  if (!result) {
    return cb(null, false, { message: '(id)입력데이터틀림 -> false_code : 3' })
  }
  if (await bcrypt.compare(입력한비번, result.password)) {
    return cb(null, result)
  } else {
    return cb(null, false, { message: '(pw)입력데이터틀림 -> false_code : 3' });
  }
}))

passport.serializeUser((user, done) => {
  process.nextTick(() => {
    done(null, { id: user._id, username: user.username })
  })
})

passport.deserializeUser(async (user, done) => {
  let result = await db.collection('user').findOne({ _id: new ObjectId(user.id) })
  delete result.password
  process.nextTick(() => {
    return done(null, result)
  })
})

router.post('/login', async (req, res, next) => {
  passport.authenticate('local', (error, user, info) => {
    if (error) return res.status(500).json({ success: false, message: error })
    if (!user) return res.status(200).json({ success: false, message: info.message, false_code: 3 })
    req.logIn(user, (err) => {
      if (err) return next(err)
      res.status(200).send({ success: true })
    })
  })(req, res, next)

})

router.post('/regist', async (req, res) => {
  try {
    const { username, password, nickname } = req.body
    const hash_password = await bcrypt.hash(password, 10)
    const overlapping_result = await check_overlapping(username, nickname)
    if (!overlapping_result[0]) {
      await db.collection('user').insertOne({
        username: username,
        nickname: nickname,
        password: hash_password,
        regist_moment: moment().format('YYYY-MM-DD HH:mm'),
        team: { team1: null, team2: null }
      })
      res.status(200).send({ success: true, message: "회원가입이 완료되었습니다." })
      return
    } else if (overlapping_result[0]) {
      res.status(200).send({ success: false, overlapping_result: overlapping_result[1], false_code: 2, message: '중복데이터 -> false_code : 2' })
      return;
    }
  } catch (err) {
    console.error("회원가입 insertOne 실패   -> " + err)
    res.status(500).send({ success: false, meassage: "DB등록에 실패하였습니다." })
    return
  }
})

router.get('/logout', async (req, res) => {
  try {
    if (req.user) {
      res.status(200).send({ success: true })
      return reqLogout(req, res)
    } else {
      res.status(200).send({ success: false })
      return
    }
  } catch (err) {
    console.log(err)
  }
})

async function reqLogout(req, res) {
  await req.logout(() => {
    console.log('로그아웃완료')
    return true
  })
}

async function check_overlapping(username, nickname) {
  var overlapping_result = await false
  var overlapping_username = await db.collection('user').findOne({ username: username }) === null ? false : true
  var overlapping_nickname = await db.collection('user').findOne({ nickname: nickname }) === null ? false : true
  if (overlapping_username || overlapping_nickname) overlapping_result = await true
  //  ture 일 경우는 중복이라는 뜻
  if (overlapping_result) return ([true, [overlapping_username, overlapping_nickname]])
  return ([false, [overlapping_username, overlapping_nickname]]);
}



module.exports = router