const Controller = require('../base').Controller;
const { respond, handle } = require('../base');
const FeaturedItemService = require('../../service/managerial/featuredItem').FeaturedItemService;
const ErrorHandler = require('../../util/errorHandler');

const featuredItemService = new FeaturedItemService();

class FeaturedItemController extends Controller {
    constructor() {
        super();
    }

    list = handle(() => featuredItemService.listAdmin());

    create = handle((req) => featuredItemService.create(req.body));

    update = async (req, res) => {
        const { itemType, itemId } = req.params;
        const parsedItemId = parseInt(itemId);
        if (isNaN(parsedItemId)) {
            throw ErrorHandler.validationError({
                itemId: 'itemId must be a valid number'
            });
        }

        const result = await featuredItemService.update(itemType, parsedItemId, req.body);
        return respond(res, result);
    };

    reorder = handle((req) => featuredItemService.reorder(req.body.items));

    deleteEntry = async (req, res) => {
        const { itemType, itemId } = req.params;
        const parsedItemId = parseInt(itemId);
        if (isNaN(parsedItemId)) {
            throw ErrorHandler.validationError({
                itemId: 'itemId must be a valid number'
            });
        }

        const result = await featuredItemService.deleteEntry(itemType, parsedItemId);
        return respond(res, result);
    };
}

module.exports = { FeaturedItemController };
