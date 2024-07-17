
const Joi = require('joi')

const dateValidation = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required();
const timeValidation = Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required();
const dataTimeValidation = Joi.string().pattern(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/).required();
const teamNameValidation = Joi.string().pattern(/^[가-힣]{2,8}$/).required();
const teamUrlValidation = Joi.string().pattern(/^[a-z]+[a-z0-9]{2,10}$/).required();
const stadiumValidation = ['잠실야구장', '고척스카이돔', '랜더스필드', '이글스파크', '엔씨파크', '라이온즈파크', '사직구장', '챔피언스필드']
const sexValidation = ['남자', '여자', '남녀']
const levelValidation = ['취미', '4부', '3부', '2부', '1부']

function trueCheckValidation(array, helpers) {
    const trueCheck = array.includes(true);
    if (!trueCheck) return helpers.error('true가 하나이상 있어야합니다.')
    return array
}
// trueCheck arr 중 true 가 하나 이상 있는지 확인 // oneTrueCheck arr 중 true가 딱 하나 있는지 확인
function oneTrueCheckValidation(array, helpers) {
    const oneTrueCheck = array.filter(val => val === true).length
    if (oneTrueCheck !== 1) return helpers.error('true가 한 개가 아닙니다.')
    return array
}

const write_guest_validation = Joi.object({
    content: Joi.string().min(2).required(),
    date: dateValidation,
    time: timeValidation,
    stadium: Joi.string().valid(...stadiumValidation).required(),
    sex: Joi.string().valid(...sexValidation).required(),
    age: Joi.array().items(Joi.number().valid(10, 20, 30, 40, 50)).length(2)
        .custom((array, helpers) => {
            if (array[0] > array[1]) return helpers.error('age - max 가 min 보다 작다.')
            return array;
        }),
    level: Joi.string().valid(...levelValidation).required(),
    position: Joi.array().items(Joi.boolean().valid()).length(4).custom(trueCheckValidation),
    recruitment: Joi.array().items( // true인 포지션에 대해서 1이상 으로 해야할 꺼 같음
        Joi.number().valid(0, 1, 2, 3, 4),
        Joi.number().valid(0, 1, 2, 3, 4),
        Joi.number().valid(0, 1, 2),
        Joi.number().valid(0, 1, 2)
    ).length(4)
})

const write_team_validation = Joi.object({
    name: teamNameValidation,
    url: teamUrlValidation,
    day: Joi.array().items(Joi.boolean().valid()).length(7).custom(trueCheckValidation),
    time: Joi.array().items(Joi.boolean().valid()).length(4).custom(oneTrueCheckValidation),
    area: Joi.string().min(1).required(),
    stadium: Joi.string().min(1).required(),
    age: Joi.array().items(Joi.boolean().valid()).length(5).custom(trueCheckValidation),
    sex: Joi.array().items(Joi.boolean().valid()).length(3).custom(trueCheckValidation),
    level: Joi.array().items(Joi.boolean().valid()).length(5).custom(oneTrueCheckValidation)
})

const write_bulletin_validation = Joi.object({
    classification: Joi.number().valid(1, 2, 3),
    title: Joi.string().min(2).required(),
    content: Joi.string().min(2).required()
})

async function validation(inputData) {
    const typeofData = await [write_guest_validation, write_team_validation, write_bulletin_validation]
    const { data, typeNumber } = await inputData
    const { error, value } = await typeofData[typeNumber].validate(data)
    return { error, value }
}

module.exports = { validation };