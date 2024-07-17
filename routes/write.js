
const router = require('express').Router()
const { ObjectId } = require('mongodb');
const { log } = console;
const { check_login } = require('./middleware.js')
const { connectDB, forTransaction } = require('./database.js')
const { validation } = require('./validation.js')
const moment = require('moment');

let db
connectDB.then((client) => {
    db = client.db('baseball')

}).catch((err) => {
    console.log(err)
})


const session = forTransaction.startSession()

router.get('/', check_login, async (req, res) => {
    try {
        res.status(200).send({ success: true, userData: req.user })
        return
    } catch (err) {
        console.log('Router [write/] catch')
        res.send({ success: false, message: err })
        return
    }
})

router.post('/guest', check_login, async (req, res) => {
    try {
        const dataValidation = await validation({ data: req.body, typeNumber: 0 })
        if (dataValidation.error) return res.status(200).send({ success: false, false_code: 3, message: '입력데이터 뭐 잘못됨' })
        const post_count = await db.collection('count_post').findOne({ name: 'guest_post' })
        await db.collection('guest_post').insertOne({
            no: post_count.count,
            ...req.body,
            writer_id: req.user._id,
            write_time: moment().format('YYYY-MM-DD HH-mm'),
            recruitment_fix: [0, 0, 0, 0],
            end: false
        })
        await db.collection('count_post').updateOne(
            { name: 'guest_post' },
            {
                $set: { count: post_count.count + 1 }
            })
        await res.status(200).send({ success: true, message: 'Guset작성확인' })
        return
    } catch (err) {
        console.log('Router [guest] catch')
        console.log(err)
    }
})

router.post('/team', check_login, async (req, res) => {
    try {
        const dataValidation = await validation({ data: req.body, typeNumber: 1 })
        if (dataValidation.error) return res.status(200).send({ success: false, false_code: 3, message: '입력데이터 뭐 잘못됨' })
        const user = await db.collection('user').findOne({ _id: new ObjectId(req.user._id) })
        const new_id = await new ObjectId();
        const { name, url } = req.body
        if (await !Object.values(user.team).includes(null)) {
            res.status(200).send({ success: false, false_code: 6, message: '팀 최대치 -> false_code : 6' })
            return;
        }
        let user_team = user.team
        if (user && user_team) {
            for (const key in user_team) {
                if (user_team[key] === null) {
                    user_team[key] = new_id;
                    break;
                }
            }
        }
        const overlapping_result = await check_overlapping(name, url)
        if (overlapping_result[0]) {
            res.status(200).send({ success: false, overlapping_result: overlapping_result[1], false_code: 2, message: '중복데이터 -> false_code : 2' })
            return
        }
        const work_for_db = await team_transaction(req.body, user, user_team, session, new_id)
        if (work_for_db) {
            res.status(200).send({ success: true, team_url: url })
            return
        } else {
            res.status(200).send({ success: false, message: 'something err' })
            return
        }

    } catch (err) {
        console.log('Router [team] catch')
        console.log(err)
    }
})

router.post('/team/overlapping', async (req, res) => {
    try {
        const { name, url } = await req.body
        const overlapping_result = await check_overlapping(name, url)
        if (overlapping_result[0]) {
            res.status(200).send({ success: false, overlapping_result: overlapping_result[1], false_code: 2, message: '중복데이터 -> false_code : 2' })
            return
        } else {
            res.status(200).send({ success: true })
            return
        }
    } catch (err) {
        console.log('Router [team/overlapping] catch')
        console.log(err)
    }
})

async function check_overlapping(teamname, teamurl) {
    var overlapping_result = await false
    var overlapping_teamname = await db.collection('team').findOne({ name: teamname }) === null ? false : true
    var overlapping_teamurl = await db.collection('team').findOne({ url: teamurl }) === null ? false : true
    if (overlapping_teamname || overlapping_teamurl) overlapping_result = await true
    // -----------
    if (overlapping_result) return ([true, [!overlapping_teamname, !overlapping_teamurl]])
    return ([false, [!overlapping_teamname, !overlapping_teamurl]]);
}

async function team_transaction(req_body, user, user_team, session, new_id) {

    const team_count = await db.collection('count_post').findOne({ name: 'team' })
    try {
        const transaction_result = await session.withTransaction(async () => {
            const work1 = await db.collection('team').insertOne({
                _id: new_id,
                no: team_count.count,
                ...req_body,
                team_founder: user._id,
                team_found_date: moment().format('YYYY-MM-DD HH:mm'),
                team_leader: user._id,
                member_count: 1
            }, { session })
            if (await !work1.acknowledged) {
                throw new Error('work1')
            }
            const work2 = await db.collection('count_post').updateOne(
                { name: 'team' },
                {
                    $inc: { count: 1 }
                }, { session })
            if (work2.modifiedCount !== 1) {
                throw new Error('work2')
            }
            const work3 = await db.collection('user').updateOne(
                { _id: new ObjectId(user._id) },
                {
                    $set: { team: user_team }
                }, { session })
            if (work3.modifiedCount !== 1) {
                throw new Error('work3')
            }
            const work4 = await db.collection('member').insertOne({
                team_id: new_id,
                user_id: user._id,
                nickname: user.nickname,
                join_date: moment().format('YYYY-MM-DD HH-mm'),
                member_rating: 1,
            }, { session })
            if (await !work4.acknowledged) {
                throw new Error('work1')
            }
        })
        return transaction_result;
    } catch (err) {
        console.log('function [team_transaction] catch')
        throw err
    }
}

router.post('/bulletin', check_login, async (req, res) => {
    try {
        const dataValidation = await validation({ data: req.body, typeNumber: 2 })
        if (dataValidation.error) return res.status(200).send({ success: false, false_code: 3, message: '입력데이터 뭐 잘못됨' })
        const user = await db.collection('user').findOne({ _id: new ObjectId(req.user._id) })
        const new_id = await new ObjectId();
        const work_for_db = await bulletin_transaction(req.body, user, new_id, session)
        if (work_for_db) {
            return res.status(200).send({ success: true, message: '성공' })
        } else {
            return res.status(200).send({ success: false, message: '실패' })
        }
    } catch (err) {
        console.log('Router [bulletin] catch')
        console.log(err)
    }
})

async function bulletin_transaction(req_body, user, new_id, session) {
    try {
        const bulletin_count = await db.collection('count_post').findOne({ name: 'bulletin_post' })
        const transaction_result = await session.withTransaction(async () => {
            // 1 bulletin_post 에 정보올리기
            // 2 count 조정하기.
            const work1 = await db.collection('bulletin_post').insertOne({
                _id: new_id,
                no: bulletin_count.count,
                ...req_body,
                writer_id: new ObjectId(user._id),
                writer_nickname: user.nickname,
                write_time: moment().format('YYYY-MM-DD HH:mm'),
                view: 0,
                like: 0,
                comment: 0,
            }, { session })
            if (await !work1.acknowledged) {
                throw new Error('work1')
            }
            const work2 = await db.collection('count_post').updateOne(
                { name: 'bulletin_post' },
                {
                    $inc: { count: 1 }
                }, { session })
            if (work2.modifiedCount !== 1) {
                throw new Error('work2')
            }
            const work3 = await db.collection('bulletin').insertOne({
                post_id: new_id
            }, { session })
            if (await !work3.acknowledged) {
                throw new Error('work3')
            }
        })
        return transaction_result;
    } catch (err) {
        console.log('function [bulletin_transaction] catch')
        throw err
    }
}


module.exports = router


