const Controller = require('../base').Controller;
const { respond } = require('../base');
const FeaturedItemService = require('../../service/managerial/featuredItem').FeaturedItemService;
const ErrorHandler = require('../../util/errorHandler');

const featuredItemService = new FeaturedItemService();

class FeaturedItemController extends Controller {
    constructor() {
        super();
    }

    list = async (req, res) => {
        const result = await featuredItemService.listAdmin();
        return respond(res, result);
    };

    create = async (req, res) => {
        const result = await featuredItemService.create(req.body);
        return respond(res, result);
    };

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

    reorder = async (req, res) => {
        const { items } = req.body;
        const result = await featuredItemService.reorder(items);
        return respond(res, result);
    };

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
