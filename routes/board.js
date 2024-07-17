
const router = require('express').Router()
let { connectDB } = require('./database.js')

let db
connectDB.then((client) => {
    db = client.db('baseball')

}).catch((err) => {
    console.log(err)
})

router.get('/guest_board', async (req, res) => {
    try {
        var post_data = await db.collection('guest_post')
            .find()
            .sort({
                end: 1,
                date: 1
            })
            .toArray()
        res.status(200).send({ success: true, post_data: post_data })
        return;
    } catch (err) {
        console.log('Router [guset] catch')
        return res.send({ success: false, message: err })
    }
})

router.get('/team_board', async (req, res) => {
    try {
        var post_data = await db.collection('team')
            .find()
            .toArray()
        res.status(200).send({ success: true, post_data: post_data })
        return
    } catch (err) {
        console.log('Router [team] catch')
        return res.send({ success: false, message: err })
    }
})

router.get('/bulletin_board', async (req, res) => {
    try {
        var post_data = await db.collection('bulletin_post')
            .find()
            .sort({
                no: -1,
                date: 1,
            })
            .toArray()
        res.status(200).send({ success: true, post_data: post_data })
        return
    } catch (err) {
        console.log('Router [bulletin] catch')
        return res.send({ success: false, message: err })
    }
})






module.exports = router