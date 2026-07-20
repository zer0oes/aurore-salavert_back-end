'use strict';

const LOCAL_PUBLIC_READ_ACTIONS = [
  'api::project.project.find',
  'api::project.project.findOne',
  'api::category.category.find',
  'api::category.category.findOne',
  'api::layout.layout.find',
  'api::layout.layout.findOne',
  'api::skill.skill.find',
  'api::skill.skill.findOne',
  'api::showcase.showcase.find',
  'api::competence.competence.find',
  'api::service.service.find',
  'api::contact.contact.find',
  'api::slider-item.slider-item.find',
  'api::slider-item.slider-item.findOne',
  'api::social-network.social-network.find',
  'api::social-network.social-network.findOne',
  'api::privacy-policy.privacy-policy.find',
];

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    const roleRepository = strapi.db.query('plugin::users-permissions.role');
    const permissionRepository = strapi.db.query('plugin::users-permissions.permission');
    const publicRole = await roleRepository.findOne({
      where: { type: 'public' },
      populate: ['permissions'],
    });

    if (!publicRole) {
      strapi.log.warn('Local public role not found; public read permissions were not configured.');
      return;
    }

    const existingActions = new Set(publicRole.permissions.map(({ action }) => action));
    const missingActions = LOCAL_PUBLIC_READ_ACTIONS.filter(
      (action) => !existingActions.has(action)
    );

    await Promise.all(
      missingActions.map((action) =>
        permissionRepository.create({ data: { action, role: publicRole.id } })
      )
    );

    if (missingActions.length > 0) {
      strapi.log.info(`Enabled ${missingActions.length} local public read permissions.`);
    }
  },
};
