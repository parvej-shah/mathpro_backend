const managerialRegistration = require('./registration');
const managerialLogin = require('./login');
const requestOTP = require('./request_otp');
const forgotPassword = require('./forgot_password');
const resetPassword = require('./reset_password');
const getProfile = require('./get_profile');
const setProfile = require('./set_profile');

module.exports = {
    paths:{
        '/admin/auth/request-otp': {
            ...requestOTP
        },
        '/admin/auth/register':{
            ...managerialRegistration
        },
        '/admin/auth/login':{
            ...managerialLogin
        },
        '/admin/auth/forgot-password': {
            ...forgotPassword
        },
        '/admin/auth/reset-password': {
            ...resetPassword
        },
        '/admin/auth/getProfile':{
            ...getProfile
        },
        '/admin/auth/setProfile':{
            ...setProfile
        },
        // '/todos/{id}':{
        //     ...getTodo,
        //     ...updateTodo,
        //     ...deleteTodo
        // }
    }
}
