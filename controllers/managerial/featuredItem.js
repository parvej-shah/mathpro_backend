const Controller = require('../base').Controller;
const FeaturedItemService = require('../../service/managerial/featuredItem').FeaturedItemService;
const ErrorHandler = require('../../util/errorHandler');

const featuredItemService = new FeaturedItemService();

class FeaturedItemController extends Controller {
    constructor() {
        super();
    }

    list = async (req, res) => {
        try {
            const result = await featuredItemService.listAdmin();
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in list:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    create = async (req, res) => {
        try {
            const result = await featuredItemService.create(req.body);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in create:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    update = async (req, res) => {
        try {
            const { itemType, itemId } = req.params;
            const parsedItemId = parseInt(itemId);
            if (isNaN(parsedItemId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    itemId: 'itemId must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            const result = await featuredItemService.update(itemType, parsedItemId, req.body);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in update:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    reorder = async (req, res) => {
        try {
            const { items } = req.body;
            const result = await featuredItemService.reorder(items);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in reorder:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    deleteEntry = async (req, res) => {
        try {
            const { itemType, itemId } = req.params;
            const parsedItemId = parseInt(itemId);
            if (isNaN(parsedItemId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    itemId: 'itemId must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            const result = await featuredItemService.deleteEntry(itemType, parsedItemId);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in deleteEntry:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };
}

module.exports = { FeaturedItemController };
