const contactSubmit = require('./contact_submit');
const contactList = require('./contact_list');
const contactGet = require('./contact_get');
const contactUpdateStatus = require('./contact_update_status');

module.exports = {
    paths:{
        '/api/contact':{
            ...contactSubmit,
            ...contactList
        },
        '/api/contact/{id}':{
            ...contactGet
        },
        '/api/contact/{id}/status':{
            ...contactUpdateStatus
        }
    }
}

