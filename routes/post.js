
const router = require('express').Router()
const { log } = console;
const { ObjectId } = require('mongodb')
const { check_login, myrating_onteam, gusetpost_writercheck, bulletin_LikeComment_check } = require('./middleware.js')
const moment = require('moment');
require('moment/locale/ko');
let { connectDB, forTransaction } = require('./database.js')

let db
connectDB.then((client) => {
    db = client.db('baseball')

}).catch((err) => {
    console.log(err)
})
const session = forTransaction.startSession()

function dateTime_conversion(date, time) {
    try {
        return `${moment(date).locale('ko').format('M월 D일')}`;
    } catch (err) {
        log('function [ dateTime_conversion] catch')
        throw err
    }
}
function position_conversion(position) {
    try {
        const positionArr = ['내야수', '외야수', '포수', '투수']
        var answer;
        for (var i = 0; i < positionArr.length; i++) {
            if (position[i]) answer = positionArr[i]
        }
        return answer
    } catch (err) {
        log('function [ position_conversion] catch')
        throw err
    }
}

// ///////////////  게스트 모집 //////////////////

router.get('/guest/:id', async (req, res) => { // 끝
    // 게스트 모집 페이지 
    try {
        const req_params = await req.params.id;
        if (!ObjectId.isValid(req_params)) return res.status(200).send({ success: false, false_code: 4, message: 'id에 맞는 게시물데이터 없음 -> false_code : 5' })
        const user = await db.collection('user').findOne({ _id: new ObjectId(req.user?._id) })
        const post_data = await db.collection('guest_post').findOne({ _id: new ObjectId(req.params.id) })
        var check_write = await false;
        var check_apply = await 0;
        if (post_data?.writer_id.equals(user?._id)) check_write = await true // 게시자와 현재 접속자가 같은지 확인 
        const guest_data = await db.collection('guest')
            .findOne({ post_id: new ObjectId(post_data?._id), user_id: new ObjectId(user?._id), withdrawal: { $exists: false } })
        if (guest_data) check_apply = await !guest_data?.confirm ? 1 : 2; // 1은 신청대기 / 2는 신청확정
        const writer_data = await db.collection('user').findOne({ _id: new ObjectId(post_data?.writer_id) })
        res.status(200).send({ success: true, post_data: post_data, check_write: check_write, check_apply: check_apply, writer_nickname: writer_data.nickname })
        return
    } catch (err) {
        console.log('Router [guset/:id] catch')
        console.log(err)
    }
})

router.post('/joinguest/:id', check_login, async (req, res) => {
    try {
        const req_params = await req.params.id;
        const guest_post = await db.collection('guest_post').findOne({ _id: new ObjectId(req_params) })
        const user = await db.collection('user').findOne({ _id: new ObjectId(req.user._id) })
        const guest_write_id = await guest_post.writer_id
        const submit_position = await req.body.select
        if (guest_write_id.equals(user._id)) return res.status(200).send({ success: false, false_code: 5, message: '본인이 본인게시물 신청 안됨 -> false_code : 5' })
        var notificationTextUser_summary = await `[게스트] 신청이 완료되었습니다.`
        var notificationTextUser = await `[${dateTime_conversion(guest_post?.date)} 경기] 게스트 신청이 완료되었습니다.`
        var notificationTextTeam_summary = await `[게스트] 신청이 들어왔습니다.`
        var notificationTextTeam = await `[${dateTime_conversion(guest_post?.date)} 경기] 게스트 모집 신청이 들어왔습니다.`
        const work_for_db = await join_guest_transaction(user, guest_post, submit_position, [notificationTextUser_summary, notificationTextUser], [notificationTextTeam_summary, notificationTextTeam], session)

        if (work_for_db) {
            return res.status(200).send({ success: true, message: '신청완료' })
        } else {
            return res.status(200).send({ success: false, message: '뭔가 이상' })
        }
    } catch (err) {
        log('Router [/joinguset/:id] catch')
        log(err)
    }
})

async function join_guest_transaction(user, guest_post, submit_position, notificationUser, notificationTeam, session) {
    try {
        const transaction_result = await session.withTransaction(async () => {
            // . guset_post 에 신청인원 추가  취소
            // 1. guset 추가
            // 2. noti_post 추가
            // 3. noti_user 추가
            const work1 = await db.collection('guest').insertOne({
                post_id: new ObjectId(guest_post._id),
                user_id: new ObjectId(user._id),
                nickname: user.nickname,
                submit_position: submit_position,
                confirm: false,
                application_date: moment().format('YYYY-MM-DD HH:mm')
            }, { session })
            if (await !work1.acknowledged) {
                throw new Error('work1')
            }
            const work2 = await db.collection('notification_post')
                .insertOne({
                    recevie_id: new ObjectId(guest_post._id),
                    recevie_userid: new ObjectId(guest_post.writer_id),
                    send_id: new ObjectId(user._id),
                    major_category: 2,
                    sub_category: 1,
                    note: notificationTeam,
                    Notification_date: moment().format('YYYY-MM-DD HH:mm'),
                    confirm: false,
                    type: 'post'
                }, { session })
            if (await !work2.acknowledged) {
                throw new Error('work2')
            }
            const work3 = await db.collection('notification_user')
                .insertOne({
                    recevie_id: new ObjectId(user._id),
                    send_id: new ObjectId(guest_post._id),
                    major_category: 2,
                    sub_category: 1,
                    note: notificationUser,
                    Notification_date: moment().format('YYYY-MM-DD HH:mm'),
                    confirm: false,
                    type: 'user'
                }, { session })
            if (await !work3.acknowledged) {
                throw new Error('work3')
            }
        })
        return transaction_result;
    } catch (err) {
        console.log('function [ join_accept_transaction] catch')
        throw err
    }
}

///////////////////// 아래는 게스트 관리자 페이지 관련 //////////////////////

router.get('/guestadmin/:id', check_login, gusetpost_writercheck, async (req, res) => {
    try {
        const req_params = await req.params.id;
        const guest_post = await db.collection('guest_post').findOne({ _id: new ObjectId(req_params) })
        var undetermined_count = await [0, 0, 0, 0]
        var approval_count = await [0, 0, 0, 0]
        var recuitment_check = await [false, false, false, false] // 모집인원만큼 다 찼는지 확인
        const guest_undetermined = await db.collection('guest')
            .find({
                post_id: new ObjectId(req_params),
                confirm: false,
                approval: { $exists: false },
                withdrawal: { $exists: false }
            }).toArray()
        const guest_approval = await db.collection('guest')
            .find({
                post_id: new ObjectId(req_params),
                confirm: true,
                approval: { $exists: true },
                withdrawal: { $exists: false }
            }).toArray()

        for (var i = 0; i < guest_undetermined.length; i++) {
            for (var j = 0; j < guest_undetermined[i].submit_position.length; j++) {
                if (guest_undetermined[i].submit_position[j]) {
                    undetermined_count[j] = await undetermined_count[j] + 1
                }
            }
        }
        for (var i = 0; i < guest_approval.length; i++) {
            for (var j = 0; j < guest_approval[i].approval_postion.length; j++) {
                if (guest_approval[i].approval_postion[j]) {
                    approval_count[j] = await approval_count[j] + 1
                }
            }
        }
        for (var i = 0; i < guest_post.recruitment_fix.length; i++) {
            if (guest_post.recruitment_fix[i] === guest_post.recruitment[i]) {
                recuitment_check[i] = await true // 모집인원과 모집된인원이 맞다면 트루!
            } else if (guest_post.recruitment_fix[i] !== guest_post.recruitment[i]) {
                recuitment_check[i] = await false // 모집인원과 모집돤인원이 다르면 false
                // false 이면 아직 모집이 안됬다는 거임 , 
            }
        }
        const guest_count = await { undetermined_count: undetermined_count, approval_count: approval_count }
        return res.status(200).send({
            success: true,
            guest_undetermined: guest_undetermined,
            guest_approval: guest_approval,
            guest_post: guest_post,
            guest_count: guest_count,
            recuitment_check: recuitment_check
        })

    } catch (err) {
        log('Router [/guestadmin/:id] catch')
        log(err)
    }
})

router.post('/guestadmin/decision/join/:id', check_login, gusetpost_writercheck, async (req, res) => {
    try {
        const { decision, selectposition, guest_id } = await req.body
        const guest_data = await db.collection('guest').findOne({ _id: new ObjectId(guest_id) })
        const post_data = await db.collection('guest_post').findOne({ _id: new ObjectId(guest_data?.post_id) })
        const guset_data_recuitmentFix = await post_data?.recruitment_fix
        var notificationText_summary;
        var notificationText;
        var work_for_db;
        if (decision) {
            notificationText_summary = await `[게스트] 신청 건이 수락되었습니다.`
            notificationText = await `[${dateTime_conversion(post_data?.date)} 경기] 게스트 모집 신청 건이 수락되었습니다. [포지션 - ${position_conversion(selectposition)}]`
            for (var i = 0; i < selectposition.length; i++) {
                guset_data_recuitmentFix[i] = await selectposition[i] ? guset_data_recuitmentFix[i] + 1 : guset_data_recuitmentFix[i];
            }
        } else if (!decision) {
            notificationText_summary = await `[게스트] 신청 건이 거절되었습니다.`
            notificationText = await `[${dateTime_conversion(post_data?.date)} 경기] 게스트 모집 신청 건이 거절되었습니다. `
        }

        if (decision) {
            work_for_db = await guest_accept_transaction(guest_data, selectposition, guset_data_recuitmentFix, [notificationText_summary, notificationText], session)
        } else if (!decision) {
            work_for_db = await guest_reject_transaction(guest_data, [notificationText_summary, notificationText], session)
        }

        if (decision && work_for_db) {
            res.status(200).send({ success: true, message: '수락완료' })
        } else if (!decision && work_for_db) {
            res.status(200).send({ success: true, message: '거절완료' })
        }
        return
    } catch (err) {
        log('Router [/guestadmin/decision/join/:id] catch')
        log(err)
    }
})

router.post('/guestadmin/cancel/:id', check_login, gusetpost_writercheck, async (req, res) => {
    try {
        const { userData } = await req.body
        const guest_data = await db.collection('guest').findOne({ _id: new ObjectId(userData._id) })
        const post_data = await db.collection('guest_post').findOne({ _id: new ObjectId(userData.post_id) })
        var recruitment_cancal_fix = await post_data?.recruitment_fix
        var user_position_fix = await guest_data.approval_postion.findIndex((val) => val === true)
        await recruitment_cancal_fix[user_position_fix]--
        var notificationText_summary = await `[게스트] 수락된 신청 건이 모집자에 의해 취소되었습니다.`
        var notificationText = await `[${dateTime_conversion(post_data?.date)} 경기] 수락 된 게스트모집 신청 건이 모집자에 의해 취소되었습니다. `


        var work_for_db = await guest_cancel_admin_transaction(guest_data, recruitment_cancal_fix, [notificationText_summary, notificationText], session)


        if (work_for_db) return res.status(200).send({ success: true, message: '취소완료' })
        res.status(200).send({ success: false, message: '확인요망' })
        return
    } catch (err) {
        log('Router [/guestadmin/cancel/:id] catch')
        log(err)
    }
})

router.post('/guestadmin/end/:id', check_login, gusetpost_writercheck, async (req, res) => {
    try {
        const req_params = await req.params.id
        const post_data = await db.collection('guest_post').findOne({ _id: new ObjectId(req_params) })
        notificationText_summary = await `[게스트] 신청 건이 거절되었습니다.`
        notificationText = await `[${dateTime_conversion(post_data?.date)} 경기] 게스트 모집 신청 건이 거절되었습니다. `
        const guest_undetermined = await db.collection('guest')
            .find({
                post_id: new ObjectId(req_params),
                confirm: false,
                approval: { $exists: false },
                withdrawal: { $exists: false }
            }).toArray()

        var work_for_db = await guest_end_transaction(post_data, [notificationText_summary, notificationText], guest_undetermined, session)
        if (work_for_db) return res.status(200).send({ success: true, message: '모집종료 완료' })
        res.status(200).send({ success: false, message: '확인요망' })
        return
    } catch (err) {
        log('Router [/guestadmin/end/:id] catch')
        log(err)
    }
})


async function guest_accept_transaction(guest_data, selectposition, guset_data_recuitmentFix, notification, session) {
    try {
        const transaction_result = await session.withTransaction(async () => {
            // 1.guest - con 변경 , 
            // 1.guest - approval 추가 , join_date 추가 , position 추가 , 
            // 2. notif_user 보내기 
            // 3.guset-post 중 - fix에 추가 /
            const work1 = await db.collection('guest')
                .updateOne({ _id: new ObjectId(guest_data._id) },
                    {
                        $set: {
                            confirm: true,
                            join_date: moment().format('YYYY-MM-DD HH:mm'),
                            approval: true,
                            approval_postion: selectposition,
                        },
                    }, { session })
            if (await work1.modifiedCount !== 1) {
                throw new Error('work1')
            }
            const work2 = await db.collection('notification_user')
                .insertOne({
                    recevie_id: new ObjectId(guest_data.user_id),
                    send_id: new ObjectId(guest_data.post_id),
                    major_category: 2,
                    sub_category: 2,
                    note: notification,
                    Notification_date: moment().format('YYYY-MM-DD HH:mm'),
                    confirm: false,
                    type: 'user'
                }, { session })
            if (await !work2.acknowledged) {
                throw new Error('work2')
            }
            const work3 = await db.collection('guest_post')
                .updateOne({ _id: new ObjectId(guest_data.post_id) },
                    {
                        $set: {
                            recruitment_fix: guset_data_recuitmentFix
                        }
                    }
                )
            if (await work3.modifiedCount !== 1) {
                throw new Error('work3')
            }
        })
        return transaction_result;
    } catch (err) {
        console.log('function [ guest_accept_transaction] catch')
        throw err
    }
}

async function guest_reject_transaction(guest_data, notification, session) {
    try {
        const transaction_result = await session.withTransaction(async () => {
            // 1.guest - con 변경 , appli 제거 , summit 제거
            // 1.guest - withdrawal 추가 , withdrawal_reason 추가 , 
            // 2.guset-post 를 수정할까...? - 일단 안함
            // 3. notif_user 보내기 
            const work1 = await db.collection('guest')
                .updateOne({ _id: new ObjectId(guest_data._id) },
                    {
                        $set: {
                            confirm: true,
                            withdrawal: true,
                            withdrawal_reason: 1,
                        },
                        $unset: {
                            submit_position: ""
                        }
                    }, { session })
            if (await work1.modifiedCount !== 1) {
                throw new Error('work1')
            }
            const work2 = await db.collection('notification_user')
                .insertOne({
                    recevie_id: new ObjectId(guest_data.user_id),
                    send_id: new ObjectId(guest_data.post_id),
                    major_category: 2,
                    sub_category: 3,
                    note: notification,
                    Notification_date: moment().format('YYYY-MM-DD HH:mm'),
                    confirm: false,
                    type: 'user'
                }, { session })
            if (await !work2.acknowledged) {
                throw new Error('work2')
            }
        })
        return transaction_result;
    } catch (err) {
        console.log('function [guest_reject_transaction] catch')
        throw err
    }
}

async function guest_cancel_admin_transaction(guest_data, recruitment_cancal_fix, notification, session) {
    try {
        const transaction_result = await session.withTransaction(async () => {
            // 1.guest - app, app_posi, join_da 삭제
            // 2. notif_user 보내기 
            // 3.guset-post 중 - fix에 추가 /
            const work1 = await db.collection('guest')
                .updateOne({ _id: new ObjectId(guest_data._id) },
                    {
                        $set: {
                            confirm: true,
                            withdrawal: true,
                            withdrawal_reason: 3
                            // 3번은 모집자 취소 
                        },
                        $unset: {
                            approval: "",
                            approval_postion: "",
                            join_date: ""
                        }
                    }, { session })
            if (await work1.modifiedCount !== 1) {
                throw new Error('work1')
            }
            const work2 = await db.collection('notification_user')
                .insertOne({
                    recevie_id: new ObjectId(guest_data.user_id),
                    send_id: new ObjectId(guest_data.post_id),
                    major_category: 2,
                    sub_category: 5, // admin 취소 
                    note: notification,
                    Notification_date: moment().format('YYYY-MM-DD HH:mm'),
                    confirm: false,
                    type: 'user'
                }, { session })
            if (await !work2.acknowledged) {
                throw new Error('work2')
            }
            const work3 = await db.collection('guest_post')
                .updateOne({ _id: new ObjectId(guest_data.post_id) },
                    {
                        $set: {
                            recruitment_fix: recruitment_cancal_fix
                        }
                    }
                )
            if (await work3.modifiedCount !== 1) {
                throw new Error('work3')
            }
        })
        return transaction_result;
    } catch (err) {
        console.log('function [guest_reject_transaction] catch')
        throw err
    }
}

async function guest_end_transaction(post_data, notification, guest_undetermined, session) {
    try {
        const transaction_result = await session.withTransaction(async () => {
            // 1.guest - con 변경 , appli 제거 , summit 제거
            // 1.guest - withdrawal 추가 , withdrawal_reason 추가 , 
            // 2. notif_user 보내기 
            // 3.guset-post 를 end 추가 
            const work1 = await db.collection('guest')
                .updateMany({
                    post_id: new ObjectId(post_data._id),
                    confirm: false,
                    approval: { $exists: false },
                    withdrawal: { $exists: false }
                },
                    {
                        $set: {
                            confirm: true,
                            withdrawal: true,
                            withdrawal_reason: 1,
                        },
                        $unset: {
                            submit_position: ""
                        }
                    }, { session })
            if (await work1.modifiedCount !== guest_undetermined.length) {
                throw new Error('work1')
            }

            for (let user of guest_undetermined) {
                const work2 = await db.collection('notification_user')
                    .insertOne({
                        recevie_id: new ObjectId(user.user_id),
                        send_id: new ObjectId(user.post_id),
                        major_category: 2,
                        sub_category: 3,
                        note: notification,
                        Notification_date: moment().format('YYYY-MM-DD HH:mm'),
                        confirm: false,
                        type: 'user'
                    }, { session })
                if (await !work2.acknowledged) {
                    throw new Error('work2')
                }
            }
            const work3 = await db.collection('guest_post')
                .updateOne({ _id: new ObjectId(post_data._id) },
                    {
                        $set: {
                            end: true
                        }
                    }
                )
            if (await work3.modifiedCount !== 1) {
                throw new Error('work3')
            }
        })
        return transaction_result;
    } catch (err) {
        console.log('function [guest_end_transaction] catch')
        throw err
    }
}


//////////////////// 팀 POST /////////////////////////////

router.get('/team/:id', myrating_onteam, async (req, res) => {
    // 팀 포스트 페이지
    try {
        const req_params = req.params.id
        const team_data = await db.collection('team').findOne({ url: req_params })
        const data_conversion = await team_data_conversion(team_data);
        await res.status(200).send({ success: true, myrating: req.myrating, team_data: data_conversion })
        return
    } catch (err) {
        console.log('Router [team/:id] catch')
        console.log(err)
    }
})

router.get('/jointeam/:id', check_login, myrating_onteam, async (req, res) => {
    try {
        const user = await db.collection('user').findOne({ _id: new ObjectId(req.user._id) })
        if (req.myrating) return res.status(200).send({ success: false, false_code: 5, message: '이미 가입하셨습니다. -> false_code : 5' })
        if (!Object.values(user.team).includes(null)) return res.status(200).send({ success: false, false_code: 5, message: '더 이상 가입 하 실수 없습니다. -> false_code : 5' })
        const req_params = await req.params.id
        const team_data = await db.collection('team').findOne({ url: req_params })

        let user_team = await user.team
        if (user && user_team) {
            for (const key in user_team) {
                if (user_team[key] === null) {
                    user_team[key] = team_data._id;
                    break;
                }
            }
        }
        var notificationTextUser_summary = await `[팀] 가입 신청이 완료되었습니다.`
        var notificationTextUser = await `[ 팀 ${team_data.name}] 가입 신청이 완료되었습니다.`
        var notificationTextTeam_summary = await `[팀] 가입 신청이 들어왔습니다.`
        var notificationTextTeam = await `[ 팀 ${team_data.name}] 가입 신청이 들어왔습니다.`
        const work_for_db = await join_transaction(user, user_team, team_data, [notificationTextUser_summary, notificationTextUser], [notificationTextTeam_summary, notificationTextTeam], session)

        if (work_for_db) {
            res.status(200).send({ success: true, message: '가입이 완료되었습니다.' })
            return
        } else {
            res.status(200).send({ success: false, message: 'something err' })
            return
        }
        return
    } catch (err) {
        log('Router [/jointeam/:id] catch')
        res.status(500).send({ errMessage: err })
    }
})

async function join_transaction(user, user_team, team_data, notificationUser, notificationTeam, session) {
    try {
        const transaction_result = await session.withTransaction(async () => {
            // 1 - 신청 유저 document team 안에 데이터 넣기 (updataOne)
            // 2 - member collect에 추가 (insertOne)
            // 3 - team collect count (udataOne)
            const work1 = await db.collection('user').updateOne(
                { _id: new ObjectId(user._id) },
                {
                    $set: {
                        team: user_team
                    }
                }, { session })
            if (await work1.modifiedCount !== 1) {
                throw new Error('work1')
            }
            const work2 = await db.collection('member')
                .insertOne({
                    team_id: new ObjectId(team_data._id),
                    user_id: new ObjectId(user._id),
                    nickname: user.nickname,
                    join_date: "",
                    member_rating: 4,
                    confirm: false,
                    application_date: moment().format('YYYY-MM-DD HH:mm')
                }, { session })
            if (await !work2.acknowledged) {
                throw new Error('work2')
            }
            const work3 = await db.collection('team').updateOne(
                { _id: new ObjectId(team_data._id) },
                {
                    $inc: {
                        member_count: 1
                    }
                }, { session })
            if (await work3.modifiedCount !== 1) {
                throw new Error('work3')
            }
            const work4 = await db.collection('notification_post')
                .insertOne({
                    recevie_id: new ObjectId(team_data._id),
                    send_id: new ObjectId(user._id),
                    recevie_userid: new ObjectId(team_data.team_leader),
                    major_category: 1,
                    sub_category: 1,
                    note: notificationTeam,
                    Notification_date: moment().format('YYYY-MM-DD HH:mm'),
                    confirm: false,
                    type: 'post'
                }, { session })
            if (await !work4.acknowledged) {
                throw new Error('work4')
            }
            const work5 = await db.collection('notification_user')
                .insertOne({
                    recevie_id: new ObjectId(user._id),
                    send_id: new ObjectId(team_data._id),
                    major_category: 1,
                    sub_category: 1,
                    note: notificationUser,
                    Notification_date: moment().format('YYYY-MM-DD HH:mm'),
                    confirm: false,
                    type: 'user'
                }, { session })
            if (await !work5.acknowledged) {
                throw new Error('work5')
            }
        })
        return transaction_result;
    } catch (err) {
        console.log('function [team_transaction] catch')
        throw err
    }
}

///////////////////// 아래는 팀 관리자 페이지 관련 //////////////////////

router.get('/teamadmin/update/:id', myrating_onteam, async (req, res) => {
    // 팀 관리페이지 - 수정페이지(마운드)
    try {
        log(req.params.id)
        const req_params = req.params.id
        const team_data = await db.collection('team').findOne({ url: req_params })
        if (!team_data) {
            //  url 에 팀 데이터가 없는 경우
            res.status(200).send({ success: false, false_code: 4, message: 'url 해당되는 자료 없음 -> false_code : 4' })
            return
        }
        if (req.myrating !== 1) return res.status(200).send({ success: false, false_code: 5, message: '수정권한없음 -> false_code : 5' })
        await res.status(200).send({ success: true, team_data: team_data })
        return
    } catch (err) {
        console.log('Router [teamadmin/:id] catch')
        console.log(err)
    }
})

router.get('/teamadmin/member/:id', myrating_onteam, async (req, res) => {
    // 팀 관리페이지 - 수정페이지(마운드)
    try {
        const req_params = req.params.id
        const team_data = await db.collection('team').findOne({ url: req_params })
        if (!team_data) {
            //  url 에 팀 데이터가 없는 경우
            res.status(200).send({ success: false, false_code: 4, message: 'url 해당되는 자료 없음 -> false_code : 4' })
            return
        }
        if (req.myrating > 2) return res.status(200).send({ success: false, false_code: 5, message: '수정권한없음 -> false_code : 5' })
        const member_data = await db.collection('member').find({ team_id: new ObjectId(team_data._id), member_rating: { $exists: true } }).toArray()
        await res.status(200).send({ success: true, team_data: team_data, member_data: member_data })
        return
    } catch (err) {
        console.log('Router [teamadmin/:id] catch')
        console.log(err)
    }
})

router.post('/teamadmin/update/:id', myrating_onteam, async (req, res) => {
    // 팀 관리자 페이지 - 수정페이지(최종수정)
    try {
        if (req.myrating !== 1) return res.status(200).send({ success: false, false_code: 5, message: '권한없음 -> false_code : 5' })
        const req_params = await req.params.id
        const team_data = await db.collection('team').findOne({ url: req_params })
        if (team_data === null) return res.status(200).send({ success: false, false_code: 4, message: 'id에 맞는 데이터 없음 -> false_code : 4' })
        const updata_result = await db.collection('team').updateOne(
            { url: req_params }, {
            $set: {
                ...req.body,
                updata_date: moment().format('YYYY-MM-DD HH:mm')
            }
        })
        if (updata_result.modifiedCount === 1) return res.status(200).send({ success: true, message: '변경완료' })
        res.status(200).send({ success: false, false_code: 100, message: '확인해봐야함' })
        return
    } catch (err) {
        console.log('Router [teamadmin/update/:id] catch')
        console.log(err)
    }
})

router.post('/teamamin/member/decision/join/:id', myrating_onteam, async (req, res) => {
    try {
        if (req.myrating !== 1) return res.status(200).send({ success: false, false_code: 5, message: '권한없음 -> false_code : 5' })
        const { decision, user_id, member_id } = await req.body
        const req_params = req.params.id
        const join_user_data = await db.collection('user').findOne({ _id: new ObjectId(user_id) })
        const join_team_data = await db.collection('team').findOne({ url: req_params })
        if (!join_user_data) return res.status(200).send({ success: false, false_code: 4, message: '신청자 id가 user db에 없음 -> false_code : 5' })
        if (!join_team_data) return res.status(200).send({ success: false, false_code: 4, message: 'params id가 team db에 없음 -> false_code : 5' })
        const join_member_data = await db.collection('member').findOne({
            _id: new ObjectId(member_id),
            team_id: new ObjectId(join_team_data._id),
            user_id: new ObjectId(join_user_data._id)
            //  - check 
        })
        if (!join_member_data) return res.status(200).send({ success: false, false_code: 4, message: 'user/team/member 데이터가 일치 되는 게 없음. -> false_code : 5' })
        let user_team = await join_user_data.team
        if (join_user_data && user_team) {
            for (const key in user_team) {
                if (JSON.stringify(user_team[key]) === JSON.stringify(join_team_data._id)) {
                    user_team[key] = null
                    break;
                }
            }
        }
        var notificationText_summary;
        var notificationText;
        if (decision) {
            notificationText_summary = await `[팀] 가입 신청이 수락되었습니다.`
            notificationText = await `[ 팀 ${join_team_data.name}] 가입 신청이 수락되었습니다.`
        } else if (!decision) {
            notificationText_summary = await `[팀] 가입 신청이 거절되었습니다.`
            notificationText = await `[ 팀 ${join_team_data.name}] 가입 신청이 거절되었습니다.`
        }

        const session = await forTransaction.startSession()
        const work_for_db = decision ?
            await join_accept_transaction(join_member_data, [notificationText_summary, notificationText], session) :
            await join_reject_transaction(join_member_data, user_team, [notificationText_summary, notificationText], session);

        if (work_for_db && decision) {
            return res.status(200).send({ success: true, message: '수락완료' })
        } else if (work_for_db && !decision) {
            return res.status(200).send({ success: true, message: '거절완료' })
        }
        return res.status(200).send({ success: false, message: '뭔가이상' })
    } catch (err) {
        console.log('Router [/teamamin/member/decision/join] catch')
        console.log(err)
    }
})

router.post('/teamamin/member/decision/rating/:id', myrating_onteam, async (req, res) => {
    try {
        if (req.myrating !== 1) return res.status(200).send({ success: false, false_code: 5, message: '권한없음 -> false_code : 5' })
        const team_data = await db.collection('team').findOne({ _id: new ObjectId(req.body.team_id) })
        var notificationText_summary = await `[팀] 등급이 변경되었습니다.`
        var notificationText = await `[ 팀 ${team_data.name}] 등급이 변경되었습니다.`
        const session = await forTransaction.startSession()
        const work_for_db = await change_rating_transaction(req.body, [notificationText_summary, notificationText], session)

        if (work_for_db) {
            return res.status(200).send({ success: true, message: '변경이 완료되었습니다.' })
        }
        return res.status(200).send({ success: false, message: 'something err' })
    } catch (err) {
        console.log('Router [/teamamin/member/decision/rating] catch')
        console.log(err)
    }
})

router.post('/teamamin/member/decision/withdrawal/:id', myrating_onteam, async (req, res) => {
    try {
        if (req.myrating !== 1) return res.status(200).send({ success: false, false_code: 5, message: '권한없음 -> false_code : 5' })
        const { member_id, user_id, team_id } = await req.body
        const req_params = req.params.id
        const join_user_data = await db.collection('user').findOne({ _id: new ObjectId(user_id) })
        const join_team_data = await db.collection('team').findOne({ url: req_params })
        if (!join_user_data) return res.status(200).send({ success: false, false_code: 4, message: '신청자 id가 user db에 없음 -> false_code : 5' })
        if (!join_team_data) return res.status(200).send({ success: false, false_code: 4, message: 'params id가 team db에 없음 -> false_code : 5' })
        const join_member_data = await db.collection('member').findOne({
            _id: new ObjectId(member_id),
            team_id: new ObjectId(join_team_data._id),
            user_id: new ObjectId(join_user_data._id),
            member_rating: { $exists: true },
            withdrawal: { $exists: false }
        })
        if (!join_member_data) return res.status(200).send({ success: false, false_code: 4, message: 'user/team/member 데이터가 일치 되는 게 없음. -> false_code : 5' })
        let user_team = await join_user_data.team
        if (join_user_data && user_team) {
            for (const key in user_team) {
                if (JSON.stringify(user_team[key]) === JSON.stringify(join_team_data._id)) {
                    user_team[key] = null
                    break;
                }
            }
        }
        var notificationText_summary = await `[팀] 강제 탈퇴 되었습니다.`
        var notificationText = await `[ 팀 ${join_team_data.name}] 강제 탈퇴 되었습니다.`
        const session = await forTransaction.startSession()
        const work_for_db = await change_withdrawal_transaction(req.body, user_team, [notificationText_summary, notificationText], session)

        if (work_for_db) {
            return res.status(200).send({ success: true, message: '변경이 완료되었습니다.' })
        }
        return res.status(200).send({ success: false, message: 'something err' })
    } catch (err) {
        console.log('Router [/teamamin/member/decision/withdrawal] catch')
        console.log(err)
    }
})

router.post('/teamadmin/overlapping', async (req, res) => {
    // 팀 관리페이지 - 수정페이지(중복확인)
    try {
        const { check_text, type } = req.body
        var check_result;
        if (type === 1) {
            check_result = await db.collection('team').findOne({ name: check_text })
        } else if (type === 2) {
            check_result = await db.collection('team').findOne({ url: check_text })
        } else {
            await res.status(200).send({ success: false, false_code: 3, message: '잘못된데이터보냄 -> false_code : 3' })
            return
        }
        if (check_result === null) return await res.status(200).send({ success: true, check_result: true })

        await res.status(200).send({ success: false, false_code: 2, message: '중복데이터 -> false_code : 2' })
        return;
    } catch (err) {
        console.log('Router [teamadmin/overlapping] catch')
        console.log(err)
    }
})

async function team_data_conversion(team_data) {
    // age,level,day,sex,time이 boolean 순서에 따라 목록이 정해져있는데 가시화 하기 위한 작업
    var team_data = await team_data
    var day_T = await ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일']
    var time_T = await ['06시~10시 : 아침', "10시~18시 :  낮 ", '18시~24시 : 저녁', '24시~06시 : 심야']
    var age_T = await ['10대', '20대', '30대', '40대', '50대이상']
    var sex_T = await ['남성', '여성']
    var level_T = await ['사회인 4부', '사회인 3부', '사회인 2부', '사회인 1부', '취미 수준']
    team_data.day = await day_T.map((val, idx) => team_data.day[idx] ? val : undefined).filter(day => day)
    team_data.time = await time_T.map((val, idx) => team_data.time[idx] ? val : undefined).filter(time => time)
    team_data.age = await age_T.map((val, idx) => team_data.age[idx] ? val : undefined).filter(age => age)
    team_data.sex = await sex_T.map((val, idx) => team_data.sex[idx] ? val : undefined).filter(age => age)
    team_data.level = await level_T.map((val, idx) => team_data.level[idx] ? val : undefined).filter(age => age)

    return await team_data
}

async function join_accept_transaction(join_member_data, notificationText, session) {
    // 수락 시 
    try {
        const transaction_result = await session.withTransaction(async () => {
            // 1. member coll 안 rating 을 3으로 변경 / confirm true로 /
            // join_date 날짜 입력 / decision : accept 추가 / 신청날짜 삭제
            // 2. no~~_user 에 저장
            const work1 = await db.collection('member')
                .updateOne({ _id: new ObjectId(join_member_data._id) },
                    {
                        $set: {
                            member_rating: 3,
                            confirm: true,
                            join_date: moment().format('YYYY-MM-DD HH:mm'),
                        },
                        $unset: {
                            application_date: ""
                        }
                    }, { session })
            if (await work1.modifiedCount !== 1) {
                throw new Error('work1')
            }
            const work2 = await db.collection('notification_user')
                .insertOne({
                    recevie_id: new ObjectId(join_member_data.user_id),
                    send_id: new ObjectId(join_member_data.team_id),
                    major_category: 1,
                    sub_category: 2,
                    note: notificationText,
                    Notification_date: moment().format('YYYY-MM-DD HH:mm'),
                    confirm: false,
                    type: 'user'
                }, { session })
            if (await !work2.acknowledged) {
                throw new Error('work2')
            }
        })
        return transaction_result;
    } catch (err) {
        console.log('function [ join_accept_transaction] catch')
        throw err
    }
}

async function join_reject_transaction(join_member_data, user_team, notificationText, session) {
    // 거절 시
    try {
        const transaction_result = await session.withTransaction(async () => {
            // 1 team coll 에서 count 1제거
            // 2 user coll 에서 team 안에 해당 팀 빼기 
            // 3 member call 에서 confirm true 로 변경 / decision false 로 추가
            //   join_date 지우고 member_rating 지우기 
            // 4 알림 user
            const work1 = await db.collection('team').updateOne(
                { _id: new ObjectId(join_member_data.team_id) },
                {
                    $inc: {
                        member_count: -1
                    }
                }, { session })
            if (await work1.modifiedCount !== 1) {
                throw new Error('work1')
            }
            const work2 = await db.collection('user').updateOne(
                { _id: new ObjectId(join_member_data.user_id) },
                {
                    $set: { team: user_team }
                }, { session })
            if (await work2.modifiedCount !== 1) {
                throw new Error('work2')
            }
            const work3 = await db.collection('member')
                .updateOne({ _id: new ObjectId(join_member_data._id) },
                    {
                        $set: {
                            withdrawal: true,
                            withdrawal_reason: 1,
                        },
                        $unset: {
                            application_date: "",
                            join_date: "",
                            member_rating: "",
                            confirm: ""
                        }
                    }, { session })
            if (await work3.modifiedCount !== 1) {
                throw new Error('work3')
            }
            const work4 = await db.collection('notification_user')
                .insertOne({
                    recevie_id: new ObjectId(join_member_data.user_id),
                    send_id: new ObjectId(join_member_data.team_id),
                    major_category: 1,
                    sub_category: 3,
                    note: notificationText,
                    Notification_date: moment().format('YYYY-MM-DD HH:mm'),
                    confirm: false,
                    type: 'user'
                }, { session })
            if (await !work4.acknowledged) {
                throw new Error('work4')
            }
        })
        return transaction_result;
    } catch (err) {
        console.log('function [join_reject_transaction] catch')
        throw err
    }
}

async function change_rating_transaction(change_rating_data, notificationText, session) {
    // 등급 변경 시 
    const { member_id, user_id, team_id, change_rating } = await change_rating_data
    // 1 member 에서 등급 바꾸고 
    // 2 no _user 에게 알림보내기 
    try {
        const transaction_result = await session.withTransaction(async () => {
            const work1 = await db.collection('member')
                .updateOne(
                    {
                        _id: new ObjectId(member_id),
                        user_id: new ObjectId(user_id),
                        team_id: new ObjectId(team_id)
                    }, {
                    $set: {
                        member_rating: change_rating
                    }
                }, { session })
            if (await work1.modifiedCount !== 1) {
                throw new Error('work1')
            }
            const work2 = await db.collection('notification_user')
                .insertOne({
                    recevie_id: new ObjectId(user_id),
                    send_id: new ObjectId(team_id),
                    major_category: 1,
                    sub_category: 5,
                    note: notificationText,
                    Notification_date: moment().format('YYYY-MM-DD HH:mm'),
                    confirm: false,
                    type: 'user'
                }, { session })
            if (await !work2.acknowledged) {
                throw new Error('work2')
            }
        })
        return transaction_result;
    } catch (err) {
        console.log('function [join_reject_transaction] catch')
        throw err
    }
}

async function change_withdrawal_transaction(change_rating_data, user_team, notificationText, session) {
    // 등급 변경 시 
    const { member_id, user_id, team_id } = await change_rating_data
    // 1 member 수정(지우진 않음)
    // 2 team에서 카운트 내리고
    // 3 no _user 에게 알림보내기 
    // 4 user 에서 팀 변경
    try {
        const transaction_result = await session.withTransaction(async () => {
            const work1 = await db.collection('member')
                .updateOne(
                    {
                        _id: new ObjectId(member_id),
                        user_id: new ObjectId(user_id),
                        team_id: new ObjectId(team_id)
                    }, {
                    $set: {
                        withdrawal: true,
                        withdrawal_reason: 3,
                    },
                    $unset: {
                        application_date: "",
                        join_date: "",
                        member_rating: "",
                        confirm: "",
                        decision: "",
                        member_rating: ""
                    }
                }, { session })
            if (await work1.modifiedCount !== 1) {
                throw new Error('work1')
            }
            const work2 = await db.collection('team')
                .updateOne(
                    {
                        _id: new ObjectId(team_id)
                    }, {
                    $inc: {
                        member_count: -1
                    },
                }, { session })
            if (await work2.modifiedCount !== 1) {
                throw new Error('work2')
            }
            const work3 = await db.collection('notification_user')
                .insertOne({
                    recevie_id: new ObjectId(user_id),
                    send_id: new ObjectId(team_id),
                    major_category: 1,
                    sub_category: 6,
                    note: notificationText,
                    Notification_date: moment().format('YYYY-MM-DD HH:mm'),
                    confirm: false,
                    type: 'user'
                }, { session })
            if (await !work3.acknowledged) {
                throw new Error('work3')
            }
            const work4 = await db.collection('user').updateOne(
                { _id: new ObjectId(user_id), },
                {
                    $set: { team: user_team }
                }, { session })
            if (await work4.modifiedCount !== 1) {
                throw new Error('work4')
            }
        })
        return transaction_result;
    } catch (err) {
        console.log('function [join_reject_transaction] catch')
        throw err
    }
}



// //////////////////////// 자유게시물

router.get('/bulletin/:id', bulletin_LikeComment_check, async (req, res) => {
    // 게스트 모집 페이지 
    try {
        const req_params = req.params.id
        await db.collection('bulletin_post')
            .updateOne({ _id: new ObjectId(req_params) },
                {
                    $inc: { view: 1 },
                    $set: { like: req.like, comment: req.comment }
                })
        const post_data = await db.collection('bulletin_post').findOne({ _id: new ObjectId(req_params) })


        //  좋아요 했는지 안했는지 시작
        const user = await db.collection('user').findOne({ _id: new ObjectId(req.user?._id) })
        const useridtoString = await user?._id
        var bulletin_data;
        if (user) {
            bulletin_data = await db.collection('bulletin')
                .findOne({
                    post_id: new ObjectId(req_params),
                    [useridtoString]: { $exists: true }
                }, {
                    projection: {
                        _id: 0,
                        [useridtoString]: 1
                    }
                })
        }
        const userThisPostLike = await bulletin_data ? bulletin_data[useridtoString] : false
        const ThisPostCommentToArray = await db.collection('bulletin_comment')
            .find({ post_id: new ObjectId(req_params) })
            .sort({ writer_time: -1 })
            .toArray()
        //  끝
        res.status(200).send({ success: true, post_data: post_data, userThisPost: userThisPostLike, user: user?._id, comment: ThisPostCommentToArray })
        return
    } catch (err) {
        console.log('Router [bulletin/:id] catch')
        console.log(err)
    }
})

router.post('/bulletin/like/:id', check_login, async (req, res) => {
    try {
        const { userLike } = await req.body;
        const req_params = await req.params.id
        const user = await db.collection('user').findOne({ _id: new ObjectId(req.user._id) })
        const useridtoString = await user._id
        const bulletin_data = await db.collection('bulletin')
            .findOne({
                post_id: new ObjectId(req_params),
                [useridtoString]: { $exists: true }
            }, {
                projection: {
                    _id: 0,
                    [useridtoString]: 1
                }
            })

        if (bulletin_data) {
            console.log('bull 작동여부')
            await db.collection('bulletin')
                .updateOne({
                    post_id: new ObjectId(req_params)
                }, {
                    $set: {
                        [useridtoString]: userLike
                    }
                })
        }
        if (!bulletin_data) {
            console.log('!bull 작동여부')
            await db.collection('bulletin')
                .updateOne({
                    post_id: new ObjectId(req_params)
                }, {
                    $set: {
                        [useridtoString]: userLike
                    }
                })
        }
        return res.end()
    } catch (err) {
        console.log('Router [bulletin/like/:id] catch')
        console.log(err)
    }
})

router.post('/bulletin/comment/:id', check_login, async (req, res) => {
    try {
        const { comment } = await req.body
        const req_params = req.params.id
        const bulletinPostData = await db.collection('bulletin_post').findOne({ _id: new ObjectId(req_params) })
        const user = await db.collection('user').findOne({ _id: new ObjectId(req.user?._id) })
        await db.collection('bulletin_comment')
            .insertOne({
                post_id: new ObjectId(bulletinPostData._id),
                writer_id: new ObjectId(user._id),
                writer_nickname: user.nickname,
                writer_time: moment().format('YYYY-MM-DD HH:mm'),
                comment: comment,
            })
        const ThisPostCommentToArray = await db.collection('bulletin_comment')
            .find({ post_id: new ObjectId(bulletinPostData._id) })
            .sort({ writer_time: -1 })
            .toArray()
        return res.status(200).send({ success: true, comment: ThisPostCommentToArray, commentLength: ThisPostCommentToArray.length })
    } catch (err) {
        console.log('Router [bulletin/comment/:id] catch')
        console.log(err)
    }
})

router.post('/bulletin/delete/comment/:id', check_login, async (req, res) => {
    try {
        const { commentId } = await req.body
        const req_params = req.params.id
        const bulletinPostData = await db.collection('bulletin_post').findOne({ _id: new ObjectId(req_params) })
        const user = await db.collection('user').findOne({ _id: new ObjectId(req.user?._id) })
        await db.collection('bulletin_comment')
            .deleteOne({
                _id: new ObjectId(commentId),
                post_id: new ObjectId(bulletinPostData._id),
                writer_id: new ObjectId(user._id),
            })
        const ThisPostCommentToArray = await db.collection('bulletin_comment')
            .find({ post_id: new ObjectId(bulletinPostData._id) })
            .sort({ writer_time: -1 })
            .toArray()
        return res.status(200).send({ success: true, comment: ThisPostCommentToArray, commentLength: ThisPostCommentToArray.length })
    } catch (err) {
        console.log('Router [bulletin/comment/:id] catch')
        console.log(err)
    }
})



module.exports = router