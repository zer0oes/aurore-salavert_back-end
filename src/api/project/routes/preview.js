'use strict';

module.exports = {
  routes: [{
    method: 'GET',
    path: '/project-preview',
    handler: 'project.preview',
    config: { auth: false }, // Access is restricted by the signed, expiring document token.
  }],
};
