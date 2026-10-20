'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::cookie-banner.cookie-banner', { only: ['find'] });
