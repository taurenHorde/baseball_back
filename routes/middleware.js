let { connectDB } = require('./database.js')
const { ObjectId } = require('mongodb')

let db
connectDB.then((client) => {
    db = client.db('baseball')

}).catch((err) => {
    console.log(err)
})

async function check_login(req, res, next) { // 완료!
    if (req.user) {
        next()
        return
    } else {
        res.status(200).send({ success: false, false_code: 1, message: "로그인 안됨" })
        return
    }
}

async function myrating_onteam(req, res, next) { // 완료
    // url로 팀을 데이터를 받아온 후, 그 팀 안에서 내 등급 찾기
    // 여기에선 가입 팀 빈공간이 있는지 없는지는 체크 안함
    // 필요하다면 본 api 에서 체크해야함
    try {
        const req_params = await req.params.id
        const team_data = await db.collection('team').findOne({ url: req_params })
        if (!team_data) return res.status(200).send({ success: false, false_code: 4, message: 'url 해당되는 자료 없음 -> false_code : 4' })
        const user = await db.collection('user').findOne({ _id: new ObjectId(req.user?._id) })
        if (!user) return next(); // 비로그인일때
        const user_team_check = await Object.values(user.team).some(val => val?.equals(team_data?._id))
        if (!user_team_check) return next(); // 유저 콜렉션 확인 비가입자
        const member_check = await db.collection('member').findOne({
            team_id: new ObjectId(team_data._id),
            user_id: new ObjectId(user._id),
            member_rating: { $exists: true }
            // 하지만 가입신청했다가 본인 또는 관리자가 취소 하는 경우에도 데이터는 남아있기에
            // rating 이 있나 없나로 체크 (신청했다가 취소 또는 탈퇴 또는 강퇴이후는 rating이 지워짐)
        }) // 다시한번 user-member 서로다른 콜랙션 교차확인
        if (!member_check) return log('이 경우에는 user,member DB간 서로 데이터가 불일치 하는 경우 좆됬음')
        req.myrating = await member_check.member_rating
        return next();
    } catch (err) {
        console.log('middleware [myrating_onteam] catch')
        console.log(err)
    }
}

async function gusetpost_writercheck(req, res, next) { // 완료
    // 현재 게스트post 접속자가 게스트 모집 작성자인지.
    try {
        const req_params = await req.params.id;
        if (!ObjectId.isValid(req_params)) return res.status(200).send({ success: false, false_code: 4, message: 'id에 맞는 게시물데이터 없음 -> false_code : 5' })
        const guest_post = await db.collection('guest_post').findOne({ _id: new ObjectId(req_params) })
        const user = await db.collection('user').findOne({ _id: new ObjectId(req.user._id) })
        const guest_write_id = await guest_post?.writer_id
        if (!user) return res.status(200).send({ success: false, false_code: 1, message: '비로그인 -> false_code : 5' })
        if (!guest_post) return res.status(200).send({ success: false, false_code: 4, message: 'id에 맞는 게시물데이터 없음 -> false_code : 5' })
        if (!guest_write_id.equals(user._id)) return res.status(200).send({ success: false, false_code: 5, message: '권한없음 -> false_code : 5' })
        next()
        return
    } catch (err) {
        console.log('middleware [gusetpost_writercheck] catch')
        console.log(err)
    }
}

async function bulletin_LikeComment_check(req, res, next) { //완료 
    try {
        //  post 가 있는지 확인 
        const req_params = req.params.id
        if (!ObjectId.isValid(req_params)) return res.status(200).send({ success: false, false_code: 4, message: 'id에 맞는 게시물데이터 없음 -> false_code : 4' })
        const check_post = await db.collection('bulletin_post').findOne({ _id: new ObjectId(req_params) })
        if (!check_post) return res.status(200).send({ success: false, false_code: 4, message: 'id에 맞는 게시물데이터 없음 -> false_code : 4' })
        const thisPostLikeCount = await db.collection('bulletin').findOne({ post_id: new ObjectId(req_params) }, { projection: { _id: 0, post_id: 0 } })
        const values = await Object.values(thisPostLikeCount)
        let likeNum = 0;
        for (var i = 0; i < values.length; i++) {
            if (values[i]) likeNum++
        }
        const ThisPostCommentToArray = await db.collection('bulletin_comment')
            .find({ post_id: new ObjectId(req_params) })
            .sort({ writer_time: -1 })
            .toArray()

        req.comment = await ThisPostCommentToArray.length
        req.like = await likeNum;
        return next()
    } catch (err) {
        console.log('middleware [bulletin_LikeComment_check] catch')
        console.log(err)
    }
}

module.exports = { check_login, myrating_onteam, gusetpost_writercheck, bulletin_LikeComment_check };


 