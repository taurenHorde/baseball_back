
const router = require('express').Router()
const { check_login } = require('./middleware.js')
const { log } = console;
let { connectDB } = require('./database.js');
const { ObjectId } = require('mongodb');


let db
connectDB.then((client) => {
    db = client.db('baseball')

}).catch((err) => {
    console.log(err)
})



router.get('/mypage_data', check_login, async (req, res) => {
    try {
        // 보내줘야하는것 (모든 정보 필요한 정보만)
        // 1. 나의 정보 myinfo
        const user = await db.collection('user').findOne({ _id: req.user._id })
        // 2. 내가 속한 팀 myteam
        const myteam = await Object.values(user.team).filter(val => val)
        const myteam_info = await mypage_team_conversion(myteam, user._id)
        // 3. 나에게 온 알림  mynotification
        const mynotification_info = await mypage_notification_conversion(user._id)
        //  -------------------------------------------
        return res.status(200).send({
            success: true,
            my_info: user,
            myteam_info: myteam_info,
            mynotification_user: mynotification_info[0],
            mynotification_post: mynotification_info[1]
        })
    } catch (err) {
        console.log('Router [mypage/] catch')
        console.log(err)
    }
})

router.get('/calender', check_login, async (req, res) => {
    try {
        const user = await db.collection('user').findOne({ _id: new ObjectId(req.user?._id) })
        const scheduleHost = await db.collection('guest_post') // 내가 만든 경기
            .find({ writer_id: new ObjectId(user._id) },
                {
                    projection: {
                        _id: 1,
                        date: 1,
                        time: 1,
                        stadium: 1,
                        end: 1
                    }
                }
            ).toArray()
        const scheduleGuest = await db.collection('guest') // 내가 신청한 경기 (확정 및 확인전까지)
            .find({
                user_id: new ObjectId(user._id),
                withdrawal: { $exists: false }
            }, {
                projection: {
                    post_id: 1,
                    approval: 1, // 이게 있으면 확정
                    confirm: 1,  // 이게 false 면 미확
                    _id: 0 // 겹치면안됨.
                }
            }).toArray()
        // 내가 만든 경기엔 내가 만든 경기 데이터 넣기
        // 내가 신청한 경기는 확정인지 확인전인지 넣기 + 경기정보 간략
        // type 1 - 내가 만든 / 2 - 참여(확정) / 3 - 참여(미확)
        const scheduleHostAdd = await scheduleHost.map(val => ({ ...val, calendartype: 1 }))
        const scheduleGuestAdd = await []
        for (var i = 0; i < scheduleGuest.length; i++) {
            let post_data = await db.collection('guest_post').findOne({ _id: new ObjectId(scheduleGuest[i].post_id) },
                {
                    projection: {
                        _id: 1,
                        date: 1,
                        time: 1,
                        stadium: 1,
                        end: 1
                    }
                })
            const calendartype = await !scheduleGuest[i].confirm ? 3 : scheduleGuest[i].approval ? 2 : 4
            post_data = { ...post_data, calendartype: calendartype }
            await scheduleGuestAdd.push(post_data)
        }
        const mySchedule = await [...scheduleGuestAdd, ...scheduleHostAdd]


        return res.status(200).send({ success: true, schedule: mySchedule })
    } catch (err) {
        console.log('Router [mypage/calender] catch')
        console.log(err)
    }
})


async function mypage_team_conversion(myteam_id, my_id) {
    // 나의 팀 _id로  팀이름,url 등등 가져오기.
    try {
        var data_retrun = []
        for (let i = 0; i < myteam_id.length; i++) {
            if (myteam_id[i] !== null) {
                const team_data = await db.collection('team').findOne({ _id: new ObjectId(myteam_id[i]) })
                const member_data = await db.collection('member').findOne({
                    team_id: new ObjectId(myteam_id[i]),
                    user_id: new ObjectId(my_id),
                    member_rating: { $exists: true }
                })
                data_retrun[i] = await {
                    team_name: team_data.name,
                    team_url: team_data.url,
                    team_id: team_data._id,
                    team_myrating: member_data.member_rating
                }
            }
        }
        return await data_retrun
    } catch (err) {
        console.log('function [mypage_team_conversion] catch')
        throw err
    }
}

async function mypage_notification_conversion(my_id) {
    try {
        const notificationUser = await db.collection('notification_user').find({ recevie_id: new ObjectId(my_id) }).toArray()
        const notificationPost = await db.collection('notification_post').find({ recevie_userid: new ObjectId(my_id) }).toArray()
        return await [notificationUser, notificationPost]
    } catch (err) {
        console.log('function [mypage_notification_conversion] catch')
        throw err
    }
}
// /////////////////////////////////////// history /////////////////////////
//  -------------------------지원내역-----------------

router.get('/history/application', check_login, async (req, res) => {
    try {
        log('작동')
        const user = await db.collection('user').findOne({ _id: new ObjectId(req.user._id) })
        var apply_guest = await db.collection('guest').find({ user_id: new ObjectId(user._id) }).toArray()
        var post_data;
        for (var i = 0; i < apply_guest.length; i++) {
            // mypage/apply 창에 띄울 호스트 신청 데이터.
            // 기본 guest 데이터 + post 데이터 내 date,stadium,sex,age,level,position,end 넣을 예정 . - 
            post_data = await db.collection('guest_post').findOne({ _id: new ObjectId(apply_guest[i].post_id) })
            apply_guest[i] = await {
                ...apply_guest[i],
                date: post_data.date,
                stadium: post_data.stadium,
                sex: post_data.sex,
                age: post_data.age,
                level: post_data.level,
                position: post_data.position,
                end: post_data.end
            }
        }
        res.status(200).send({ success: true, apply_guest: apply_guest })
        return
    } catch (err) {
        console.log('Router [/history/application] catch')
        console.log(err)
    }
})


// ------------------------------알림내역 ------------------


router.get('/history/notify', check_login, async (req, res) => {
    try {
        const user = await db.collection('user').findOne({ _id: req.user._id })
        const mynotification_info = await mypage_notification_conversion(user._id)
        res.status(200).send({
            success: true,
            my_info: user,
            mynotification_user: mynotification_info[0],
            mynotification_post: mynotification_info[1]
        })
        return
    } catch (err) {
        console.log('Router [/history/notify] catch')
        console.log(err)
    }
})

router.get('/history/notify/confirm', check_login, async (req, res) => {
    // 알림 페이지 들어오면 기존 페이지 다 확인 되는 API
    try {
        const user = await db.collection('user').findOne({ _id: req.user?._id })
        await db.collection('notification_user')
            .updateMany({
                recevie_id: new ObjectId(user?._id),
                confirm: false
            }, {
                $set: {
                    confirm: true
                }
            })
        await db.collection('notification_post')
            .updateMany({
                recevie_userid: new ObjectId(user?._id),
                confirm: false
            }, {
                $set: {
                    confirm: true
                }
            })
        res.status(200).send({ success: true, message: '알림 읽기처리' })
        return
    } catch (err) {
        console.log('Router [/history/notify/confirm] catch')
        console.log(err)
    }
})

router.get('/history/notify/delete', check_login, async (req, res) => {
    try {
        const user = await db.collection('user').findOne({ _id: req.user?._id })
        await db.collection('notification_user')
            .deleteMany({
                recevie_id: new ObjectId(user?._id),
            })
        await db.collection('notification_post')
            .deleteMany({
                recevie_userid: new ObjectId(user?._id),
            })
        res.status(200).send({ success: true, message: '알림 삭제처리' })
        return
    } catch (err) {
        console.log('Router [/history/notify/delete] catch')
        console.log(err)
    }
})


// -------------------------- 작성내역 ------------------------------

router.get('/history/write', check_login, async (req, res) => {
    try {
        const user = await db.collection('user').findOne({ _id: req.user._id })
        const guest_post = await db.collection('guest_post').find({ writer_id: user._id })
            .sort({
                writer_time: 1
            }).toArray()
        const bulletin_post = await db.collection('bulletin_post').find({ writer_id: user._id })
            .sort({
                writer_time: 1
            }).toArray()
        res.status(200).send({ success: true, guest_post: guest_post, bulletin_post: bulletin_post, message: '성공' })
        return
    } catch (err) {
        console.log('Router [/history/application] catch')
        console.log(err)
    }
})

module.exports = router




