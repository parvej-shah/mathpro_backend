/**
 * Managerial routes for the merged course+bundle Featured rail.
 * Prefixed with /v2/admin/featured
 */

const router = require('express-promise-router')();
const FeaturedItemController = require('../../controllers/managerial/featuredItem').FeaturedItemController;
const { requireAnyPermission } = require('../../service/authMiddleWares');
const { PERMISSIONS } = require('../../util/permissions');
const { revalidateOnWrite } = require('../../util/revalidateFrontend');

const requireFeaturedManage = requireAnyPermission([
    PERMISSIONS.COURSE.MANAGE.ALL,
    PERMISSIONS.BUNDLE.MANAGE.ALL
]);

const featuredItemController = new FeaturedItemController();

router.use(revalidateOnWrite(['courses', 'combos']));

router.route('/')
    .get(requireFeaturedManage, featuredItemController.list)
    .post(requireFeaturedManage, featuredItemController.create);

router.route('/reorder')
    .post(requireFeaturedManage, featuredItemController.reorder);

router.route('/:itemType/:itemId')
    .put(requireFeaturedManage, featuredItemController.update)
    .delete(requireFeaturedManage, featuredItemController.deleteEntry);

module.exports = router;
