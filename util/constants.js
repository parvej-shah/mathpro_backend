/** System role name for super admin - non-deletable, non-modifiable; last holder cannot be removed or deleted */
const SUPER_ADMIN_ROLE_NAME = 'super_admin';

module.exports={
    SUPER_ADMIN_ROLE_NAME,
    managerialAccountTypes:{
        admin:1,
        moderator:2,
        regular:3
    },
    logNames:{
        couponSuccess:'COUPON_SUCCESS',
        coursePurchase:'COURSE_PERCHASE'
    }
}
